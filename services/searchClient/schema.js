import { Schema } from "effect";
// ID schema (nanoid format: 21 character URL-safe string)
export const ID = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(100),
  Schema.annotations({
    description: "Unique identifier (preferably nanoid format)",
  })
);
// MemoryValue schema
export const MemoryValue = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(1_000_000),
  Schema.annotations({
    description: "Memory content value",
  })
);
// RelevanceScore schema (0.0 to 1.0)
export const RelevanceScore = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
  Schema.annotations({
    description: "Relevance score (0.0 to 1.0)",
  })
);
// Namespace schema
export const Namespace = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(100),
  Schema.pattern(/^[a-zA-Z0-9_-]+$/),
  Schema.annotations({
    description: "Namespace identifier",
  })
);
// Timestamp schema (ISO 8601)
export const Timestamp = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/),
  Schema.annotations({
    description: "ISO 8601 timestamp string",
  })
);
// Metadata schema
export const Metadata = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).pipe(
  Schema.annotations({
    description: "Metadata object for search results",
  })
);
// FilterValue schema
export const FilterValue = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Array(Schema.String)
).pipe(
  Schema.annotations({
    description: "Filter value types",
  })
);
// SearchFilters schema
export const SearchFilters = Schema.Record({
  key: Schema.String,
  value: FilterValue,
}).pipe(
  Schema.annotations({
    description: "Filter object for search parameters",
  })
);
// QueryParams schema
export const QueryParams = Schema.Record({
  key: Schema.String,
  value: Schema.String,
}).pipe(
  Schema.annotations({
    description: "Encoded query parameters for HTTP requests",
  })
);
// Memory schema
export class Memory extends Schema.Class("Memory")({
  key: ID,
  value: MemoryValue,
}) {}
// SearchResult schema
export class SearchResult extends Schema.Class("SearchResult")({
  memory: Schema.instanceOf(Memory),
  relevanceScore: RelevanceScore,
}) {}
