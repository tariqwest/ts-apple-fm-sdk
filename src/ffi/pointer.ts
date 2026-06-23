import type { Pointer } from "./types.js";
import { FoundationModelsError } from "../errors.js";

/** Ensure a native FFI call returned a non-null pointer. */
export function requirePointer(ptr: Pointer, context: string): Pointer {
  if (!ptr) {
    throw new FoundationModelsError(`${context}: native call returned null pointer`);
  }
  return ptr;
}