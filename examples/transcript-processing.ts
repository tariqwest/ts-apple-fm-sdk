/**
 * Transcript Processing Example
 *
 * Demonstrates how to process transcripts exported from Swift apps using the
 * Foundation Models SDK for TypeScript. This mirrors the Python SDK example at
 * `reference/python-apple-fm-sdk/examples/transcript_processing.py`.
 *
 * The example shows:
 * - Loading transcripts exported from Swift
 * - Analyzing session structure and content
 * - Extracting metrics and statistics
 * - Comparing multiple transcripts
 */

import { readFileSync } from "node:fs";

interface TranscriptContent {
  type?: string;
  text?: string;
  structure?: { content?: Record<string, unknown> };
}

interface TranscriptEntry {
  role?: string;
  id?: string;
  contents?: TranscriptContent[];
  toolCalls?: Record<string, unknown>[];
  toolName?: string;
  tools?: Record<string, unknown>[];
  responseFormat?: { type?: string };
}

interface TranscriptDict {
  version?: number;
  type?: string;
  transcript?: {
    entries?: TranscriptEntry[];
  };
}

interface TranscriptAnalysis {
  total_entries: number;
  instructions_entries: number;
  user_entries: number;
  response_entries: number;
  tool_entries: number;
  total_user_chars: number;
  total_response_chars: number;
  avg_user_entry_length: number;
  avg_response_entry_length: number;
  tool_calls_count: number;
  has_tools: boolean;
  available_tools_count: number;
  has_structured_output: boolean;
  unique_assets: number;
}

/**
 * Load a transcript exported from a Swift app.
 *
 * Swift code to export transcript:
 * ```swift
 * import FoundationModels
 *
 * let transcript = session.transcript
 * let jsonData = try JSONEncoder().encode(transcript)
 * try jsonData.write(to: URL(fileURLWithPath: "transcript.json"))
 * ```
 */
function loadTranscript(filePath: string): TranscriptDict {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as TranscriptDict;
}

/**
 * Extract text from a contents array.
 */
function extractTextFromContents(contents: TranscriptContent[]): string {
  const textParts: string[] = [];
  for (const content of contents) {
    if (content.type === "text") {
      textParts.push(content.text ?? "");
    } else if (content.type === "structure") {
      // For structured content, convert to string representation
      const structure = content.structure ?? {};
      textParts.push(JSON.stringify(structure.content ?? {}));
    }
  }
  return textParts.join(" ");
}

/**
 * Analyze a transcript and extract key metrics.
 */
function analyzeTranscript(transcript: TranscriptDict): TranscriptAnalysis {
  const entries = transcript.transcript?.entries ?? [];

  // Count entry types by role
  const instructionsEntries = entries.filter((e) => e.role === "instructions");
  const userEntries = entries.filter((e) => e.role === "user");
  const responseEntries = entries.filter((e) => e.role === "response");
  const toolEntries = entries.filter((e) => e.role === "tool");

  // Calculate content lengths
  const totalUserChars = userEntries.reduce((sum, e) => {
    return sum + extractTextFromContents(e.contents ?? []).length;
  }, 0);
  const totalResponseChars = responseEntries.reduce((sum, e) => {
    return sum + extractTextFromContents(e.contents ?? []).length;
  }, 0);

  // Extract tool calls from response entries
  const toolCalls: Record<string, unknown>[] = [];
  for (const entry of responseEntries) {
    if (entry.toolCalls) {
      toolCalls.push(...entry.toolCalls);
    }
  }

  // Extract available tools from instructions
  const availableTools: Record<string, unknown>[] = [];
  for (const entry of instructionsEntries) {
    if (entry.tools) {
      availableTools.push(...entry.tools);
    }
  }

  // Check for structured output (responseFormat)
  const hasStructuredOutput = userEntries.some((e) => "responseFormat" in e);

  // Check for assets (model information)
  const assets: string[] = [];
  for (const entry of responseEntries) {
    if ("assets" in entry && Array.isArray(entry.assets)) {
      for (const asset of entry.assets) {
        assets.push(JSON.stringify(asset));
      }
    }
  }

  return {
    total_entries: entries.length,
    instructions_entries: instructionsEntries.length,
    user_entries: userEntries.length,
    response_entries: responseEntries.length,
    tool_entries: toolEntries.length,
    total_user_chars: totalUserChars,
    total_response_chars: totalResponseChars,
    avg_user_entry_length: userEntries.length
      ? totalUserChars / userEntries.length
      : 0,
    avg_response_entry_length: responseEntries.length
      ? totalResponseChars / responseEntries.length
      : 0,
    tool_calls_count: toolCalls.length,
    has_tools: toolCalls.length > 0,
    available_tools_count: availableTools.length,
    has_structured_output: hasStructuredOutput,
    unique_assets: new Set(assets).size,
  };
}

/**
 * Print a formatted summary of the transcript.
 */
