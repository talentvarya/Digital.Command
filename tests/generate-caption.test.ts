import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/provider", () => ({ generateText: vi.fn() }));

import { generateText } from "@/lib/ai/provider";
import { generateCaption, parseResponse } from "@/lib/ai/generate-content";

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
});
