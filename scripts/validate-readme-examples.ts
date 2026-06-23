/**
 * Validates README.md code examples against the live SDK.
 *
 * Run: bun scripts/validate-readme-examples.ts
 */

import fm from "../dist/index.js";
import z from "zod";

const results: Array<{ name: string; ok: boolean; error?: string; skipped?: boolean }> = [];

async function run(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("not available") || message.includes("FM_NATIVE")) {
      results.push({ name, ok: false, skipped: true, error: message });
      console.log(`SKIP  ${name}: ${message}`);
    } else {
      results.push({ name, ok: false, error: message });
      console.error(`FAIL  ${name}: ${message}`);
    }
  }
}

function requireModel(): fm.SystemLanguageModel {
  const model = new fm.SystemLanguageModel();
  const [isAvailable, reason] = model.isAvailable();
  if (!isAvailable) {
    throw new Error(`Foundation Models not available: ${reason}`);
  }
  return model;
}

// --- README: Basic usage ---
async function basicUsage(): Promise<void> {
  const model = new fm.SystemLanguageModel();
  const [isAvailable, reason] = model.isAvailable();
  if (isAvailable) {
    const session = new fm.LanguageModelSession();
    const response = await session.respond("Hello, how are you?");
    if (typeof response !== "string" || response.length === 0) {
      throw new Error("Expected non-empty string response");
    }
    console.log(`  -> response length: ${response.length}`);
  } else {
    throw new Error(`Foundation Models not available: ${reason}`);
  }
}

// --- README: Streaming responses ---
async function streaming(): Promise<void> {
  const model = new fm.SystemLanguageModel();
  const [isAvailable] = model.isAvailable();
  if (!isAvailable) throw new Error("Foundation Models not available");

  const session = new fm.LanguageModelSession();
  let previous = "";
  let snapshotCount = 0;
  for await (const chunk of session.streamResponse("Tell me a short story about a cat")) {
    // README prints chunks directly; streamResponse yields cumulative snapshots.
    const delta = chunk.slice(previous.length);
    process.stdout.write(delta);
    previous = chunk;
    snapshotCount++;
  }
  console.log();
  if (snapshotCount === 0 || previous.length === 0) {
    throw new Error("Expected at least one non-empty streaming snapshot");
  }
  console.log(`  -> snapshots: ${snapshotCount}, final length: ${previous.length}`);
}

// --- README: Guided generation ---
async function guidedGeneration(): Promise<void> {
  const Cat = fm.generable(
    z.object({
      name: z.string(),
      age: fm.guide(z.number().int(), { description: "Age in years", range: [0, 20] }),
    }),
    "Cat",
  );

  const model = new fm.SystemLanguageModel();
  const [isAvailable, reason] = model.isAvailable();
  if (!isAvailable) throw new Error(`Foundation Models not available: ${reason}`);

  const session = new fm.LanguageModelSession();
  const cat = await session.respond("Generate an adorable rescue cat", {
    generating: Cat.generationSchema(),
  });
  const parsed = Cat.parse(cat);
  if (typeof parsed.name !== "string" || typeof parsed.age !== "number") {
    throw new Error(`Unexpected parsed cat: ${JSON.stringify(parsed)}`);
  }
  console.log(`  -> Name: ${parsed.name}, Age: ${parsed.age}`);
}

// --- README: Tools ---
async function tools(): Promise<void> {
  const WeatherParams = fm.generable(
    z.object({ location: z.string() }),
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
  if (!isAvailable) throw new Error("Foundation Models not available");

  const session = new fm.LanguageModelSession({
    instructions: "You can use the WeatherTool to check the weather.",
    tools: [new WeatherTool()],
  });

  const response = await session.respond("What is the weather in Taipei?");
  if (typeof response !== "string" || response.length === 0) {
    throw new Error("Expected non-empty tool session response");
  }
  console.log(`  -> response length: ${response.length}`);
}

// --- README: Generation options ---
async function generationOptions(): Promise<void> {
  const options = new fm.GenerationOptions({
    temperature: 0.7,
    sampling: fm.SamplingMode.random({ top: 50, seed: 42 }),
    maximumResponseTokens: 200,
  });

  const session = new fm.LanguageModelSession();
  const response = await session.respond("Write a haiku.", { options });
  if (typeof response !== "string" || response.length === 0) {
    throw new Error("Expected non-empty response with generation options");
  }
  console.log(`  -> response length: ${response.length}`);
}

// --- README: Transcripts ---
async function transcripts(): Promise<void> {
  const session = new fm.LanguageModelSession();
  await session.respond("My name is Alice.");
  await session.respond("What is my name?");

  const transcript = new fm.Transcript(session.ptr);
  const dict = await transcript.toDict();
  const restored = await fm.Transcript.fromDict(dict);

  const restoredDict = await restored.toDict();
  const originalEntries =
    (dict.transcript as { entries?: unknown[] }).entries ?? [];
  const restoredEntries =
    (restoredDict.transcript as { entries?: unknown[] }).entries ?? [];

  if (restoredEntries.length !== originalEntries.length) {
    throw new Error(
      `Transcript round-trip entry count mismatch: ${originalEntries.length} vs ${restoredEntries.length}`,
    );
  }
  console.log(`  -> entries preserved: ${restoredEntries.length}`);
}

// --- README: Custom model configuration ---
async function customModelConfig(): Promise<void> {
  const model = new fm.SystemLanguageModel({
    useCase: fm.SystemLanguageModelUseCase.CONTENT_TAGGING,
    guardrails: fm.SystemLanguageModelGuardrails.PERMISSIVE_CONTENT_TRANSFORMATIONS,
  });
  const size = model.getContextSize();
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`Unexpected context size: ${size}`);
  }
  console.log(`  -> Context size: ${size}`);
}

// --- README: default import smoke test ---
async function defaultImport(): Promise<void> {
  const required = [
    "SystemLanguageModel",
    "LanguageModelSession",
    "generable",
    "guide",
    "Tool",
    "GenerationOptions",
    "SamplingMode",
    "Transcript",
    "isNativeAvailable",
  ] as const;
  for (const key of required) {
    if (!(key in fm) || (fm as Record<string, unknown>)[key] === undefined) {
      throw new Error(`Default export missing '${key}'`);
    }
  }
  if (!fm.isNativeAvailable()) {
    throw new Error("isNativeAvailable() returned false");
  }
  console.log("  -> default export namespace complete");
}

async function main(): Promise<void> {
  console.log("Validating README.md examples...\n");

  await run("default import", defaultImport);
  await run("basic usage", basicUsage);
  await run("streaming responses", streaming);
  await run("guided generation", guidedGeneration);
  await run("tools", tools);
  await run("generation options", generationOptions);
  await run("transcripts", transcripts);
  await run("custom model configuration", customModelConfig);

  console.log("\n--- Summary ---");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`${passed} passed, ${failed} failed, ${skipped} skipped`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});