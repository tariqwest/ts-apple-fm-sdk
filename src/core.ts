/**
 * SystemLanguageModel — the on-device Apple Intelligence model.
 *
 * Mirrors the Python SDK's `SystemLanguageModel` class and the Swift
 * `FoundationModels.SystemLanguageModel`.
 */

import { ManagedObject } from "./ffi/managed-object.js";
import { getNativeBindings } from "./ffi/native.js";
import type { Pointer } from "./ffi/types.js";

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

// --- Class ---

export class SystemLanguageModel extends ManagedObject {
  constructor(options?: SystemLanguageModelOptions) {
    const native = getNativeBindings();
    const useCase = options?.useCase ?? SystemLanguageModelUseCase.GENERAL;
    const guardrails = options?.guardrails ?? SystemLanguageModelGuardrails.DEFAULT;

    const ptr = native.systemLanguageModelCreate(useCase, guardrails);
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
}
