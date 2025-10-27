import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { HttpClientImpl } from "../../httpClient/service.js";
import { MemoryStreamClient } from "./api.js";
import { MemoryStreamClientConfigType } from "./types.js";
import { MemoryError } from "../../memoryClient/errors.js"; // Base errors
import { HttpClientError, HttpError, NetworkError, AuthorizationError as HttpClientAuthorizationError, TooManyRequestsError } from "../../httpClient/errors.js";
import { SearchOptions, SearchResult, SearchError } from "../../searchClient/api.js";
import * as StreamErrors from "./errors.js"; // Stream specific errors
import * as Utils from "./utils.js"; // NDJSON decoder utility

export class MemoryStreamClientImpl extends Effect.Service<MemoryStreamClientImpl>()(
  "MemoryStreamClient",
  {
    effect: Effect.fn(function* (config: MemoryStreamClientConfigType) {
      const { namespace, baseUrl, apiKey, timeoutMs } = config;

      // Provide the HttpClient with its specific configuration
      const httpClientLayer = HttpClientImpl.Default({
        baseUrl,
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "X-Supermemory-Namespace": namespace,
          "Content-Type": "application/json",
        },
        timeoutMs,
      });

      const httpClient = yield* HttpClientImpl.pipe(Effect.provide(httpClientLayer));

      // Helper for translating HttpClientError to MemoryError/SearchError
      const translateInitialHttpClientError = (
        error: HttpClientError,
        keyFor404Translation?: string
      ): MemoryError | SearchError | StreamErrors.StreamError => {
        if (error._tag === "HttpClientAuthorizationError") {
          return new MemoryError.MemoryValidationError({ message: `Authorization failed: ${error.reason}` });
        }
        if (error._tag === "HttpError" && error.status >= 400 && error.status < 500 && error.status !== 429) {
          // Specific 404 for search/list endpoints handled by filter, others are validation.
          return new MemoryError.MemoryValidationError({ message: `API request failed: ${error.status} - ${error.message}` });
        }
        // Other errors (Network, 5xx, TooManyRequests) are StreamReadError
        return new StreamErrors.StreamReadError({ message: `Stream initiation failed: ${error._tag}`, cause: error });
      };

      return {
        listAllKeys: () =>
          httpClient.requestStream(
            `/api/v1/memories/keys/stream`,
            { method: "GET" }
          ).pipe(
            Effect.mapError(translateInitialHttpClientError),
            Effect.flatMap((byteStream) =>
              Utils.ndjsonDecoder(byteStream as Stream.Stream<Uint8Array, StreamErrors.StreamReadError>).pipe(
                Stream.mapEffect((parsed) =>
                  Effect.try({
                    try: () => {
                      if (typeof parsed === 'object' && parsed !== null && 'key' in parsed && typeof parsed.key === 'string') {
                        return parsed.key;
                      }
                      throw new Error("Invalid stream item format for key.");
                    },
                    catch: (e) => new StreamErrors.StreamReadError({ message: `Failed to parse stream item as key: ${String(e)}`, details: parsed }),
                  })
                )
              )
            ),
            Stream.mapError((error) => (error._tag === 'JsonParsingError' ? new StreamErrors.StreamReadError({ message: error.message, cause: error.cause }) : error)) // Translate JsonParsingError to StreamReadError
          ),

        streamSearch: (query, options) =>
          httpClient.requestStream(
            `/api/v1/search/stream`,
            {
              method: "GET",
              queryParams: {
                q: query,
                ...(options?.limit && { limit: String(options.limit) }),
                ...(options?.offset && { offset: String(options.offset) }),
                ...(options?.minRelevanceScore && { minRelevanceScore: String(options.minRelevanceScore) }),
                ...(options?.maxAgeHours && { maxAgeHours: String(options.maxAgeHours) }),
                ...(options?.filters && { filters: JSON.stringify(options.filters) }), // Assuming JSON stringify for filters
              },
            }
          ).pipe(
            Effect.mapError(translateInitialHttpClientError),
            Effect.flatMap((byteStream) =>
              Utils.ndjsonDecoder(byteStream as Stream.Stream<Uint8Array, StreamErrors.StreamReadError>).pipe(
                Stream.mapEffect((parsed) =>
                  Effect.try({
                    try: () => {
                      if (typeof parsed === 'object' && parsed !== null && 'memory' in parsed && typeof parsed.memory === 'object' && 'relevanceScore' in parsed && typeof parsed.relevanceScore === 'number') {
                        // Ensure it matches SearchResult type, re-using Memory type
                        return {
                          memory: parsed.memory, // Assume Memory type from backend
                          relevanceScore: parsed.relevanceScore,
                        } as SearchResult;
                      }
                      throw new Error("Invalid stream item format for search result.");
                    },
                    catch: (e) => new StreamErrors.StreamReadError({ message: `Failed to parse stream item as SearchResult: ${String(e)}`, details: parsed }),
                  })
                )
              )
            ),
            Stream.mapError((error) => (error._tag === 'JsonParsingError' ? new StreamErrors.StreamReadError({ message: error.message, cause: error.cause }) : error))
          ),
      } satisfies MemoryStreamClient;
    }),
  }
) {}

export const Default = Layer.succeed(
  MemoryStreamClientImpl,
  new MemoryStreamClientImpl()
);
