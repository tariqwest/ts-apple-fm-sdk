/**
 * End-to-end tests based on the Python SDK examples.
 *
 * These tests mirror the examples in the `examples/` directory and exercise
 * the full SDK stack against the on-device model. They are skipped unless the
 * `FM_NATIVE` environment variable is set because they require macOS 26+ with
 * Apple Intelligence.
 */

import { describe, it, expect } from "vitest";

// E2E tests requiring the on-device model.
describe.skipIf(!process.env.FM_NATIVE)("Python SDK examples (e2e)", () => {
  it("simple inference: responds to a question and follows up", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const { LanguageModelSession } = await import("../src/session.js");

    const model = new SystemLanguageModel();
    const [available, reason] = model.isAvailable();
    expect(available).toBe(true);
    expect(reason).toBeUndefined();

    const session = new LanguageModelSession({
      instructions: "You are a helpful assistant that provides concise answers.",
    });

    const response = await session.respond("What is the capital of France?");
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);

    const followUp = await session.respond("What is its population?");
    expect(typeof followUp).toBe("string");
    expect(followUp.length).toBeGreaterThan(0);
  });

  it("streaming: yields a growing response", async () => {
    const { LanguageModelSession } = await import("../src/session.js");

    const session = new LanguageModelSession();
    const prompt = "Tell me a short story about a cat.";

    const deltas: string[] = [];
    let previous = "";
    for await (const snapshot of session.streamResponse(prompt)) {
      const delta = snapshot.slice(previous.length);
      expect(delta.length).toBeGreaterThanOrEqual(0);
      deltas.push(delta);
      previous = snapshot;
    }

    const fullResponse = previous;
    expect(deltas.length).toBeGreaterThan(0);
    expect(fullResponse.length).toBeGreaterThan(10);
    expect(deltas.join("")).toBe(fullResponse);
  });

  it("transcript processing: exports and analyzes a transcript", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { Transcript } = await import("../src/transcript.js");

    const session = new LanguageModelSession({
      instructions: "You are a helpful assistant.",
    });
    await session.respond("What is the capital of France?");
    await session.respond("What is its population?");

    const transcript = new Transcript(session.ptr);
    const dict = await transcript.toDict();

    expect(dict).toBeDefined();
    expect(typeof dict).toBe("object");
    expect(typeof dict.version).toBe("string");
    expect(dict.version).toMatch(/^1/);
    expect(dict.type).toBe("FoundationModels.Transcript");

    const entries = (dict.transcript as { entries?: unknown[] }).entries ?? [];
    expect(entries.length).toBeGreaterThan(0);

    const userEntries = entries.filter(
      (e: any) => e?.role === "user",
    );
    const responseEntries = entries.filter(
      (e: any) => e?.role === "response",
    );
    expect(userEntries.length).toBeGreaterThan(0);
    expect(responseEntries.length).toBeGreaterThan(0);
  });

  it("transcript processing: restores a transcript from a JSON dict", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { Transcript } = await import("../src/transcript.js");

    const session = new LanguageModelSession();
    await session.respond("Hello!");

    const originalTranscript = new Transcript(session.ptr);
    const dict = await originalTranscript.toDict();

    const restored = await Transcript.fromDict(dict);
    expect(restored).toBeDefined();
    expect(restored.sessionPtr).toBeTruthy();

    const restoredDict = await restored.toDict();
    const restoredEntries =
      (restoredDict.transcript as { entries?: unknown[] }).entries ?? [];
    const originalEntries =
      (dict.transcript as { entries?: unknown[] }).entries ?? [];
    expect(restoredEntries.length).toBe(originalEntries.length);
  });
});
