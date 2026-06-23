import { describe, it, expect } from "vitest";

// All token counting tests require native bindings
describe.skipIf(!process.env.FM_NATIVE)("Token counting (native)", () => {
  it("getContextSize returns a positive integer", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const size = model.getContextSize();
    expect(size).toBeGreaterThan(0);
    expect(Number.isInteger(size)).toBe(true);
  });

  // Token counting methods will be added to SystemLanguageModel
  // once the async callback FFI mechanism is implemented.
  // These tests document the expected API.

  it.todo("tokenCountForPrompt returns a positive integer");
  it.todo("tokenCountForPrompt is deterministic");
  it.todo("longer prompts have higher token counts");
  it.todo("tokenCountForInstructions returns a positive integer");
  it.todo("tokenCountForTools returns a positive integer");
  it.todo("tokenCountForSchema returns a positive integer");
  it.todo("tokenCountForTranscript returns a positive integer");
});
