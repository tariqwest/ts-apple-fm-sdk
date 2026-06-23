/**
 * Streaming Response Example
 *
 * Demonstrates how to stream responses from the model, receiving chunks of text
 * as they are generated. This mirrors the Python SDK example at
 * `reference/python-apple-fm-sdk/examples/streaming_example.py`.
 */

import {
  SystemLanguageModel,
  LanguageModelSession,
} from "../src/index.js";

async function main() {
  console.log("=== Streaming Response Example ===\n");

  // Check if the model is available
  const model = new SystemLanguageModel();
  const [isAvailable, reason] = model.isAvailable();

  if (!isAvailable) {
    console.log(`Model not available: ${reason}`);
    return;
  }

  // Create a session
  const session = new LanguageModelSession({
    instructions: "You are a helpful assistant.",
  });

  // Stream a response
  const prompt = "Tell me a short story about a cat.";
  console.log(`User: ${prompt}\n`);
  process.stdout.write("Assistant: ");

  // Iterate through response chunks as they arrive.
  // streamResponse yields complete snapshots, so we only print the delta.
  let previous = "";
  for await (const snapshot of session.streamResponse(prompt)) {
    const delta = snapshot.slice(previous.length);
    process.stdout.write(delta);
    previous = snapshot;
  }

  console.log("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { main };
