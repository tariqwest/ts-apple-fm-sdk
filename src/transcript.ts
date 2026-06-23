/**
 * Transcript — read-only access to a session's conversation history.
 *
 * Mirrors the Python SDK's `Transcript` class and the Swift
 * `FoundationModels.Transcript`.
 */

import { getNativeBindings } from "./ffi/native.js";
import type { FMLanguageModelSessionRef } from "./ffi/types.js";
export class Transcript {
  private _sessionPtr: FMLanguageModelSessionRef;

  constructor(sessionPtr: FMLanguageModelSessionRef) {
    this._sessionPtr = sessionPtr;
  }

  /** The underlying session pointer (used by fromTranscript). */
  get sessionPtr(): FMLanguageModelSessionRef {
    return this._sessionPtr;
  }

  /**
   * Export the transcript as a JSON-compatible dictionary.
   */
  async toDict(): Promise<Record<string, unknown>> {
    const native = getNativeBindings();
    const jsonStr = native.languageModelSessionGetTranscriptJSONString(this._sessionPtr);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  }

  /**
   * Create a Transcript from a JSON dictionary.
   */
  static async fromDict(dict: Record<string, unknown>): Promise<Transcript> {
    const native = getNativeBindings();
    const sessionPtr = native.transcriptCreateFromJSONString(JSON.stringify(dict));
    return new Transcript(sessionPtr);
  }
}
