import { Effect, Option } from "effect";
export const getOption = (client) => (key) =>
  client.get(key).pipe(Effect.map(Option.fromNullable));
