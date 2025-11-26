/**
 * @since 1.0.0
 * @module Ingest
 *
 * Ingest service for adding content to Supermemory.
 * Handles text, URLs, and file uploads with schema validation.
 */
import * as Schema from "@effect/schema/Schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SupermemoryHttpClientService } from "./Client.js";
import {
	IngestOptions,
	IngestResponse,
} from "./Domain.js";
import { type SupermemoryError } from "./Errors.js";

/**
 * Ingest service interface.
 *
 * @since 1.0.0
 * @category Services
 */
export interface IngestService {
	/**
	 * Add text content to Supermemory.
	 *
	 * @param content - The text content to ingest.
	 * @param options - Optional ingestion options (tags, customId, metadata).
	 * @returns Effect that resolves to the ingestion response.
	 *
	 * @example
	 * const result = yield* ingest.addText(
	 *   "The sky is blue",
	 *   { tags: ["weather"], customId: "weather-001" }
	 * );
	 */
	readonly addText: (
		content: string,
		options?: IngestOptions
	) => Effect.Effect<IngestResponse, SupermemoryError>;

	/**
	 * Add content from a URL to Supermemory.
	 * Triggers Supermemory's scraper to fetch and process the content.
	 *
	 * @param url - The URL to scrape and ingest.
	 * @param options - Optional ingestion options.
	 * @returns Effect that resolves to the ingestion response.
	 *
	 * @example
	 * const result = yield* ingest.addUrl(
	 *   "https://example.com/article",
	 *   { tags: ["web-content"] }
	 * );
	 */
	readonly addUrl: (
		url: string,
		options?: IngestOptions
	) => Effect.Effect<IngestResponse, SupermemoryError>;
}

/**
 * Context tag for IngestService.
 *
 * @since 1.0.0
 * @category Context
 */
export class IngestServiceTag extends Context.Tag(
	"@effect-supermemory/Ingest"
)<IngestServiceTag, IngestService>() { }

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
					} as SupermemoryError)
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
				"/documents",
				{
					body,
				}
			);
		}).pipe(
			Effect.withSpan("supermemory.ingest.addText", {
				attributes: {
					"supermemory.content_length": content.length,
					"supermemory.has_tags": options?.tags !== undefined,
					"supermemory.has_custom_id": options?.customId !== undefined,
				},
			})
		);

	const addUrl = (
		url: string,
		options?: IngestOptions
	): Effect.Effect<IngestResponse, SupermemoryError> =>
		Effect.gen(function* () {
			// Validate URL
			const validatedUrl = yield* Schema.decodeUnknown(Schema.String)(
				url
			).pipe(
				Effect.mapError(
					(error) =>
					({
						_tag: "SupermemoryValidationError",
						message: "URL must be a valid string",
						details: error,
					} as SupermemoryError)
				)
			);

			// Try to parse as URL to validate format
			try {
				new URL(validatedUrl);
			} catch {
				return yield* Effect.fail({
					_tag: "SupermemoryValidationError",
					message: `Invalid URL format: ${validatedUrl}`,
				} as SupermemoryError);
			}

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
				"/documents",
				{
					body,
				}
			);
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
	} satisfies IngestService;
});

/**
 * Live layer for IngestService.
 * Requires SupermemoryHttpClientService.
 *
 * @since 1.0.0
 * @category Layers
 */
export const IngestServiceLive: Layer.Layer<
	IngestServiceTag,
	never,
	SupermemoryHttpClientService
> = Layer.effect(IngestServiceTag, makeIngestService);