function printTranscriptSummary(
  transcript: TranscriptDict,
  analysis: TranscriptAnalysis,
): void {
  console.log("=".repeat(60));
  console.log("TRANSCRIPT SUMMARY");
  console.log("=".repeat(60));

  // Transcript metadata
  const version = transcript.version ?? "N/A";
  const transcriptType = transcript.type ?? "N/A";
  console.log(`\nVersion: ${version}`);
  console.log(`Type: ${transcriptType}`);

  // Entry statistics
  console.log("\nEntry Statistics:");
  console.log(`  Total entries: ${analysis.total_entries}`);
  console.log(`  Instructions entries: ${analysis.instructions_entries}`);
  console.log(`  User entries: ${analysis.user_entries}`);
  console.log(`  Response entries: ${analysis.response_entries}`);
  console.log(`  Tool entries: ${analysis.tool_entries}`);

  // Content statistics
  console.log("\nContent Statistics:");
  console.log(`  Total user characters: ${analysis.total_user_chars}`);
  console.log(`  Total response characters: ${analysis.total_response_chars}`);
  console.log(
    `  Avg user entry length: ${analysis.avg_user_entry_length.toFixed(1)} chars`,
  );
  console.log(
    `  Avg response entry length: ${analysis.avg_response_entry_length.toFixed(1)} chars`,
  );

  // Tool usage
  if (analysis.has_tools) {
    console.log("\nTool Usage:");
    console.log(`  Available tools: ${analysis.available_tools_count}`);
    console.log(`  Tool calls made: ${analysis.tool_calls_count}`);
  }

  // Structured output
  if (analysis.has_structured_output) {
    console.log("\nStructured Output: Yes (JSON Schema)");
  }

  // Model assets
  if (analysis.unique_assets > 0) {
    console.log(`\nModel Assets: ${analysis.unique_assets} unique asset(s)`);
  }

  console.log("=".repeat(60));
}

/**
 * Print the first few entries from the transcript.
 */
function printTranscriptEntries(
  transcript: TranscriptDict,
  maxEntries: number = 5,
): void {
  const entries = transcript.transcript?.entries ?? [];

  console.log(`\nFirst ${Math.min(maxEntries, entries.length)} entries:`);
  console.log("-".repeat(60));

  for (let i = 0; i < Math.min(maxEntries, entries.length); i++) {
    const entry = entries[i];
    const role = entry.role ?? "unknown";
    const entryId = entry.id ?? "N/A";

    console.log(`\n[${i + 1}] ${role.toUpperCase()} (ID: ${entryId.slice(0, 8)}...)`);

    // Show contents
    if (entry.contents) {
      let text = extractTextFromContents(entry.contents);
      if (text.length > 100) {
        text = text.slice(0, 100) + "...";
      }
      if (text) {
        console.log(`    Content: ${text}`);
      }
    }

    // Show tool calls if present
    if (entry.toolCalls) {
      for (const toolCall of entry.toolCalls) {
        const toolName =
          typeof toolCall === "object" && toolCall !== null && "name" in toolCall
            ? String(toolCall.name)
            : "unknown";
        console.log(`    [Tool Call: ${toolName}]`);
      }
    }

    // Show tool name if this is a tool response
    if (entry.toolName) {
      console.log(`    [Tool Response: ${entry.toolName}]`);
    }

    // Show available tools if present
    if (entry.tools) {
      console.log(`    [Available Tools: ${entry.tools.length}]`);
    }

    // Show response format if present
    if (entry.responseFormat) {
      const formatType = entry.responseFormat.type ?? "unknown";
      console.log(`    [Response Format: ${formatType}]`);
    }
  }

  if (entries.length > maxEntries) {
    console.log(`\n... and ${entries.length - maxEntries} more entries`);
  }

  console.log("-".repeat(60));
}

/**
 * Compare multiple transcripts and generate comparison metrics.
 */
function compareTranscripts(transcripts: TranscriptDict[]): {
  transcript_count: number;
  total_entries: number;
  total_user_chars: number;
  total_response_chars: number;
  total_tool_calls: number;
  avg_entries_per_transcript: number;
  transcripts_with_tools: number;
  transcripts_with_structured_output: number;
} {
  const analyses = transcripts.map(analyzeTranscript);

  const totalEntries = analyses.reduce((sum, a) => sum + a.total_entries, 0);
  const totalUserChars = analyses.reduce((sum, a) => sum + a.total_user_chars, 0);
  const totalResponseChars = analyses.reduce(
    (sum, a) => sum + a.total_response_chars,
    0,
  );
  const totalToolCalls = analyses.reduce((sum, a) => sum + a.tool_calls_count, 0);

  return {
    transcript_count: transcripts.length,
    total_entries: totalEntries,
    total_user_chars: totalUserChars,
    total_response_chars: totalResponseChars,
    total_tool_calls: totalToolCalls,
    avg_entries_per_transcript: transcripts.length
      ? totalEntries / transcripts.length
      : 0,
    transcripts_with_tools: analyses.filter((a) => a.has_tools).length,
    transcripts_with_structured_output: analyses.filter(
      (a) => a.has_structured_output,
    ).length,
  };
}

/**
 * Demonstrate loading and analyzing transcripts.
 */
async function main(): Promise<void> {
  console.log("=== Transcript Processing Example ===\n");

  // Example: create a transcript from a session and analyze it
  // In a real workflow, transcript.json would be exported from a Swift app.
  const transcriptPath = process.argv[2] ?? "transcript.json";

  try {
    const transcript = loadTranscript(transcriptPath);
    const analysis = analyzeTranscript(transcript);

    printTranscriptSummary(transcript, analysis);
    printTranscriptEntries(transcript);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Could not load transcript from ${transcriptPath}. ` +
        "Provide a path or export one from a Swift app.",
    );
    console.error(message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export {
  loadTranscript,
  extractTextFromContents,
  analyzeTranscript,
  printTranscriptSummary,
  printTranscriptEntries,
  compareTranscripts,
  main,
};
