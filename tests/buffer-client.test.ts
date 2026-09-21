import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BufferApiError, getBufferPostMetrics } from "@/lib/buffer/client";

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => vi.stubEnv("BUFFER_ACCESS_TOKEN", "buf-token"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getBufferPostMetrics", () => {
  it("sends the metrics query with the bearer token and the post id", async () => {
    const fetchMock = stubFetch({
      data: { post: { id: "p1", metrics: [{ type: "engagement", name: "reactions", value: 12, unit: null }], metricsUpdatedAt: "2026-09-21T00:00:00Z" } },
    });
    const result = await getBufferPostMetrics("p1");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer buf-token");
    const body = JSON.parse(init.body);
    expect(body.query).toContain("metrics { type name value unit }");
    expect(body.variables).toEqual({ id: "p1" });
    expect(result.metrics).toEqual([{ type: "engagement", name: "reactions", value: 12, unit: null }]);
  });

  it("explains a missing token instead of calling Buffer", async () => {
    vi.stubEnv("BUFFER_ACCESS_TOKEN", "");
    const fetchMock = stubFetch({});
    await expect(getBufferPostMetrics("p1")).rejects.toThrow("BUFFER_ACCESS_TOKEN is missing");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a rejected token as an authentication error", async () => {
    stubFetch({}, 401);
    await expect(getBufferPostMetrics("p1")).rejects.toThrow("Buffer authentication failed");
  });

  it("turns GraphQL-level errors into a BufferApiError", async () => {
    stubFetch({ errors: [{ message: "Post not found" }] });
    const err = await getBufferPostMetrics("p1").catch((e) => e);
    expect(err).toBeInstanceOf(BufferApiError);
    expect(err.message).toContain("Post not found");
  });
});
