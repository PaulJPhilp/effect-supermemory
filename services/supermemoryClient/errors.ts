/** biome-ignore-all lint/performance/noBarrelFile: we want to export the functions directly */
import type { HttpClientError } from "@services/httpClient/errors.js";
import {
  isAuthorizationError,
  isHttpErrorWithStatus,
} from "@services/httpClient/helpers.js";
import type { MemoryError } from "@services/inMemoryClient/errors.js";
import {
  MemoryNotFoundError,
  MemoryValidationError,
} from "@services/inMemoryClient/errors.js"; // Import existing MemoryErrors

// SupermemoryClient-specific errors, if any, could be defined here.
// For now, we mainly translate HttpClientError to existing MemoryError.

// Helper to translate HttpClient errors to Memory errors
export const translateHttpClientError = (
  error: HttpClientError,
  key?: string
): MemoryError => {
  if (isAuthorizationError(error)) {
    // If we decide to introduce a distinct MemoryAuthError later, it would go here.
    // For now, mapping to MemoryValidationError as per CTO directive.
    return new MemoryValidationError({
      message: `Authorization failed: ${error.reason}`,
    });
  }
  if (isHttpErrorWithStatus(error, 404) && key) {
    // This should ideally be handled by the consuming method (get, exists)
    // but useful for direct error translation if a general API call expects an item.
    return new MemoryNotFoundError({ key });
  }
  // Generic mapping for other HttpClient errors to MemoryValidationError
  let errorMessage: string;
  if (error._tag === "NetworkError") {
    // NetworkError has a cause property with the actual error and a url property
    const causeMsg = error.cause.message || String(error.cause);
    const urlInfo = error.url ? ` (URL: ${error.url})` : "";
    errorMessage = `${causeMsg}${urlInfo}`;
  } else if ("message" in error && typeof error.message === "string") {
    errorMessage = error.message;
    if ("url" in error && typeof error.url === "string") {
      errorMessage += ` (URL: ${error.url})`;
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else {
    errorMessage = String(error);
  }

  return new MemoryValidationError({
    message: `API request failed: ${error._tag} - ${errorMessage}`,
  });
};

export type { MemoryError } from "@services/inMemoryClient/errors.js";
// Re-export MemoryError types for convenience
export {
  MemoryNotFoundError,
  MemoryValidationError,
} from "@services/inMemoryClient/errors.js";
