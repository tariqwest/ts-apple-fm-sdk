/**
 * Apple Foundation Models SDK for TypeScript.
 *
 * Provides access to Apple's on-device foundation models
 * (SystemLanguageModel / Apple Intelligence) from TypeScript.
 *
 * @example
 * ```ts
 * import fm from "apple-fm-sdk";
 * import z from "zod";
 *
 * const model = new fm.SystemLanguageModel();
 * const [available, reason] = model.isAvailable();
 *
 * if (available) {
 *   const session = new fm.LanguageModelSession({
 *     instructions: "You are a helpful assistant.",
 *   });
 *   const response = await session.respond("Hello!");
 *   console.log(response);
 * }
 * ```
 *
 * @module
 */

// --- Core ---
export {
  SystemLanguageModel,
  SystemLanguageModelUseCase,
  SystemLanguageModelGuardrails,
  SystemLanguageModelUnavailableReason,
  type SystemLanguageModelOptions,
  type TokenCountInput,
  type TokenCountOptions,
} from "./core.js";

// --- Session ---
export {
  LanguageModelSession,
  type LanguageModelSessionOptions,
  type RespondOptions,
} from "./session.js";

// --- Prompt ---
export {
  Attachment,
  ImageAttachment,
  composePrompt,
  PromptError,
  ImagePromptError,
  type Prompt,
  type PromptComponent,
} from "./prompt.js";

// --- Transcript ---
export { Transcript } from "./transcript.js";

// --- Guided Generation ---
export {
  generable,
  GeneratedContent,
  GenerationID,
  type GenerableSchema,
} from "./generable.js";

export { GenerationSchema } from "./generation-schema.js";

export {
  guide,
  hasGuideMeta,
  getGuideMeta,
  GuideType,
  GUIDE_META,
  type GuideConstraints,
  type GuideMeta,
  type GuidedZodType,
} from "./generation-guide.js";

// --- Generation Options ---
export {
  GenerationOptions,
  SamplingMode,
  SamplingModeType,
  type GenerationOptionsInit,
  type SamplingModeOptions,
} from "./generation-options.js";

// --- Tools ---
export { Tool } from "./tool.js";

// --- Errors ---
export {
  FoundationModelsError,
  GenerationError,
  InvalidGenerationSchemaError,
  ExceededContextWindowSizeError,
  AssetsUnavailableError,
  GuardrailViolationError,
  UnsupportedGuideError,
  UnsupportedLanguageOrLocaleError,
  DecodingFailureError,
  RateLimitedError,
  ConcurrentRequestsError,
  RefusalError,
  ToolCallError,
  GenerationErrorCode,
  statusCodeToError,
} from "./errors.js";

// --- Type Conversion ---
export {
  zodTypeToSwiftString,
  isZodOptional,
  isZodArray,
  unwrapZodType,
} from "./type-conversion.js";

// --- FFI (advanced usage) ---
export { getNativeBindings, isNativeAvailable } from "./ffi/native.js";
export { ManagedObject } from "./ffi/managed-object.js";

// --- Default export (Python-style namespace) ---
import {
  SystemLanguageModel,
  SystemLanguageModelUseCase,
  SystemLanguageModelGuardrails,
  SystemLanguageModelUnavailableReason,
} from "./core.js";
import { isNativeAvailable } from "./ffi/native.js";
import { LanguageModelSession } from "./session.js";
import {
  Attachment,
  ImageAttachment,
  composePrompt,
  PromptError,
  ImagePromptError,
} from "./prompt.js";
import { Transcript } from "./transcript.js";
import { generable, GeneratedContent, GenerationID } from "./generable.js";
import { GenerationSchema } from "./generation-schema.js";
import { guide, hasGuideMeta, getGuideMeta, GuideType, GUIDE_META } from "./generation-guide.js";
import { GenerationOptions, SamplingMode, SamplingModeType } from "./generation-options.js";
import { Tool } from "./tool.js";
import {
  FoundationModelsError,
  GenerationError,
  InvalidGenerationSchemaError,
  ExceededContextWindowSizeError,
  AssetsUnavailableError,
  GuardrailViolationError,
  UnsupportedGuideError,
  UnsupportedLanguageOrLocaleError,
  DecodingFailureError,
  RateLimitedError,
  ConcurrentRequestsError,
  RefusalError,
  ToolCallError,
  GenerationErrorCode,
  statusCodeToError,
} from "./errors.js";
import {
  zodTypeToSwiftString,
  isZodOptional,
  isZodArray,
  unwrapZodType,
} from "./type-conversion.js";

const fm = {
  isNativeAvailable,
  SystemLanguageModel,
  SystemLanguageModelUseCase,
  SystemLanguageModelGuardrails,
  SystemLanguageModelUnavailableReason,
  LanguageModelSession,
  Attachment,
  ImageAttachment,
  composePrompt,
  PromptError,
  ImagePromptError,
  Transcript,
  generable,
  GeneratedContent,
  GenerationID,
  GenerationSchema,
  guide,
  hasGuideMeta,
  getGuideMeta,
  GuideType,
  GUIDE_META,
  GenerationOptions,
  SamplingMode,
  SamplingModeType,
  Tool,
  FoundationModelsError,
  GenerationError,
  InvalidGenerationSchemaError,
  ExceededContextWindowSizeError,
  AssetsUnavailableError,
  GuardrailViolationError,
  UnsupportedGuideError,
  UnsupportedLanguageOrLocaleError,
  DecodingFailureError,
  RateLimitedError,
  ConcurrentRequestsError,
  RefusalError,
  ToolCallError,
  GenerationErrorCode,
  statusCodeToError,
  zodTypeToSwiftString,
  isZodOptional,
  isZodArray,
  unwrapZodType,
};

export default fm;
