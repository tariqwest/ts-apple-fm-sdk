# ts-apple-fm-sdk

TypeScript SDK for Apple's on-device Foundation Models (SystemLanguageModel / Apple Intelligence).

> For a detailed readout of how this project was planned and executed, see [.agents/implementation-readout.md](.agents/implementation-readout.md). This file is for quick project context only.

## Build Commands

```bash
bun install                # Install dependencies
bun run build:native       # Build the Swift dylib (macOS 26+ required)
bun run build              # Compile TypeScript
bun run build:all          # Build native + TypeScript
bun run check              # Type check (tsc --noEmit)
bun run test               # Run all tests via Vitest
FM_NATIVE=1 bun run test   # Run all tests including native FFI integration tests
```

### N-API Rust Addon (Node.js backend)

The `native/` directory contains a Rust/NAPI-RS addon that wraps the Foundation Models C FFI for use under Node.js (as an alternative to Bun FFI).

```bash
# Build the Rust addon (requires Rust + Cargo)
cd native && cargo build --release

# Copy the artifact to the expected location
cp native/target/release/libapple_fm_sdk_napi.dylib build/apple_fm_sdk_napi.node

# Sanity check
node -e "require('./build/apple_fm_sdk_napi.node').ping()"  # prints 42

# Full integration test with the on-device model (macOS 26+ with Apple Intelligence)
FM_NATIVE=1 node -e "
  import { createRequire } from 'module';
  const require = createRequire(import.meta.url);
  const addon = require('./build/apple_fm_sdk_napi.node');
  const model = addon.systemLanguageModelGetDefault();
  const session = addon.languageModelSessionCreateDefault();
  const prompt = addon.composedPromptInitialize();
  addon.composedPromptAddText(prompt, 'Hi, say a one word greeting');
  addon.languageModelSessionRespond(session, prompt, null, (json) => {
    console.log('callback:', json);
  });
" --input-type=module
```

**N-API design notes:**
- All `StringCallback` TSFNs use `ErrorStrategy::Fatal` so the JS callback receives the JSON string as its **first** argument (no leading `null` error parameter).  The default `CalleeHandled` strategy prepends `null` (on success) before the actual value, which broke the TypeScript wrapper in `native.ts`.
- `FMLanguageModelSessionRespond` calls its callback exactly once with the full response; the Rust trampoline synthesises a follow-up `{type:"done"}` event so the TypeScript promise-based API can resolve.
- napi-derive converts Rust `snake_case` with acronyms like `json` as a single word → JS `camelCase`: `get_json_string` → `getJsonString` (not `getJSONString`). The `native.ts` bindings use the correct camelCase names.

## Architecture

- **FFI Layer**: Bun FFI (`bun:ffi`) loads `libFoundationModels.dylib` compiled from `foundation-models-c`; Node.js uses the Rust N-API addon in `build/apple_fm_sdk_napi.node`
- **Abstraction**: `src/ffi/native.ts` provides runtime-agnostic NativeBindings interface
- **Guided Generation**: Zod schemas + `guide()` helper (TypeScript-idiomatic equivalent of Python's `@generable` + `fm.guide()`)
- **Tests**: Vitest. Pure logic tests run everywhere; FFI tests gated by `FM_NATIVE` env var

## Test Categories

- **Unit tests** (always run): errors, generation-options, guides, generable, tool logic, prompts
- **Integration tests** (require `FM_NATIVE=1`): core (SystemLanguageModel), session, streaming, transcript, token-count, tool-with-session, guided-generation with model

## Reference Codebases

- `reference/python-apple-fm-sdk/` — Python SDK being translated
- `reference/apple-on-device-ai/` — Prior TypeScript implementation (Rust N-API)
