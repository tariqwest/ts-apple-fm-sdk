# Foundation Models SDK for TypeScript

TypeScript bindings for Apple's [Foundation Models framework](https://developer.apple.com/documentation/foundationmodels), providing access to the on-device foundation model at the core of Apple Intelligence on macOS.

This SDK is a near 1-to-1 TypeScript translation of Apple's [Python Foundation Models SDK](https://github.com/apple/python-apple-fm-sdk), adapted for TypeScript/Bun idioms.

## Overview

The Foundation Models SDK for TypeScript provides a typed, async interface to Apple's Foundation Models framework.

You can:

- **Evaluate Swift Foundation Models app features** by running batch inference and analyzing results from TypeScript
- Perform **on-device inference** with the system foundation model
- Stream **real-time text generation** responses
- Use **guided generation** with structured output schemas and Zod constraints
- Get **type-safe responses** by defining generation schemas with Zod
- Configure **custom model settings** for different model options and generation parameters
- Define **tools** the model can call during a conversation
- Process **transcripts exported from Swift apps** for quality analysis

Keep in mind that it's your responsibility to design AI experiences with care.
To learn about practical strategies you can implement in code, **check out:**
[Improving the safety of generative model output](https://developer.apple.com/documentation/foundationmodels/improving-the-safety-of-generative-model-output)
and Apple's [Human Interface Guidelines on Generative AI](https://developer.apple.com/design/human-interface-guidelines/generative-ai).

## Requirements

- macOS 26.0+
- Download [Xcode 26.0+](https://developer.apple.com/xcode/) and agree to the [Xcode and Apple SDKs agreement](https://www.apple.com/legal/sla/docs/xcode.pdf) in the Xcode app.
- [Bun](https://bun.sh/) 1.0+
- Apple Intelligence turned on for [a compatible Mac](https://support.apple.com/en-us/121115)

## Installation

```bash
npm install apple-fm-sdk
# or
bun add apple-fm-sdk
```

The published package ships prebuilt native artifacts for **macOS arm64** (`build/libFoundationModels.dylib` and `build/apple_fm_sdk_napi.node`). No postinstall build step is required on supported platforms.

> **Platform support:** macOS 26+ on Apple Silicon only. The package declares `os: ["darwin"]` and `cpu: ["arm64"]` so npm will warn on unsupported platforms.

To install from source or contribute, see [Development Installation](#development-installation) below.

## Documentation

- [Python SDK documentation](https://apple.github.io/python-apple-fm-sdk/) (the TypeScript API follows the same structure)
- [Python code examples](https://github.com/apple/python-apple-fm-sdk/tree/main/examples) (concepts translate directly to TypeScript)

## Basic usage

```typescript
import fm from "apple-fm-sdk";

async function main() {
    // Get the default system foundation model
    const model = new fm.SystemLanguageModel();

    // Check if the model is available
    const [isAvailable, reason] = model.isAvailable();
    if (isAvailable) {
        // Create a session
        const session = new fm.LanguageModelSession();

        // Generate a response
        const response = await session.respond("Hello, how are you?");
        console.log(`Model response: ${response}`);
    } else {
        console.log(`Foundation Models not available: ${reason}`);
    }
}

await main();
```

### Streaming responses

> **Note:** `streamResponse` yields **cumulative snapshots** (the full response generated so far), not deltas. To print incrementally, slice off the portion you have already seen.

```typescript
import fm from "apple-fm-sdk";

const model = new fm.SystemLanguageModel();
const [isAvailable] = model.isAvailable();

if (isAvailable) {
    const session = new fm.LanguageModelSession();
    let previous = "";
    for await (const snapshot of session.streamResponse("Tell me a short story about a cat")) {
        const delta = snapshot.slice(previous.length);
        process.stdout.write(delta);
        previous = snapshot;
    }
}
```

### Guided generation

The TypeScript SDK uses [Zod](https://zod.dev/) schemas and the `guide()` helper to define generation constraints. This is equivalent to the Python SDK's `@generable` decorator and `fm.guide()`.

```typescript
import fm from "apple-fm-sdk";
import z from "zod";

const Cat = fm.generable(
    z.object({
        name: z.string(),
        age: fm.guide(z.number().int(), { description: "Age in years", range: [0, 20] }),
    }),
    "Cat",
);

async function generateCat() {
    const model = new fm.SystemLanguageModel();
    const [isAvailable, reason] = model.isAvailable();

    if (isAvailable) {
        const session = new fm.LanguageModelSession();

        // Generate a response typed as Cat
        const cat = await session.respond("Generate an adorable rescue cat", {
            generating: Cat.generationSchema(),
        });

        // The response is a GeneratedContent instance; parse it with the schema
        const parsed = Cat.parse(cat);
        console.log(`Name: ${parsed.name}, Age: ${parsed.age}`);
    } else {
        console.log(`Foundation Models not available: ${reason}`);
    }
}

await generateCat();
```

### Tools

Define tools by extending the `Tool` class. The model can invoke them during a conversation.

```typescript
import fm from "apple-fm-sdk";
import z from "zod";

const WeatherParams = fm.generable(
    z.object({
        location: z.string(),
    }),
    "Weather parameters",
);

class WeatherTool extends fm.Tool {
    name = "WeatherTool";
    description = "Gets the current weather for a location.";

    get argumentsSchema() {
        return WeatherParams.generationSchema();
    }

    async call(args: fm.GeneratedContent) {
        const location = args.value<string>("location");
        return `72°F in ${location}`;
    }
}

const model = new fm.SystemLanguageModel();
const [isAvailable] = model.isAvailable();

if (isAvailable) {
    const session = new fm.LanguageModelSession({
        instructions: "You can use the WeatherTool to check the weather.",
        tools: [new WeatherTool()],
    });

    const response = await session.respond("What is the weather in Taipei?");
    console.log(response);
}
```

### Generation options

```typescript
import fm from "apple-fm-sdk";

const options = new fm.GenerationOptions({
    temperature: 0.7,
    sampling: fm.SamplingMode.random({ top: 50, seed: 42 }),
    maximumResponseTokens: 200,
});

const session = new fm.LanguageModelSession();
const response = await session.respond("Write a haiku.", { options });
```

### Transcripts

Export a session's conversation history and restore it later.

```typescript
const session = new fm.LanguageModelSession();
await session.respond("My name is Alice.");
await session.respond("What is my name?");

const transcript = new fm.Transcript(session.ptr);
const dict = await transcript.toDict();

// Restore the conversation from the transcript
const restored = await fm.Transcript.fromDict(dict);
```

### Custom model configuration

```typescript
const model = new fm.SystemLanguageModel({
    useCase: fm.SystemLanguageModelUseCase.CONTENT_TAGGING,
    guardrails: fm.SystemLanguageModelGuardrails.PERMISSIVE_CONTENT_TRANSFORMATIONS,
});

console.log(`Context size: ${model.getContextSize()}`);
```

## Development Installation

If you need to modify the SDK or install from source:

1. Get the code

```bash
git clone https://github.com/tariqwest/ts-apple-fm-sdk
cd ts-apple-fm-sdk
```

2. Install dependencies and build all artifacts

```bash
bun install
bun run build:all
```

This compiles the Swift `foundation-models-c` dylib, the Rust N-API addon, and the TypeScript SDK.

4. Run the test suite

```bash
bun run test
```

To run tests that exercise the native FFI layer (requires a macOS 26+ machine with Apple Intelligence enabled):

```bash
FM_NATIVE=1 bun run test
```

5. Type-check the project

```bash
bun run check
```

## Key Differences from the Python SDK

- **Runtime**: The TypeScript SDK runs on both [Bun](https://bun.sh/) and Node.js via the Rust N-API addon in `native/` (built with `bun run build:napi`). Both runtimes load the same `.node` artifact through the `NativeBindings` abstraction.
- **Generables**: Python uses a `@fm.generable` class decorator; TypeScript uses a `fm.generable(zodSchema)` factory function because decorators are less idiomatic in TypeScript.
- **Schema constraints**: Python uses `fm.guide("description", range=(0, 20))`; TypeScript uses `fm.guide(z.number(), { description: "Age in years", range: [0, 20] })`.
- **Tool return values**: Tools in both SDKs return strings that are passed back to the model.

## Contributing

This project is not yet taking contributions. Stay tuned!

## Reference & Inspiration

- [Python SDK](https://github.com/apple/python-apple-fm-sdk)
- [Swift SDK](https://github.com/apple/swift-apple-fm-sdk)
- [apple-on-device-ai](https://github.com/meridius-labs/apple-on-device-ai)
- [apfel](https://github.com/Arthur-Ficial/apfel)
- [tsfm](https://github.com/codybrom/tsfm)
- [apfel-plus](https://github.com/tariqwest/apfel-plus)
- [afm-js](https://github.com/tariqwest/afm-js)


## Publishing

Maintainers can prepare a release tarball with:

```bash
bun run build:release   # build all artifacts + verify package contents
npm pack --dry-run      # preview the tarball
```

To publish (requires [GitHub CLI](https://cli.github.com/) authenticated via `gh auth login`):

```bash
chmod +x scripts/release.sh
./scripts/release.sh patch   # or minor / major
```

This bumps the version, publishes to npm, pushes the git tag, and creates a [GitHub Release](https://github.com/tariqwest/ts-apple-fm-sdk/releases) with the npm tarball attached.

## License

MIT — see [LICENSE](LICENSE).
