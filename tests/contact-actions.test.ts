import { beforeEach, describe, expect, it, vi } from "vitest";

// A recording stand-in for the signed-in member's Supabase session: it answers
// each kind of query from `cfg` and remembers what was asked, so the tests can
// check what was written and that every write is limited to the member's own business.
interface Op {
  table: string;
  kind: "select" | "insert" | "upsert" | "update" | "delete";
  payload?: unknown;
  options?: Record<string, unknown>;
  filters: [string, unknown][];
}
interface Config {
  count: number;
  before: Record<string, unknown> | null;
  insertError: { code?: string; message: string } | null;
  upsertRows: unknown[];
  upsertError: { message: string } | null;
  writeError: { message: string } | null;
}
let ops: Op[];
let cfg: Config;
let audits: Record<string, unknown>[];

function from(table: string) {
  const op: Op = { table, kind: "select", filters: [] };
  ops.push(op);
  const answer = (mode: "single" | "maybeSingle" | "await") => {
    if (table === "organization_members") return { data: { org_id: "org-1" } };
    if (op.kind === "select") return op.options?.head ? { count: cfg.count, error: null } : { data: cfg.before };
    if (op.kind === "insert") return { data: { id: "new-1" }, error: cfg.insertError };
    if (op.kind === "upsert") return { data: cfg.upsertRows, error: cfg.upsertError };
    return { error: cfg.writeError };
  };
  const api: Record<string, unknown> = {
    select: (_cols?: string, options?: Record<string, unknown>) => {
      if (op.kind === "select") op.options = options;
      return api;
    },
    insert: (payload: unknown) => ((op.kind = "insert"), (op.payload = payload), api),
    upsert: (payload: unknown, options: Record<string, unknown>) => ((op.kind = "upsert"), (op.payload = payload), (op.options = options), api),
    update: (payload: unknown) => ((op.kind = "update"), (op.payload = payload), api),
    delete: () => ((op.kind = "delete"), api),
    eq: (column: string, value: unknown) => (op.filters.push([column, value]), api),
    single: async () => answer("single"),
    maybeSingle: async () => answer("maybeSingle"),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(answer("await")).then(resolve, reject),
  };
  return api;
}

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) }, from }),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: async (_s: unknown, params: Record<string, unknown>) => void audits.push(params) }));

import {
  addContactAction,
  deleteContactAction,
  importContactsAction,
  markMessagedAction,
  updateContactAction,
} from "@/app/app/contacts/actions";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const writes = (kind: Op["kind"]) => ops.filter((o) => o.table === "customer_contacts" && o.kind === kind);

beforeEach(() => {
  ops = [];
  audits = [];
  revalidatePath.mockClear();
  cfg = { count: 0, before: null, insertError: null, upsertRows: [], upsertError: null, writeError: null };
});

