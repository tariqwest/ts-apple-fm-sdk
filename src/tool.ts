/**
 * Tool — abstract base class for model-callable functions.
 *
 * Mirrors the Python SDK's `Tool` class and the Swift
 * `FoundationModels.Tool` protocol.
 */

import type { GenerationSchema } from "./generation-schema.js";
import type { GeneratedContent } from "./generable.js";

/**
 * Abstract base class for tools that can be invoked by the model.
 *
 * Subclass and implement `name`, `description`, `argumentsSchema`,
 * and `call()` to create a tool.
 *
 * @example
 * ```ts
 * class WeatherTool extends Tool {
 *   name = "WeatherTool";
 *   description = "Gets weather for a location.";
 *
 *   get argumentsSchema(): GenerationSchema {
 *     return WeatherParams.generationSchema();
 *   }
 *
 *   async call(args: GeneratedContent): Promise<string> {
 *     const location = args.value<string>("location");
 *     return `72°F in ${location}`;
 *   }
 * }
 * ```
 */
export abstract class Tool {
  constructor() {
    if (new.target === Tool) {
      throw new Error("Tool is abstract and cannot be instantiated directly");
    }
  }

  /** Unique name identifying this tool to the model. */
  abstract readonly name: string;

  /** Human-readable description of what this tool does. */
  abstract readonly description: string;

  /** Schema defining the tool's expected arguments. */
  abstract get argumentsSchema(): GenerationSchema;

  /** Execute the tool with the given arguments. */
  abstract call(args: GeneratedContent): Promise<string>;
}
