/** @effect-diagnostics classSelfMismatch:skip-file */
/**
 * @since 1.0.0
 * @module Ingest
 */

import { SupermemoryHttpClientService } from "@services/client/service.js";
import { Effect, Schema } from "effect";
import { API_ENDPOINTS, SPANS, TELEMETRY_ATTRIBUTES } from "@/Constants.js";
import type { SupermemoryError } from "@/Errors.js";
import type { IngestServiceOps } from "./api.js";
import type { IngestOptions, IngestResponse } from "./types.js";

/**
 * Create the ingest service implementation.
 *
 * @since 1.0.0
 * @category Constructors
 */
const makeIngestService = Effect.gen(function* () {
  const httpClient = yield* SupermemoryHttpClientService;

  const addText = (
    content: string,
    options?: IngestOptions
  ): Effect.Effect<IngestResponse, SupermemoryError> =>
    Effect.gen(function* () {
      // Validate input
      const validatedContent = yield* Schema.decodeUnknown(Schema.String)(
        content
      ).pipe(
        Effect.mapError(
          (error) =>
            ({
              _tag: "SupermemoryValidationError",
              message: "Content must be a non-empty string",
              details: error,
            }) as SupermemoryError
        )
      );

      // Build request body
      const body = {
        content: validatedContent,
        ...(options?.tags && { tags: options.tags }),
        ...(options?.customId && { customId: options.customId }),
        ...(options?.metadata && { metadata: options.metadata }),
      };

      // Make request to v3 documents endpoint
      return yield* httpClient.requestV3<IngestResponse, unknown, never>(
        "POST",
        API_ENDPOINTS.V3.DOCUMENTS,
        {
          body,
        }
      );
    }).pipe(
      Effect.withSpan(SPANS.INGEST_ADD_TEXT, {
        attributes: {
          [TELEMETRY_ATTRIBUTES.CONTENT_LENGTH]: content.length,
          [TELEMETRY_ATTRIBUTES.HAS_TAGS]: options?.tags !== undefined,
          [TELEMETRY_ATTRIBUTES.HAS_CUSTOM_ID]: options?.customId !== undefined,
        },
      })
    );

  const addUrl = (
    url: string,
    options?: IngestOptions
  ): Effect.Effect<IngestResponse, SupermemoryError> =>
    Effect.gen(function* () {
      // Validate URL
      const validatedUrl = yield* Schema.decodeUnknown(Schema.String)(url).pipe(
        Effect.mapError(
          (error) =>
            ({
              _tag: "SupermemoryValidationError",
              message: "URL must be a valid string",
              details: error,
            }) as SupermemoryError
        )
      );

      // Validate URL format using Effect.try
      yield* Effect.try({
        try: () => new URL(validatedUrl),
        catch: () => new Error(`Invalid URL format: ${validatedUrl}`),
      }).pipe(
        Effect.mapError(
          (error) =>
            ({
              _tag: "SupermemoryValidationError",
              message: error.message,
            }) as SupermemoryError
        )
      );

      // Build request body
      const body = {
        url: validatedUrl,
        ...(options?.tags && { tags: options.tags }),
        ...(options?.customId && { customId: options.customId }),
        ...(options?.metadata && { metadata: options.metadata }),
      };

      // Make request to v3 documents endpoint
      return yield* httpClient.requestV3<IngestResponse, unknown, never>(
        "POST",
        API_ENDPOINTS.V3.DOCUMENTS,
        {
          body,
        }
      );
    }).pipe(
      Effect.withSpan(SPANS.INGEST_ADD_URL, {
        attributes: {
          [TELEMETRY_ATTRIBUTES.URL]: url,
          [TELEMETRY_ATTRIBUTES.HAS_TAGS]: options?.tags !== undefined,
          [TELEMETRY_ATTRIBUTES.HAS_CUSTOM_ID]: options?.customId !== undefined,
        },
      })
    );

  return {
    addText,
    addUrl,
  } satisfies IngestServiceOps;
});

/**
 * Context tag and Service for IngestService.
 *
 * @since 1.0.0
 * @category Context
 */
export class IngestService extends Effect.Service<IngestServiceOps>()(
  "@effect-supermemory/Ingest",
  {
    accessors: true,
    effect: makeIngestService,
  }
) {}

/**
 * Live layer for IngestService.
 *
 * @since 1.0.0
 * @category Layers
 */
export const IngestServiceLive = IngestService.Default;
