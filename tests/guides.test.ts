import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  guide,
  hasGuideMeta,
  getGuideMeta,
  GuideType,
  GUIDE_META,
} from "../src/generation-guide.js";

describe("guide()", () => {
  it("attaches description to a Zod type", () => {
    const schema = guide(z.string(), "A person's name");
    expect(hasGuideMeta(schema)).toBe(true);
    const meta = getGuideMeta(schema)!;
    expect(meta.description).toBe("A person's name");
    expect(meta.constraints).toEqual({});
  });

  it("attaches anyOf constraint", () => {
    const schema = guide(z.string(), {
      anyOf: ["positive", "negative", "neutral"],
    });
    const meta = getGuideMeta(schema)!;
    expect(meta.constraints.anyOf).toEqual(["positive", "negative", "neutral"]);
  });

  it("attaches range constraint", () => {
    const schema = guide(z.number(), { range: [1.0, 5.0] });
    const meta = getGuideMeta(schema)!;
    expect(meta.constraints.range).toEqual([1.0, 5.0]);
  });

  it("attaches count constraint", () => {
    const schema = guide(z.array(z.string()), { count: 3 });
    const meta = getGuideMeta(schema)!;
    expect(meta.constraints.count).toBe(3);
  });

  it("attaches regex constraint", () => {
    const schema = guide(z.string(), { regex: "\\w+\\s\\w+" });
    const meta = getGuideMeta(schema)!;
    expect(meta.constraints.regex).toBe("\\w+\\s\\w+");
  });

  it("attaches minimum constraint", () => {
    const schema = guide(z.number(), { minimum: 0 });
    const meta = getGuideMeta(schema)!;
    expect(meta.constraints.minimum).toBe(0);
  });

  it("attaches maximum constraint", () => {
    const schema = guide(z.number(), { maximum: 100 });
    const meta = getGuideMeta(schema)!;
    expect(meta.constraints.maximum).toBe(100);
  });

  it("attaches minItems constraint", () => {
    const schema = guide(z.array(z.string()), { minItems: 2 });
    const meta = getGuideMeta(schema)!;
    expect(meta.constraints.minItems).toBe(2);
  });

  it("attaches maxItems constraint", () => {
    const schema = guide(z.array(z.string()), { maxItems: 10 });
    const meta = getGuideMeta(schema)!;
    expect(meta.constraints.maxItems).toBe(10);
  });

  it("attaches constant constraint", () => {
    const schema = guide(z.string(), { constant: "hello" });
    const meta = getGuideMeta(schema)!;
    expect(meta.constraints.constant).toBe("hello");
  });

  it("combines description with constraints", () => {
    const schema = guide(z.string(), {
      description: "Sentiment of the review",
      anyOf: ["positive", "negative"],
    });
    const meta = getGuideMeta(schema)!;
    expect(meta.description).toBe("Sentiment of the review");
    expect(meta.constraints.anyOf).toEqual(["positive", "negative"]);
  });

  it("hasGuideMeta returns false for plain Zod types", () => {
    expect(hasGuideMeta(z.string())).toBe(false);
    expect(hasGuideMeta(z.number())).toBe(false);
  });

  it("getGuideMeta returns undefined for plain Zod types", () => {
    expect(getGuideMeta(z.string())).toBeUndefined();
  });
});

describe("GuideType enum", () => {
  it("has expected values", () => {
    expect(GuideType.ANY_OF).toBe("anyOf");
    expect(GuideType.CONSTANT).toBe("constant");
    expect(GuideType.COUNT).toBe("count");
    expect(GuideType.ELEMENT).toBe("element");
    expect(GuideType.MAX_ITEMS).toBe("maxItems");
    expect(GuideType.MAXIMUM).toBe("maximum");
    expect(GuideType.MIN_ITEMS).toBe("minItems");
    expect(GuideType.MINIMUM).toBe("minimum");
    expect(GuideType.RANGE).toBe("range");
    expect(GuideType.REGEX).toBe("regex");
  });
});
