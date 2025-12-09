import { API_FIELD_NAMES } from "@/Constants.js";
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
    [API_FIELD_NAMES.QUERY]: query,
  };

  if (options?.topK !== undefined) {
    params[API_FIELD_NAMES.TOP_K] = options.topK;
  }

  if (options?.threshold !== undefined) {
    params[API_FIELD_NAMES.THRESHOLD] = options.threshold;
  }

  if (options?.rerank) {
    params[API_FIELD_NAMES.RERANK] = options.rerank;
  }

  if (options?.filters) {
    params[API_FIELD_NAMES.FILTERS] = toJSON(
      options.filters as FilterExpression
    );
  }

  if (options?.containerTag !== undefined) {
    params[API_FIELD_NAMES.CONTAINER_TAG] = options.containerTag;
  }

  if (
    options?.containerTags !== undefined &&
    options.containerTags.length > 0
  ) {
    params[API_FIELD_NAMES.CONTAINER_TAGS] = options.containerTags;
  }

  return params;
};
