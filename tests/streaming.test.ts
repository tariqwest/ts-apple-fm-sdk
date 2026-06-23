import { describe, it, expect } from "vitest";

// Integration tests requiring native bindings
describe.skipIf(!process.env.FM_NATIVE)("Streaming responses (native)", () => {
  it("streamResponse yields chunks", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();

    const deltas: string[] = [];
    let previous = "";
    for await (const snapshot of session.streamResponse("Tell me a short story about a cat")) {
      const delta = snapshot.slice(previous.length);
      deltas.push(delta);
      previous = snapshot;
    }

    expect(deltas.length).toBeGreaterThan(0);
    expect(previous.length).toBeGreaterThan(10);
    expect(deltas.join("")).toBe(previous);
  });

  it("streamResponse maintains session context", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();

    // First stream
    let previous1 = "";
    for await (const snapshot of session.streamResponse(
      "What are differences between Swift and Python?",
    )) {
      previous1 = snapshot;
    }
    expect(previous1.length).toBeGreaterThan(0);

    // Follow-up stream with context
    let previous2 = "";
    for await (const snapshot of session.streamResponse("Show me an example")) {
      previous2 = snapshot;
    }
    expect(previous2.length).toBeGreaterThan(0);
  });

  it("streamResponse with GenerationOptions", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { GenerationOptions, SamplingMode } = await import(
      "../src/generation-options.js"
    );
    const session = new LanguageModelSession();

    const deltas: string[] = [];
    let previous = "";
    for await (const snapshot of session.streamResponse(
      "Say hello in three words.",
      new GenerationOptions({
        temperature: 0.3,
        sampling: SamplingMode.greedy(),
        maximumResponseTokens: 50,
      }),
    )) {
      const delta = snapshot.slice(previous.length);
      deltas.push(delta);
      previous = snapshot;
    }

    expect(deltas.length).toBeGreaterThan(0);
    expect(previous.length).toBeGreaterThan(0);
    expect(deltas.join("")).toBe(previous);
  });
});