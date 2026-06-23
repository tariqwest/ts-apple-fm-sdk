/**
 * GenerationSchema — defines the structure for guided generation.
 *
 * Mirrors the Python SDK's `GenerationSchema` class.
 * Built from Zod schemas via the `generable()` helper.
 */

import { ManagedObject } from "./ffi/managed-object.js";
import { getNativeBindings, requirePointer } from "./ffi/native.js";
import type { Pointer } from "./ffi/types.js";
import type { ZodObject, ZodRawShape, ZodTypeAny } from "zod";
import {
  zodTypeToSwiftString,
  isZodOptional,
  isZodArray,
  unwrapZodType,
} from "./type-conversion.js";
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

    const schemaRef = requirePointer(
      native.generationSchemaCreate(name, description ?? null),
      "generationSchemaCreate",
    );

    // Add properties
    for (const [propName, meta] of properties) {
      const zodType = zodShape[propName];
      if (!zodType) continue;

      const optional = isZodOptional(zodType as ZodTypeAny);
      const swiftType = meta.nestedSchema
        ? meta.nestedSchema.name
        : zodTypeToSwiftString(zodType as ZodTypeAny);

      const propRef = native.generationSchemaPropertyCreate(
        propName,
        meta.description ?? null,
        swiftType,
        optional,
      );

      applyGuides(native, propRef, meta.guides, zodType as ZodTypeAny);

      native.generationSchemaAddProperty(schemaRef, propRef);
    }

    // Add nested/reference schemas
    for (const nested of nestedSchemas) {
      native.generationSchemaAddReferenceSchema(schemaRef, nested.ptr);
    }

    super(schemaRef);
    this.name = name;
    this.description = description;
    this.properties = properties;
    this.zodShape = zodShape;
    this.nestedSchemas = nestedSchemas;
  }

  /** Get the schema as a JSON string (for debugging/validation). */
  toJSONString(): string {
    const native = getNativeBindings();
    return native.generationSchemaGetJSONString(this.ptr);
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

  if (guides.anyOf) {
    native.generationSchemaPropertyAddAnyOfGuide(propRef, guides.anyOf, isArray);
  }

  if (guides.range) {
    const [min, max] = guides.range;
    native.generationSchemaPropertyAddRangeGuide(propRef, min, max, isArray);
  }

  if (guides.minimum !== undefined) {
    native.generationSchemaPropertyAddMinimumGuide(propRef, guides.minimum, isArray);
  }

  if (guides.maximum !== undefined) {
    native.generationSchemaPropertyAddMaximumGuide(propRef, guides.maximum, isArray);
  }

  if (guides.count !== undefined) {
    native.generationSchemaPropertyAddCountGuide(propRef, guides.count, isArray);
  }

  if (guides.minItems !== undefined) {
    native.generationSchemaPropertyAddMinItemsGuide(propRef, guides.minItems);
  }

  if (guides.maxItems !== undefined) {
    native.generationSchemaPropertyAddMaxItemsGuide(propRef, guides.maxItems);
  }

  if (guides.regex) {
    native.generationSchemaPropertyAddRegex(propRef, guides.regex, isArray);
  }

  if (guides.constant) {
    // constant is implemented as anyOf with a single value
    native.generationSchemaPropertyAddAnyOfGuide(propRef, [guides.constant], isArray);
  }
}
