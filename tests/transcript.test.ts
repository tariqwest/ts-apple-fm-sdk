import { describe, it, expect } from "vitest";

// Integration tests requiring native bindings
describe.skipIf(!process.env.FM_NATIVE)("Transcript (native)", () => {
  it("gets transcript from empty session", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();

    const { Transcript } = await import("../src/transcript.js");
    const transcript = new Transcript(session.ptr);
    const dict = await transcript.toDict();
    expect(dict).toBeDefined();
    expect(typeof dict).toBe("object");
  });

  it("gets transcript after interaction", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();
    await session.respond("Hello!");

    const { Transcript } = await import("../src/transcript.js");
    const transcript = new Transcript(session.ptr);
    const dict = await transcript.toDict();
    expect(dict).toBeDefined();
    expect(typeof dict).toBe("object");
  });

  it("gets transcript after multiple turns", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession();
    await session.respond("My name is Alice.");
    await session.respond("What is my name?");

    const { Transcript } = await import("../src/transcript.js");
    const transcript = new Transcript(session.ptr);
    const dict = await transcript.toDict();
    expect(dict).toBeDefined();
  });

  it("gets transcript with instructions", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const session = new LanguageModelSession({
      instructions: "You are a helpful assistant.",
    });
    await session.respond("Hello!");

    const { Transcript } = await import("../src/transcript.js");
    const transcript = new Transcript(session.ptr);
    const dict = await transcript.toDict();
    expect(dict).toBeDefined();
  });

  it("creates transcript from JSON dict", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const { Transcript } = await import("../src/transcript.js");

    // First get a transcript from a session
    const session = new LanguageModelSession();
    await session.respond("Hello!");
    const originalTranscript = new Transcript(session.ptr);
    const dict = await originalTranscript.toDict();

    // Then recreate from the JSON
    const restoredTranscript = await Transcript.fromDict(dict);
    expect(restoredTranscript).toBeDefined();
    expect(restoredTranscript.sessionPtr).toBeTruthy();
  });
});
