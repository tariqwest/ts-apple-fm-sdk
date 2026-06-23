import { describe, it, expect } from "vitest";
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
} from "../src/errors.js";

describe("Error classes", () => {
  it("FoundationModelsError is an Error", () => {
    const err = new FoundationModelsError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FoundationModelsError);
    expect(err.message).toBe("test");
  });

  it("GenerationError extends FoundationModelsError", () => {
    const err = new GenerationError("gen error");
    expect(err).toBeInstanceOf(FoundationModelsError);
    expect(err).toBeInstanceOf(GenerationError);
  });

  it("InvalidGenerationSchemaError extends FoundationModelsError", () => {
    const err = new InvalidGenerationSchemaError("bad schema");
    expect(err).toBeInstanceOf(FoundationModelsError);
    expect(err).not.toBeInstanceOf(GenerationError);
  });

  it("all generation error subclasses extend GenerationError", () => {
    const classes = [
      ExceededContextWindowSizeError,
      AssetsUnavailableError,
      GuardrailViolationError,
      UnsupportedGuideError,
      UnsupportedLanguageOrLocaleError,
      DecodingFailureError,
      RateLimitedError,
      ConcurrentRequestsError,
      RefusalError,
    ] as const;

    for (const ErrorClass of classes) {
      const err = new ErrorClass("msg");
      expect(err).toBeInstanceOf(GenerationError);
      expect(err).toBeInstanceOf(FoundationModelsError);
    }
  });

  it("RefusalError stores explanation entries", () => {
    const entries = [{ type: "text", text: "harmful content" }];
    const err = new RefusalError("refused", "debug info", entries);
    expect(err.explanationEntries).toEqual(entries);
    expect(err.message).toBe("refused");
  });

  it("ToolCallError stores tool name and underlying error", () => {
    const underlying = new Error("connection failed");
    const err = new ToolCallError("WeatherTool", underlying);
    expect(err).toBeInstanceOf(FoundationModelsError);
    expect(err.toolName).toBe("WeatherTool");
    expect(err.underlyingError).toBe(underlying);
    expect(err.message).toContain("WeatherTool");
    expect(err.message).toContain("connection failed");
  });
});

describe("GenerationErrorCode", () => {
  it("has correct numeric values", () => {
    expect(GenerationErrorCode.SUCCESS).toBe(0);
    expect(GenerationErrorCode.EXCEEDED_CONTEXT_WINDOW_SIZE).toBe(1);
    expect(GenerationErrorCode.ASSETS_UNAVAILABLE).toBe(2);
    expect(GenerationErrorCode.GUARDRAIL_VIOLATION).toBe(3);
    expect(GenerationErrorCode.UNSUPPORTED_GUIDE).toBe(4);
    expect(GenerationErrorCode.UNSUPPORTED_LANGUAGE_OR_LOCALE).toBe(5);
    expect(GenerationErrorCode.DECODING_FAILURE).toBe(6);
    expect(GenerationErrorCode.RATE_LIMITED).toBe(7);
    expect(GenerationErrorCode.CONCURRENT_REQUESTS).toBe(8);
    expect(GenerationErrorCode.REFUSAL).toBe(9);
    expect(GenerationErrorCode.INVALID_SCHEMA).toBe(10);
    expect(GenerationErrorCode.UNKNOWN_ERROR).toBe(255);
  });
});

describe("statusCodeToError", () => {
  it("maps status 1 to ExceededContextWindowSizeError", () => {
    const err = statusCodeToError(1, "too long");
    expect(err).toBeInstanceOf(ExceededContextWindowSizeError);
    expect(err.message).toContain("too long");
  });

  it("maps status 2 to AssetsUnavailableError", () => {
    expect(statusCodeToError(2)).toBeInstanceOf(AssetsUnavailableError);
  });

  it("maps status 3 to GuardrailViolationError", () => {
    expect(statusCodeToError(3)).toBeInstanceOf(GuardrailViolationError);
  });

  it("maps status 4 to UnsupportedGuideError", () => {
    expect(statusCodeToError(4)).toBeInstanceOf(UnsupportedGuideError);
  });

  it("maps status 5 to UnsupportedLanguageOrLocaleError", () => {
    expect(statusCodeToError(5)).toBeInstanceOf(UnsupportedLanguageOrLocaleError);
  });

  it("maps status 6 to DecodingFailureError", () => {
    expect(statusCodeToError(6)).toBeInstanceOf(DecodingFailureError);
  });

  it("maps status 7 to RateLimitedError", () => {
    expect(statusCodeToError(7)).toBeInstanceOf(RateLimitedError);
  });

  it("maps status 8 to ConcurrentRequestsError", () => {
    expect(statusCodeToError(8)).toBeInstanceOf(ConcurrentRequestsError);
  });

  it("maps status 9 to RefusalError", () => {
    expect(statusCodeToError(9)).toBeInstanceOf(RefusalError);
  });

  it("maps status 10 to InvalidGenerationSchemaError", () => {
    expect(statusCodeToError(10)).toBeInstanceOf(InvalidGenerationSchemaError);
  });

  it("maps unknown status to GenerationError", () => {
    const err = statusCodeToError(99, "unknown");
    expect(err).toBeInstanceOf(GenerationError);
    expect(err.message).toContain("99");
  });
});
