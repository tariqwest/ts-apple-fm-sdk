/**
 * SystemLanguageModel — the on-device Apple Intelligence model.
 *
 * Mirrors the Python SDK's `SystemLanguageModel` class and the Swift
 * `FoundationModels.SystemLanguageModel`.
 */

import { ManagedObject } from "./ffi/managed-object.js";
import { getNativeBindings, requirePointer } from "./ffi/native.js";
import type { Pointer, TokenCountCallback } from "./ffi/types.js";
import { composePrompt, type Prompt } from "./prompt.js";
import { GenerationSchema } from "./generation-schema.js";
import { Transcript } from "./transcript.js";
import { Tool } from "./tool.js";
import { createBridgedTool } from "./tool-bridge.js";
import { GenerationErrorCode, statusCodeToError } from "./errors.js";

// --- Enums ---

export const SystemLanguageModelUseCase = {
  GENERAL: 0,
  CONTENT_TAGGING: 1,
} as const;
export type SystemLanguageModelUseCase =
  (typeof SystemLanguageModelUseCase)[keyof typeof SystemLanguageModelUseCase];

export const SystemLanguageModelGuardrails = {
  DEFAULT: 0,
  PERMISSIVE_CONTENT_TRANSFORMATIONS: 1,
} as const;
export type SystemLanguageModelGuardrails =
  (typeof SystemLanguageModelGuardrails)[keyof typeof SystemLanguageModelGuardrails];

export const SystemLanguageModelUnavailableReason = {
  APPLE_INTELLIGENCE_NOT_ENABLED: 0,
  DEVICE_NOT_ELIGIBLE: 1,
  MODEL_NOT_READY: 2,
  UNKNOWN: 0xff,
} as const;
export type SystemLanguageModelUnavailableReason =
  (typeof SystemLanguageModelUnavailableReason)[keyof typeof SystemLanguageModelUnavailableReason];

// --- Reverse lookup for unavailable reason ---

const UNAVAILABLE_REASON_MAP: Record<number, SystemLanguageModelUnavailableReason> = {
  0: SystemLanguageModelUnavailableReason.APPLE_INTELLIGENCE_NOT_ENABLED,
  1: SystemLanguageModelUnavailableReason.DEVICE_NOT_ELIGIBLE,
  2: SystemLanguageModelUnavailableReason.MODEL_NOT_READY,
  0xff: SystemLanguageModelUnavailableReason.UNKNOWN,
};

// --- Options ---

export interface SystemLanguageModelOptions {
  useCase?: SystemLanguageModelUseCase;
  guardrails?: SystemLanguageModelGuardrails;
}

export type TokenCountInput = Prompt | GenerationSchema | Transcript | Tool[];

export interface TokenCountOptions {
  instructions?: string;
}

// --- Class ---

export class SystemLanguageModel extends ManagedObject {
  constructor(options?: SystemLanguageModelOptions) {
    const native = getNativeBindings();
    const useCase = options?.useCase ?? SystemLanguageModelUseCase.GENERAL;
    const guardrails = options?.guardrails ?? SystemLanguageModelGuardrails.DEFAULT;

    const ptr = requirePointer(
      native.systemLanguageModelCreate(useCase, guardrails),
      "systemLanguageModelCreate",
    );
    super(ptr);
  }

  /**
   * Check if the model is available on this device.
   *
   * Returns a tuple of `[available, reason]` where `reason` is defined
   * only when `available` is false.
   */
  isAvailable(): [boolean, SystemLanguageModelUnavailableReason | undefined] {
    const native = getNativeBindings();
    const { available, reason } = native.systemLanguageModelIsAvailable(this.ptr);

    if (available) {
      return [true, undefined];
    }

    const reasonCode = reason ?? 0xff;
    const mappedReason = UNAVAILABLE_REASON_MAP[reasonCode] ?? SystemLanguageModelUnavailableReason.UNKNOWN;
    return [false, mappedReason];
  }

  /** Get the model's maximum context window size in tokens. */
  getContextSize(): number {
    const native = getNativeBindings();
    return native.systemLanguageModelGetContextSize(this.ptr);
  }

  /**
   * Count the number of tokens an input would consume without running generation.
   *
   * Pass a prompt, schema, transcript, or tool list as `value`, or pass
   * `instructions` via `options` (mutually exclusive).
   */
  async tokenCount(
    value?: TokenCountInput,
    options?: TokenCountOptions,
  ): Promise<number> {
    const native = getNativeBindings();
    const { instructions } = options ?? {};

    if (instructions !== undefined) {
      if (value !== undefined) {
        throw new Error(
          "Provide either a value or instructions to tokenCount(), not both",
        );
      }
      return this._runTokenCount((callback) =>
        native.systemLanguageModelTokenCountForInstructions(this.ptr, instructions, callback),
      );
    }

    if (value === undefined) {
      throw new Error("tokenCount() requires either a value or instructions");
    }

    if (value instanceof GenerationSchema) {
      return this._runTokenCount((callback) =>
        native.systemLanguageModelTokenCountForSchema(this.ptr, value.ptr, callback),
      );
    }

    if (value instanceof Transcript) {
      return this._runTokenCount((callback) =>
        native.systemLanguageModelTokenCountForTranscript(this.ptr, value.sessionPtr, callback),
      );
    }

    if (Array.isArray(value) && value.every((item) => item instanceof Tool)) {
      const bridgedTools = value.map((tool) => createBridgedTool(tool));
      try {
        return await this._runTokenCount((callback) =>
          native.systemLanguageModelTokenCountForTools(
            this.ptr,
            bridgedTools.map((tool) => tool.ptr),
            callback,
          ),
        );
      } finally {
        for (const tool of bridgedTools) {
          tool.release();
        }
      }
    }

    const composedPrompt = composePrompt(value);
    try {
      return await this._runTokenCount((callback) =>
        native.systemLanguageModelTokenCountForPrompt(this.ptr, composedPrompt, callback),
      );
    } finally {
      native.fmRelease(composedPrompt);
    }
  }

  private _runTokenCount(
    start: (callback: TokenCountCallback) => Pointer,
  ): Promise<number> {
    const native = getNativeBindings();
    return new Promise((resolve, reject) => {
      let completed = false;
      let task: Pointer | null = null;

      const callback: TokenCountCallback = (status, count, errorDescription) => {
        if (completed) return;
        completed = true;
        if (task) native.fmRelease(task);
        if (status !== GenerationErrorCode.SUCCESS) {
          reject(statusCodeToError(status, errorDescription));
        } else {
          resolve(count);
        }
      };

      task = start(callback);
    });
  }
}