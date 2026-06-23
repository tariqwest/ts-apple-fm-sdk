import { describe, it, expect } from "vitest";

// Integration tests requiring native bindings
describe.skipIf(!process.env.FM_NATIVE)("Streaming responses (native)", () => {
  it("streamResponse yields chunks", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();

    const chunks: string[] = [];
    for await (const chunk of session.streamResponse("Tell me a short story about a cat")) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const fullResponse = chunks.join("");
    expect(fullResponse.length).toBeGreaterThan(10);
  });

  it("streamResponse maintains session context", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();

    // First stream
    const chunks1: string[] = [];
    for await (const chunk of session.streamResponse(
      "What are differences between Swift and Python?",
    )) {
      chunks1.push(chunk);
    }
    expect(chunks1.length).toBeGreaterThan(0);

    // Follow-up stream with context
    const chunks2: string[] = [];
    for await (const chunk of session.streamResponse("Show me an example")) {
      chunks2.push(chunk);
    }
    expect(chunks2.length).toBeGreaterThan(0);
  });

  it("streamResponse with GenerationOptions", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { GenerationOptions, SamplingMode } = await import(
      "../src/generation-options.js"
    );
    const session = new LanguageModelSession();

    const chunks: string[] = [];
    for await (const chunk of session.streamResponse(
      "Say hello in three words.",
      new GenerationOptions({
        temperature: 0.3,
        sampling: SamplingMode.greedy(),
        maximumResponseTokens: 50,
      }),
    )) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const fullResponse = chunks.join("");
    expect(fullResponse.length).toBeGreaterThan(0);
  });
});
