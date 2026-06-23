/**
 * Test tool implementations for tool calling tests.
 *
 * Mirrors the Python test tools in tester_tools/tester_tools.py.
 */

import z from "zod";
import { guide } from "../../src/generation-guide.js";
import { generable, GeneratedContent } from "../../src/generable.js";
import { GenerationSchema } from "../../src/generation-schema.js";
import { Tool } from "../../src/tool.js";

// --- Calculator Tool ---

export const CalculatorParams = generable(
  z.object({
    operation: guide(z.string(), {
      anyOf: ["add", "subtract", "multiply", "divide"],
    }),
    a: guide(z.number(), "First number"),
    b: guide(z.number(), "Second number"),
  }),
  "Calculator parameters",
);

export class SimpleCalculatorTool extends Tool {
  name = "simple_calculator";
  description = "Perform basic arithmetic operations";

  get argumentsSchema(): GenerationSchema {
    return CalculatorParams.generationSchema();
  }

  async call(args: GeneratedContent): Promise<string> {
    const operation = args.value<string>("operation");
    const a = args.value<number>("a");
    const b = args.value<number>("b");

    let result: number;
    switch (operation) {
      case "add":
        result = a + b;
        break;
      case "subtract":
        result = a - b;
        break;
      case "multiply":
        result = a * b;
        break;
      case "divide":
        if (b === 0) throw new Error("Division by zero");
        result = a / b;
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    return String(result);
  }
}

// --- User Info Tool ---

export const UserInfoParams = generable(
  z.object({
    userId: guide(z.number().int(), "The user ID to look up"),
  }),
  "User info parameters",
);

const MOCK_USERS: Record<number, { name: string; email: string }> = {
  1: { name: "Alice", email: "alice@example.com" },
  2: { name: "Bob", email: "bob@example.com" },
  3: { name: "Charlie", email: "charlie@example.com" },
};

export class GetUserInfoTool extends Tool {
  name = "get_user_info";
  description = "Get information about a user by ID";

  get argumentsSchema(): GenerationSchema {
    return UserInfoParams.generationSchema();
  }

  async call(args: GeneratedContent): Promise<string> {
    const userId = args.value<number>("userId");
    const user = MOCK_USERS[userId];
    if (!user) return JSON.stringify({ error: "User not found" });
    return JSON.stringify(user);
  }
}

// --- Bread Search Tool ---

export const SearchBreadParams = generable(
  z.object({
    searchTerm: guide(z.string(), "The type of bread to search for"),
    limit: guide(z.number().int(), { range: [1, 6] }),
  }),
  "Search bread database parameters",
);

export class SearchBreadDatabaseTool extends Tool {
  name = "searchBreadDatabaseTool";
  description = "Searches a local database for bread recipes";

  get argumentsSchema(): GenerationSchema {
    return SearchBreadParams.generationSchema();
  }

  async call(args: GeneratedContent): Promise<string> {
    const searchTerm = args.value<string>("searchTerm");
    const limit = args.value<number>("limit");

    const recipes = [
      { name: "Sourdough", type: "artisan" },
      { name: "Focaccia", type: "flatbread" },
      { name: "Baguette", type: "French" },
      { name: "Ciabatta", type: "Italian" },
      { name: "Rye bread", type: "hearty" },
    ];

    const results = recipes
      .filter((r) =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.type.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .slice(0, limit);

    return JSON.stringify(results);
  }
}

// --- Error-raising tool for testing ---

export const ErrorParams = generable(
  z.object({
    shouldFail: z.boolean(),
  }),
  "Error test parameters",
);

export class ErrorRaisingTool extends Tool {
  name = "error_raising_tool";
  description = "Tool that can raise errors for testing";

  get argumentsSchema(): GenerationSchema {
    return ErrorParams.generationSchema();
  }

  async call(args: GeneratedContent): Promise<string> {
    const shouldFail = args.value<boolean>("shouldFail");
    if (shouldFail) {
      throw new Error("Intentional test error");
    }
    return "success";
  }
}
