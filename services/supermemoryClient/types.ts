import { Brand } from "effect";

export type SupermemoryId = string & Brand.Brand<"SupermemoryId">;
export const SupermemoryId = Brand.nominal<SupermemoryId>();

export interface RetryScheduleConfig {
  readonly attempts: number; // Total number of attempts (1 means no retries, just initial call)
  readonly delayMs: number;  // Fixed delay in milliseconds between attempts
}

// Configuration for the SupermemoryClient service itself
export interface SupermemoryClientConfigType {
  readonly namespace: string;
  readonly baseUrl: string; // Supermemory API base URL
  readonly apiKey: string;  // API key for Authorization header
  readonly timeoutMs?: number; // Optional timeout for HTTP requests
  readonly retries?: RetryScheduleConfig; // New: Optional retry configuration
}

// Represents a memory as stored/returned by the Supermemory backend
export interface SupermemoryApiMemory {
  readonly id: SupermemoryId;
  readonly value: string; // Base64 encoded content
  readonly namespace: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string; // ISO date string
  readonly updatedAt: string; // ISO date string
}
