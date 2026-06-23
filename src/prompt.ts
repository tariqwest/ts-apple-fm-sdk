/**
 * Prompt types for composing model inputs.
 *
 * Mirrors the Python SDK's Prompt, Attachment, ImageAttachment, and
 * related types from prompt.py.
 */

import { getNativeBindings } from "./ffi/native.js";
import type { Pointer, FMComposedPrompt } from "./ffi/types.js";

// --- Errors ---

export class PromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptError";
  }
}

export class ImagePromptError extends PromptError {
  constructor(message: string) {
    super(message);
    this.name = "ImagePromptError";
  }
}

// --- Attachment types ---

/**
 * Abstract base class for prompt attachments.
 */
export abstract class Attachment {
  /** Add this attachment to a C composed prompt. */
  abstract addToComposedPrompt(composedPromptPtr: FMComposedPrompt): void;
}

/**
 * Image attachment for including images in prompts.
 */
export class ImageAttachment extends Attachment {
  readonly path: string;
  readonly label?: string;

  constructor(path: string, label?: string) {
    super();
    this.path = path;
    this.label = label;
  }

  addToComposedPrompt(composedPromptPtr: FMComposedPrompt): void {
    const native = getNativeBindings();
    const encoder = new TextEncoder();

    const pathBuf = encoder.encode(this.path + "\0");
    const pathPtr = Buffer.from(pathBuf) as unknown as Pointer;

    let labelPtr: Pointer | null = null;
    if (this.label) {
      const labelBuf = encoder.encode(this.label + "\0");
      labelPtr = Buffer.from(labelBuf) as unknown as Pointer;
    }

    // Allocate error out-param (4-byte int)
    const errorBuf = new Int32Array(1);
    const errorPtr = Buffer.from(errorBuf.buffer) as unknown as Pointer;

    const success = native.FMComposedPromptAddAttachment(
      composedPromptPtr,
      pathPtr,
      labelPtr,
      errorPtr,
    );

    if (!success) {
      const errorCode = errorBuf[0];
      switch (errorCode) {
        case 1:
          throw new ImagePromptError("Image attachments require macOS 27+");
        case 2:
          throw new ImagePromptError("Image attachments require SDK with macOS 27+ support");
        default:
          throw new ImagePromptError("Failed to add image attachment");
      }
    }
  }
}

// --- Prompt type aliases ---

/** A single component of a prompt: either text or an attachment. */
export type PromptComponent = string | Attachment;

/** A prompt: a single component or an array of components. */
export type Prompt = PromptComponent | PromptComponent[];

// --- Prompt composition helpers ---

/**
 * Compose a Prompt into a C FMComposedPrompt.
 *
 * Creates a new FMComposedPrompt via FFI and adds all text/attachment
 * components to it. The caller is responsible for releasing the returned
 * pointer via FMRelease.
 */
export function composePrompt(prompt: Prompt): FMComposedPrompt {
  const native = getNativeBindings();
  const composedPtr = native.FMComposedPromptInitialize();

  const components = Array.isArray(prompt) ? prompt : [prompt];

  for (const component of components) {
    if (typeof component === "string") {
      const encoder = new TextEncoder();
      const textBuf = encoder.encode(component + "\0");
      const textPtr = Buffer.from(textBuf) as unknown as Pointer;
      native.FMComposedPromptAddText(composedPtr, textPtr);
    } else if (component instanceof Attachment) {
      component.addToComposedPrompt(composedPtr);
    } else {
      throw new PromptError(
        `Invalid prompt component type: ${typeof component}`,
      );
    }
  }

  return composedPtr;
}
