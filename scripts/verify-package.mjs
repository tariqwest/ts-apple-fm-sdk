#!/usr/bin/env node
/**
 * Verify the package is ready for npm publish.
 * Checks compiled output, native artifacts, and basic addon loading.
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const requiredPaths = [
  "dist/index.js",
  "dist/index.d.ts",
  "build/apple_fm_sdk_napi.node",
  "build/libFoundationModels.dylib",
  "README.md",
  "LICENSE",
];

let failed = false;

for (const rel of requiredPaths) {
  const path = resolve(root, rel);
  if (!existsSync(path)) {
    console.error(`missing required file: ${rel}`);
    failed = true;
  }
}

// Reject stale compiled artifacts from removed source files.
const staleArtifacts = [
  "dist/ffi/bindings.js",
  "dist/ffi/helpers.js",
];
for (const rel of staleArtifacts) {
  if (existsSync(resolve(root, rel))) {
    console.error(`stale artifact present (run 'bun run build'): ${rel}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

try {
  const addon = require(resolve(root, "build/apple_fm_sdk_napi.node"));
  if (addon.ping?.() !== 42) {
    console.error("N-API addon ping() did not return 42");
    process.exit(1);
  }
} catch (error) {
  console.error("failed to load N-API addon:", error);
  process.exit(1);
}

console.log("package verification passed");