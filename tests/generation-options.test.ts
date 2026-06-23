import { describe, it, expect } from "vitest";
import {
  GenerationOptions,
  SamplingMode,
  SamplingModeType,
} from "../src/generation-options.js";

describe("SamplingModeType", () => {
  it("has GREEDY and RANDOM values", () => {
    expect(SamplingModeType.GREEDY).toBe("greedy");
    expect(SamplingModeType.RANDOM).toBe("random");
  });
});

describe("SamplingMode", () => {
  it("greedy() creates a greedy sampling mode", () => {
    const mode = SamplingMode.greedy();
    expect(mode.modeType).toBe(SamplingModeType.GREEDY);
    expect(mode.top).toBeUndefined();
    expect(mode.probabilityThreshold).toBeUndefined();
    expect(mode.seed).toBeUndefined();
  });

  it("random() creates a random sampling mode with no constraints", () => {
    const mode = SamplingMode.random();
    expect(mode.modeType).toBe(SamplingModeType.RANDOM);
    expect(mode.top).toBeUndefined();
    expect(mode.probabilityThreshold).toBeUndefined();
    expect(mode.seed).toBeUndefined();
  });

  it("random() with top-k", () => {
    const mode = SamplingMode.random({ top: 50, seed: 42 });
    expect(mode.modeType).toBe(SamplingModeType.RANDOM);
    expect(mode.top).toBe(50);
    expect(mode.seed).toBe(42);
    expect(mode.probabilityThreshold).toBeUndefined();
  });

  it("random() with probability threshold", () => {
    const mode = SamplingMode.random({ probabilityThreshold: 0.9, seed: 42 });
    expect(mode.modeType).toBe(SamplingModeType.RANDOM);
    expect(mode.probabilityThreshold).toBe(0.9);
    expect(mode.seed).toBe(42);
    expect(mode.top).toBeUndefined();
  });

  it("random() throws if both top and probabilityThreshold are set", () => {
    expect(() =>
      SamplingMode.random({ top: 50, probabilityThreshold: 0.9 }),
    ).toThrow("Cannot specify both");
  });

  it("random() throws if top is not a positive integer", () => {
    expect(() => SamplingMode.random({ top: 0 })).toThrow(
      "'top' must be a positive integer",
    );
    expect(() => SamplingMode.random({ top: -1 })).toThrow(
      "'top' must be a positive integer",
    );
  });

  it("random() throws if probabilityThreshold is out of range", () => {
    expect(() => SamplingMode.random({ probabilityThreshold: -0.1 })).toThrow(
      "between 0.0 and 1.0",
    );
    expect(() => SamplingMode.random({ probabilityThreshold: 1.1 })).toThrow(
      "between 0.0 and 1.0",
    );
  });

  it("random() accepts edge values 0.0 and 1.0 for probabilityThreshold", () => {
    expect(() => SamplingMode.random({ probabilityThreshold: 0.0 })).not.toThrow();
    expect(() => SamplingMode.random({ probabilityThreshold: 1.0 })).not.toThrow();
  });
});

describe("GenerationOptions", () => {
  it("defaults to all undefined", () => {
    const opts = new GenerationOptions();
    expect(opts.sampling).toBeUndefined();
    expect(opts.temperature).toBeUndefined();
    expect(opts.maximumResponseTokens).toBeUndefined();
  });

  it("accepts temperature", () => {
    const opts = new GenerationOptions({ temperature: 0.7 });
    expect(opts.temperature).toBe(0.7);
  });

  it("accepts maximum response tokens", () => {
    const opts = new GenerationOptions({ maximumResponseTokens: 500 });
    expect(opts.maximumResponseTokens).toBe(500);
  });

  it("accepts sampling mode", () => {
    const opts = new GenerationOptions({ sampling: SamplingMode.greedy() });
    expect(opts.sampling?.modeType).toBe(SamplingModeType.GREEDY);
  });

  it("accepts all options combined", () => {
    const opts = new GenerationOptions({
      sampling: SamplingMode.random({ top: 50, seed: 42 }),
      temperature: 0.8,
      maximumResponseTokens: 200,
    });
    expect(opts.sampling?.modeType).toBe(SamplingModeType.RANDOM);
    expect(opts.sampling?.top).toBe(50);
    expect(opts.temperature).toBe(0.8);
    expect(opts.maximumResponseTokens).toBe(200);
  });

  it("toJSON() serializes for the C API", () => {
    const opts = new GenerationOptions({
      sampling: SamplingMode.random({ top: 50, seed: 42 }),
      temperature: 0.7,
      maximumResponseTokens: 500,
    });
    const json = opts.toJSON();
    expect(json).toEqual({
      sampling: {
        mode: "random",
        top_k: 50,
        seed: 42,
      },
      temperature: 0.7,
      maximum_response_tokens: 500,
    });
  });

  it("toJSON() omits undefined fields", () => {
    const opts = new GenerationOptions({ temperature: 0.5 });
    const json = opts.toJSON();
    expect(json).toEqual({ temperature: 0.5 });
    expect(json).not.toHaveProperty("sampling");
    expect(json).not.toHaveProperty("maximum_response_tokens");
  });

  it("toJSON() handles greedy sampling", () => {
    const opts = new GenerationOptions({ sampling: SamplingMode.greedy() });
    const json = opts.toJSON();
    expect(json.sampling).toEqual({ mode: "greedy" });
  });
});
