import { Memory } from "../memoryClient/api.js";

export interface SearchOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly filters?: Record<string, string | number | boolean | string[]>;
  readonly minRelevanceScore?: number;
  readonly maxAgeHours?: number;
}

export interface SearchResult {
  readonly memory: Memory;
  readonly relevanceScore: number;
}
