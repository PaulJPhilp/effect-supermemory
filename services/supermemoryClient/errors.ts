import { Data } from "effect";
import { MemoryError, MemoryNotFoundError, MemoryValidationError } from "../../services/memoryClient/errors.js"; // Import existing MemoryErrors
import { HttpClientError, AuthorizationError as HttpClientAuthorizationError } from "../../services/httpClient/errors.js";

// SupermemoryClient-specific errors, if any, could be defined here.
// For now, we mainly translate HttpClientError to existing MemoryError.

// Helper to translate HttpClient errors to Memory errors
export const translateHttpClientError = (
  error: HttpClientError,
  key?: string
): MemoryError => {
  if (error._tag === "AuthorizationError") {
    // If we decide to introduce a distinct MemoryAuthError later, it would go here.
    // For now, mapping to MemoryValidationError as per CTO directive.
    return new MemoryValidationError({ message: `Authorization failed: ${error.reason}` });
  }
  if (error._tag === "HttpError" && error.status === 404 && key) {
    // This should ideally be handled by the consuming method (get, exists)
    // but useful for direct error translation if a general API call expects an item.
    return new MemoryNotFoundError({ key });
  }
  // Generic mapping for other HttpClient errors to MemoryValidationError
  return new MemoryValidationError({
    message: `API request failed: ${error._tag} - ${
      "message" in error ? error.message : (error as any).cause?.message || String(error)
    }`,
  });
};

export { MemoryError, MemoryNotFoundError, MemoryValidationError };
