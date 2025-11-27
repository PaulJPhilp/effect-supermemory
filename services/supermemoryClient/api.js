import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
export const getOption = (client) => (key) =>
  client.get(key).pipe(Effect.map(Option.fromNullable));
