/**
 * Guide constraints for guided generation.
 *
 * The `guide()` function wraps a Zod type with metadata that maps to
 * Swift's `@Guide` macro constraints (anyOf, range, count, regex, etc.).
 *
 * Mirrors the Python SDK's `guide()` function and `GenerationGuide` class.
 */

import type { ZodTypeAny } from "zod";

// --- Guide constraint types ---

export const GuideType = {
  ANY_OF: "anyOf",
  CONSTANT: "constant",
  COUNT: "count",
  ELEMENT: "element",
  MAX_ITEMS: "maxItems",
  MAXIMUM: "maximum",
  MIN_ITEMS: "minItems",
  MINIMUM: "minimum",
  RANGE: "range",
  REGEX: "regex",
} as const;

export type GuideType = (typeof GuideType)[keyof typeof GuideType];

/** Constraint options passed to `guide()`. */
export interface GuideConstraints {
  anyOf?: string[];
  constant?: string;
  count?: number;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  range?: [number, number];
  regex?: string;
}

// --- Guided Zod type ---

/** Symbol used to attach guide metadata to Zod schemas. */
export const GUIDE_META = Symbol.for("apple-fm-sdk:guide");

export interface GuideMeta {
  description?: string;
  constraints: GuideConstraints;
}

/** A Zod type annotated with guide metadata. */
export type GuidedZodType<T extends ZodTypeAny = ZodTypeAny> = T & {
  [GUIDE_META]: GuideMeta;
};

/**
 * Annotate a Zod type with generation guide constraints.
 *
 * This is the TypeScript equivalent of Python's `fm.guide()`.
 *
 * @example
 * ```ts
 * const ProductReview = fm.generable(z.object({
 *   sentiment: fm.guide(z.string(), { anyOf: ["positive", "negative", "neutral"] }),
 *   rating: fm.guide(z.number(), { range: [1.0, 5.0] }),
 *   keywords: fm.guide(z.array(z.string()), { count: 3 }),
 *   name: fm.guide(z.string(), "The product name"),
 * }), "Product review");
 * ```
 */
export function guide<T extends ZodTypeAny>(
  schema: T,
  descriptionOrConstraints?: string | GuideConstraints & { description?: string },
): GuidedZodType<T> {
  let description: string | undefined;
  let constraints: GuideConstraints = {};

  if (typeof descriptionOrConstraints === "string") {
    description = descriptionOrConstraints;
  } else if (descriptionOrConstraints) {
    const { description: desc, ...rest } = descriptionOrConstraints;
    description = desc;
    constraints = rest;
  }

  const guided = schema as GuidedZodType<T>;
  (guided as any)[GUIDE_META] = { description, constraints };
  return guided;
}

/**
 * Check if a Zod type has guide metadata attached.
 */
export function hasGuideMeta(schema: ZodTypeAny): schema is GuidedZodType {
  return GUIDE_META in schema;
}

/**
 * Get guide metadata from a Zod type, if present.
 */
export function getGuideMeta(schema: ZodTypeAny): GuideMeta | undefined {
  if (hasGuideMeta(schema)) {
    return schema[GUIDE_META];
  }
  return undefined;
}
