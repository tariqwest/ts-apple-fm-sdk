/**
 * GenerationSchema — defines the structure for guided generation.
 *
 * Mirrors the Python SDK's `GenerationSchema` class.
 * Built from Zod schemas via the `generable()` helper.
 */

import { ManagedObject } from "./ffi/managed-object.js";
import { getNativeBindings } from "./ffi/native.js";
import type { Pointer } from "./ffi/types.js";
import type { ZodObject, ZodRawShape, ZodTypeAny } from "zod";
import { zodTypeToSwiftString, isZodOptional, isZodArray, unwrapZodType } from "./type-conversion.js";
import type { GuideConstraints } from "./generation-guide.js";

// --- Property metadata stored alongside Zod fields ---

export interface PropertyMeta {
  description?: string;
  guides: GuideConstraints;
  /** Whether this property wraps a nested generable. */
  nestedSchema?: GenerationSchema;
}

/**
 * A guided generation schema backed by an FFI pointer.
 *
 * Created via `generable()` — not typically constructed directly.
 */
export class GenerationSchema extends ManagedObject {
  readonly name: string;
  readonly description?: string;
  readonly properties: Map<string, PropertyMeta>;
  readonly zodShape: ZodRawShape;
  readonly nestedSchemas: GenerationSchema[];

  constructor(
    name: string,
    zodShape: ZodRawShape,
    properties: Map<string, PropertyMeta>,
    nestedSchemas: GenerationSchema[],
    description?: string,
  ) {
    const native = getNativeBindings();
    const encoder = new TextEncoder();

    // Create the C schema
    const namePtr = Buffer.from(encoder.encode(name + "\0")) as unknown as Pointer;
    const descPtr = description
      ? (Buffer.from(encoder.encode(description + "\0")) as unknown as Pointer)
      : null;

    const schemaRef = native.FMGenerationSchemaCreate(namePtr, descPtr);

    // Add properties
    for (const [propName, meta] of properties) {
      const zodType = zodShape[propName];
      if (!zodType) continue;

      const optional = isZodOptional(zodType as ZodTypeAny);
      const swiftType = meta.nestedSchema
        ? meta.nestedSchema.name
        : zodTypeToSwiftString(zodType as ZodTypeAny);

      const propNamePtr = Buffer.from(
        encoder.encode(propName + "\0"),
      ) as unknown as Pointer;
      const propDescPtr = meta.description
        ? (Buffer.from(encoder.encode(meta.description + "\0")) as unknown as Pointer)
        : null;
      const typeNamePtr = Buffer.from(
        encoder.encode(swiftType + "\0"),
      ) as unknown as Pointer;

      const propRef = native.FMGenerationSchemaPropertyCreate(
        propNamePtr,
        propDescPtr,
        typeNamePtr,
        optional,
      );

      // Apply guides
      applyGuides(native, propRef, meta.guides, zodType as ZodTypeAny);

      native.FMGenerationSchemaAddProperty(schemaRef, propRef);
    }

    // Add nested/reference schemas
    for (const nested of nestedSchemas) {
      native.FMGenerationSchemaAddReferenceSchema(schemaRef, nested.ptr);
    }

    super(schemaRef);
    this.name = name;
    this.description = description;
    this.properties = properties;
    this.zodShape = zodShape;
    this.nestedSchemas = nestedSchemas;
  }

  /** Get the schema as a JSON string (for debugging/validation). */
  toJSONString(): string | null {
    const native = getNativeBindings();
    const errorCodeBuf = new Int32Array(1);
    const errorCodePtr = Buffer.from(errorCodeBuf.buffer) as unknown as Pointer;
    const errorDescBuf = new BigUint64Array(1);
    const errorDescPtr = Buffer.from(errorDescBuf.buffer) as unknown as Pointer;

    const jsonPtr = native.FMGenerationSchemaGetJSONString(
      this.ptr,
      errorCodePtr,
      errorDescPtr,
    );

    if (!jsonPtr) return null;

    try {
      return Buffer.from(jsonPtr as unknown as ArrayBuffer).toString("utf-8");
    } finally {
      native.FMFreeString(jsonPtr);
    }
  }
}

// --- Guide application helper ---

function applyGuides(
  native: ReturnType<typeof getNativeBindings>,
  propRef: Pointer,
  guides: GuideConstraints,
  zodType: ZodTypeAny,
): void {
  const isArray = isZodArray(zodType);
  const encoder = new TextEncoder();

  if (guides.anyOf) {
    const values = guides.anyOf;
    // Create array of C strings
    const ptrs = values.map(
      (v) => Buffer.from(encoder.encode(v + "\0")) as unknown as Pointer,
    );
    // For now, pass as array pointer — exact FFI mechanics depend on runtime
    const arrayPtr = ptrs as unknown as Pointer;
    native.FMGenerationSchemaPropertyAddAnyOfGuide(
      propRef,
      arrayPtr,
      values.length,
      isArray,
    );
  }

  if (guides.range) {
    const [min, max] = guides.range;
    native.FMGenerationSchemaPropertyAddRangeGuide(propRef, min, max, isArray);
  }

  if (guides.minimum !== undefined) {
    native.FMGenerationSchemaPropertyAddMinimumGuide(propRef, guides.minimum, isArray);
  }

  if (guides.maximum !== undefined) {
    native.FMGenerationSchemaPropertyAddMaximumGuide(propRef, guides.maximum, isArray);
  }

  if (guides.count !== undefined) {
    native.FMGenerationSchemaPropertyAddCountGuide(propRef, guides.count, isArray);
  }

  if (guides.minItems !== undefined) {
    native.FMGenerationSchemaPropertyAddMinItemsGuide(propRef, guides.minItems);
  }

  if (guides.maxItems !== undefined) {
    native.FMGenerationSchemaPropertyAddMaxItemsGuide(propRef, guides.maxItems);
  }

  if (guides.regex) {
    const patternPtr = Buffer.from(
      encoder.encode(guides.regex + "\0"),
    ) as unknown as Pointer;
    native.FMGenerationSchemaPropertyAddRegex(propRef, patternPtr, isArray);
  }

  if (guides.constant) {
    // constant is implemented as anyOf with a single value
    const constPtr = Buffer.from(
      encoder.encode(guides.constant + "\0"),
    ) as unknown as Pointer;
    native.FMGenerationSchemaPropertyAddAnyOfGuide(
      propRef,
      [constPtr] as unknown as Pointer,
      1,
      isArray,
    );
  }
}
