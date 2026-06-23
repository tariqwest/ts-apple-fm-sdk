/**
 * LanguageModelSession — manages conversation context and model interactions.
 *
 * Mirrors the Python SDK's `LanguageModelSession` class and the Swift
 * `FoundationModels.LanguageModelSession`.
 */

import { ManagedObject } from "./ffi/managed-object.js";
import { getNativeBindings } from "./ffi/native.js";
import type { Pointer, FMComposedPrompt, FMTaskRef } from "./ffi/types.js";
import { SystemLanguageModel } from "./core.js";
import { composePrompt, type Prompt } from "./prompt.js";
import { type GenerationOptions } from "./generation-options.js";
import { statusCodeToError, GenerationErrorCode } from "./errors.js";
import { GenerationSchema } from "./generation-schema.js";
import { GeneratedContent, type GenerableSchema } from "./generable.js";
import type { Tool } from "./tool.js";
import type { Transcript } from "./transcript.js";
import { BridgedTool, createBridgedTool } from "./tool-bridge.js";

// --- Options ---

export interface LanguageModelSessionOptions {
  instructions?: string;
  model?: SystemLanguageModel;
  tools?: Tool[];
}

export interface RespondOptions {
  options?: GenerationOptions;
  generating?: GenerationSchema | GenerableSchema<unknown>;
}

// --- Class ---

export class LanguageModelSession extends ManagedObject {
  private _requestLock = false;
  private _activeTask: FMTaskRef | null = null;
  private _tools: Tool[] = [];
  private _bridgedTools: BridgedTool[] = [];

  constructor(options?: LanguageModelSessionOptions) {
    const native = getNativeBindings();

    const tools = options?.tools ?? [];
    const bridgedTools = tools.map((tool) => createBridgedTool(tool));

    const modelPtr = options?.model?.ptr ?? null;

    const ptr = native.languageModelSessionCreateFromSystemLanguageModel(
      modelPtr,
      options?.instructions ?? null,
      bridgedTools.map((t) => t.ptr),
    );

    super(ptr);
    this._tools = tools;
    this._bridgedTools = bridgedTools;
  }

  /** Whether a request is currently in progress. */
  get isResponding(): boolean {
    const native = getNativeBindings();
    return native.languageModelSessionIsResponding(this.ptr);
  }

  /** Reset the session, clearing conversation history. */
  reset(): void {
    const native = getNativeBindings();
    native.languageModelSessionReset(this.ptr);
  }

  /** Release the session and its bridged tools. */
  release(): void {
    if (this.isReleased) return;
    for (const tool of this._bridgedTools) {
      tool.release();
    }
    this._bridgedTools = [];
    this._tools = [];
    super.release();
  }

  /**
   * Generate a response to a prompt.
   *
   * - Plain text: `respond(prompt)` returns the response string.
   * - Structured: `respond(prompt, { generating: schema })` returns a
   *   `GeneratedContent` instance.
   */
  async respond(
    prompt: Prompt,
    opts?: RespondOptions,
  ): Promise<string | GeneratedContent> {
    if (this._requestLock) {
      throw new Error("Session already has an active request");
    }
    this._requestLock = true;

    const native = getNativeBindings();
    let composedPrompt: FMComposedPrompt | null = null;

    try {
      composedPrompt = composePrompt(prompt);
      const optionsJSON = opts?.options
        ? JSON.stringify(opts.options.toJSON())
        : null;

      const schema = opts?.generating
        ? opts.generating instanceof GenerationSchema
          ? opts.generating
          : opts.generating.generationSchema()
        : null;

      if (schema) {
        return await this._respondStructured(composedPrompt, schema, optionsJSON);
      }

      return await this._respondText(composedPrompt, optionsJSON);
    } finally {
      this._requestLock = false;
      if (this._activeTask) {
        native.fmRelease(this._activeTask);
        this._activeTask = null;
      }
      if (composedPrompt) native.fmRelease(composedPrompt);
    }
  }

