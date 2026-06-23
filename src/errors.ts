/**
 * Foundation Models error classes and exception types.
 *
 * Mirrors the Python SDK's error hierarchy and maps 1-to-1 with
 * the C status codes from foundation-models-c.
 */

export class FoundationModelsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoundationModelsError";
  }
}

export class GenerationError extends FoundationModelsError {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

export class InvalidGenerationSchemaError extends FoundationModelsError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGenerationSchemaError";
  }
}

export class ExceededContextWindowSizeError extends GenerationError {
  constructor(message: string) {
    super(message);
    this.name = "ExceededContextWindowSizeError";
  }
}

export class AssetsUnavailableError extends GenerationError {
  constructor(message: string) {
    super(message);
    this.name = "AssetsUnavailableError";
  }
}

export class GuardrailViolationError extends GenerationError {
  constructor(message: string) {
    super(message);
    this.name = "GuardrailViolationError";
  }
}

export class UnsupportedGuideError extends GenerationError {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedGuideError";
  }
}

export class UnsupportedLanguageOrLocaleError extends GenerationError {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedLanguageOrLocaleError";
  }
}

export class DecodingFailureError extends GenerationError {
  constructor(message: string) {
    super(message);
    this.name = "DecodingFailureError";
  }
}

export class RateLimitedError extends GenerationError {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitedError";
  }
}

export class ConcurrentRequestsError extends GenerationError {
  constructor(message: string) {
    super(message);
    this.name = "ConcurrentRequestsError";
  }
}

export class RefusalError extends GenerationError {
  readonly explanationEntries: unknown[];

  constructor(
    message: string,
    debugDescription?: string | null,
    explanationEntries: unknown[] = [],
  ) {
    super(message);
    this.name = "RefusalError";
    this.explanationEntries = explanationEntries;
  }
}

export class ToolCallError extends FoundationModelsError {
  readonly toolName: string;
  readonly underlyingError: Error;

  constructor(toolName: string, underlyingError: Error) {
    super(`Tool '${toolName}' failed: ${underlyingError.message}`);
    this.name = "ToolCallError";
    this.toolName = toolName;
    this.underlyingError = underlyingError;
  }
}

/** Error codes that map 1-to-1 with C status codes from foundation-models-c. */
export const GenerationErrorCode = {
  SUCCESS: 0,
  EXCEEDED_CONTEXT_WINDOW_SIZE: 1,
  ASSETS_UNAVAILABLE: 2,
  GUARDRAIL_VIOLATION: 3,
  UNSUPPORTED_GUIDE: 4,
  UNSUPPORTED_LANGUAGE_OR_LOCALE: 5,
  DECODING_FAILURE: 6,
  RATE_LIMITED: 7,
  CONCURRENT_REQUESTS: 8,
  REFUSAL: 9,
  INVALID_SCHEMA: 10,
  UNKNOWN_ERROR: 255,
} as const;

export type GenerationErrorCode =
  (typeof GenerationErrorCode)[keyof typeof GenerationErrorCode];

const ERROR_MAP: Record<number, new (msg: string) => FoundationModelsError> = {
  [GenerationErrorCode.EXCEEDED_CONTEXT_WINDOW_SIZE]: ExceededContextWindowSizeError,
  [GenerationErrorCode.ASSETS_UNAVAILABLE]: AssetsUnavailableError,
  [GenerationErrorCode.GUARDRAIL_VIOLATION]: GuardrailViolationError,
  [GenerationErrorCode.UNSUPPORTED_GUIDE]: UnsupportedGuideError,
  [GenerationErrorCode.UNSUPPORTED_LANGUAGE_OR_LOCALE]: UnsupportedLanguageOrLocaleError,
  [GenerationErrorCode.DECODING_FAILURE]: DecodingFailureError,
  [GenerationErrorCode.RATE_LIMITED]: RateLimitedError,
  [GenerationErrorCode.CONCURRENT_REQUESTS]: ConcurrentRequestsError,
  [GenerationErrorCode.REFUSAL]: RefusalError,
  [GenerationErrorCode.INVALID_SCHEMA]: InvalidGenerationSchemaError,
};

const ERROR_MESSAGES: Record<number, string> = {
  [GenerationErrorCode.EXCEEDED_CONTEXT_WINDOW_SIZE]: "Context window size exceeded",
  [GenerationErrorCode.ASSETS_UNAVAILABLE]: "Required assets are unavailable",
  [GenerationErrorCode.GUARDRAIL_VIOLATION]: "Guardrail violation occurred",
  [GenerationErrorCode.UNSUPPORTED_GUIDE]: "Unsupported guide used",
  [GenerationErrorCode.UNSUPPORTED_LANGUAGE_OR_LOCALE]: "Unsupported language or locale",
  [GenerationErrorCode.DECODING_FAILURE]: "Failed to decode response",
  [GenerationErrorCode.RATE_LIMITED]: "Request was rate limited",
  [GenerationErrorCode.CONCURRENT_REQUESTS]: "Too many concurrent requests",
  [GenerationErrorCode.REFUSAL]: "Model refused to generate content",
  [GenerationErrorCode.INVALID_SCHEMA]: "Invalid generation schema provided",
};

/** Convert a C status code to the appropriate error instance. */
export function statusCodeToError(
  statusCode: number,
  debugDescription?: string | null,
): FoundationModelsError {
  const ErrorClass = ERROR_MAP[statusCode];
  if (ErrorClass) {
    const baseMsg = ERROR_MESSAGES[statusCode] ?? "Generation error";
    const msg = debugDescription ? `${baseMsg}: ${debugDescription}` : baseMsg;
    return new ErrorClass(msg);
  }
  return new GenerationError(
    `Unknown generation error (status: ${statusCode}): ${debugDescription ?? ""}`,
  );
}
