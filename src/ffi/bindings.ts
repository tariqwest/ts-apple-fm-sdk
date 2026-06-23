/**
 * Bun FFI declarations for all C functions in FoundationModels.h.
 *
 * These declarations are used with `dlopen` to load the compiled
 * foundation-models-c dynamic library. The abstraction in `native.ts`
 * wraps these for ergonomic, type-safe usage.
 */

import type {
  Pointer,
  FMSystemLanguageModelRef,
  FMLanguageModelSessionRef,
  FMLanguageModelSessionResponseStreamRef,
  FMGenerationSchemaRef,
  FMGeneratedContentRef,
  FMGenerationSchemaPropertyRef,
  FMBridgedToolRef,
  FMComposedPrompt,
  FMTaskRef,
} from "./types.js";

// ---------- Bun FFI symbol definitions ----------
// These map to the dlopen symbol table.

export const FFI_SYMBOLS = {
  // --- SystemLanguageModel ---
  FMSystemLanguageModelGetDefault: {
    args: [] as const,
    returns: "ptr" as const,
  },
  FMSystemLanguageModelCreate: {
    args: ["i32", "i32"] as const, // useCase, guardrails
    returns: "ptr" as const,
  },
  FMSystemLanguageModelIsAvailable: {
    args: ["ptr", "ptr"] as const, // ref, *unavailableReason
    returns: "bool" as const,
  },
  FMSystemLanguageModelGetContextSize: {
    args: ["ptr"] as const, // model
    returns: "i32" as const,
  },

  // --- Session creation ---
  FMLanguageModelSessionCreateDefault: {
    args: [] as const,
    returns: "ptr" as const,
  },
  FMLanguageModelSessionCreateFromSystemLanguageModel: {
    args: ["ptr", "ptr", "ptr", "i32"] as const, // model, instructions, tools, toolCount
    returns: "ptr" as const,
  },
  FMLanguageModelSessionCreateFromTranscript: {
    args: ["ptr", "ptr", "ptr", "i32"] as const, // transcriptSession, model, tools, toolCount
    returns: "ptr" as const,
  },

  // --- Session state ---
  FMLanguageModelSessionIsResponding: {
    args: ["ptr"] as const,
    returns: "bool" as const,
  },
  FMLanguageModelSessionReset: {
    args: ["ptr"] as const,
    returns: "void" as const,
  },

  // --- Composed prompt ---
  FMComposedPromptInitialize: {
    args: [] as const,
    returns: "ptr" as const,
  },
  FMComposedPromptAddText: {
    args: ["ptr", "ptr"] as const, // composedPrompt, text
    returns: "void" as const,
  },
  FMComposedPromptAddAttachment: {
    args: ["ptr", "ptr", "ptr", "ptr"] as const, // composedPrompt, imagePath, label, *error
    returns: "bool" as const,
  },

  // --- Response ---
  FMLanguageModelSessionRespond: {
    args: ["ptr", "ptr", "ptr", "ptr", "callback"] as const, // session, prompt, optionsJSON, userInfo, callback
    returns: "ptr" as const,
  },
  FMLanguageModelSessionStreamResponse: {
    args: ["ptr", "ptr", "ptr"] as const, // session, prompt, optionsJSON
    returns: "ptr" as const,
  },
  FMLanguageModelSessionResponseStreamIterate: {
    args: ["ptr", "ptr", "callback"] as const, // stream, userInfo, callback
    returns: "void" as const,
  },

  // --- Structured response ---
  FMLanguageModelSessionRespondWithSchema: {
    args: ["ptr", "ptr", "ptr", "ptr", "ptr", "callback"] as const,
    returns: "ptr" as const,
  },
  FMLanguageModelSessionRespondWithSchemaFromJSON: {
    args: ["ptr", "ptr", "ptr", "ptr", "ptr", "callback"] as const,
    returns: "ptr" as const,
  },

  // --- Token counting ---
  FMSystemLanguageModelTokenCountForPrompt: {
    args: ["ptr", "ptr", "ptr", "callback"] as const,
    returns: "ptr" as const,
  },
  FMSystemLanguageModelTokenCountForInstructions: {
    args: ["ptr", "ptr", "ptr", "callback"] as const,
    returns: "ptr" as const,
  },
  FMSystemLanguageModelTokenCountForTools: {
    args: ["ptr", "ptr", "i32", "ptr", "callback"] as const,
    returns: "ptr" as const,
  },
  FMSystemLanguageModelTokenCountForSchema: {
    args: ["ptr", "ptr", "ptr", "callback"] as const,
    returns: "ptr" as const,
  },
  FMSystemLanguageModelTokenCountForTranscript: {
    args: ["ptr", "ptr", "ptr", "callback"] as const,
    returns: "ptr" as const,
  },

  // --- Transcript ---
  FMTranscriptCreateFromJSONString: {
    args: ["ptr", "ptr", "ptr"] as const, // jsonString, *outErrorCode, **outErrorDescription
    returns: "ptr" as const,
  },
  FMLanguageModelSessionGetTranscriptJSONString: {
    args: ["ptr", "ptr", "ptr"] as const, // session, *outErrorCode, **outErrorDescription
    returns: "ptr" as const,
  },

  // --- GenerationSchema ---
  FMGenerationSchemaCreate: {
    args: ["ptr", "ptr"] as const, // name, description
    returns: "ptr" as const,
  },
  FMGenerationSchemaPropertyCreate: {
    args: ["ptr", "ptr", "ptr", "bool"] as const, // name, description, typeName, isOptional
    returns: "ptr" as const,
  },
  FMGenerationSchemaPropertyAddAnyOfGuide: {
    args: ["ptr", "ptr", "i32", "bool"] as const, // property, *anyOf, choiceCount, wrapped
    returns: "void" as const,
  },
  FMGenerationSchemaPropertyAddCountGuide: {
    args: ["ptr", "i32", "bool"] as const, // property, count, wrapped
    returns: "void" as const,
  },
  FMGenerationSchemaPropertyAddMaximumGuide: {
    args: ["ptr", "f64", "bool"] as const, // property, maximum, wrapped
    returns: "void" as const,
  },
  FMGenerationSchemaPropertyAddMinimumGuide: {
    args: ["ptr", "f64", "bool"] as const, // property, minimum, wrapped
    returns: "void" as const,
  },
  FMGenerationSchemaPropertyAddMinItemsGuide: {
    args: ["ptr", "i32"] as const, // property, minItems
    returns: "void" as const,
  },
  FMGenerationSchemaPropertyAddMaxItemsGuide: {
    args: ["ptr", "i32"] as const, // property, maxItems
    returns: "void" as const,
  },
  FMGenerationSchemaPropertyAddRangeGuide: {
    args: ["ptr", "f64", "f64", "bool"] as const, // property, min, max, wrapped
    returns: "void" as const,
  },
  FMGenerationSchemaPropertyAddRegex: {
    args: ["ptr", "ptr", "bool"] as const, // property, pattern, wrapped
    returns: "void" as const,
  },
  FMGenerationSchemaAddProperty: {
    args: ["ptr", "ptr"] as const, // schema, property
    returns: "void" as const,
  },
  FMGenerationSchemaAddReferenceSchema: {
    args: ["ptr", "ptr"] as const, // schema, referenceSchema
    returns: "void" as const,
  },
  FMGenerationSchemaGetJSONString: {
    args: ["ptr", "ptr", "ptr"] as const, // schema, *outErrorCode, **outErrorDescription
    returns: "ptr" as const,
  },

  // --- GeneratedContent ---
  FMGeneratedContentCreateFromJSON: {
    args: ["ptr", "ptr", "ptr"] as const, // jsonString, *outErrorCode, **outErrorDescription
    returns: "ptr" as const,
  },
  FMGeneratedContentGetJSONString: {
    args: ["ptr"] as const,
    returns: "ptr" as const,
  },
  FMGeneratedContentGetPropertyValue: {
    args: ["ptr", "ptr", "ptr", "ptr"] as const, // content, propertyName, *outErrorCode, **outErrorDescription
    returns: "ptr" as const,
  },
  FMGeneratedContentIsComplete: {
    args: ["ptr"] as const,
    returns: "bool" as const,
  },

  // --- Tools ---
  FMBridgedToolCreate: {
    args: ["ptr", "ptr", "ptr", "callback", "ptr", "ptr"] as const,
    returns: "ptr" as const,
  },
  FMBridgedToolFinishCall: {
    args: ["ptr", "u32", "ptr"] as const, // tool, callId, output
    returns: "void" as const,
  },

  // --- Memory management ---
  FMTaskCancel: {
    args: ["ptr"] as const,
    returns: "void" as const,
  },
  FMRetain: {
    args: ["ptr"] as const,
    returns: "void" as const,
  },
  FMRelease: {
    args: ["ptr"] as const,
    returns: "void" as const,
  },
  FMFreeString: {
    args: ["ptr"] as const,
    returns: "void" as const,
  },
} as const;

export type FFISymbols = typeof FFI_SYMBOLS;
