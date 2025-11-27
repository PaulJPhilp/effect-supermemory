/**
 * @since 1.0.0
 * @module Ingest
 *
 * Ingest service for adding content to Supermemory.
 * Handles text, URLs, and file uploads with schema validation.
 */
import { Context, Effect, Layer, Schema } from "effect";
import { SupermemoryHttpClientService } from "./Client.js";
/**
 * Context tag for IngestService.
 *
 * @since 1.0.0
 * @category Context
 */
export class IngestServiceTag extends Context.Tag(
  "@effect-supermemory/Ingest"
)() {}
/**
 * Create the ingest service implementation.
 *
 * @since 1.0.0
 * @category Constructors
 */
const makeIngestService = Effect.gen(function* () {
  const httpClient = yield* SupermemoryHttpClientService;
  const addText = (content, options) =>
    Effect.gen(function* () {
      // Validate input
      const validatedContent = yield* Schema.decodeUnknown(Schema.String)(
        content
      ).pipe(
        Effect.mapError((error) => ({
          _tag: "SupermemoryValidationError",
          message: "Content must be a non-empty string",
          details: error,
        }))
      );
      // Build request body
      const body = {
        content: validatedContent,
        ...(options?.tags && { tags: options.tags }),
        ...(options?.customId && { customId: options.customId }),
        ...(options?.metadata && { metadata: options.metadata }),
      };
      // Make request to v3 documents endpoint
      return yield* httpClient.requestV3("POST", "/documents", {
        body,
      });
    }).pipe(
      Effect.withSpan("supermemory.ingest.addText", {
        attributes: {
          "supermemory.content_length": content.length,
          "supermemory.has_tags": options?.tags !== undefined,
          "supermemory.has_custom_id": options?.customId !== undefined,
        },
      })
    );
  const addUrl = (url, options) =>
    Effect.gen(function* () {
      // Validate URL
      const validatedUrl = yield* Schema.decodeUnknown(Schema.String)(url).pipe(
        Effect.mapError((error) => ({
          _tag: "SupermemoryValidationError",
          message: "URL must be a valid string",
          details: error,
        }))
      );
      // Validate URL format using Effect.try
      yield* Effect.try({
        try: () => new URL(validatedUrl),
        catch: () => new Error(`Invalid URL format: ${validatedUrl}`),
      }).pipe(
        Effect.mapError((error) => ({
          _tag: "SupermemoryValidationError",
          message: error.message,
        }))
      );
      // Build request body
      const body = {
        url: validatedUrl,
        ...(options?.tags && { tags: options.tags }),
        ...(options?.customId && { customId: options.customId }),
        ...(options?.metadata && { metadata: options.metadata }),
      };
      // Make request to v3 documents endpoint
      return yield* httpClient.requestV3("POST", "/documents", {
        body,
      });
    }).pipe(
      Effect.withSpan("supermemory.ingest.addUrl", {
        attributes: {
          "supermemory.url": url,
          "supermemory.has_tags": options?.tags !== undefined,
          "supermemory.has_custom_id": options?.customId !== undefined,
        },
      })
    );
  return {
    addText,
    addUrl,
  };
});
/**
 * Live layer for IngestService.
 * Requires SupermemoryHttpClientService.
 *
 * @since 1.0.0
 * @category Layers
 */
export const IngestServiceLive = Layer.effect(
  IngestServiceTag,
  makeIngestService
);
