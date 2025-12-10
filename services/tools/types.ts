/**
 * Tool definition types for AI SDK integration.
 *
 * @since 1.0.0
 * @module Tools
 */

/**
 * Tool definition compatible with Vercel AI SDK, OpenAI, and other AI frameworks.
 *
 * Follows the OpenAI function calling format:
 * https://platform.openai.com/docs/guides/function-calling
 *
 * @since 1.0.0
 */
export type ToolDefinition = {
  /**
   * The name of the tool to be called.
   * Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.
   */
  readonly name: string;

  /**
   * A description of what the tool does.
   * Used by the model to choose when and how to call the tool.
   */
  readonly description: string;

  /**
   * The parameters the tool accepts, described as a JSON Schema object.
   * Follows the JSON Schema format: https://json-schema.org/
   */
  readonly parameters: {
    readonly type: "object";
    readonly properties: Record<string, ParameterDefinition>;
    readonly required?: readonly string[];
  };
};

/**
 * Parameter definition for a tool parameter.
 *
 * @since 1.0.0
 */
export type ParameterDefinition = {
  /**
   * The type of the parameter (string, number, boolean, object, array).
   */
  readonly type: "string" | "number" | "boolean" | "object" | "array";

  /**
   * Description of what the parameter does.
   */
  readonly description: string;

  /**
   * For string types, an optional enum of allowed values.
   */
  readonly enum?: readonly string[];

  /**
   * For array types, the items schema.
   */
  readonly items?: ParameterDefinition;

  /**
   * For object types, the properties schema.
   */
  readonly properties?: Record<string, ParameterDefinition>;

  /**
   * For number types, optional minimum value.
   */
  readonly minimum?: number;

  /**
   * For number types, optional maximum value.
   */
  readonly maximum?: number;
};
