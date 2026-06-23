/**
 * Bridge between TypeScript Tool instances and the C bridged tool API.
 *
 * Each Tool subclass instance is wrapped in a `BridgedTool` that registers a
 * C-callable callback. When the model invokes the tool, the callback parses the
 * generated arguments, calls the tool's async `call()` method, and reports the
 * result back to the model via bridgedToolFinishCall.
 */

import { ManagedObject } from "./ffi/managed-object.js";
import { getNativeBindings } from "./ffi/native.js";
import type { Pointer, FMGeneratedContentRef } from "./ffi/types.js";
import { GeneratedContent } from "./generable.js";
import { Tool } from "./tool.js";
import { statusCodeToError } from "./errors.js";

export class BridgedTool extends ManagedObject {
  private _tool: Tool;

  constructor(tool: Tool) {
    const native = getNativeBindings();
    const schema = tool.argumentsSchema;

    const callback = (contentPtr: Pointer, callId: number) => {
      // Ownership of contentPtr is transferred to us. Wrap it and release it
      // after the async tool call completes.
      const content = new GeneratedContent(undefined, undefined, contentPtr);

      Promise.resolve()
        .then(() => tool.call(content))
        .then((result) => {
          native.bridgedToolFinishCall(this.ptr, callId, result);
        })
        .catch((error: Error) => {
          native.bridgedToolFinishCall(
            this.ptr,
            callId,
            `Tool error: ${error.message}`,
          );
        });
    };

    const ptr = native.bridgedToolCreate(
      tool.name,
      tool.description,
      schema.ptr,
      callback,
    );

    super(ptr);
    this._tool = tool;
  }
}

/**
 * Create a bridged tool wrapper for a TypeScript Tool instance.
 *
 * The returned BridgedTool must be kept alive for as long as the session may
 * invoke the tool. It is released automatically when garbage collected or when
 * release() is called.
 */
export function createBridgedTool(tool: Tool): BridgedTool {
  return new BridgedTool(tool);
}
