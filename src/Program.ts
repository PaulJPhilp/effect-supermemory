/**
 * Demo program for effect-supermemory
 *
 * @since 1.0.0
 * @module Program
 */
import * as Effect from "effect/Effect";

const program = Effect.log(
  "effect-supermemory - ready for V1.0 implementation"
);

Effect.runPromise(program);
