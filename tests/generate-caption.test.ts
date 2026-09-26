import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/provider", () => ({ generateText: vi.fn() }));

import { generateText } from "@/lib/ai/provider";
import { buildUserPrompt, generateCaption, parseResponse } from "@/lib/ai/generate-content";

describe("parseResponse — the caption plus the picture idea", () => {
  it("reads the caption, hashtags and image idea", () => {
    const parsed = parseResponse('{"caption":"Fresh today!","hashtags":["choc","gift"],"image_idea":"A hand-made chocolate box on a wooden table, warm light"}');
    expect(parsed).toEqual({
      caption: "Fresh today!",
      hashtags: ["choc", "gift"],
      imageIdea: "A hand-made chocolate box on a wooden table, warm light",
    });
  });

  it("copes with a model that omits the idea, or sends something that isn't text", () => {
    expect(parseResponse('{"caption":"Hi","hashtags":[]}').imageIdea).toBeNull();
    expect(parseResponse('{"caption":"Hi","hashtags":[],"image_idea":42}').imageIdea).toBeNull();
    expect(parseResponse('{"caption":"Hi","hashtags":[],"image_idea":"   "}').imageIdea).toBeNull();
  });

  it("tidies and caps a long idea", () => {
    const parsed = parseResponse(JSON.stringify({ caption: "Hi", hashtags: [], image_idea: `a\n\n  b ${"x".repeat(1000)}` }));
    expect(parsed.imageIdea!.startsWith("a b ")).toBe(true);
    expect(parsed.imageIdea).toHaveLength(400);
  });

  it("finds the JSON inside surrounding chatter", () => {
    const parsed = parseResponse('Sure! Here you go: {"caption":"Hello","hashtags":["a"],"image_idea":"A sunny shop front"} Hope that helps.');
    expect(parsed).toMatchObject({ caption: "Hello", imageIdea: "A sunny shop front" });
  });

  it("falls back to plain text with no idea when the reply isn't JSON", () => {
    expect(parseResponse("  Just a caption, no JSON  ")).toEqual({ caption: "Just a caption, no JSON", hashtags: [], imageIdea: null });
  });
});

describe("generateCaption", () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue({
      text: '{"caption":"C","hashtags":["h"],"image_idea":"A picture idea"}',
      usage: { provider: "anthropic", model: "m", inputTokens: 1, outputTokens: 1 },
    } as never);
  });

  it("asks the model for an image idea in the reply format, in English, with no text or real people in it", async () => {
    const result = await generateCaption({ platform: "instagram", brandProfile: null });
    const { system } = vi.mocked(generateText).mock.calls[0][0];
    expect(system).toContain('"image_idea": string');
    expect(system).toMatch(/in English/);
    expect(system).toMatch(/no text, logos or brand names/);
    expect(system).toMatch(/no real people or celebrities/);
    expect(result).toMatchObject({ caption: "C", hashtags: ["h"], imageIdea: "A picture idea" });
  });

  it("tells the model which occasion a post is for, without inviting invented offers", async () => {
    await generateCaption({
      platform: "facebook",
      brandProfile: null,
      occasion: { name: "Diwali", date: "2026-11-08", angle: "The festival of lights." },
    });
    const { user } = vi.mocked(generateText).mock.calls[0][0];
    expect(user).toContain("This post is for Diwali (2026-11-08). Background: The festival of lights.");
    expect(user).toMatch(/warm, respectful greeting/);
    expect(user).toMatch(/Do not invent offers, prices, discounts, dates or deadlines/);
  });
});

describe("buildUserPrompt", () => {
  it("has nothing about an occasion unless one was chosen", () => {
    expect(buildUserPrompt({ platform: "instagram", brandProfile: null })).toBe("Write a caption for a instagram post.");
    expect(buildUserPrompt({ platform: "instagram", brandProfile: null, occasion: null })).not.toMatch(/This post is for/);
  });

  it("works when the occasion has no background line", () => {
    const prompt = buildUserPrompt({ platform: "facebook", brandProfile: null, occasion: { name: "Holi", date: "2027-03-22" } });
    expect(prompt).toContain("This post is for Holi (2027-03-22).");
    expect(prompt).not.toContain("Background:");
  });

  it("keeps the client's own direction alongside the occasion", () => {
    const prompt = buildUserPrompt({
      platform: "facebook",
      brandProfile: null,
      occasion: { name: "Holi", date: "2027-03-22" },
      clientSuggestion: "Mention our gujiya boxes",
    });
    expect(prompt).toContain("This post is for Holi");
    expect(prompt).toContain('follow it closely: "Mention our gujiya boxes"');
  });
});
