import { describe, it, expect } from "vitest";
import { SimpleCalculatorTool, GetUserInfoTool } from "./helpers/tools.js";
import { Cat } from "./helpers/schemas.js";

describe.skipIf(!process.env.FM_NATIVE)("Token counting (native)", () => {
  it("getContextSize returns a positive integer", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const size = model.getContextSize();
    expect(size).toBeGreaterThan(0);
    expect(Number.isInteger(size)).toBe(true);
  });

  it("tokenCount returns a positive integer for a prompt", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const count = await model.tokenCount("Hello, world!");
    expect(count).toBeGreaterThan(0);
    expect(Number.isInteger(count)).toBe(true);
  });

  it("tokenCount is deterministic for the same prompt", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const prompt = "The quick brown fox jumps over the lazy dog.";
    const first = await model.tokenCount(prompt);
    const second = await model.tokenCount(prompt);
    expect(second).toBe(first);
  });

  it("longer prompts have higher token counts", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const short = await model.tokenCount("Hi");
    const long = await model.tokenCount(
      "This is a much longer prompt that should consume more tokens than a short one.",
    );
    expect(long).toBeGreaterThan(short);
  });

  it("tokenCountForInstructions returns a positive integer", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const count = await model.tokenCount(undefined, {
      instructions: "You are a helpful assistant.",
    });
    expect(count).toBeGreaterThan(0);
  });

  it("tokenCountForTools returns a positive integer", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const count = await model.tokenCount([new SimpleCalculatorTool()]);
    expect(count).toBeGreaterThan(0);
  });

  it("tokenCountForSchema returns a positive integer", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const count = await model.tokenCount(Cat.generationSchema());
    expect(count).toBeGreaterThan(0);
  });

  it("tokenCountForTranscript returns a positive integer", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const { LanguageModelSession } = await import("../src/session.js");
    const { Transcript } = await import("../src/transcript.js");

    const session = new LanguageModelSession();
    await session.respond("What is the capital of France?");

    const model = new SystemLanguageModel();
    const count = await model.tokenCount(new Transcript(session.ptr));
    expect(count).toBeGreaterThan(0);
  });

  it("rejects providing both value and instructions", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    await expect(
      model.tokenCount("Hello", { instructions: "You are helpful." }),
    ).rejects.toThrow(/not both/);
  });

  it("rejects when neither value nor instructions are provided", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    await expect(model.tokenCount()).rejects.toThrow(/requires either/);
  });

  it("more tools consume more tokens than a single tool", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const single = await model.tokenCount([new SimpleCalculatorTool()]);
    const multiple = await model.tokenCount([
      new SimpleCalculatorTool(),
      new GetUserInfoTool(),
    ]);
    expect(multiple).toBeGreaterThan(single);
  });
});