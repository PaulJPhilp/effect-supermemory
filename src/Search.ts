/**
 * @since 1.0.0
 * @module Search
 *
 * Search service for querying Supermemory.
 * Provides separate methods for RAG (documents) and Chat (memories) paths.
 */
import { Schema } from "effect";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SupermemoryHttpClientService } from "./Client.js";
import {
	DocumentChunk,
	SearchDocumentsResponse,
	SearchMemoriesResponse,
	SearchOptions,
	SupermemoryMemory,
} from "./Domain.js";
import { type SupermemoryError } from "./Errors.js";
import { Filter, toJSON, type FilterExpression } from "./FilterBuilder.js";

/**
 * Search service interface.
 *
 * @since 1.0.0
 * @category Services
 */
export interface SearchService {
	/**
	 * Search documents (RAG path).
	 * Returns document chunks relevant to the query.
	 *
	 * @param query - The search query.
	 * @param options - Optional search options (topK, threshold, rerank, filters).
	 * @returns Effect that resolves to an array of document chunks.
	 *
	 * @example
	 * const chunks = yield* search.searchDocuments(
	 *   "What is the pricing model?",
	 *   { topK: 5, threshold: 0.7 }
	 * );
	 */
	readonly searchDocuments: (
		query: string,
		options?: SearchOptions
	) => Effect.Effect<readonly DocumentChunk[], SupermemoryError>;

	/**
	 * Search memories (Chat path).
	 * Returns synthesized memories/context relevant to the query.
	 *
	 * @param query - The search query.
	 * @param options - Optional search options (topK, threshold, rerank, filters).
	 * @returns Effect that resolves to an array of memories.
	 *
	 * @example
	 * const memories = yield* search.searchMemories(
	 *   "What does the user prefer?",
	 *   { topK: 10, filters: Filter.tag("user-preferences") }
	 * );
	 */
	readonly searchMemories: (
		query: string,
		options?: SearchOptions
	) => Effect.Effect<readonly SupermemoryMemory[], SupermemoryError>;
}

/**
 * Context tag for SearchService.
 *
 * @since 1.0.0
 * @category Context
 */
export class SearchServiceTag extends Context.Tag(
	"@effect-supermemory/Search"
)<SearchServiceTag, SearchService>() { }

/**
 * Build query parameters from search options and filters.
 *
 * @since 1.0.0
 * @category Utilities
 */
const buildSearchParams = (
	query: string,
	options?: SearchOptions
): Record<string, unknown> => {
	const params: Record<string, unknown> = {
		query,
	};

	if (options?.topK !== undefined) {
		params.topK = options.topK;
	}

	if (options?.threshold !== undefined) {
		params.threshold = options.threshold;
	}

	if (options?.rerank) {
		params.rerank = options.rerank;
	}

	if (options?.filters) {
		params.filters = toJSON(options.filters as FilterExpression);
	}

	return params;
};

/**
 * Create the search service implementation.
 *
 * @since 1.0.0
 * @category Constructors
 */
const makeSearchService = Effect.gen(function* () {
	const httpClient = yield* SupermemoryHttpClientService;

	const searchDocuments = (
		query: string,
		options?: SearchOptions
	): Effect.Effect<readonly DocumentChunk[], SupermemoryError> =>
		Effect.gen(function* () {
			// Validate query
			const validatedQuery = yield* Schema.decodeUnknown(Schema.String)(
				query
			).pipe(
				Effect.mapError(
					(error) =>
					({
						_tag: "SupermemoryValidationError",
						message: "Query must be a non-empty string",
						details: error,
					} as SupermemoryError)
				)
			);

			// Build request body
			const body = buildSearchParams(validatedQuery, options);

			// Make request to v3 search endpoint
			const response = yield* httpClient.requestV3<
				SearchDocumentsResponse,
				unknown,
				never
			>("POST", "/search", {
				body,
			});

			return response.results;
		}).pipe(
			Effect.withSpan("supermemory.search.documents", {
				attributes: {
					"supermemory.query_length": query.length,
					"supermemory.top_k": options?.topK,
					"supermemory.threshold": options?.threshold,
					"supermemory.has_filters": options?.filters !== undefined,
				},
			})
		);

	const searchMemories = (
		query: string,
		options?: SearchOptions
	): Effect.Effect<readonly SupermemoryMemory[], SupermemoryError> =>
		Effect.gen(function* () {
			// Validate query
			const validatedQuery = yield* Schema.decodeUnknown(Schema.String)(
				query
			).pipe(
				Effect.mapError(
					(error) =>
					({
						_tag: "SupermemoryValidationError",
						message: "Query must be a non-empty string",
						details: error,
					} as SupermemoryError)
				)
			);

			// Build request body
			const body = buildSearchParams(validatedQuery, options);

			// Make request to v4 search endpoint
			const response = yield* httpClient.requestV4<
				SearchMemoriesResponse,
				unknown,
				never
			>("POST", "/search", {
				body,
			});

			return response.results;
		}).pipe(
			Effect.withSpan("supermemory.search.memories", {
				attributes: {
					"supermemory.query_length": query.length,
					"supermemory.top_k": options?.topK,
					"supermemory.threshold": options?.threshold,
					"supermemory.has_filters": options?.filters !== undefined,
				},
			})
		);

	return {
		searchDocuments,
		searchMemories,
	} satisfies SearchService;
});

/**
 * Live layer for SearchService.
 * Requires SupermemoryHttpClientService.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SearchServiceLive: Layer.Layer<
	SearchServiceTag,
	never,
	SupermemoryHttpClientService
> = Layer.effect(SearchServiceTag, makeSearchService);

/**
 * Re-export Filter API for convenience.
 *
 * @since 1.0.0
 * @category Utilities
 */
export { Filter, toJSON, type FilterExpression };
