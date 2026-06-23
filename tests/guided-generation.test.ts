import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generable, GeneratedContent, GenerationID } from "../src/generable.js";
import { guide } from "../src/generation-guide.js";

describe("GenerationID", () => {
  it("generates a UUID by default", () => {
    const id = new GenerationID();
    expect(id.value).toBeTruthy();
    expect(id.value.length).toBeGreaterThan(0);
  });

  it("accepts a custom value", () => {
    const id = new GenerationID("custom-id");
    expect(id.value).toBe("custom-id");
    expect(id.toString()).toBe("custom-id");
  });
});

describe("GeneratedContent", () => {
  it("creates from a content dict", () => {
    const content = new GeneratedContent({ name: "Whiskers", age: 3 });
    expect(content.value<string>("name")).toBe("Whiskers");
    expect(content.value<number>("age")).toBe(3);
  });

  it("creates from JSON string", () => {
    const content = GeneratedContent.fromJSON('{"name":"Luna","age":5}');
    expect(content.value<string>("name")).toBe("Luna");
    expect(content.value<number>("age")).toBe(5);
  });

  it("serializes to JSON", () => {
    const content = new GeneratedContent({ name: "Whiskers", age: 3 });
    const json = content.toJSON();
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("Whiskers");
    expect(parsed.age).toBe(3);
  });

  it("contentDict returns a copy", () => {
    const content = new GeneratedContent({ name: "Whiskers" });
    const dict = content.contentDict;
    dict.name = "modified";
    expect(content.value<string>("name")).toBe("Whiskers");
  });

  it("isComplete returns true for non-native content", () => {
    const content = new GeneratedContent({ name: "Whiskers" });
    expect(content.isComplete).toBe(true);
  });
});

describe("generable()", () => {
  it("creates a GenerableSchema from a Zod object", () => {
    const CatSchema = generable(
      z.object({
        name: z.string(),
        age: z.number().int(),
      }),
      "Cat",
    );

    expect(CatSchema.name).toBe("Cat");
    expect(CatSchema.description).toBe("Cat");
    expect(CatSchema.zodSchema).toBeDefined();
  });

  it("parses GeneratedContent into typed result", () => {
    const CatSchema = generable(
      z.object({
        name: z.string(),
        age: z.number().int(),
      }),
      "Cat",
    );

    const content = new GeneratedContent({ name: "Luna", age: 3 });
    const cat = CatSchema.parse(content);
    expect(cat.name).toBe("Luna");
    expect(cat.age).toBe(3);
  });

  it("parse rejects invalid content", () => {
    const CatSchema = generable(
      z.object({
        name: z.string(),
        age: z.number().int(),
      }),
      "Cat",
    );

    const content = new GeneratedContent({ name: 123, age: "not a number" });
    expect(() => CatSchema.parse(content)).toThrow();
  });

  it("works with guide-annotated fields", () => {
    const ReviewSchema = generable(
      z.object({
        sentiment: guide(z.string(), {
          anyOf: ["positive", "negative", "neutral"],
        }),
        rating: guide(z.number(), { range: [1.0, 5.0] }),
        keywords: guide(z.array(z.string()), { count: 3 }),
      }),
      "Product review analysis",
    );

    expect(ReviewSchema.name).toBe("Product review analysis");

    const content = new GeneratedContent({
      sentiment: "positive",
      rating: 4.5,
      keywords: ["quality", "value", "design"],
    });
    const result = ReviewSchema.parse(content);
    expect(result.sentiment).toBe("positive");
    expect(result.rating).toBe(4.5);
    expect(result.keywords).toEqual(["quality", "value", "design"]);
  });
});

// Integration tests that require native bindings
describe.skipIf(!process.env.FM_NATIVE)("Guided generation (native)", () => {
  it("generates a simple schema response", async () => {
    const { LanguageModelSession } = await import("../src/session.js");

    const CatSchema = generable(
      z.object({
        name: z.string(),
        age: z.number().int(),
      }),
      "Cat",
    );

    const session = new LanguageModelSession();
    const response = await session.respond("Generate a cat named Whiskers", {
      generating: CatSchema.generationSchema(),
    });
    expect(response).toBeDefined();
  });

  it("generates with anyOf guide", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { ProductAnyOfGuide } = await import("./helpers/schemas.js");

    const session = new LanguageModelSession();
    const response = await session.respond(
      "Classify this product: A high-end laptop",
      { generating: ProductAnyOfGuide.generationSchema() },
    );
    expect(response).toBeDefined();
  });

  it("generates with range guide", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { ProductRangeGuide } = await import("./helpers/schemas.js");

    const session = new LanguageModelSession();
    const response = await session.respond("Rate this product: A budget phone", {
      generating: ProductRangeGuide.generationSchema(),
    });
    expect(response).toBeDefined();
  });

  it("generates with count guide", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { ProductCountGuide } = await import("./helpers/schemas.js");

    const session = new LanguageModelSession();
    const response = await session.respond(
      "List features and tags for a smartwatch",
      { generating: ProductCountGuide.generationSchema() },
    );
    expect(response).toBeDefined();
  });
});
