/**
 * Schema definitions for Supermemory configuration.
 *
 * @since 1.0.0
 * @module Config
 */

import { Schema } from "effect";

/**
 * Schema for Supermemory configuration environment variables.
 * Uses strings for all values and parses numbers in the service layer.
 *
 * @since 1.0.0
 * @category Schema
 */
export class SupermemoryConfigEnv extends Schema.Class<SupermemoryConfigEnv>(
  "SupermemoryConfigEnv"
)({
  SUPERMEMORY_API_KEY: Schema.String,
  SUPERMEMORY_WORKSPACE_ID: Schema.optional(Schema.String),
  SUPERMEMORY_BASE_URL: Schema.optional(Schema.String),
  SUPERMEMORY_DEFAULT_THRESHOLD: Schema.optional(Schema.String),
  SUPERMEMORY_TIMEOUT_MS: Schema.optional(Schema.String),
}) {}
