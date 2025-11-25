export interface Memory {
  readonly key: string;
  readonly value: string;
}

export interface SupermemoryClientConfigType {
  readonly namespace: string;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
}

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
