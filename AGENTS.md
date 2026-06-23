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

## Architecture

- **FFI Layer**: Bun FFI (`bun:ffi`) loads `libFoundationModels.dylib` compiled from `foundation-models-c`
- **Abstraction**: `src/ffi/native.ts` provides runtime-agnostic NativeBindings interface
- **Guided Generation**: Zod schemas + `guide()` helper (TypeScript-idiomatic equivalent of Python's `@generable` + `fm.guide()`)
- **Tests**: Vitest. Pure logic tests run everywhere; FFI tests gated by `FM_NATIVE` env var

## Test Categories

- **Unit tests** (always run): errors, generation-options, guides, generable, tool logic, prompts
- **Integration tests** (require `FM_NATIVE=1`): core (SystemLanguageModel), session, streaming, transcript, token-count, tool-with-session, guided-generation with model

## Reference Codebases

- `reference/python-apple-fm-sdk/` — Python SDK being translated
- `reference/apple-on-device-ai/` — Prior TypeScript implementation (Rust N-API)
