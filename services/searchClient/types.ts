// Import types from schema to maintain consistency
import type * as SchemaModule from "./schema.js";

export type ID = typeof SchemaModule.ID.Type;
export type MemoryValue = typeof SchemaModule.MemoryValue.Type;
export type RelevanceScore = typeof SchemaModule.RelevanceScore.Type;
export type Namespace = typeof SchemaModule.Namespace.Type;
export type Timestamp = typeof SchemaModule.Timestamp.Type;
export type Metadata = typeof SchemaModule.Metadata.Type;
export type FilterValue = typeof SchemaModule.FilterValue.Type;
export type SearchFilters = typeof SchemaModule.SearchFilters.Type;
export type QueryParams = typeof SchemaModule.QueryParams.Type;

export type Memory = {
  readonly key: ID;
  readonly value: MemoryValue;
};

export type SupermemoryClientConfigType = {
  readonly namespace: Namespace;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
};

export type SearchOptions = {
  readonly limit?: number;
  readonly offset?: number;
  readonly filters?: SearchFilters;
  readonly minRelevanceScore?: RelevanceScore;
  readonly maxAgeHours?: number;
};

export type SearchResult = {
  readonly memory: Memory;
  readonly relevanceScore: RelevanceScore;
};
