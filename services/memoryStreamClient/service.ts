import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { type HttpClientError } from "../httpClient/errors.js";
import { HttpClientImpl } from "../httpClient/service.js";
import {
  MemoryValidationError,
  type MemoryError,
} from "../memoryClient/errors.js";
import { SearchResult } from "../searchClient/types.js";
import { MemoryStreamClient } from "./api.js";
import { StreamReadError, type StreamError } from "./errors.js";
import { JsonParsingError, ndjsonDecoder } from "./helpers.js";
import { MemoryStreamClientConfigType } from "./types.js";

export class MemoryStreamClientImpl extends Effect.Service<MemoryStreamClientImpl>()(
  "MemoryStreamClient",
  {
    effect: Effect.fn(function* (config: MemoryStreamClientConfigType) {
      const { namespace, baseUrl, apiKey, timeoutMs } = config;

      const httpClientLayer = HttpClientImpl.Default({
        baseUrl,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Supermemory-Namespace": namespace,
          "Content-Type": "application/json",
        },
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      });

      const httpClient = yield* HttpClientImpl.pipe(
        Effect.provide(httpClientLayer)
      );

      const translateHttpError = (
        error: HttpClientError
      ): MemoryError | StreamError => {
        if (error._tag === "AuthorizationError") {
          return new MemoryValidationError({
            message: `Authorization failed: ${error.reason}`,
          });
        }
        if (
          error._tag === "HttpError" &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 429
        ) {
          return new MemoryValidationError({
            message: `API request failed: ${error.status} - ${error.message}`,
          });
        }
        return new StreamReadError({
          message: `Stream initiation failed: ${error._tag}`,
          cause: error,
        });
      };

      return {
        listAllKeys: () =>
          httpClient
            .requestStream(`/api/v1/memories/keys/stream`, { method: "GET" })
            .pipe(
              Effect.mapError(translateHttpError),
              Effect.map((byteStream) => {
                const decoded = ndjsonDecoder(
                  byteStream as unknown as Stream.Stream<
                    Uint8Array,
                    StreamReadError
                  >
                );
                return decoded.pipe(
                  Stream.mapEffect((parsed) =>
                    Effect.try({
                      try: () => {
                        if (
                          typeof parsed === "object" &&
                          parsed !== null &&
                          "key" in parsed &&
                          typeof parsed.key === "string"
                        ) {
                          return parsed.key;
                        }
                        throw new Error("Invalid stream item format for key.");
                      },
                      catch: (e) =>
                        new StreamReadError({
                          message: `Failed to parse key: ${String(e)}`,
                          details: parsed,
                        }),
                    })
                  ),
                  Stream.mapError((error) =>
                    error instanceof JsonParsingError
                      ? new StreamReadError({
                        message: error.message,
                        cause: error.cause,
                      })
                      : error
                  )
                );
              })
            ),

        streamSearch: (query, options) => {
          const filtersJson = options?.filters
            ? JSON.stringify(options.filters)
            : undefined;

          return httpClient
            .requestStream(`/api/v1/search/stream`, {
              method: "GET",
              queryParams: {
                q: query,
                ...(options?.limit && { limit: String(options.limit) }),
                ...(options?.offset && { offset: String(options.offset) }),
                ...(options?.minRelevanceScore && {
                  minRelevanceScore: String(options.minRelevanceScore),
                }),
                ...(options?.maxAgeHours && {
                  maxAgeHours: String(options.maxAgeHours),
                }),
                ...(filtersJson && { filters: filtersJson }),
              },
            })
            .pipe(
              Effect.mapError(translateHttpError),
              Effect.map((byteStream) => {
                const decoded = ndjsonDecoder(
                  byteStream as unknown as Stream.Stream<
                    Uint8Array,
                    StreamReadError
                  >
                );
                return decoded.pipe(
                  Stream.mapEffect((parsed) =>
                    Effect.try({
                      try: () => {
                        if (
                          typeof parsed === "object" &&
                          parsed !== null &&
                          "memory" in parsed &&
                          typeof parsed.memory === "object" &&
                          "relevanceScore" in parsed &&
                          typeof parsed.relevanceScore === "number"
                        ) {
                          return {
                            memory: parsed.memory,
                            relevanceScore: parsed.relevanceScore,
                          } as SearchResult;
                        }
                        throw new Error("Invalid stream item format.");
                      },
                      catch: (e) =>
                        new StreamReadError({
                          message: `Failed to parse SearchResult: ${String(e)}`,
                          details: parsed,
                        }),
                    })
                  ),
                  Stream.mapError((error) =>
                    error instanceof JsonParsingError
                      ? new StreamReadError({
                        message: error.message,
                        cause: error.cause,
                      })
                      : error
                  )
                );
              })
            );
        },
      } satisfies MemoryStreamClient;
    }),
  }
) { }

export const Default = (config: MemoryStreamClientConfigType) =>
  MemoryStreamClientImpl.Default(config);
