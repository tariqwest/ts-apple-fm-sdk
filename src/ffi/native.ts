/**
 * Runtime-agnostic abstraction over the native FFI layer.
 *
 * Primary implementation uses Bun FFI (`bun:ffi`). The abstraction
 * allows swapping in a Node N-API adapter without changing any
 * consuming code.
 */

import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Pointer } from "./types.js";

// ---------- Library loading ----------

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Candidate paths for the compiled dylib, in priority order. */
const DYLIB_SEARCH_PATHS = [
  resolve(__dirname, "../../build/libFoundationModels.dylib"),
  resolve(__dirname, "../build/libFoundationModels.dylib"),
  resolve(
    __dirname,
    "../../reference/python-apple-fm-sdk/foundation-models-c/.build/release/libFoundationModels.dylib",
  ),
];

function findDylib(): string {
  for (const p of DYLIB_SEARCH_PATHS) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Could not find libFoundationModels.dylib. Searched:\n${DYLIB_SEARCH_PATHS.map((p) => `  - ${p}`).join("\n")}\n` +
      `Run 'bun run build:native' or './build.sh' to compile.`,
  );
}

// ---------- Native module interface ----------

/**
 * Thin wrapper over the loaded FFI symbols.
 *
 * All methods correspond 1-to-1 with the C functions in FoundationModels.h.
 * Pointer types are `number` (Bun FFI convention). Strings are encoded/decoded
 * automatically where indicated.
 */
export interface NativeBindings {
  // --- SystemLanguageModel ---
  FMSystemLanguageModelGetDefault(): Pointer;
  FMSystemLanguageModelCreate(useCase: number, guardrails: number): Pointer;
  FMSystemLanguageModelIsAvailable(
    ref: Pointer,
    outReason: Pointer,
  ): boolean;
  FMSystemLanguageModelGetContextSize(model: Pointer): number;

  // --- Session ---
  FMLanguageModelSessionCreateDefault(): Pointer;
  FMLanguageModelSessionCreateFromSystemLanguageModel(
    model: Pointer | null,
    instructions: Pointer | null,
    tools: Pointer | null,
    toolCount: number,
  ): Pointer;
  FMLanguageModelSessionCreateFromTranscript(
    transcriptSession: Pointer,
    model: Pointer | null,
    tools: Pointer | null,
    toolCount: number,
  ): Pointer;
  FMLanguageModelSessionIsResponding(session: Pointer): boolean;
  FMLanguageModelSessionReset(session: Pointer): void;

  // --- Composed prompt ---
  FMComposedPromptInitialize(): Pointer;
  FMComposedPromptAddText(composedPrompt: Pointer, text: Pointer): void;
  FMComposedPromptAddAttachment(
    composedPrompt: Pointer,
    imagePath: Pointer,
    label: Pointer | null,
    outError: Pointer | null,
  ): boolean;

  // --- Response ---
  FMLanguageModelSessionRespond(
    session: Pointer,
    composedPrompt: Pointer,
    optionsJSON: Pointer | null,
    userInfo: Pointer | null,
    callback: Pointer,
  ): Pointer;
  FMLanguageModelSessionStreamResponse(
    session: Pointer,
    composedPrompt: Pointer,
    optionsJSON: Pointer | null,
  ): Pointer;
  FMLanguageModelSessionResponseStreamIterate(
    stream: Pointer,
    userInfo: Pointer | null,
    callback: Pointer,
  ): void;

  // --- Structured response ---
  FMLanguageModelSessionRespondWithSchema(
    session: Pointer,
    composedPrompt: Pointer,
    schema: Pointer,
    optionsJSON: Pointer | null,
    userInfo: Pointer | null,
    callback: Pointer,
  ): Pointer;
  FMLanguageModelSessionRespondWithSchemaFromJSON(
    session: Pointer,
    composedPrompt: Pointer,
    schemaJSONString: Pointer,
    optionsJSON: Pointer | null,
    userInfo: Pointer | null,
    callback: Pointer,
  ): Pointer;

  // --- Token counting ---
  FMSystemLanguageModelTokenCountForPrompt(
    model: Pointer,
    composedPrompt: Pointer,
    userInfo: Pointer | null,
    callback: Pointer,
  ): Pointer;
  FMSystemLanguageModelTokenCountForInstructions(
    model: Pointer,
    instructions: Pointer,
    userInfo: Pointer | null,
    callback: Pointer,
  ): Pointer;
  FMSystemLanguageModelTokenCountForTools(
    model: Pointer,
    tools: Pointer | null,
    toolCount: number,
    userInfo: Pointer | null,
    callback: Pointer,
  ): Pointer;
  FMSystemLanguageModelTokenCountForSchema(
    model: Pointer,
    schema: Pointer,
    userInfo: Pointer | null,
    callback: Pointer,
  ): Pointer;
  FMSystemLanguageModelTokenCountForTranscript(
    model: Pointer,
    transcriptSession: Pointer,
    userInfo: Pointer | null,
    callback: Pointer,
  ): Pointer;

  // --- Transcript ---
  FMTranscriptCreateFromJSONString(
    jsonString: Pointer,
    outErrorCode: Pointer | null,
    outErrorDescription: Pointer | null,
  ): Pointer | null;
  FMLanguageModelSessionGetTranscriptJSONString(
    session: Pointer,
    outErrorCode: Pointer | null,
    outErrorDescription: Pointer | null,
  ): Pointer | null;

  // --- GenerationSchema ---
  FMGenerationSchemaCreate(name: Pointer, description: Pointer | null): Pointer;
  FMGenerationSchemaPropertyCreate(
    name: Pointer,
    description: Pointer | null,
    typeName: Pointer,
    isOptional: boolean,
  ): Pointer;
  FMGenerationSchemaPropertyAddAnyOfGuide(
    property: Pointer,
    anyOf: Pointer,
    choiceCount: number,
    wrapped: boolean,
  ): void;
  FMGenerationSchemaPropertyAddCountGuide(
    property: Pointer,
    count: number,
    wrapped: boolean,
  ): void;
  FMGenerationSchemaPropertyAddMaximumGuide(
    property: Pointer,
    maximum: number,
    wrapped: boolean,
  ): void;
  FMGenerationSchemaPropertyAddMinimumGuide(
    property: Pointer,
    minimum: number,
    wrapped: boolean,
  ): void;
  FMGenerationSchemaPropertyAddMinItemsGuide(
    property: Pointer,
    minItems: number,
  ): void;
  FMGenerationSchemaPropertyAddMaxItemsGuide(
    property: Pointer,
    maxItems: number,
  ): void;
  FMGenerationSchemaPropertyAddRangeGuide(
    property: Pointer,
    minValue: number,
    maxValue: number,
    wrapped: boolean,
  ): void;
  FMGenerationSchemaPropertyAddRegex(
    property: Pointer,
    pattern: Pointer,
    wrapped: boolean,
  ): void;
  FMGenerationSchemaAddProperty(schema: Pointer, property: Pointer): void;
  FMGenerationSchemaAddReferenceSchema(
    schema: Pointer,
    referenceSchema: Pointer,
  ): void;
  FMGenerationSchemaGetJSONString(
    schema: Pointer,
    outErrorCode: Pointer | null,
    outErrorDescription: Pointer | null,
  ): Pointer | null;

  // --- GeneratedContent ---
  FMGeneratedContentCreateFromJSON(
    jsonString: Pointer,
    outErrorCode: Pointer | null,
    outErrorDescription: Pointer | null,
  ): Pointer | null;
  FMGeneratedContentGetJSONString(content: Pointer): Pointer | null;
  FMGeneratedContentGetPropertyValue(
    content: Pointer,
    propertyName: Pointer,
    outErrorCode: Pointer | null,
    outErrorDescription: Pointer | null,
  ): Pointer | null;
  FMGeneratedContentIsComplete(content: Pointer): boolean;

  // --- Tools ---
  FMBridgedToolCreate(
    name: Pointer,
    description: Pointer,
    parameters: Pointer,
    callable: Pointer,
    outErrorCode: Pointer | null,
    outErrorDescription: Pointer | null,
  ): Pointer | null;
  FMBridgedToolFinishCall(
    tool: Pointer,
    callId: number,
    output: Pointer,
  ): void;

  // --- Memory management ---
  FMTaskCancel(task: Pointer): void;
  FMRetain(object: Pointer): void;
  FMRelease(object: Pointer): void;
  FMFreeString(str: Pointer): void;
}

// ---------- Bun FFI loader ----------

let _native: NativeBindings | null = null;

/**
 * Lazily load and return the native bindings.
 *
 * On first call, locates the dylib via `findDylib()` and opens it
 * using Bun's `dlopen`. Subsequent calls return the cached instance.
 */
export function getNativeBindings(): NativeBindings {
  if (_native) return _native;

  // Dynamic import check – fail fast if not running under Bun
  const isBun = typeof (globalThis as any).Bun !== "undefined";
  if (!isBun) {
    throw new Error(
      "apple-fm-sdk currently requires Bun for FFI support. " +
        "Node.js N-API support is planned.",
    );
  }

  const dylibPath = findDylib();

  // Use Bun's dlopen
  const { dlopen } = require("bun:ffi") as typeof import("bun:ffi");
  const { FFI_SYMBOLS } = require("./bindings.js") as typeof import("./bindings.js");

  const lib = dlopen(dylibPath, FFI_SYMBOLS as any);

  // Expose the raw symbols as our NativeBindings interface
  _native = lib.symbols as unknown as NativeBindings;
  return _native;
}

/**
 * Check whether native bindings are available without throwing.
 */
export function isNativeAvailable(): boolean {
  try {
    getNativeBindings();
    return true;
  } catch {
    return false;
  }
}