describe("addContactAction", () => {
  it("asks for a name and a usable number before writing anything", async () => {
    expect(await addContactAction({}, form({ name: "  ", phone: "9876543210" }))).toEqual({ error: "Enter the customer's name." });
    const bad = await addContactAction({}, form({ name: "Ravi", phone: "12345" }));
    expect(bad.error).toMatch(/country code/);
    expect(writes("insert")).toHaveLength(0);
  });

  it("saves the number as digits with the country code, tidied tags, and the member's own business", async () => {
    const result = await addContactAction(
      {},
      form({ name: "  Ravi   Sharma ", phone: "98765 43210", tags: "VIP, Wedding, vip", notes: "  Likes dark chocolate ", consent: "on", consentNote: "Asked in the shop", org_id: "someone-else" })
    );
    expect(result).toEqual({ message: "Ravi Sharma was added." });
    const [insert] = writes("insert");
    expect(insert.payload).toMatchObject({
      org_id: "org-1", // from the session, never from the form
      name: "Ravi Sharma",
      phone: "919876543210",
      tags: ["vip", "wedding"],
      notes: "Likes dark chocolate",
      consent: true,
      consent_note: "Asked in the shop",
      created_by: "user-1",
    });
    expect((insert.payload as { consent_at: string }).consent_at).toEqual(expect.any(String));
    expect(revalidatePath).toHaveBeenCalledWith("/app/contacts");
  });

  it("records no consent, and ignores a consent note, when the box isn't ticked", async () => {
    await addContactAction({}, form({ name: "Anita", phone: "9000011111", consentNote: "should be ignored" }));
    expect(writes("insert")[0].payload).toMatchObject({ consent: false, consent_at: null, consent_note: null });
  });

  it("says so when the number is already in the list", async () => {
    cfg.insertError = { code: "23505", message: "duplicate key value violates unique constraint" };
    expect(await addContactAction({}, form({ name: "Ravi", phone: "9876543210" }))).toEqual({ error: "That number is already in your list." });
    expect(audits).toHaveLength(0);
  });

  it("stops at the list size limit", async () => {
    cfg.count = 5000;
    const result = await addContactAction({}, form({ name: "Ravi", phone: "9876543210" }));
    expect(result.error).toMatch(/up to 5,000 customers/);
    expect(writes("insert")).toHaveLength(0);
  });

  it("keeps the customer's details out of the audit trail", async () => {
    await addContactAction({}, form({ name: "Ravi Sharma", phone: "9876543210", consent: "on" }));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ orgId: "org-1", actionType: "contact_added", newState: { consent: true } });
    expect(JSON.stringify(audits[0])).not.toMatch(/Ravi|9876543210/);
  });
});

describe("importContactsAction", () => {
  it("asks for a list first, and explains when nothing in it is usable", async () => {
    expect((await importContactsAction({}, form({ list: "   " }))).error).toMatch(/Paste your customers first/);
    const none = await importContactsAction({}, form({ list: "just some words\nand more" }));
    expect(none.error).toBe("No usable numbers found. Line 1: No phone number found on this line.");
    expect(writes("upsert")).toHaveLength(0);
  });

  it("adds new customers, skipping numbers already in the list without touching them", async () => {
    cfg.upsertRows = [{ id: "a" }, { id: "b" }];
    const result = await importContactsAction({}, form({ list: "Ravi, 9876543210\nAnita, 9000011111\nMeena, 9111122222", consent: "on" }));
    const [upsert] = writes("upsert");
    expect(upsert.options).toEqual({ onConflict: "org_id,phone", ignoreDuplicates: true });
    expect(upsert.payload).toEqual([
      expect.objectContaining({ org_id: "org-1", name: "Ravi", phone: "919876543210", consent: true, created_by: "user-1" }),
      expect.objectContaining({ name: "Anita", phone: "919000011111", consent: true }),
      expect.objectContaining({ name: "Meena", phone: "919111122222", consent: true }),
    ]);
    expect(result.message).toBe("Added 2 customers. 1 was already in your list.");
  });

  it("reports what couldn't be read, and repeated numbers", async () => {
    cfg.upsertRows = [{ id: "a" }];
    const result = await importContactsAction({}, form({ list: "Ravi, 9876543210\nRavi again, 9876543210\nno number here\nAnita, 12345678", consent: "on" }));
    expect(result.message).toContain("Added 1 customer.");
    expect(result.message).toContain("1 repeated number was skipped.");
    expect(result.message).toContain("2 lines couldn't be read (line 3, line 4).");
  });

  it("saves everyone without consent unless the box is ticked, and says what that means", async () => {
    cfg.upsertRows = [{ id: "a" }];
    const result = await importContactsAction({}, form({ list: "Ravi, 9876543210" }));
    expect((writes("upsert")[0].payload as { consent: boolean }[])[0]).toMatchObject({ consent: false, consent_at: null, consent_note: null });
    expect(result.message).toContain("saved without consent");
  });

  it("refuses an import that would take the list over its limit", async () => {
    cfg.count = 4999;
    const result = await importContactsAction({}, form({ list: "Ravi, 9876543210\nAnita, 9000011111" }));
    expect(result.error).toMatch(/would go over/);
    expect(writes("upsert")).toHaveLength(0);
  });

  it("logs only counts", async () => {
    cfg.upsertRows = [{ id: "a" }];
    await importContactsAction({}, form({ list: "Ravi Sharma, 9876543210", consent: "on" }));
    expect(audits[0]).toMatchObject({ actionType: "contacts_imported", newState: { added: 1, alreadyThere: 0, unreadable: 0, consent: true } });
    expect(JSON.stringify(audits[0])).not.toMatch(/Ravi|9876543210/);
  });
});

