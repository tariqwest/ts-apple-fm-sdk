import { describe, it, expect } from "vitest";
import { Tool } from "../src/tool.js";
import { GeneratedContent } from "../src/generable.js";
import {
  SimpleCalculatorTool,
  GetUserInfoTool,
  ErrorRaisingTool,
} from "./helpers/tools.js";

describe("Tool", () => {
  it("is an abstract class", () => {
    // Cannot instantiate directly
    expect(() => {
      // @ts-expect-error testing abstract class
      new Tool();
    }).toThrow();
  });

  it("SimpleCalculatorTool has correct attributes", () => {
    const tool = new SimpleCalculatorTool();
    expect(tool.name).toBe("simple_calculator");
    expect(tool.description).toBe("Perform basic arithmetic operations");
  });

  it("GetUserInfoTool has correct attributes", () => {
    const tool = new GetUserInfoTool();
    expect(tool.name).toBe("get_user_info");
    expect(tool.description).toBe("Get information about a user by ID");
  });
});

describe("Tool direct invocation", () => {
  it("calculator add", async () => {
    const tool = new SimpleCalculatorTool();
    const args = new GeneratedContent({ operation: "add", a: 5.0, b: 3.0 });
    const result = await tool.call(args);
    expect(result).toBe("8");
  });

  it("calculator subtract", async () => {
    const tool = new SimpleCalculatorTool();
    const args = new GeneratedContent({
      operation: "subtract",
      a: 10.0,
      b: 4.0,
    });
    const result = await tool.call(args);
    expect(result).toBe("6");
  });

  it("calculator multiply", async () => {
    const tool = new SimpleCalculatorTool();
    const args = new GeneratedContent({
      operation: "multiply",
      a: 3.0,
      b: 7.0,
    });
    const result = await tool.call(args);
    expect(result).toBe("21");
  });

  it("calculator divide", async () => {
    const tool = new SimpleCalculatorTool();
    const args = new GeneratedContent({
      operation: "divide",
      a: 15.0,
      b: 3.0,
    });
    const result = await tool.call(args);
    expect(result).toBe("5");
  });

  it("calculator divide by zero throws", async () => {
    const tool = new SimpleCalculatorTool();
    const args = new GeneratedContent({
      operation: "divide",
      a: 5.0,
      b: 0,
    });
    await expect(tool.call(args)).rejects.toThrow("Division by zero");
  });

  it("user info lookup returns user data", async () => {
    const tool = new GetUserInfoTool();
    const args = new GeneratedContent({ userId: 1 });
    const result = await tool.call(args);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("Alice");
    expect(parsed.email).toBe("alice@example.com");
  });

  it("user info lookup returns error for unknown user", async () => {
    const tool = new GetUserInfoTool();
    const args = new GeneratedContent({ userId: 999 });
    const result = await tool.call(args);
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe("User not found");
  });
});

describe("Tool error handling", () => {
  it("error raising tool succeeds when shouldFail is false", async () => {
    const tool = new ErrorRaisingTool();
    const args = new GeneratedContent({ shouldFail: false });
    const result = await tool.call(args);
    expect(result).toBe("success");
  });

  it("error raising tool throws when shouldFail is true", async () => {
    const tool = new ErrorRaisingTool();
    const args = new GeneratedContent({ shouldFail: true });
    await expect(tool.call(args)).rejects.toThrow("Intentional test error");
  });
});

// Integration tests requiring native bindings
describe.skipIf(!process.env.FM_NATIVE)("Tool with session (native)", () => {
  it("session with calculator tool", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const tool = new SimpleCalculatorTool();
    const session = new LanguageModelSession({
      instructions: "You are a helpful assistant with access to a calculator.",
      tools: [tool],
    });
    const response = await session.respond("What is 15 + 27?");
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  });

  it("session with user info tool", async () => {
    const { LanguageModelSession } = await import("../src/session.js");
    const tool = new GetUserInfoTool();
    const session = new LanguageModelSession({
      instructions: "You are a helpful assistant that can look up user information.",
      tools: [tool],
    });
    const response = await session.respond("Get info for user 1");
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
  });
});
