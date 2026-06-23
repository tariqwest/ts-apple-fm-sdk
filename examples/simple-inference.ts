/**
 * Simple Inference Example
 *
 * Demonstrates the simplest way to use the Foundation Models SDK to create a
 * session and get responses. This mirrors the Python SDK example at
 * `reference/python-apple-fm-sdk/examples/simple_inference.py`.
 */

import {
  SystemLanguageModel,
  LanguageModelSession,
} from "../src/index.js";

async function main() {
  console.log("=== Simple Inference Example ===\n");

  // Check if the model is available
  const model = new SystemLanguageModel();
  const [isAvailable, reason] = model.isAvailable();

  if (!isAvailable) {
    console.log(`Model not available: ${reason}`);
    return;
  }

  // Create a session with instructions
  const session = new LanguageModelSession({
    instructions: "You are a helpful assistant that provides concise answers.",
  });

  // Send a prompt and get a response
  const prompt = "What is the capital of France?";
  console.log(`User: ${prompt}`);

  const response = await session.respond(prompt);
  console.log(`Assistant: ${response}\n`);

  // Continue the session
  const followUp = "What is its population?";
  console.log(`User: ${followUp}`);

  const followUpResponse = await session.respond(followUp);
  console.log(`Assistant: ${followUpResponse}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { main };