  /** Internal: plain text respond using languageModelSessionRespond. */
  private _respondText(
    composedPrompt: FMComposedPrompt,
    optionsJSON: string | null,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const native = getNativeBindings();
      let completed = false;
      let accumulated = "";

      const callback = (status: number, text: string | null) => {
        if (completed) return;

        if (status !== GenerationErrorCode.SUCCESS) {
          completed = true;
          reject(statusCodeToError(status));
          return;
        }

        if (text === null) {
          // End of stream
          completed = true;
          resolve(accumulated);
          return;
        }

        accumulated = text;
      };

      this._activeTask = native.languageModelSessionRespond(
        this.ptr,
        composedPrompt,
        optionsJSON,
        callback,
      );
    });
  }

  /** Internal: structured respond using languageModelSessionRespondWithSchema. */
  private _respondStructured(
    composedPrompt: FMComposedPrompt,
    schema: GenerationSchema,
    optionsJSON: string | null,
  ): Promise<GeneratedContent> {
    return new Promise<GeneratedContent>((resolve, reject) => {
      const native = getNativeBindings();
      let completed = false;

      const callback = (status: number, contentPtr: Pointer | null) => {
        if (completed) return;

        if (status !== GenerationErrorCode.SUCCESS) {
          completed = true;
          if (contentPtr) native.fmRelease(contentPtr);
          reject(statusCodeToError(status));
          return;
        }

        if (!contentPtr) {
          completed = true;
          reject(new Error("No content returned from guided generation"));
          return;
        }

        const content = new GeneratedContent(undefined, undefined, contentPtr);
        completed = true;
        resolve(content);
      };

      this._activeTask = native.languageModelSessionRespondWithSchema(
        this.ptr,
        composedPrompt,
        schema.ptr,
        optionsJSON,
        callback,
      );
    });
  }

  /**
   * Stream a response as an async iterable of text snapshots.
   *
   * Each yielded value is the complete response generated so far, not just
   * the delta since the previous chunk. This matches the Python SDK behavior.
   */
  async *streamResponse(
    prompt: Prompt,
    options?: GenerationOptions,
  ): AsyncIterableIterator<string> {
    if (this._requestLock) {
      throw new Error("Session already has an active request");
    }
    this._requestLock = true;

    const native = getNativeBindings();
    let composedPrompt: FMComposedPrompt | null = null;
    let streamRef: Pointer | null = null;

    try {
      composedPrompt = composePrompt(prompt);
      const optionsJSON = options ? JSON.stringify(options.toJSON()) : null;

      streamRef = native.languageModelSessionStreamResponse(
        this.ptr,
        composedPrompt,
        optionsJSON,
      );

      const queue: Array<
        { snapshot: string } | { done: true } | { error: Error }
      > = [];
      let notify: (() => void) | null = null;

      const callback = (status: number, text: string | null) => {
        if (status !== GenerationErrorCode.SUCCESS) {
          queue.push({ error: statusCodeToError(status) as Error });
        } else if (text === null) {
          queue.push({ done: true });
        } else {
          queue.push({ snapshot: text });
        }
        notify?.();
      };

      // Start iteration. This calls the callback synchronously for each chunk.
      native.languageModelSessionResponseStreamIterate(streamRef, callback);

      while (true) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
        }

        const item = queue.shift();
        if (!item) continue;
        if ("error" in item) throw item.error;
        if ("done" in item) break;
        yield item.snapshot;
      }
    } finally {
      this._requestLock = false;
      if (streamRef) native.fmRelease(streamRef);
      if (composedPrompt) native.fmRelease(composedPrompt);
    }
  }

  /**
   * Create a session from an existing transcript.
   */
  static fromTranscript(
    transcript: Transcript,
    options?: { model?: SystemLanguageModel; tools?: Tool[] },
  ): LanguageModelSession {
    const native = getNativeBindings();

    const tools = options?.tools ?? [];
    const bridgedTools = tools.map((tool) => createBridgedTool(tool));

    const ptr = native.languageModelSessionCreateFromTranscript(
      transcript.sessionPtr,
      options?.model?.ptr ?? null,
      bridgedTools.map((t) => t.ptr),
    );

    const session = LanguageModelSession.__privateFromPtr(ptr);
    session._tools = tools;
    session._bridgedTools = bridgedTools;
    return session;
  }

  /** @internal — used only by fromTranscript. */
  private static __privateFromPtr(ptr: Pointer): LanguageModelSession {
    const session = Object.create(LanguageModelSession.prototype) as LanguageModelSession;
    (ManagedObject as any).call(session, ptr);
    return session;
  }
}
