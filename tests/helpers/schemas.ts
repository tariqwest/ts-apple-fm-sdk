/**
 * Test schema definitions for guided generation tests.
 *
 * Mirrors the Python test schemas in tester_schemas/schemas.py.
 */

import { z } from "zod";
import { guide } from "../../src/generation-guide.js";
import { generable } from "../../src/generable.js";

// --- Simple schemas ---

export const Age = generable(
  z.object({
    years: z.number().int(),
    months: z.number().int(),
  }),
  "Age",
);

export const Cat = generable(
  z.object({
    name: z.string(),
    age: z.number().int(),
    profile: z.string(),
  }),
  "Cat",
);

// --- Schema with guides ---

export const Hedgehog = generable(
  z.object({
    name: guide(z.string(), "The hedgehog's name"),
    age: guide(z.number().int(), "Age in years"),
    favoriteFood: guide(z.string(), {
      description: "Favorite food",
      anyOf: ["carrot", "turnip", "leek"],
    }),
    home: guide(z.string(), { constant: "a hedge" }),
    hobbies: guide(z.array(z.string()), { count: 3 }),
  }),
  "Hedgehog",
);

// --- Guide-heavy schemas for constraint tests ---

export const ProductAnyOfGuide = generable(
  z.object({
    category: guide(z.string(), {
      anyOf: ["electronics", "clothing", "books", "home", "sports"],
    }),
    status: guide(z.string(), {
      anyOf: ["available", "out_of_stock", "discontinued"],
    }),
  }),
  "ProductAnyOfGuide",
);

export const ProductRangeGuide = generable(
  z.object({
    price: guide(z.number(), { range: [0.99, 999.99] }),
    rating: guide(z.number(), { range: [1.0, 5.0] }),
    discountPercent: guide(z.number(), { range: [0, 100] }),
  }),
  "ProductRangeGuide",
);

export const ProductCountGuide = generable(
  z.object({
    features: guide(z.array(z.string()), { count: 3 }),
    tags: guide(z.array(z.string()), { count: 5 }),
  }),
  "ProductCountGuide",
);

export const ProductMinMaxGuide = generable(
  z.object({
    minPrice: guide(z.number(), { minimum: 0 }),
    maxPrice: guide(z.number(), { maximum: 1000 }),
    stock: guide(z.number().int(), { minimum: 0 }),
  }),
  "ProductMinMaxGuide",
);

export const ContactRegexGuide = generable(
  z.object({
    name: guide(z.string(), { regex: "\\w+\\s\\w+" }),
    age: guide(z.string(), { regex: "\\d+" }),
  }),
  "ContactRegexGuide",
);

// --- Complex nested schemas ---

export const Shelter = generable(
  z.object({
    cats: z.array(
      z.object({
        name: z.string(),
        age: z.number().int(),
        profile: z.string(),
      }),
    ),
  }),
  "Shelter",
);
