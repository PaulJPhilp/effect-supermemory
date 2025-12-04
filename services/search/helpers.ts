import { type FilterExpression, toJSON } from "./filterBuilder.js";
import type { SearchOptions } from "./types.js";

/**
 * Build query parameters from search options and filters.
 *
 * @since 1.0.0
 * @category Utilities
 */
export const buildSearchParams = (
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
