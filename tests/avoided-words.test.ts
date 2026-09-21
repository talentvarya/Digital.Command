import { describe, expect, it } from "vitest";
import { findAvoidedWords } from "@/lib/ai/generate-content";

describe("findAvoidedWords", () => {
  it("returns the client's words that appear, ignoring case", () => {
    expect(findAvoidedWords("Our CHEAP and Guaranteed chocolates", ["cheap", "guaranteed", "luxury"])).toEqual([
      "cheap",
      "guaranteed",
    ]);
  });

  it("matches multi-word phrases", () => {
    expect(findAvoidedWords("The best in India for gifts", ["best in india"])).toEqual(["best in india"]);
  });

  it("ignores blank entries in the avoid list", () => {
    expect(findAvoidedWords("anything at all", ["", "   "])).toEqual([]);
  });

  it("returns nothing when the caption is clean", () => {
    expect(findAvoidedWords("Handcrafted truffles for celebrations", ["cheap", "discount"])).toEqual([]);
  });
});
