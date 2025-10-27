import * as Stream from "effect/Stream";
import * as Effect from "effect/Effect";
import * as Data from "effect/Data";
import { StreamReadError } from "./errors.js";

// Custom error for JSON parsing within the stream
export class JsonParsingError extends Data.TaggedError("JsonParsingError")<{
  readonly message: string;
  readonly rawChunk: string;
  readonly cause?: Error;
}> {}

/**
 * A Stream decoder for NDJSON (Newline-Delimited JSON) / JSONL.
 * Takes a Stream<Uint8Array> and returns a Stream<unknown> (parsed JSON objects).
 * Handles partial lines and ensures each emitted element is a complete JSON object.
 */
export const ndjsonDecoder = (
  byteStream: Stream.Stream<Uint8Array, StreamReadError>
): Stream.Stream<unknown, StreamReadError | JsonParsingError> => {
  let buffer = ""; // Buffer to hold incomplete lines

  return byteStream.pipe(
    Stream.decodeText("utf-8"), // Decode bytes to text
    Stream.flatMap((chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");

      // Keep the last part in buffer if it's an incomplete line
      buffer = lines.pop() || "";

      // Parse each complete line
      return Stream.fromIterable(lines);
    }),
    Stream.filter((line) => line.trim().length > 0), // Filter out empty lines
    Stream.flatMap((line) => {
      return Effect.try({
        try: () => JSON.parse(line),
        catch: (e) => new JsonParsingError({ message: "Failed to parse JSON line", rawChunk: line, cause: e instanceof Error ? e : undefined }),
      }).pipe(
        Effect.map(Stream.succeed), // Wrap parsed object in a Stream of one element
        Effect.mapError(Effect.fail) // Propagate parse error
      );
    }),
    Stream.flatten // Flatten the Stream<Stream<unknown>> to Stream<unknown>
  );
};

// Helper to convert Uint8Array to text if needed, for testing
export const decodeUint8Array = (chunk: Uint8Array): string =>
  new TextDecoder().decode(chunk);
