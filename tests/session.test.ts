import { describe, it, expect } from "vitest";

// Pure logic tests (no native required)
describe("LanguageModelSession types", () => {
  it("exports LanguageModelSession class", async () => {
    const mod = await import("../src/session.js");
    expect(mod.LanguageModelSession).toBeDefined();
  });
});

// Integration tests requiring native bindings
describe.skipIf(!process.env.FM_NATIVE)("LanguageModelSession (native)", () => {
  it("can be created with no arguments", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();
    expect(session).toBeDefined();
  });

  it("can be created with instructions", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession({
      instructions: "You are a helpful assistant.",
    });
    expect(session).toBeDefined();
  });

  it("can be created with custom model", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const session = new LanguageModelSession({ model });
    expect(session).toBeDefined();
  });

  it("can be created with instructions and model", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const session = new LanguageModelSession({
      instructions: "You are a tagging assistant.",
      model,
    });
    expect(session).toBeDefined();
  });

  it("isResponding returns false when idle", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();
    expect(session.isResponding).toBe(false);
  });

  it("respond returns a non-empty string", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();
    const response = await session.respond("What is the capital of France?");
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  });

  it("respond maintains multi-turn context", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();
    await session.respond("My name is Alice.");
    const response = await session.respond("What is my name?");
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  });

  it("respond with GenerationOptions", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { GenerationOptions, SamplingMode } = await import(
      "../src/generation-options.js"
    );
    const session = new LanguageModelSession();

    const response = await session.respond("Say hello.", {
      options: new GenerationOptions({
        temperature: 0.5,
        sampling: SamplingMode.greedy(),
        maximumResponseTokens: 100,
      }),
    });
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  });
});
