import { describe, expect, it } from "vitest";
import { parseAiJsonObject } from "@/lib/ai/parse-json";
import { AiGenerationError } from "@/lib/ai/client";

describe("parseAiJsonObject", () => {
  it("parses a plain JSON object", () => {
    expect(parseAiJsonObject('{"reply":"hi"}', "fail")).toEqual({ reply: "hi" });
  });

  it("extracts the object when the model wraps it in prose or a code fence", () => {
    const text = 'Sure! Here you go:\n```json\n{"reply":"hi","n":2}\n```\nHope that helps.';
    expect(parseAiJsonObject(text, "fail")).toEqual({ reply: "hi", n: 2 });
  });

  it("throws AiGenerationError with the caller's message on truncated JSON", () => {
    expect(() => parseAiJsonObject('{"faqDraft":"Q: where', "Try again.")).toThrow(AiGenerationError);
    expect(() => parseAiJsonObject('{"faqDraft":"Q: where', "Try again.")).toThrow("Try again.");
  });

  it("throws on a raw newline inside a string value (invalid JSON — the bug that broke FAQ generation)", () => {
    expect(() => parseAiJsonObject('{"faqDraft":"Q: a\nA: b"}', "bad")).toThrow(AiGenerationError);
  });

  it("throws when there is no JSON at all", () => {
    expect(() => parseAiJsonObject("I can't help with that.", "bad")).toThrow(AiGenerationError);
    expect(() => parseAiJsonObject("", "bad")).toThrow(AiGenerationError);
  });

  it("throws when the JSON is an array or a scalar rather than an object", () => {
    expect(() => parseAiJsonObject("[1,2,3]", "bad")).toThrow(AiGenerationError);
    expect(() => parseAiJsonObject("null", "bad")).toThrow(AiGenerationError);
  });
});
