/**
 * Mapping between TypeScript/Zod types and the Swift type strings
 * expected by the foundation-models-c schema API.
 *
 * Mirrors Python SDK's type_conversion.py.
 */

import { z, type ZodTypeAny } from "zod";

/**
 * Convert a Zod type to the Swift type string expected by
 * FMGenerationSchemaPropertyCreate's `typeName` parameter.
 */
export function zodTypeToSwiftString(schema: ZodTypeAny): string {
  // Unwrap ZodOptional / ZodNullable / ZodDefault
  const unwrapped = unwrapZodType(schema);

  if (unwrapped instanceof z.ZodString) return "string";
  if (unwrapped instanceof z.ZodNumber) {
    // Check if it has an integer check
    const checks = (unwrapped as any)._def?.checks as Array<{ kind: string }> | undefined;
    const isInt = checks?.some((c) => c.kind === "int");
    return isInt ? "integer" : "number";
  }
  if (unwrapped instanceof z.ZodBoolean) return "boolean";

  if (unwrapped instanceof z.ZodArray) {
    const elementType = zodTypeToSwiftString(unwrapped.element);
    return `array<${elementType}>`;
  }

  if (unwrapped instanceof z.ZodEnum) {
    return "string";
  }

  // For ZodObject, return the schema name if available, or "object"
  if (unwrapped instanceof z.ZodObject) {
    return (unwrapped as any)._def?.typeName ?? "object";
  }

  throw new TypeError(
    `Unsupported Zod type for Swift conversion: ${unwrapped.constructor.name}`,
  );
}

/**
 * Check whether a Zod schema represents an optional type.
 */
export function isZodOptional(schema: ZodTypeAny): boolean {
  return (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable
  );
}

/**
 * Check whether a Zod schema represents an array type.
 */
export function isZodArray(schema: ZodTypeAny): boolean {
  const unwrapped = unwrapZodType(schema);
  return unwrapped instanceof z.ZodArray;
}

/**
 * Unwrap ZodOptional, ZodNullable, ZodDefault to get the inner type.
 */
export function unwrapZodType(schema: ZodTypeAny): ZodTypeAny {
  if (schema instanceof z.ZodOptional) return unwrapZodType(schema.unwrap());
  if (schema instanceof z.ZodNullable) return unwrapZodType(schema.unwrap());
  if (schema instanceof z.ZodDefault) return unwrapZodType(schema.removeDefault());
  return schema;
}
