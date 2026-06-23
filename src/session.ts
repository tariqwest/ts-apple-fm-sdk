/**
 * LanguageModelSession — manages conversation context and model interactions.
 *
 * Mirrors the Python SDK's `LanguageModelSession` class and the Swift
 * `FoundationModels.LanguageModelSession`.
 */

import { ManagedObject } from "./ffi/managed-object.js";
import { getNativeBindings } from "./ffi/native.js";
import type { Pointer, FMComposedPrompt } from "./ffi/types.js";
import { SystemLanguageModel } from "./core.js";
import { composePrompt, type Prompt } from "./prompt.js";
import { type GenerationOptions } from "./generation-options.js";
import { statusCodeToError, GenerationErrorCode } from "./errors.js";
import type { GenerationSchema } from "./generation-schema.js";
import type { GeneratedContent } from "./generable.js";
import type { Tool } from "./tool.js";
import type { Transcript } from "./transcript.js";

// --- Options ---

export interface LanguageModelSessionOptions {
  instructions?: string;
  model?: SystemLanguageModel;
  tools?: Tool[];
}

export interface RespondOptions {
  options?: GenerationOptions;
  generating?: GenerationSchema;
}

// --- Class ---

export class LanguageModelSession extends ManagedObject {
  private _requestLock = false;

  constructor(options?: LanguageModelSessionOptions) {
    const native = getNativeBindings();
    const encoder = new TextEncoder();

    // Encode instructions
    let instructionsPtr: Pointer | null = null;
    if (options?.instructions) {
      instructionsPtr = Buffer.from(
        encoder.encode(options.instructions + "\0"),
      ) as unknown as Pointer;
    }

    // Build tools array pointer
    let toolsPtr: Pointer | null = null;
    const toolCount = options?.tools?.length ?? 0;
    // TODO: Convert Tool[] to FMBridgedToolRef* array
    // For now, tools require Phase 5 implementation

    const modelPtr = options?.model?.ptr ?? null;

    const ptr = native.FMLanguageModelSessionCreateFromSystemLanguageModel(
      modelPtr,
      instructionsPtr,
      toolsPtr,
      toolCount,
    );

    super(ptr);
  }

  /** Whether a request is currently in progress. */
  get isResponding(): boolean {
    const native = getNativeBindings();
    return native.FMLanguageModelSessionIsResponding(this.ptr);
  }

  /** Reset the session, clearing conversation history. */
  reset(): void {
    const native = getNativeBindings();
    native.FMLanguageModelSessionReset(this.ptr);
  }

  /**
   * Generate a text response to a prompt.
   *
   * Overloads:
   * - `respond(prompt)` → `string`
   * - `respond(prompt, { generating })` → `GeneratedContent` (structured)
   */
  async respond(prompt: Prompt, opts?: RespondOptions): Promise<string> {
    if (this._requestLock) {
      throw new Error("Session already has an active request");
    }
    this._requestLock = true;

    try {
      const composedPrompt = composePrompt(prompt);
      const native = getNativeBindings();

      // Serialize options
      let optionsJSON: Pointer | null = null;
      if (opts?.options) {
        const json = JSON.stringify(opts.options.toJSON());
        optionsJSON = Buffer.from(
          new TextEncoder().encode(json + "\0"),
        ) as unknown as Pointer;
      }

      // If generating a schema, use structured response
      if (opts?.generating) {
        return this._respondStructured(composedPrompt, opts.generating, optionsJSON);
      }

      // Plain text response via callback
      return await this._respondText(composedPrompt, optionsJSON);
    } finally {
      this._requestLock = false;
    }
  }

