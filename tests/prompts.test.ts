import { describe, it, expect } from "vitest";
import {
  Attachment,
  ImageAttachment,
  PromptError,
  ImagePromptError,
} from "../src/prompt.js";

describe("Prompt types", () => {
  it("ImageAttachment stores path and label", () => {
    const img = new ImageAttachment("/tmp/cat.png", "A cute cat");
    expect(img.path).toBe("/tmp/cat.png");
    expect(img.label).toBe("A cute cat");
  });

  it("ImageAttachment stores path without label", () => {
    const img = new ImageAttachment("/tmp/cat.png");
    expect(img.path).toBe("/tmp/cat.png");
    expect(img.label).toBeUndefined();
  });

  it("ImageAttachment is an Attachment", () => {
    const img = new ImageAttachment("/tmp/cat.png");
    expect(img).toBeInstanceOf(Attachment);
  });

  it("PromptError is an Error", () => {
    const err = new PromptError("bad prompt");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PromptError");
  });

  it("ImagePromptError extends PromptError", () => {
    const err = new ImagePromptError("bad image");
    expect(err).toBeInstanceOf(PromptError);
    expect(err.name).toBe("ImagePromptError");
  });
});

// Integration tests requiring native bindings
describe.skipIf(!process.env.FM_NATIVE)("Prompt composition (native)", () => {
  it("composes a simple text prompt", async () => {
    const { composePrompt } = await import("../src/prompt.js");
    const ptr = composePrompt("Hello, world!");
    expect(ptr).toBeTruthy();
  });

  it("composes a multi-component prompt", async () => {
    const { composePrompt } = await import("../src/prompt.js");
    const ptr = composePrompt(["What is this:", "A test"]);
    expect(ptr).toBeTruthy();
  });
});
