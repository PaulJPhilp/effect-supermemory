/** @effect-diagnostics classSelfMismatch:skip-file */
/** biome-ignore-all assist/source/organizeImports: <explanation> */
/**
 * @since 1.0.0
 * @module Ingest
 */

import {
  API_ENDPOINTS,
  API_FIELD_NAMES,
  ERROR_MESSAGES,
  HTTP_METHODS,
  SERVICE_TAGS,
  SPANS,
  TELEMETRY_ATTRIBUTES,
} from "@/Constants.js";
import { type SupermemoryError, SupermemoryValidationError } from "@/Errors.js";
import { SupermemoryHttpClientService } from "@services/client/service.js";
import { Effect, Schema } from "effect";
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
            new SupermemoryValidationError({
              message: ERROR_MESSAGES.CONTENT_MUST_BE_NON_EMPTY_STRING,
              details: error,
            })
        )
      );

      // Build request body
      const body = {
        [API_FIELD_NAMES.CONTENT]: validatedContent,
        ...(options?.tags && { [API_FIELD_NAMES.TAGS]: options.tags }),
        ...(options?.customId && {
          [API_FIELD_NAMES.CUSTOM_ID]: options.customId,
        }),
        ...(options?.metadata && {
          [API_FIELD_NAMES.METADATA]: options.metadata,
        }),
      };

      // Make request to v3 documents endpoint
      return yield* httpClient.requestV3<IngestResponse, unknown, never>(
        HTTP_METHODS.POST,
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
            new SupermemoryValidationError({
              message: ERROR_MESSAGES.URL_MUST_BE_VALID_STRING,
              details: error,
            })
        )
      );

      // Validate URL format using Effect.try
      yield* Effect.try({
        try: () => new URL(validatedUrl),
        catch: () =>
          new SupermemoryValidationError({
            message: `${ERROR_MESSAGES.INVALID_URL_FORMAT}: ${validatedUrl}`,
          }),
      });

      // Build request body
      const body = {
        [API_FIELD_NAMES.URL]: validatedUrl,
        ...(options?.tags && { [API_FIELD_NAMES.TAGS]: options.tags }),
        ...(options?.customId && {
          [API_FIELD_NAMES.CUSTOM_ID]: options.customId,
        }),
        ...(options?.metadata && {
          [API_FIELD_NAMES.METADATA]: options.metadata,
        }),
      };

      // Make request to v3 documents endpoint
      return yield* httpClient.requestV3<IngestResponse, unknown, never>(
        HTTP_METHODS.POST,
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
  SERVICE_TAGS.INGEST,
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
