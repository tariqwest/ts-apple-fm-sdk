/**
 * TypeScript type definitions for the foundation-models-c FFI surface.
 *
 * These mirror the opaque pointer types, enums, and callback signatures
 * declared in FoundationModels.h.
 */

// --- Opaque pointer types (represented as `number` in Bun FFI / bigint in some runtimes) ---
export type Pointer = number;
export type FMTaskRef = Pointer;
export type FMSystemLanguageModelRef = Pointer;
export type FMLanguageModelSessionRef = Pointer;
export type FMLanguageModelSessionResponseStreamRef = Pointer;
export type FMGenerationSchemaRef = Pointer;
export type FMGeneratedContentRef = Pointer;
export type FMGenerationSchemaPropertyRef = Pointer;
export type FMBridgedToolRef = Pointer;
export type FMComposedPrompt = Pointer;

// --- Enums ---

export const FMSystemLanguageModelUnavailableReason = {
  AppleIntelligenceNotEnabled: 0,
  DeviceNotEligible: 1,
  ModelNotReady: 2,
  Unknown: 0xff,
} as const;
export type FMSystemLanguageModelUnavailableReason =
  (typeof FMSystemLanguageModelUnavailableReason)[keyof typeof FMSystemLanguageModelUnavailableReason];

export const FMSystemLanguageModelUseCase = {
  General: 0,
  ContentTagging: 1,
} as const;
export type FMSystemLanguageModelUseCase =
  (typeof FMSystemLanguageModelUseCase)[keyof typeof FMSystemLanguageModelUseCase];

export const FMSystemLanguageModelGuardrails = {
  Default: 0,
  PermissiveContentTransformations: 1,
} as const;
export type FMSystemLanguageModelGuardrails =
  (typeof FMSystemLanguageModelGuardrails)[keyof typeof FMSystemLanguageModelGuardrails];

export const FMComposedPromptAddImageError = {
  None: 0,
  UnsupportedOS: 1,
  UnsupportedSDK: 2,
  Unknown: 3,
} as const;
export type FMComposedPromptAddImageError =
  (typeof FMComposedPromptAddImageError)[keyof typeof FMComposedPromptAddImageError];

// --- Callback function signatures ---

/**
 * void (*)(int status, const char *content, size_t length, void *userInfo)
 */
export type FMLanguageModelSessionResponseCallback = (
  status: number,
  content: Pointer | null,
  length: number,
  userInfo: Pointer | null,
) => void;

/**
 * void (*)(int status, FMGeneratedContentRef content, void *userInfo)
 */
export type FMLanguageModelSessionStructuredResponseCallback = (
  status: number,
  content: FMGeneratedContentRef | null,
  userInfo: Pointer | null,
) => void;

/**
 * void (*)(int status, int tokenCount, const char *errorDescription, void *userInfo)
 */
export type FMSystemLanguageModelTokenCountCallback = (
  status: number,
  tokenCount: number,
  errorDescription: Pointer | null,
  userInfo: Pointer | null,
) => void;

/**
 * Tool callable: void (*)(FMGeneratedContentRef, unsigned int callId)
 */
export type FMBridgedToolCallable = (
  content: FMGeneratedContentRef,
  callId: number,
) => void;