  /** Internal: plain text respond using FMLanguageModelSessionRespond. */
  private _respondText(
    composedPrompt: FMComposedPrompt,
    optionsJSON: Pointer | null,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const native = getNativeBindings();

      // The C callback accumulates content and signals completion with content=NULL
      let accumulated = "";
      let completed = false;

      // Create callback function
      const callback = (
        status: number,
        contentPtr: Pointer | null,
        length: number,
        _userInfo: Pointer | null,
      ) => {
        if (completed) return;

        if (status !== 0) {
          completed = true;
          reject(statusCodeToError(status));
          return;
        }

        if (contentPtr === null || contentPtr === 0) {
          // Completion signal
          completed = true;
          resolve(accumulated);
          return;
        }

        // Read the accumulated string from the pointer
        // The content pointer contains the full accumulated response
        try {
          const cString = Buffer.from(
            (contentPtr as any) as ArrayBuffer,
            0,
            length,
          ).toString("utf-8");
          accumulated = cString;
        } catch {
          // Fallback: just use length
          accumulated = `[response: ${length} bytes]`;
        }
      };

      // NOTE: The actual FFI callback mechanism requires Bun-specific
      // JSCallback creation. This is a structural placeholder that will
      // be refined when testing against the native library.
      const taskRef = native.FMLanguageModelSessionRespond(
        this.ptr,
        composedPrompt,
        optionsJSON,
        null, // userInfo
        callback as unknown as Pointer, // Will be JSCallback in actual Bun FFI
      );

      // Store task ref for potential cancellation
      // taskRef will be released by the callback completion
    });
  }

  /** Internal: structured respond using FMLanguageModelSessionRespondWithSchema. */
  private async _respondStructured(
    _composedPrompt: FMComposedPrompt,
    _schema: GenerationSchema,
    _optionsJSON: Pointer | null,
  ): Promise<string> {
    // TODO: Implement in Phase 4 (Guided Generation)
    throw new Error("Structured generation not yet implemented");
  }

  /**
   * Stream a response as an async iterable of text chunks.
   */
  async *streamResponse(
    prompt: Prompt,
    options?: GenerationOptions,
  ): AsyncIterableIterator<string> {
    if (this._requestLock) {
      throw new Error("Session already has an active request");
    }
    this._requestLock = true;

    try {
      const composedPrompt = composePrompt(prompt);
      const native = getNativeBindings();

      // Serialize options
      let optionsJSON: Pointer | null = null;
      if (options) {
        const json = JSON.stringify(options.toJSON());
        optionsJSON = Buffer.from(
          new TextEncoder().encode(json + "\0"),
        ) as unknown as Pointer;
      }

      // Create the stream
      const streamRef = native.FMLanguageModelSessionStreamResponse(
        this.ptr,
        composedPrompt,
        optionsJSON,
      );

      // Use a queue-based approach for async iteration
      const queue: Array<{ chunk?: string; done?: boolean; error?: Error }> = [];
      let resolveWaiting: (() => void) | null = null;

      const callback = (
        status: number,
        contentPtr: Pointer | null,
        length: number,
        _userInfo: Pointer | null,
      ) => {
        if (status !== 0) {
          queue.push({ error: statusCodeToError(status) as Error });
          resolveWaiting?.();
          return;
        }

        if (contentPtr === null || contentPtr === 0) {
          queue.push({ done: true });
          resolveWaiting?.();
          return;
        }

        // Read chunk - the content is the accumulated text, extract the delta
        try {
          const fullText = Buffer.from(
            (contentPtr as any) as ArrayBuffer,
            0,
            length,
          ).toString("utf-8");
          queue.push({ chunk: fullText });
        } catch {
          queue.push({ chunk: "" });
        }
        resolveWaiting?.();
      };

      // Start iteration
      native.FMLanguageModelSessionResponseStreamIterate(
        streamRef,
        null,
        callback as unknown as Pointer,
      );

      // Yield chunks
      let lastLength = 0;
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveWaiting = resolve;
          });
        }

        const item = queue.shift();
        if (!item) continue;
        if (item.error) throw item.error;
        if (item.done) break;
        if (item.chunk !== undefined) {
          // Emit delta (new text since last chunk)
          const delta = item.chunk.slice(lastLength);
          lastLength = item.chunk.length;
          if (delta) yield delta;
        }
      }

      // Cleanup
      native.FMRelease(streamRef);
    } finally {
      this._requestLock = false;
    }
  }

  /**
   * Create a session from an existing transcript.
   *
   * This allows resuming a previous conversation.
   */
  static fromTranscript(
    transcript: Transcript,
    options?: { model?: SystemLanguageModel; tools?: Tool[] },
  ): LanguageModelSession {
    const native = getNativeBindings();

    let toolsPtr: Pointer | null = null;
    const toolCount = options?.tools?.length ?? 0;

    const ptr = native.FMLanguageModelSessionCreateFromTranscript(
      transcript.sessionPtr,
      options?.model?.ptr ?? null,
      toolsPtr,
      toolCount,
    );

    // Create instance via internal constructor bypass
    const session = Object.create(LanguageModelSession.prototype) as LanguageModelSession;
    ManagedObject.call(session, ptr);
    return session;
  }
}
