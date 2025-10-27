import { Data } from "effect";

export class StreamReadError extends Data.TaggedError("StreamReadError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly details?: unknown;
}> {}

export type StreamError = StreamReadError;
