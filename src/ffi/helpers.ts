/**
 * Low-level FFI helpers for Bun.
 *
 * Wraps `bun:ffi` primitives so the rest of the SDK can work with C strings,
 * pointers, buffers, and JSCallbacks without importing `bun:ffi` directly.
 *
 * All `bun:ffi` imports are lazy so that modules can be loaded under
 * Vitest/Node.js (which cannot resolve `bun:ffi`) until native functions are
 * actually invoked.
 */

import type { Pointer } from "./types.js";

const encoder = new TextEncoder();

type BunFFI = typeof import("bun:ffi");

let _bunFFI: BunFFI | null = null;

function getBunFFI(): BunFFI {
  if (_bunFFI) return _bunFFI;
  _bunFFI = require("bun:ffi") as BunFFI;
  return _bunFFI;
}

/**
 * Encode a JavaScript string as a null-terminated UTF-8 Buffer.
 *
 * The returned Buffer owns the bytes. Pass it where a C `const char*` is
 * expected. The caller must keep the Buffer alive for the duration of the FFI
 * call.
 */
export function toCString(str: string): Buffer {
  return Buffer.from(encoder.encode(str + "\0"));
}

/**
 * Convert a Buffer/TypedArray to a pointer value suitable for FFI.
 */
export function toPointer(buf: Buffer | Uint8Array | ArrayBuffer): Pointer {
  return getBunFFI().ptr(buf as unknown as ArrayBuffer) as Pointer;
}

/**
 * Encode a JavaScript string and return both the pointer and the Buffer.
 *
 * The Buffer must be kept alive for as long as the C code may read the string.
 */
export function toCStringPtr(str: string): { ptr: Pointer; buf: Buffer } {
  const buf = toCString(str);
  return { ptr: toPointer(buf), buf };
}

/**
 * Read a null-terminated C string from a pointer.
 */
export function readCString(ptrValue: Pointer): string {
  return new (getBunFFI().CString)(ptrValue).toString();
}

/**
 * Read a C string of known length from a pointer.
 */
export function readCStringN(ptrValue: Pointer, length: number): string {
  return new (getBunFFI().CString)(ptrValue, 0, length).toString();
}

/**
 * Allocate a zeroed buffer of a given size and return [pointer, buffer].
 */
export function allocate(size: number): [Pointer, Buffer] {
  const buf = Buffer.alloc(size);
  return [toPointer(buf), buf];
}

/**
 * Allocate an int32 out-parameter and return [pointer, int32Array].
 */
export function allocateInt32(): [Pointer, Int32Array] {
  const arr = new Int32Array(1);
  return [toPointer(Buffer.from(arr.buffer)), arr];
}

/**
 * Allocate a pointer-sized out-parameter and return [pointer, dataView].
 */
export function allocatePointer(): [Pointer, DataView] {
  const buf = Buffer.allocUnsafe(8); // 64-bit pointer
  return [toPointer(buf), new DataView(buf.buffer, buf.byteOffset, 8)];
}

/**
 * Read an int32 from an out-parameter allocated by allocateInt32().
 */
export function readInt32FromPtr(
  _ptr: Pointer,
  arr: Int32Array,
): number {
  return arr[0] ?? 0;
}

/**
 * Read a pointer value from an out-parameter allocated by allocatePointer().
 *
 * On 64-bit systems, reads a little-endian uint64 and returns it as a number.
 */
export function readPointerFromPtr(
  _ptr: Pointer,
  view: DataView,
): Pointer {
  return Number(view.getBigUint64(0, true)) as Pointer;
}

/**
 * Create a C-callable JS callback.
 *
 * @param fn The JavaScript function to expose to C.
 * @param args C argument types.
 * @param returns C return type (default "void").
 * @param threadsafe Whether the callback may be called from a different thread.
 */
export function createCallback(
  fn: (...args: any[]) => any,
  args: (import("bun:ffi").FFIType | keyof import("bun:ffi").FFITypeStringToType)[],
  returns: (import("bun:ffi").FFIType | keyof import("bun:ffi").FFITypeStringToType) = "void",
  threadsafe = true,
): import("bun:ffi").JSCallback {
  return new (getBunFFI().JSCallback)(fn, {
    args,
    returns,
    threadsafe,
  });
}

/**
 * Convert a pointer returned by a C function that returns a string into a
 * JavaScript string, then free the C string with FMFreeString.
 *
 * @param native The native bindings (must expose FMFreeString).
 * @param strPtr The pointer returned by the C function.
 */
export function readAndFreeCString(
  native: { FMFreeString(ptr: Pointer): void },
  strPtr: Pointer | null,
): string | null {
  if (!strPtr) return null;
  try {
    return new (getBunFFI().CString)(strPtr).toString();
  } finally {
    native.FMFreeString(strPtr);
  }
}

/**
 * Read a Buffer from a pointer/length pair.
 *
 * This copies the bytes into a JavaScript Buffer, so it is safe after the
 * underlying memory is freed.
 */
export function readBuffer(
  ptrValue: Pointer,
  length: number,
): Buffer {
  const ab = getBunFFI().toArrayBuffer(ptrValue as Pointer, 0, length);
  return Buffer.from(ab);
}

/**
 * Read a UTF-8 string from a pointer/length pair.
 */
export function readString(ptrValue: Pointer, length: number): string {
  return readBuffer(ptrValue, length).toString("utf-8");
}
