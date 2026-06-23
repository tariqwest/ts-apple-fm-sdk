/**
 * Base class for objects backed by a C pointer from foundation-models-c.
 *
 * Handles reference counting (FMRetain / FMRelease) and provides
 * a FinalizationRegistry-based destructor so callers don't need to
 * manually release resources.
 *
 * Mirrors Python SDK's `_ManagedObject`.
 */

import type { Pointer } from "./types.js";
import { getNativeBindings } from "./native.js";

/**
 * FinalizationRegistry releases the C pointer when the JS wrapper is GC'd.
 *
 * Because FinalizationRegistry is not guaranteed to fire, callers can
 * also call `release()` explicitly for deterministic cleanup.
 */
const pointerRegistry = new FinalizationRegistry<Pointer>((ptr) => {
  try {
    const native = getNativeBindings();
    native.FMRelease(ptr);
  } catch {
    // If native bindings aren't available during shutdown, ignore.
  }
});

export class ManagedObject {
  /** The underlying C pointer. Becomes 0 after release. */
  protected _ptr: Pointer;
  private _released = false;

  constructor(ptr: Pointer) {
    if (!ptr) throw new Error("ManagedObject: received null pointer");
    this._ptr = ptr;
    pointerRegistry.register(this, ptr, this);
  }

  /** Raw pointer value. Throws if already released. */
  get ptr(): Pointer {
    if (this._released) {
      throw new Error("ManagedObject: pointer has been released");
    }
    return this._ptr;
  }

  /** Whether this object has been released. */
  get isReleased(): boolean {
    return this._released;
  }

  /** Explicitly release the underlying C pointer. Idempotent. */
  release(): void {
    if (this._released) return;
    this._released = true;
    pointerRegistry.unregister(this);
    try {
      const native = getNativeBindings();
      native.FMRelease(this._ptr);
    } catch {
      // Ignore if native not available
    }
    this._ptr = 0 as Pointer;
  }

  /** Retain the pointer (increment reference count). */
  retain(): void {
    const native = getNativeBindings();
    native.FMRetain(this.ptr);
  }
}
