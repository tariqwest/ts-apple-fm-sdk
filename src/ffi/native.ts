/**
 * Runtime-agnostic abstraction over the native FFI layer.
 *
 * Primary implementation uses a Node-API (N-API) native Rust module that wraps
 * the Foundation Models C bindings. The Rust module marshals C callbacks to the
 * JavaScript thread so the SDK works in both Bun and Node.js.
 */

import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Pointer } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const NODE_ADDON_SEARCH_PATHS = [
  resolve(__dirname, "../../build/apple_fm_sdk_napi.node"),
  resolve(__dirname, "../build/apple_fm_sdk_napi.node"),
];

function findNodeAddon(): string {
  for (const p of NODE_ADDON_SEARCH_PATHS) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Could not find apple_fm_sdk_napi.node. Searched:\n${NODE_ADDON_SEARCH_PATHS.map((p) => `  - ${p}`).join("\n")}\n` +
      `Run 'bun run build:native' or './build.sh' to compile.`,
  );
}

function asPtr(value: bigint | number): Pointer {
  return Number(value) as Pointer;
}

/** JS-friendly callback event types. */
export type ResponseCallback = (status: number, text: string | null) => void;
export type StructuredResponseCallback = (status: number, contentPtr: Pointer | null) => void;
export type TokenCountCallback = (status: number, count: number, errorDescription?: string) => void;
export type ToolCallCallback = (contentPtr: Pointer, callId: number) => void;

export interface NativeBindings {
  // --- SystemLanguageModel ---
  systemLanguageModelGetDefault(): Pointer;
  systemLanguageModelCreate(useCase: number, guardrails: number): Pointer;
  systemLanguageModelIsAvailable(model: Pointer): { available: boolean; reason?: number };
  systemLanguageModelGetContextSize(model: Pointer): number;

  // --- Session ---
  languageModelSessionCreateDefault(): Pointer;
  languageModelSessionCreateFromSystemLanguageModel(
    model: Pointer | null,
    instructions: string | null,
    tools: Pointer[],
  ): Pointer;
  languageModelSessionCreateFromTranscript(
    transcript: Pointer,
    model: Pointer | null,
    tools: Pointer[],
  ): Pointer;
  languageModelSessionIsResponding(session: Pointer): boolean;
  languageModelSessionReset(session: Pointer): void;

  // --- Composed prompt ---
  composedPromptInitialize(): Pointer;
  composedPromptAddText(prompt: Pointer, text: string): void;
  composedPromptAddAttachment(
    prompt: Pointer,
    imagePath: string,
    label: string | null,
  ): boolean;

  // --- Response ---
  languageModelSessionRespond(
    session: Pointer,
    prompt: Pointer,
    optionsJSON: string | null,
    callback: ResponseCallback,
  ): Pointer;
  languageModelSessionStreamResponse(
    session: Pointer,
    prompt: Pointer,
    optionsJSON: string | null,
  ): Pointer;
  languageModelSessionResponseStreamIterate(
    stream: Pointer,
    callback: ResponseCallback,
  ): void;

  // --- Structured response ---
  languageModelSessionRespondWithSchema(
    session: Pointer,
    prompt: Pointer,
    schema: Pointer,
    optionsJSON: string | null,
    callback: StructuredResponseCallback,
  ): Pointer;
  languageModelSessionRespondWithSchemaFromJSON(
    session: Pointer,
    prompt: Pointer,
    schemaJSON: string,
    optionsJSON: string | null,
    callback: StructuredResponseCallback,
  ): Pointer;

  // --- Token counting ---
  systemLanguageModelTokenCountForPrompt(
    model: Pointer,
    prompt: Pointer,
    callback: TokenCountCallback,
  ): Pointer;
  systemLanguageModelTokenCountForInstructions(
    model: Pointer,
    instructions: string,
    callback: TokenCountCallback,
  ): Pointer;
  systemLanguageModelTokenCountForTools(
    model: Pointer,
    tools: Pointer[],
    callback: TokenCountCallback,
  ): Pointer;
  systemLanguageModelTokenCountForSchema(
    model: Pointer,
    schema: Pointer,
    callback: TokenCountCallback,
  ): Pointer;
  systemLanguageModelTokenCountForTranscript(
    model: Pointer,
    transcript: Pointer,
    callback: TokenCountCallback,
  ): Pointer;

  // --- Transcript ---
  transcriptCreateFromJSONString(json: string): Pointer;
  languageModelSessionGetTranscriptJSONString(session: Pointer): string;

  // --- GenerationSchema ---
  generationSchemaCreate(name: string, description: string | null): Pointer;
  generationSchemaPropertyCreate(
    name: string,
    description: string | null,
    typeName: string,
    isOptional: boolean,
  ): Pointer;
  generationSchemaPropertyAddRangeGuide(
    property: Pointer,
    min: number,
    max: number,
    wrapped: boolean,
  ): void;
  generationSchemaPropertyAddMinimumGuide(
    property: Pointer,
    minimum: number,
    wrapped: boolean,
  ): void;
  generationSchemaPropertyAddMaximumGuide(
    property: Pointer,
    maximum: number,
    wrapped: boolean,
  ): void;
  generationSchemaPropertyAddCountGuide(
    property: Pointer,
    count: number,
    wrapped: boolean,
  ): void;
  generationSchemaPropertyAddMinItemsGuide(
    property: Pointer,
    minItems: number,
  ): void;
  generationSchemaPropertyAddMaxItemsGuide(
    property: Pointer,
    maxItems: number,
  ): void;
  generationSchemaPropertyAddRegex(
    property: Pointer,
    pattern: string,
    wrapped: boolean,
  ): void;
  generationSchemaPropertyAddAnyOfGuide(
    property: Pointer,
    values: string[],
    wrapped: boolean,
  ): void;
  generationSchemaAddProperty(schema: Pointer, property: Pointer): void;
  generationSchemaAddReferenceSchema(schema: Pointer, referenceSchema: Pointer): void;
  generationSchemaGetJSONString(schema: Pointer): string;

  // --- GeneratedContent ---
  generatedContentCreateFromJSON(json: string): Pointer;
  generatedContentGetJSONString(content: Pointer): string;
  generatedContentIsComplete(content: Pointer): boolean;

  // --- Tools ---
  bridgedToolCreate(
    name: string,
    description: string,
    parameters: Pointer,
    callback: ToolCallCallback,
  ): Pointer;
  bridgedToolFinishCall(tool: Pointer, callId: number, output: string): void;
  setActiveToolCallback(callback: ToolCallCallback): void;

  // --- Memory management ---
  fmRetain(ptr: Pointer): void;
  fmRelease(ptr: Pointer): void;
  fmFreeString(ptr: Pointer): void;
  fmTaskCancel(ptr: Pointer): void;
}

let _native: NativeBindings | null = null;

export function getNativeBindings(): NativeBindings {
  if (_native) return _native;

  const addon = require(findNodeAddon()) as any;

  _native = {
    systemLanguageModelGetDefault: () => asPtr(addon.systemLanguageModelGetDefault()),
    systemLanguageModelCreate: (useCase, guardrails) => asPtr(addon.systemLanguageModelCreate(useCase, guardrails)),
    systemLanguageModelIsAvailable: (model) => addon.systemLanguageModelIsAvailable(model),
    systemLanguageModelGetContextSize: (model) => addon.systemLanguageModelGetContextSize(model),

    languageModelSessionCreateDefault: () => asPtr(addon.languageModelSessionCreateDefault()),
    languageModelSessionCreateFromSystemLanguageModel: (model, instructions, tools) =>
      asPtr(addon.languageModelSessionCreateFromSystemLanguageModel(model, instructions, tools)),
    languageModelSessionCreateFromTranscript: (transcript, model, tools) =>
      asPtr(addon.languageModelSessionCreateFromTranscript(transcript, model, tools)),
    languageModelSessionIsResponding: (session) => addon.languageModelSessionIsResponding(session),
    languageModelSessionReset: (session) => addon.languageModelSessionReset(session),

    composedPromptInitialize: () => asPtr(addon.composedPromptInitialize()),
    composedPromptAddText: (prompt, text) => addon.composedPromptAddText(prompt, text),
    composedPromptAddAttachment: (prompt, imagePath, label) =>
      addon.composedPromptAddAttachment(prompt, imagePath, label),

    languageModelSessionRespond: (session, prompt, optionsJSON, callback) => {
      const nativeCallback = (json: string) => {
        if (!json) {
          callback(0, null);
          return;
        }
        const event = JSON.parse(json);
        if (event.type === "content") {
          callback(0, event.payload.text);
        } else if (event.type === "done") {
          callback(0, null);
        } else if (event.type === "error") {
          callback(event.payload.status, null);
        }
      };
      return asPtr(addon.languageModelSessionRespond(session, prompt, optionsJSON, nativeCallback));
    },

    languageModelSessionStreamResponse: (session, prompt, optionsJSON) =>
      asPtr(addon.languageModelSessionStreamResponse(session, prompt, optionsJSON)),

    languageModelSessionResponseStreamIterate: (stream, callback) => {
      const nativeCallback = (json: string) => {
        const event = JSON.parse(json);
        if (event.type === "content") {
          callback(0, event.payload.text);
        } else if (event.type === "done") {
          callback(0, null);
        } else if (event.type === "error") {
          callback(event.payload.status, null);
        }
      };
      addon.languageModelSessionResponseStreamIterate(stream, nativeCallback);
    },

    languageModelSessionRespondWithSchema: (session, prompt, schema, optionsJSON, callback) => {
      const nativeCallback = (json: string) => {
        const event = JSON.parse(json);
        if (event.type === "content") {
          callback(0, asPtr(event.payload.contentPtr));
        } else if (event.type === "error") {
          callback(event.payload.status, null);
        }
      };
      return asPtr(addon.languageModelSessionRespondWithSchema(session, prompt, schema, optionsJSON, nativeCallback));
    },

    languageModelSessionRespondWithSchemaFromJSON: (session, prompt, schemaJSON, optionsJSON, callback) => {
      const nativeCallback = (json: string) => {
        const event = JSON.parse(json);
        if (event.type === "content") {
          callback(0, asPtr(event.payload.contentPtr));
        } else if (event.type === "error") {
          callback(event.payload.status, null);
        }
      };
      return asPtr(addon.languageModelSessionRespondWithSchemaFromJson(session, prompt, schemaJSON, optionsJSON, nativeCallback));
    },

    systemLanguageModelTokenCountForPrompt: (model, prompt, callback) => {
      const nativeCallback = (json: string) => {
        const event = JSON.parse(json);
        if (event.type === "count") {
          callback(0, event.payload.count);
        } else if (event.type === "error") {
          callback(event.payload.status, 0, event.payload.description);
        }
      };
      return asPtr(addon.systemLanguageModelTokenCountForPrompt(model, prompt, nativeCallback));
    },

    systemLanguageModelTokenCountForInstructions: (model, instructions, callback) => {
      const nativeCallback = (json: string) => {
        const event = JSON.parse(json);
        if (event.type === "count") {
          callback(0, event.payload.count);
        } else if (event.type === "error") {
          callback(event.payload.status, 0, event.payload.description);
        }
      };
      return asPtr(addon.systemLanguageModelTokenCountForInstructions(model, instructions, nativeCallback));
    },

    systemLanguageModelTokenCountForTools: (model, tools, callback) => {
      const nativeCallback = (json: string) => {
        const event = JSON.parse(json);
        if (event.type === "count") {
          callback(0, event.payload.count);
        } else if (event.type === "error") {
          callback(event.payload.status, 0, event.payload.description);
        }
      };
      return asPtr(addon.systemLanguageModelTokenCountForTools(model, tools, nativeCallback));
    },

    systemLanguageModelTokenCountForSchema: (model, schema, callback) => {
      const nativeCallback = (json: string) => {
        const event = JSON.parse(json);
        if (event.type === "count") {
          callback(0, event.payload.count);
        } else if (event.type === "error") {
          callback(event.payload.status, 0, event.payload.description);
        }
      };
      return asPtr(addon.systemLanguageModelTokenCountForSchema(model, schema, nativeCallback));
    },

    systemLanguageModelTokenCountForTranscript: (model, transcript, callback) => {
      const nativeCallback = (json: string) => {
        const event = JSON.parse(json);
        if (event.type === "count") {
          callback(0, event.payload.count);
        } else if (event.type === "error") {
          callback(event.payload.status, 0, event.payload.description);
        }
      };
      return asPtr(addon.systemLanguageModelTokenCountForTranscript(model, transcript, nativeCallback));
    },

    transcriptCreateFromJSONString: (json) => asPtr(addon.transcriptCreateFromJsonString(json)),
    languageModelSessionGetTranscriptJSONString: (session) =>
      addon.languageModelSessionGetTranscriptJsonString(session),

    generationSchemaCreate: (name, description) => asPtr(addon.generationSchemaCreate(name, description)),
    generationSchemaPropertyCreate: (name, description, typeName, isOptional) =>
      asPtr(addon.generationSchemaPropertyCreate(name, description, typeName, isOptional)),
    generationSchemaPropertyAddRangeGuide: (property, min, max, wrapped) =>
      addon.generationSchemaPropertyAddRangeGuide(property, min, max, wrapped),
    generationSchemaPropertyAddMinimumGuide: (property, minimum, wrapped) =>
      addon.generationSchemaPropertyAddMinimumGuide(property, minimum, wrapped),
    generationSchemaPropertyAddMaximumGuide: (property, maximum, wrapped) =>
      addon.generationSchemaPropertyAddMaximumGuide(property, maximum, wrapped),
    generationSchemaPropertyAddCountGuide: (property, count, wrapped) =>
      addon.generationSchemaPropertyAddCountGuide(property, count, wrapped),
    generationSchemaPropertyAddMinItemsGuide: (property, minItems) =>
      addon.generationSchemaPropertyAddMinItemsGuide(property, minItems),
    generationSchemaPropertyAddMaxItemsGuide: (property, maxItems) =>
      addon.generationSchemaPropertyAddMaxItemsGuide(property, maxItems),
    generationSchemaPropertyAddRegex: (property, pattern, wrapped) =>
      addon.generationSchemaPropertyAddRegex(property, pattern, wrapped),
    generationSchemaPropertyAddAnyOfGuide: (property, values, wrapped) =>
      addon.generationSchemaPropertyAddAnyOfGuide(property, values, wrapped),
    generationSchemaAddProperty: (schema, property) => addon.generationSchemaAddProperty(schema, property),
    generationSchemaAddReferenceSchema: (schema, referenceSchema) =>
      addon.generationSchemaAddReferenceSchema(schema, referenceSchema),
    generationSchemaGetJSONString: (schema) => addon.generationSchemaGetJsonString(schema),

    generatedContentCreateFromJSON: (json) => asPtr(addon.generatedContentCreateFromJson(json)),
    generatedContentGetJSONString: (content) => addon.generatedContentGetJsonString(content),
    generatedContentIsComplete: (content) => addon.generatedContentIsComplete(content),

    bridgedToolCreate: (name, description, parameters, callback) =>
      asPtr(addon.bridgedToolCreate(name, description, parameters, (json: string) => {
        const event = JSON.parse(json);
        callback(asPtr(event.contentPtr), event.callId);
      })),
    bridgedToolFinishCall: (tool, callId, output) => addon.bridgedToolFinishCall(tool, callId, output),
    setActiveToolCallback: (callback) => addon.setActiveToolCallback((json: string) => {
      const event = JSON.parse(json);
      callback(asPtr(event.contentPtr), event.callId);
    }),

    fmRetain: (ptr) => addon.fmRetain(ptr),
    fmRelease: (ptr) => addon.fmRelease(ptr),
    fmFreeString: (ptr) => addon.fmFreeString(ptr),
    fmTaskCancel: (ptr) => addon.fmTaskCancel(ptr),
  };

  return _native;
}
