// Buffer's GraphQL API (api.buffer.com), verified directly against
// developers.buffer.com at build time — see ARCHITECTURE.md for why this uses
// one shared personal API key (BUFFER_ACCESS_TOKEN) rather than per-org OAuth:
// Buffer's old third-party-OAuth REST API is closed to new developer
// registrations, and the new GraphQL API's beta only supports a personal key
// tied to one Buffer login.

const ENDPOINT = "https://api.buffer.com";

export class BufferApiError extends Error {}

async function bufferGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) {
    throw new BufferApiError("Buffer is not configured — BUFFER_ACCESS_TOKEN is missing.");
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new BufferApiError("Buffer authentication failed — check BUFFER_ACCESS_TOKEN.");
    }
    // Buffer returns a GraphQL-shaped {errors:[{message}]} body even on non-2xx
    // responses — parse it for a readable message instead of dumping the raw
    // response text, which can otherwise leak straight into the admin UI.
    const body = await res.json().catch(() => null);
    const message = body?.errors?.map((e: { message: string }) => e.message).join("; ");
    throw new BufferApiError(`Buffer API error: ${message ?? `HTTP ${res.status}`}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new BufferApiError(`Buffer API error: ${json.errors.map((e: { message: string }) => e.message).join("; ")}`);
  }

  return json.data as T;
}

export interface BufferChannel {
  id: string;
  name: string;
  service: string;
}

export async function listBufferChannels(): Promise<BufferChannel[]> {
  const orgData = await bufferGraphQL<{ account: { organizations: { id: string; name: string }[] } }>(
    `query GetOrganizations { account { organizations { id name } } }`
  );
  const organizationId = orgData.account.organizations[0]?.id;
  if (!organizationId) throw new BufferApiError("No Buffer organization found for this account.");

  const channelsData = await bufferGraphQL<{ channels: BufferChannel[] }>(
    `query GetChannels($organizationId: OrganizationId!) {
      channels(input: { organizationId: $organizationId }) { id name service }
    }`,
    { organizationId }
  );
  return channelsData.channels;
}

export interface CreateBufferPostParams {
  channelId: string;
  text: string;
  dueAt: string; // ISO 8601
  assetUrls: { type: "image" | "video"; url: string }[];
}

export interface BufferPost {
  id: string;
  text: string;
  dueAt: string | null;
}

export async function createBufferPost(params: CreateBufferPostParams): Promise<BufferPost> {
  const data = await bufferGraphQL<{
    createPost: { post?: BufferPost; message?: string; __typename: string };
  }>(
    `mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id text dueAt } }
        ... on MutationError { message }
      }
    }`,
    {
      input: {
        text: params.text,
        channelId: params.channelId,
        schedulingType: "automatic",
        mode: "customScheduled",
        dueAt: params.dueAt,
        assets: params.assetUrls.map((a) => ({ [a.type]: { url: a.url } })),
      },
    }
  );

  if (!data.createPost.post) {
    throw new BufferApiError(data.createPost.message ?? "Buffer rejected the post.");
  }
  return data.createPost.post;
}

export interface BufferPostStatus {
  id: string;
  status: string;
  sentAt: string | null;
  error: string | null;
}

export async function getBufferPostStatus(postId: string): Promise<BufferPostStatus> {
  const data = await bufferGraphQL<{ post: BufferPostStatus }>(
    `query GetPost($id: PostId!) { post(input: { id: $id }) { id status sentAt error } }`,
    { id: postId }
  );
  return data.post;
}

// Post-level engagement metrics — reactions/comments are the normalized
// baseline across every network; richer fields (impressions, reach,
// engagementRate, etc.) appear only when the specific network reports them,
// which is why this is a flat {type, name, value, unit} array rather than
// fixed columns. Query shape verified against developers.buffer.com's own
// "Get Post Metrics" example before writing this.
export interface BufferPostMetric {
  type: string;
  name: string;
  value: number;
  unit: string | null;
}

export interface BufferPostMetrics {
  id: string;
  metrics: BufferPostMetric[];
  metricsUpdatedAt: string | null;
}

export async function getBufferPostMetrics(postId: string): Promise<BufferPostMetrics> {
  const data = await bufferGraphQL<{ post: BufferPostMetrics }>(
    `query GetPostMetrics($id: PostId!) {
      post(input: { id: $id }) {
        id
        metrics { type name value unit }
        metricsUpdatedAt
      }
    }`,
    { id: postId }
  );
  return data.post;
}