describe("updateContactAction", () => {
  it("stamps consent when it is first given, and only for the member's own customer", async () => {
    cfg.before = { consent: false, opted_out: false };
    expect(await updateContactAction({}, form({ id: "c1", name: "Ravi", consent: "on" }))).toEqual({ message: "Saved." });
    const [update] = writes("update");
    expect(update.filters).toEqual([
      ["id", "c1"],
      ["org_id", "org-1"],
    ]);
    expect(update.payload).toMatchObject({ name: "Ravi", consent: true, opted_out: false, opted_out_at: null });
    expect((update.payload as { consent_at: string }).consent_at).toEqual(expect.any(String));
  });

  it("keeps the original consent time when consent was already given", async () => {
    cfg.before = { consent: true, opted_out: false };
    await updateContactAction({}, form({ id: "c1", name: "Ravi", consent: "on" }));
    expect(writes("update")[0].payload).not.toHaveProperty("consent_at");
  });

  it("clears consent details when consent is withdrawn", async () => {
    cfg.before = { consent: true, opted_out: false };
    await updateContactAction({}, form({ id: "c1", name: "Ravi" }));
    expect(writes("update")[0].payload).toMatchObject({ consent: false, consent_at: null, consent_note: null });
  });

  it("records when a customer asks to stop, and forgets it when they change their mind", async () => {
    cfg.before = { consent: true, opted_out: false };
    await updateContactAction({}, form({ id: "c1", name: "Ravi", consent: "on", optedOut: "on" }));
    const stopped = writes("update")[0].payload as Record<string, unknown>;
    expect(stopped.opted_out).toBe(true);
    expect(stopped.opted_out_at).toEqual(expect.any(String));

    ops = [];
    cfg.before = { consent: true, opted_out: true };
    await updateContactAction({}, form({ id: "c1", name: "Ravi", consent: "on" }));
    expect(writes("update")[0].payload).toMatchObject({ opted_out: false, opted_out_at: null });
  });

  it("says not found for a customer that isn't in the member's business", async () => {
    cfg.before = null;
    expect(await updateContactAction({}, form({ id: "someone-elses", name: "Ravi" }))).toEqual({ error: "Customer not found." });
    expect(writes("update")).toHaveLength(0);
  });

  it("needs a name", async () => {
    expect(await updateContactAction({}, form({ id: "c1", name: " " }))).toEqual({ error: "Enter the customer's name." });
  });
});

describe("deleteContactAction / markMessagedAction", () => {
  it("removes a customer only from the member's own business", async () => {
    expect(await deleteContactAction({}, form({ id: "c1" }))).toEqual({});
    expect(writes("delete")[0].filters).toEqual([
      ["id", "c1"],
      ["org_id", "org-1"],
    ]);
    expect(audits[0]).toMatchObject({ actionType: "contact_deleted", target: "c1" });
  });

  it("notes a message only for a customer who agreed and hasn't asked to stop", async () => {
    expect(await markMessagedAction({}, form({ id: "c1" }))).toEqual({});
    const [update] = writes("update");
    expect(update.filters).toEqual([
      ["id", "c1"],
      ["org_id", "org-1"],
      ["consent", true],
      ["opted_out", false],
    ]);
    expect(update.payload).toEqual({ last_messaged_at: expect.any(String) });
    expect(audits).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a database error instead of hiding it", async () => {
    cfg.writeError = { message: "boom" };
    expect(await markMessagedAction({}, form({ id: "c1" }))).toEqual({ error: "boom" });
    expect(await deleteContactAction({}, form({ id: "c1" }))).toEqual({ error: "boom" });
  });
});
