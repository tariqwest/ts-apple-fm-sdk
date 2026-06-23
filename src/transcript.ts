/**
 * Transcript — read-only access to a session's conversation history.
 *
 * Mirrors the Python SDK's `Transcript` class and the Swift
 * `FoundationModels.Transcript`.
 */

import { getNativeBindings } from "./ffi/native.js";
import type { Pointer, FMLanguageModelSessionRef } from "./ffi/types.js";

export class Transcript {
  private _sessionPtr: FMLanguageModelSessionRef;

  constructor(sessionPtr: FMLanguageModelSessionRef) {
    this._sessionPtr = sessionPtr;
  }

  /** The underlying session pointer (used by fromTranscript). */
  get sessionPtr(): FMLanguageModelSessionRef {
    return this._sessionPtr;
  }

  /** Update the session pointer (called when session is recreated). */
  updateSessionPtr(newPtr: FMLanguageModelSessionRef): void {
    this._sessionPtr = newPtr;
  }

  /**
   * Export the transcript as a JSON-compatible dictionary.
   *
   * The format matches Swift's `Transcript` Codable output:
   * ```json
   * {
   *   "version": 1,
   *   "type": "FoundationModels.Transcript",
   *   "transcript": {
   *     "entries": [...]
   *   }
   * }
   * ```
   */
  async toDict(): Promise<Record<string, unknown>> {
    const native = getNativeBindings();

    const errorCodeBuf = new Int32Array(1);
    const errorCodePtr = Buffer.from(errorCodeBuf.buffer) as unknown as Pointer;

    // Allocate a pointer-sized buffer for the error description
    const errorDescBuf = new BigUint64Array(1);
    const errorDescPtr = Buffer.from(errorDescBuf.buffer) as unknown as Pointer;

    const jsonPtr = native.FMLanguageModelSessionGetTranscriptJSONString(
      this._sessionPtr,
      errorCodePtr,
      errorDescPtr,
    );

    if (!jsonPtr) {
      const errorCode = errorCodeBuf[0];
      throw new Error(
        `Failed to get transcript JSON (error code: ${errorCode})`,
      );
    }

    // Read the JSON string
    try {
      const jsonStr = Buffer.from(jsonPtr as unknown as ArrayBuffer).toString("utf-8");
      return JSON.parse(jsonStr) as Record<string, unknown>;
    } finally {
      native.FMFreeString(jsonPtr);
    }
  }

  /**
   * Create a Transcript from a JSON dictionary.
   *
   * This creates a new session with the given transcript data.
   */
  static async fromDict(dict: Record<string, unknown>): Promise<Transcript> {
    const native = getNativeBindings();
    const jsonStr = JSON.stringify(dict);
    const encoder = new TextEncoder();
    const jsonBuf = encoder.encode(jsonStr + "\0");
    const jsonPtr = Buffer.from(jsonBuf) as unknown as Pointer;

    const errorCodeBuf = new Int32Array(1);
    const errorCodePtr = Buffer.from(errorCodeBuf.buffer) as unknown as Pointer;
    const errorDescBuf = new BigUint64Array(1);
    const errorDescPtr = Buffer.from(errorDescBuf.buffer) as unknown as Pointer;

    const sessionPtr = native.FMTranscriptCreateFromJSONString(
      jsonPtr,
      errorCodePtr,
      errorDescPtr,
    );

    if (!sessionPtr) {
      const errorCode = errorCodeBuf[0];
      throw new Error(
        `Failed to create transcript from JSON (error code: ${errorCode})`,
      );
    }

    return new Transcript(sessionPtr);
  }
}
