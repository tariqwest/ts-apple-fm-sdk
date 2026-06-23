/**
 * Generation options that control how the model generates responses.
 *
 * Mirrors the Python SDK's GenerationOptions, SamplingMode, and
 * SamplingModeType classes.
 */

export const SamplingModeType = {
  GREEDY: "greedy",
  RANDOM: "random",
} as const;

export type SamplingModeType =
  (typeof SamplingModeType)[keyof typeof SamplingModeType];

export interface SamplingModeOptions {
  top?: number;
  probabilityThreshold?: number;
  seed?: number;
}

/**
 * Defines how values are sampled from the model's probability distribution.
 */
export class SamplingMode {
  readonly modeType: SamplingModeType;
  readonly top?: number;
  readonly probabilityThreshold?: number;
  readonly seed?: number;

  private constructor(
    modeType: SamplingModeType,
    options?: SamplingModeOptions,
  ) {
    this.modeType = modeType;
    this.top = options?.top;
    this.probabilityThreshold = options?.probabilityThreshold;
    this.seed = options?.seed;
  }

  /** Always select the most likely token. */
  static greedy(): SamplingMode {
    return new SamplingMode(SamplingModeType.GREEDY);
  }

  /** Randomly select from high-probability tokens. */
  static random(options?: SamplingModeOptions): SamplingMode {
    if (
      options?.top !== undefined &&
      options?.probabilityThreshold !== undefined
    ) {
      throw new Error(
        "Cannot specify both 'top' and 'probabilityThreshold'. " +
          "Choose one sampling constraint.",
      );
    }

    if (
      options?.top !== undefined &&
      (!Number.isInteger(options.top) || options.top <= 0)
    ) {
      throw new Error("'top' must be a positive integer");
    }

    if (
      options?.probabilityThreshold !== undefined &&
      (options.probabilityThreshold < 0.0 || options.probabilityThreshold > 1.0)
    ) {
      throw new Error(
        "'probabilityThreshold' must be between 0.0 and 1.0",
      );
    }

    return new SamplingMode(SamplingModeType.RANDOM, options);
  }
}

export interface GenerationOptionsInit {
  sampling?: SamplingMode;
  temperature?: number;
  maximumResponseTokens?: number;
}

/**
 * Options that control how the model generates its response to a prompt.
 */
export class GenerationOptions {
  readonly sampling?: SamplingMode;
  readonly temperature?: number;
  readonly maximumResponseTokens?: number;

  constructor(init?: GenerationOptionsInit) {
    this.sampling = init?.sampling;
    this.temperature = init?.temperature;
    this.maximumResponseTokens = init?.maximumResponseTokens;
  }

  /** Serialize to the JSON format expected by the C API's optionsJSON parameter. */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (this.sampling) {
      const samplingObj: Record<string, unknown> = {
        mode: this.sampling.modeType,
      };
      if (this.sampling.top !== undefined) samplingObj.top_k = this.sampling.top;
      if (this.sampling.probabilityThreshold !== undefined)
        samplingObj.top_p = this.sampling.probabilityThreshold;
      if (this.sampling.seed !== undefined) samplingObj.seed = this.sampling.seed;
      result.sampling = samplingObj;
    }

    if (this.temperature !== undefined) result.temperature = this.temperature;
    if (this.maximumResponseTokens !== undefined)
      result.maximum_response_tokens = this.maximumResponseTokens;

    return result;
  }
}
