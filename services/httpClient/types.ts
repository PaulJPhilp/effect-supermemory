export type HttpClientConfigType = {
  readonly baseUrl: string;
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly fetch?: typeof globalThis.fetch; // Allows injecting custom fetch for testing
};
