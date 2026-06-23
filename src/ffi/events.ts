import { GenerationErrorCode } from "../errors.js";
import type {
  Pointer,
  ResponseCallback,
  StructuredResponseCallback,
  TokenCountCallback,
  ToolCallCallback,
} from "./types.js";

type NativeEvent = {
  type: string;
  payload?: Record<string, unknown>;
};

function parseNativeEvent(json: string): NativeEvent | null {
  try {
    return JSON.parse(json) as NativeEvent;
  } catch {
    return null;
  }
}

function asPtr(value: unknown): Pointer {
  return Number(value) as Pointer;
}

export function dispatchResponseEvent(json: string, callback: ResponseCallback): void {
  if (!json) {
    callback(GenerationErrorCode.SUCCESS, null);
    return;
  }
  const event = parseNativeEvent(json);
  if (!event) {
    callback(GenerationErrorCode.UNKNOWN_ERROR, null);
    return;
  }
  if (event.type === "content") {
    callback(GenerationErrorCode.SUCCESS, event.payload?.text as string);
  } else if (event.type === "done") {
    callback(GenerationErrorCode.SUCCESS, null);
  } else if (event.type === "error") {
    callback(
      (event.payload?.status as number) ?? GenerationErrorCode.UNKNOWN_ERROR,
      null,
    );
  }
}

export function dispatchStructuredResponseEvent(
  json: string,
  callback: StructuredResponseCallback,
): void {
  const event = parseNativeEvent(json);
  if (!event) {
    callback(GenerationErrorCode.UNKNOWN_ERROR, null);
    return;
  }
  if (event.type === "content") {
    callback(GenerationErrorCode.SUCCESS, asPtr(event.payload?.contentPtr));
  } else if (event.type === "error") {
    callback(
      (event.payload?.status as number) ?? GenerationErrorCode.UNKNOWN_ERROR,
      null,
    );
  }
}

export function dispatchTokenCountEvent(
  json: string,
  callback: TokenCountCallback,
): void {
  const event = parseNativeEvent(json);
  if (!event) {
    callback(GenerationErrorCode.UNKNOWN_ERROR, 0, "Malformed native callback payload");
    return;
  }
  if (event.type === "count") {
    callback(GenerationErrorCode.SUCCESS, event.payload?.count as number);
  } else if (event.type === "error") {
    callback(
      (event.payload?.status as number) ?? GenerationErrorCode.UNKNOWN_ERROR,
      0,
      event.payload?.description as string | undefined,
    );
  }
}

export function dispatchToolCallEvent(
  json: string,
  callback: ToolCallCallback,
): void {
  const event = parseNativeEvent(json) as
    | (NativeEvent & { contentPtr?: unknown; callId?: unknown })
    | null;
  if (!event) return;
  callback(asPtr(event.contentPtr), event.callId as number);
}