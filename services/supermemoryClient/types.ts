import { Brand } from "effect";

// Branded type for memory IDs to ensure strong typing for backend IDs
export type SupermemoryId = string & Brand.Brand<"SupermemoryId">;
export const SupermemoryId = Brand.nominal<SupermemoryId>();

// Represents a memory as stored/returned by the Supermemory backend
export interface SupermemoryApiMemory {
  readonly id: SupermemoryId;
  readonly value: string; // Base64 encoded content
  readonly namespace: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string; // ISO date string
  readonly updatedAt: string; // ISO date string
}

// Configuration for the SupermemoryClient service itself
export interface SupermemoryClientConfigType {
  readonly namespace: string;
  readonly baseUrl: string; // Supermemory API base URL
  readonly apiKey: string;  // API key for Authorization header
  readonly timeoutMs?: number; // Optional timeout for HTTP requests
}
