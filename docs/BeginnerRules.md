# Beginner Level Effect Rules

> These rules introduce core Effect patterns used throughout
> `effect-supermemory`. They are written for beginners and
> intentionally redundant with library docs for quick reference.

## Collect All Results into a List

**Rule:** Use `Stream.runCollect` to execute a stream and collect all its
emitted values into a `Chunk`.

```ts
import { Effect, Stream, Chunk } from "effect";

const program = Stream.range(1, 10).pipe(
  // Find all the even numbers
  Stream.filter((n) => n % 2 === 0),
  // Transform them into strings
  Stream.map((n) => `Even number: ${n}`),
  // Run the stream and collect the results
  Stream.runCollect
);

Effect.runPromise(program).then((results) => {
  console.log("Collected results:", Chunk.toArray(results));
});
// Output:
// Collected results: [
//   "Even number: 2",
//   "Even number: 4",
//   "Even number: 6",
//   "Even number: 8",
//   "Even number: 10"
// ]
```

## Comparing Data by Value with Structural Equality

**Rule:** Use `Data.struct` or implement the `Equal` interface for
value-based comparison of objects and classes.

```ts
import { Data, Equal, Effect } from "effect";

interface Point {
  readonly _tag: "Point";
  readonly x: number;
  readonly y: number;
}

const Point = Data.tagged<Point>("Point");

const program = Effect.gen(function* () {
  const p1 = Point({ x: 1, y: 2 });
  const p2 = Point({ x: 1, y: 2 });
  const p3 = Point({ x: 3, y: 4 });

  yield* Effect.log("Comparing points with reference equality (===):");
  yield* Effect.log(`p1 === p2: ${p1 === p2}`);

  yield* Effect.log("\nComparing points with structural equality:");
  yield* Effect.log(`p1 equals p2: ${Equal.equals(p1, p2)}`);
  yield* Effect.log(`p1 equals p3: ${Equal.equals(p1, p3)}`);

  yield* Effect.log("\nPoint values:");
  yield* Effect.log(`p1: ${JSON.stringify(p1)}`);
  yield* Effect.log(`p2: ${JSON.stringify(p2)}`);
  yield* Effect.log(`p3: ${JSON.stringify(p3)}`);
});

Effect.runPromise(program);
```

## Create a Basic HTTP Server

**Rule:** Use `Http.server.serve` (or a platform-specific wrapper) to run
an HTTP application.

```ts
import { Effect, Duration } from "effect";
import * as http from "http";

class HttpServer extends Effect.Service<HttpServer>()("HttpServer", {
  sync: () => ({
    start: () =>
      Effect.gen(function* () {
        const server = http.createServer(
          (req: http.IncomingMessage, res: http.ServerResponse) => {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("Hello, World!");
          }
        );

        yield* Effect.addFinalizer(() =>
          Effect.gen(function* () {
            yield* Effect.sync(() => server.close());
            yield* Effect.logInfo("Server shut down");
          })
        );

        yield* Effect.async<void, Error>((resume) => {
          server.on("error", (error) => resume(Effect.fail(error)));
          server.listen(3456, "localhost", () => {
            resume(Effect.succeed(void 0));
          });
        }).pipe(
          Effect.timeout(Duration.seconds(5)),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logError(
                `Failed to start server: ${error}`
              );
              return yield* Effect.fail(error);
            })
          )
        );

        yield* Effect.logInfo(
          "Server running at http://localhost:3456/"
        );

        yield* Effect.sleep(Duration.seconds(3));
        yield* Effect.logInfo("Server demonstration complete");
      }),
  }),
}) {}

const program = Effect.gen(function* () {
  const server = yield* HttpServer;

  yield* Effect.logInfo("Starting HTTP server...");

  yield* server.start();
}).pipe(Effect.scoped);

Effect.runPromise(Effect.provide(program, HttpServer.Default)).catch(
  (error) => {
    console.error("Program failed:", error);
    process.exit(1);
  }
);
```

## Create a Stream from a List

**Rule:** Use `Stream.fromIterable` to begin a pipeline from an
in-memory collection.

```ts
import { Effect, Stream, Chunk } from "effect";

const numbers = [1, 2, 3, 4, 5];

const program = Stream.fromIterable(numbers).pipe(
  Stream.map((n) => `Item: ${n}`),
  Stream.runCollect
);

Effect.runPromise(program).then((processedItems) => {
  console.log(Chunk.toArray(processedItems));
});
// Output:
// [ "Item: 1", "Item: 2", "Item: 3", "Item: 4", "Item: 5" ]
```

## Create Pre-resolved Effects with succeed and fail

**Rule:** Create pre-resolved effects with `Effect.succeed` and
`Effect.fail`.

```ts
import { Effect, Data } from "effect";

class MyError extends Data.TaggedError("MyError") {}

const program = Effect.gen(function* () {
  yield* Effect.logInfo("Running success effect...");
  yield* Effect.gen(function* () {
    const value = yield* Effect.succeed(42);
    yield* Effect.logInfo(`Success value: ${value}`);
  });

  yield* Effect.logInfo("\nRunning failure effect...");
  yield* Effect.gen(function* () {
    yield* Effect.fail(new MyError());
  }).pipe(
    Effect.catchTag("MyError", (error) =>
      Effect.logInfo(`Error occurred: ${error._tag}`)
    )
  );
});

Effect.runPromise(program);
```

## Execute Asynchronous Effects with Effect.runPromise

**Rule:** Execute asynchronous effects with `Effect.runPromise`.

```ts
import { Effect } from "effect";

const program = Effect.succeed("Hello, World!").pipe(
  Effect.delay("1 second")
);

const promise = Effect.runPromise(program);

promise.then(console.log);
```

## Execute Synchronous Effects with Effect.runSync

**Rule:** Execute synchronous effects with `Effect.runSync`.

```ts
import { Effect } from "effect";

const program1 = Effect.sync(() => {
  const n = 10;
  const result = n * 2;
  console.log(`Simple program result: ${result}`);
  return result;
});

Effect.runSync(program1);

const program2 = Effect.gen(function* () {
  yield* Effect.logInfo("Starting calculation...");
  const n = yield* Effect.sync(() => 10);
  yield* Effect.logInfo(`Got number: ${n}`);
  const result = yield* Effect.sync(() => n * 2);
  yield* Effect.logInfo(`Result: ${result}`);
  return result;
});

Effect.runSync(program2);

const program3 = Effect.gen(function* () {
  yield* Effect.logInfo("Starting division...");
  const n = yield* Effect.sync(() => 10);
  const divisor = yield* Effect.sync(() => 0);

  yield* Effect.logInfo(
    `Attempting to divide ${n} by ${divisor}...`
  );
  return yield* Effect.try({
    try: () => {
      if (divisor === 0) throw new Error("Cannot divide by zero");
      return n / divisor;
    },
    catch: (error) => {
      if (error instanceof Error) {
        return error;
      }
      return new Error("Unknown error occurred");
    },
  });
}).pipe(
  Effect.catchAll((error) =>
    Effect.logInfo(`Error occurred: ${error.message}`)
  )
);

Effect.runSync(program3);
```

## Extract Path Parameters

**Rule:** Extract pieces of a path (for example `/users/:id`) into typed
values inside your `Effect` program.

```ts
import { Data, Effect } from "effect";

interface InvalidPathErrorSchema {
  readonly _tag: "InvalidPathError";
  readonly path: string;
}

const makeInvalidPathError = (path: string): InvalidPathErrorSchema => ({
  _tag: "InvalidPathError",
  path,
});

interface PathOps {
  readonly extractUserId: (
    path: string
  ) => Effect.Effect<string, InvalidPathErrorSchema>;
  readonly greetUser: (
    userId: string
  ) => Effect.Effect<string>;
}

class PathService extends Effect.Service<PathService>()(
  "PathService",
  {
    sync: () => ({
      extractUserId: (path: string) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `Attempting to extract user ID from path: ${path}`
          );

          const match = path.match(/\/users\/([^/]+)/);
          if (!match) {
            yield* Effect.logInfo(`No user ID found in path: ${path}`);
            return yield* Effect.fail(makeInvalidPathError(path));
          }

          const userId = match[1];
          yield* Effect.logInfo(
            `Successfully extracted user ID: ${userId}`
          );
          return userId;
        }),

      greetUser: (userId: string) =>
        Effect.gen(function* () {
          const greeting = `Hello, user ${userId}!`;
          yield* Effect.logInfo(greeting);
          return greeting;
        }),
    }),
  }
) {}

const processPath = (
  path: string
): Effect.Effect<string, InvalidPathErrorSchema, PathService> =>
  Effect.gen(function* () {
    const pathService = yield* PathService;
    yield* Effect.logInfo(`Processing path: ${path}`);
    const userId = yield* pathService.extractUserId(path);
    return yield* pathService.greetUser(userId);
  });

const program = Effect.gen(function* () {
  yield* Effect.logInfo("=== Testing valid paths ===");
  const result1 = yield* processPath("/users/123");
  yield* Effect.logInfo(`Result 1: ${result1}`);

  const result2 = yield* processPath("/users/abc");
  yield* Effect.logInfo(`Result 2: ${result2}`);

  yield* Effect.logInfo("\n=== Testing invalid path ===");
  const result3 = yield* processPath("/invalid/path").pipe(
    Effect.catchTag("InvalidPathError", (error) =>
      Effect.succeed(`Error: Invalid path ${error.path}`)
    )
  );
  yield* Effect.logInfo(result3);
});

Effect.runPromise(Effect.provide(program, PathService.Default));
```

## Handle a GET-like Request

**Rule:** Route a path to a handler that returns a response `Effect` and
handle not-found and error cases in the error channel.

```ts
import { Data, Effect } from "effect";

interface RouteResponse {
  readonly status: number;
  readonly body: string;
}

class RouteNotFoundError extends Data.TaggedError(
  "RouteNotFoundError"
)<{
  readonly path: string;
}> {}

class RouteHandlerError extends Data.TaggedError(
  "RouteHandlerError"
)<{
  readonly path: string;
  readonly error: string;
}> {}

class RouteService extends Effect.Service<RouteService>()(
  "RouteService",
  {
    sync: () => {
      const handleRoute = (
        path: string
      ): Effect.Effect<RouteResponse, RouteNotFoundError | RouteHandlerError> =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `Processing request for path: ${path}`
          );

          try {
            switch (path) {
              case "/": {
                const home = "Welcome to the home page!";
                yield* Effect.logInfo("Serving home page");
                return { status: 200, body: home };
              }
              case "/hello": {
                const hello = "Hello, Effect!";
                yield* Effect.logInfo("Serving hello page");
                return { status: 200, body: hello };
              }
              default: {
                yield* Effect.logWarning(`Route not found: ${path}`);
                return yield* Effect.fail(
                  new RouteNotFoundError({ path })
                );
              }
            }
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            yield* Effect.logError(
              `Error handling route ${path}: ${error}`
            );
            return yield* Effect.fail(
              new RouteHandlerError({ path, error })
            );
          }
        });

      return {
        handleRoute,
        simulateGet: (
          path: string
        ): Effect.Effect<
          RouteResponse,
          RouteNotFoundError | RouteHandlerError
        > =>
          Effect.gen(function* () {
            yield* Effect.logInfo(`GET ${path}`);
            const response = yield* handleRoute(path);
            yield* Effect.logInfo(
              `Response: ${JSON.stringify(response)}`
            );
            return response;
          }),
      };
    },
  }
) {}

const program = Effect.gen(function* () {
  const router = yield* RouteService;

  yield* Effect.logInfo("=== Starting Route Tests ===");

  for (const path of ["/", "/hello", "/other", "/error"]) {
    yield* Effect.logInfo(`\n--- Testing ${path} ---`);

    const result = yield* router.simulateGet(path).pipe(
      Effect.catchTags({
        RouteNotFoundError: (error) =>
          Effect.gen(function* () {
            const response = {
              status: 404,
              body: `Not Found: ${error.path}`,
            };
            yield* Effect.logWarning(
              `${response.status} ${response.body}`
            );
            return response;
          }),
        RouteHandlerError: (error) =>
          Effect.gen(function* () {
            const response = {
              status: 500,
              body: `Internal Error: ${error.error}`,
            };
            yield* Effect.logError(
              `${response.status} ${response.body}`
            );
            return response;
          }),
      })
    );

    yield* Effect.logInfo(
      `Final Response: ${JSON.stringify(result)}`
    );
  }

  yield* Effect.logInfo("\n=== Route Tests Complete ===");
});

Effect.runPromise(Effect.provide(program, RouteService.Default));
```

## Run a Pipeline for its Side Effects

**Rule:** Use `Stream.runDrain` to execute a stream for its side effects
when you do not need the final values.

```ts
import { Effect, Stream } from "effect";

const tasks = ["task 1", "task 2", "task 3"];

const completeTask = (task: string): Effect.Effect<void, never> =>
  Effect.log(`Completing ${task}`);

const program = Stream.fromIterable(tasks).pipe(
  Stream.mapEffect(completeTask, { concurrency: 1 }),
  Stream.runDrain
);

Effect.runPromise(program).then(() => {
  console.log("\nAll tasks have been processed.");
});
```

## Safely Bracket Resource Usage with acquireRelease

**Rule:** Bracket the use of a resource between an `acquire` and a
`release` effect.

```ts
import { Effect, Console } from "effect";

const getDbConnection = Effect.sync(() => ({ id: Math.random() })).pipe(
  Effect.tap(() => Console.log("Connection Acquired"))
);

const closeDbConnection = (
  conn: { id: number }
): Effect.Effect<void, never, never> =>
  Effect.sync(() => console.log(`Connection ${conn.id} Released`));

const program = Effect.acquireRelease(
  getDbConnection,
  (connection) => closeDbConnection(connection)
).pipe(
  Effect.tap((connection) =>
    Console.log(
      `Using connection ${connection.id} to run query...`
    )
  )
);

Effect.runPromise(Effect.scoped(program));
```

## Send a JSON Response

**Rule:** Use a small Effect-based handler that returns a value which can
be serialized to JSON.

```ts
import { Effect, Duration } from "effect";
import { createServer } from "node:http";

const PORT = 3459;

class JsonServer extends Effect.Service<JsonServer>()(
  "JsonServer",
  {
    sync: () => ({
      handleRequest: () =>
        Effect.succeed({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Hello, JSON!",
            timestamp: new Date().toISOString(),
          }),
        }),
    }),
  }
) {}

const program = Effect.gen(function* () {
  const jsonServer = yield* JsonServer;

  const server = createServer((req, res) => {
    Effect.runPromise(jsonServer.handleRequest()).then(
      (response) => {
        res.writeHead(response.status, response.headers);
        res.end(response.body);
      },
      (error) => {
        res.writeHead(500, {
          "Content-Type": "application/json",
        });
        res.end(
          JSON.stringify({ error: "Internal Server Error" })
        );
        Effect.runPromise(
          Effect.logError(`Request error: ${error.message}`)
        );
      }
    );
  });

  yield* Effect.async<void, Error>((resume) => {
    server.on("error", (error: NodeJS.ErrnoException) => {
      resume(Effect.fail(error));
    });

    server.listen(PORT, () => {
      resume(Effect.succeed(void 0));
    });
  });

  yield* Effect.logInfo(
    `Server running at http://localhost:${PORT}`
  );
  yield* Effect.sleep(Duration.seconds(3));

  yield* Effect.sync(() => server.close());
  yield* Effect.logInfo("Server shutdown complete");
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Effect.logError(`Server error: ${error.message}`);
      return error;
    })
  ),
  Effect.provide(JsonServer.Default)
);

Effect.runPromise(program);
```

## Set Up a New Effect Project

**Rule:** Set up a new Effect project with strict TypeScript settings.

```ts
// 1. Init project (for example, `npm init -y`).
// 2. Install deps (for example, `npm install effect`,
//    `npm install -D typescript tsx`).
// 3. Create tsconfig.json with "strict": true.
// 4. Create src/index.ts:
import { Effect } from "effect";

const program = Effect.log("Hello, World!");

Effect.runSync(program);

// 5. Run the program (for example, `npx tsx src/index.ts`).
```

## Solve Promise Problems with Effect

**Rule:** Recognize that Effect solves limitations of Promises: untyped
errors, no dependency injection, and no cancellation.

```ts
import { Effect, Data } from "effect";

interface DbErrorType {
  readonly _tag: "DbError";
  readonly message: string;
}

const DbError = Data.tagged<DbErrorType>("DbError");

interface User {
  name: string;
}

class HttpClient extends Effect.Service<HttpClient>()(
  "HttpClient",
  {
    sync: () => ({
      findById: (id: number): Effect.Effect<User, DbErrorType> =>
        Effect.try({
          try: () => ({ name: `User ${id}` }),
          catch: () => DbError({ message: "Failed to find user" }),
        }),
    }),
  }
) {}

const findUser = (id: number) =>
  Effect.gen(function* () {
    const client = yield* HttpClient;
    return yield* client.findById(id);
  });

const program = Effect.gen(function* () {
  yield* Effect.logInfo(
    "=== Solving Promise Problems with Effect ==="
  );

  yield* Effect.logInfo(
    "1. Demonstrating type-safe error handling:"
  );

  const result1 = yield* findUser(123).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logInfo(
          `Handled error: ${error.message}`
        );
        return { name: "Default User" };
      })
    )
  );
  yield* Effect.logInfo(`Found user: ${result1.name}`);

  yield* Effect.logInfo("\n2. Demonstrating easy composition:");

  const composedOperation = Effect.gen(function* () {
    const user1 = yield* findUser(1);
    const user2 = yield* findUser(2);
    yield* Effect.logInfo(
      `Composed result: ${user1.name} and ${user2.name}`
    );
    return [user1, user2];
  });

  yield* composedOperation;

  yield* Effect.logInfo(
    "\n3. Demonstrating resource management:"
  );

  const resourceOperation = Effect.gen(function* () {
    yield* Effect.logInfo("Acquiring resource...");
    const resource = "database-connection";

    yield* Effect.addFinalizer(() =>
      Effect.logInfo("Cleaning up resource...")
    );

    const user = yield* findUser(456);
    yield* Effect.logInfo(`Used resource to get: ${user.name}`);

    return user;
  }).pipe(Effect.scoped);

  yield* resourceOperation;

  yield* Effect.logInfo(
    "\n✅ All operations completed successfully!"
  );
});

Effect.runPromise(Effect.provide(program, HttpClient.Default));
```

## Transform Effect Values with map and flatMap

**Rule:** Transform `Effect` values with `map` and `flatMap`.

```ts
import { Effect } from "effect";

const getUser = (
  id: number
): Effect.Effect<{ id: number; name: string }> =>
  Effect.succeed({ id, name: "Paul" });

const getPosts = (
  userId: number
): Effect.Effect<{ title: string }[]> =>
  Effect.succeed([
    { title: "My First Post" },
    { title: "Second Post" },
  ]);

const userPosts = getUser(123).pipe(
  Effect.flatMap((user) => getPosts(user.id))
);

const program = Effect.gen(function* () {
  console.log("=== Transform Effect Values Demo ===");

  console.log("\n1. Transform with map:");
  const userWithUpperName = yield* getUser(123).pipe(
    Effect.map((user) => ({
      ...user,
      name: user.name.toUpperCase(),
    }))
  );
  console.log("Transformed user:", userWithUpperName);

  console.log("\n2. Chain effects with flatMap:");
  const posts = yield* userPosts;
  console.log("User posts:", posts);

  console.log("\n3. Transform and combine multiple effects:");
  const userWithPosts = yield* getUser(456).pipe(
    Effect.flatMap((user) =>
      getPosts(user.id).pipe(
        Effect.map((posts) => ({
          user: user.name,
          postCount: posts.length,
          titles: posts.map((p) => p.title),
        }))
      )
    )
  );
  console.log("User with posts:", userWithPosts);

  console.log("\n4. Transform with tap for side effects:");
  const result = yield* getUser(789).pipe(
    Effect.tap((user) =>
      Effect.sync(() =>
        console.log(`Processing user: ${user.name}`)
      )
    ),
    Effect.map((user) => `Hello, ${user.name}!`)
  );
  console.log("Final result:", result);

  console.log("\n✅ All transformations completed successfully!");
});

Effect.runPromise(program);
```

## Understand that Effects are Lazy Blueprints

**Rule:** Understand that effects are lazy blueprints.

```ts
import { Effect } from "effect";

console.log("1. Defining the Effect blueprint...");

const program = Effect.sync(() => {
  console.log("3. The blueprint is now being executed!");
  return 42;
});

console.log(
  "2. The blueprint has been defined. No work has been done yet."
);

Effect.runSync(program);
```

## Understand the Three Effect Channels (A, E, R)

**Rule:** Understand that `Effect<A, E, R>` describes a computation with a
success type (`A`), an error type (`E`), and a requirements type (`R`).

```ts
import { Effect, Data } from "effect";

interface User {
  readonly name: string;
}

class UserNotFoundError extends Data.TaggedError(
  "UserNotFoundError"
) {}

export class Database extends Effect.Service<Database>()(
  "Database",
  {
    sync: () => ({
      findUser: (id: number) =>
        id === 1
          ? Effect.succeed({ name: "Paul" })
          : Effect.fail(new UserNotFoundError()),
    }),
  }
) {}

const getUser = (
  id: number
): Effect.Effect<User, UserNotFoundError, Database> =>
  Effect.gen(function* () {
    const db = yield* Database;
    return yield* db.findUser(id);
  });

const program = getUser(1);

Effect.runPromise(Effect.provide(program, Database.Default)).then(
  console.log
);
```

## Use .pipe for Composition

**Rule:** Use `.pipe` for composition.

```ts
import { Effect } from "effect";

const program = Effect.succeed(5).pipe(
  Effect.map((n) => n * 2),
  Effect.map((n) => `The result is ${n}`),
  Effect.tap(Effect.log)
);

const demo = Effect.gen(function* () {
  console.log("=== Using Pipe for Composition Demo ===");

  console.log("\n1. Basic pipe composition:");
  yield* program;

  console.log("\n2. Complex pipe composition:");
  const complexResult = yield* Effect.succeed(10).pipe(
    Effect.map((n) => n + 5),
    Effect.map((n) => n * 2),
    Effect.tap((n) =>
      Effect.sync(() =>
        console.log(`Intermediate result: ${n}`)
      )
    ),
    Effect.map((n) => n.toString()),
    Effect.map((s) => `Final: ${s}`)
  );
  console.log("Complex result:", complexResult);

  console.log("\n3. Pipe with flatMap for chaining effects:");
  const chainedResult = yield* Effect.succeed("hello").pipe(
    Effect.map((s) => s.toUpperCase()),
    Effect.flatMap((s) => Effect.succeed(`${s} WORLD`)),
    Effect.flatMap((s) => Effect.succeed(`${s}!`)),
    Effect.tap((s) =>
      Effect.sync(() => console.log(`Chained: ${s}`))
    )
  );
  console.log("Chained result:", chainedResult);

  console.log("\n4. Pipe with error handling:");
  const errorHandledResult = yield* Effect.succeed(-1).pipe(
    Effect.flatMap((n) =>
      n > 0
        ? Effect.succeed(n)
        : Effect.fail(new Error("Negative number"))
    ),
    Effect.catchAll((error) =>
      Effect.succeed("Handled error: " + error.message)
    ),
    Effect.tap((result) =>
      Effect.sync(() =>
        console.log(`Error handled: ${result}`)
      )
    )
  );
  console.log("Error handled result:", errorHandledResult);

  console.log("\n5. Pipe with multiple operations:");
  const multiOpResult = yield* Effect.succeed([
    1,
    2,
    3,
    4,
    5,
  ]).pipe(
    Effect.map((arr) => arr.filter((n) => n % 2 === 0)),
    Effect.map((arr) => arr.map((n) => n * 2)),
    Effect.map((arr) => arr.reduce((sum, n) => sum + n, 0)),
    Effect.tap((sum) =>
      Effect.sync(() =>
        console.log(`Sum of even numbers doubled: ${sum}`)
      )
    )
  );
  console.log("Multi-operation result:", multiOpResult);

  console.log(
    "\n✅ Pipe composition demonstration completed!"
  );
});

Effect.runPromise(demo);
```

## Wrap Asynchronous Computations with tryPromise

**Rule:** Wrap asynchronous computations with `Effect.tryPromise`.

```ts
import { Effect, Data } from "effect";

class HttpError extends Data.TaggedError("HttpError")<{
  readonly message: string;
}> {}

export class HttpClient extends Effect.Service<HttpClient>()(
  "HttpClient",
  {
    sync: () => ({
      getUrl: (url: string) =>
        Effect.tryPromise({
          try: () => fetch(url),
          catch: (error) =>
            new HttpError({
              message: `Failed to fetch ${url}: ${error}`,
            }),
        }),
    }),
  }
) {}

export class MockHttpClient extends Effect.Service<MockHttpClient>()(
  "MockHttpClient",
  {
    sync: () => ({
      getUrl: (url: string) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`Fetching URL: ${url}`);

          if (url.includes("success")) {
            yield* Effect.logInfo("✅ Request successful");
            return new Response(
              JSON.stringify({ data: "success" }),
              { status: 200 }
            );
          } else if (url.includes("error")) {
            yield* Effect.logInfo("❌ Request failed");
            return yield* Effect.fail(
              new HttpError({ message: "Server returned 500" })
            );
          } else {
            yield* Effect.logInfo("✅ Request completed");
            return new Response(
              JSON.stringify({ data: "mock response" }),
              { status: 200 }
            );
          }
        }),
    }),
  }
) {}

const program = Effect.gen(function* () {
  yield* Effect.logInfo(
    "=== Wrapping Asynchronous Computations Demo ==="
  );

  const client = yield* MockHttpClient;

  yield* Effect.logInfo("\n1. Successful request:");
  const response1 = yield* client
    .getUrl("https://api.example.com/success")
    .pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError(
            `Request failed: ${error.message}`
          );
          return new Response("Error response", {
            status: 500,
          });
        })
      )
    );
  yield* Effect.logInfo(`Response status: ${response1.status}`);

  yield* Effect.logInfo(
    "\n2. Failed request with error handling:"
  );
  const response2 = yield* client
    .getUrl("https://api.example.com/error")
    .pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError(
            `Request failed: ${error.message}`
          );
          return new Response("Fallback response", {
            status: 200,
          });
        })
      )
    );
  yield* Effect.logInfo(
    `Fallback response status: ${response2.status}`
  );

  yield* Effect.logInfo("\n3. Multiple async operations:");
  const results = yield* Effect.all(
    [
      client.getUrl("https://api.example.com/endpoint1"),
      client.getUrl("https://api.example.com/endpoint2"),
      client.getUrl("https://api.example.com/endpoint3"),
    ],
    { concurrency: 2 }
  ).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(
          `One or more requests failed: ${error.message}`
        );
        return [];
      })
    )
  );
  yield* Effect.logInfo(
    `Completed ${results.length} requests`
  );

  yield* Effect.logInfo(
    "\n✅ Asynchronous computations demonstration completed!"
  );
});

Effect.runPromise(
  Effect.provide(program, MockHttpClient.Default)
);
```

## Wrap Synchronous Computations with sync and try

**Rule:** Wrap synchronous computations with `Effect.sync` and
`Effect.try`.

```ts
import { Effect } from "effect";

const randomNumber = Effect.sync(() => Math.random());

const parseJson = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input),
    catch: (error) =>
      new Error(`JSON parsing failed: ${error}`),
  });

const divide = (a: number, b: number) =>
  Effect.try({
    try: () => {
      if (b === 0) throw new Error("Division by zero");
      return a / b;
    },
    catch: (error) =>
      new Error(`Division failed: ${error}`),
  });

const processString = (str: string) =>
  Effect.sync(() => {
    console.log(`Processing string: "${str}"`);
    return str.toUpperCase().split("").reverse().join("");
  });

const program = Effect.gen(function* () {
  console.log("=== Wrapping Synchronous Computations Demo ===");

  console.log("\n1. Basic sync computation (random number):");
  const random1 = yield* randomNumber;
  const random2 = yield* randomNumber;
  console.log(
    `Random numbers: ${random1.toFixed(4)}, ${random2.toFixed(4)}`
  );

  console.log("\n2. Successful JSON parsing:");
  const validJson = '{"name": "Paul", "age": 30}';
  const parsed = yield* parseJson(validJson).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        console.log(`Parsing failed: ${error.message}`);
        return { error: "Failed to parse" };
      })
    )
  );
  console.log("Parsed JSON:", parsed);

  console.log("\n3. Failed JSON parsing with error handling:");
  const invalidJson = '{"name": "Paul", "age":}';
  const parsedWithError = yield* parseJson(invalidJson).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        console.log(`Parsing failed: ${error.message}`);
        return { error: "Invalid JSON", input: invalidJson };
      })
    )
  );
  console.log("Error result:", parsedWithError);

  console.log("\n4. Division with error handling:");
  const division1 = yield* divide(10, 2).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        console.log(`Division error: ${error.message}`);
        return -1;
      })
    )
  );
  console.log(`10 / 2 = ${division1}`);

  const division2 = yield* divide(10, 0).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        console.log(`Division error: ${error.message}`);
        return -1;
      })
    )
  );
  console.log(`10 / 0 = ${division2} (error handled)`);

  console.log("\n5. String processing:");
  const processed = yield* processString("Hello Effect");
  console.log(`Processed result: "${processed}"`);

  console.log("\n6. Combining multiple sync operations:");
  const combined = yield* Effect.gen(function* () {
    const num = yield* randomNumber;
    const multiplied = yield* Effect.sync(() => num * 100);
    const rounded = yield* Effect.sync(() => Math.round(multiplied));
    return rounded;
  });
  console.log(`Combined operations result: ${combined}`);

  console.log(
    "\n✅ Synchronous computations demonstration completed!"
  );
});

Effect.runPromise(program);
```

## Write Sequential Code with Effect.gen

**Rule:** Write sequential code with `Effect.gen`.

```ts
import { Effect } from "effect";

const fetchUser = (id: number) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Fetching user ${id}...`);
    yield* Effect.sleep("100 millis");
    return {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
    };
  });

const fetchUserPosts = (userId: number) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(
      `Fetching posts for user ${userId}...`
    );
    yield* Effect.sleep("150 millis");
    return [
      { id: 1, title: "First Post", userId },
      { id: 2, title: "Second Post", userId },
    ];
  });

const fetchPostComments = (postId: number) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(
      `Fetching comments for post ${postId}...`
    );
    yield* Effect.sleep("75 millis");
    return [
      { id: 1, text: "Great post!", postId },
      { id: 2, text: "Thanks for sharing", postId },
    ];
  });

const getUserDataWithGen = (userId: number) =>
  Effect.gen(function* () {
    const user = yield* fetchUser(userId);
    yield* Effect.logInfo(`✅ Got user: ${user.name}`);

    const posts = yield* fetchUserPosts(user.id);
    yield* Effect.logInfo(`✅ Got ${posts.length} posts`);

    const firstPost = posts[0];
    const comments = yield* fetchPostComments(firstPost.id);
    yield* Effect.logInfo(
      `✅ Got ${comments.length} comments for "${firstPost.title}"`
    );

    const result = {
      user,
      posts,
      featuredPost: {
        ...firstPost,
        comments,
      },
    };

    yield* Effect.logInfo(
      "✅ Successfully combined all user data"
    );
    return result;
  });

const getUserDataWithoutGen = (userId: number) =>
  fetchUser(userId).pipe(
    Effect.flatMap((user) =>
      fetchUserPosts(user.id).pipe(
        Effect.flatMap((posts) =>
          fetchPostComments(posts[0].id).pipe(
            Effect.map((comments) => ({
              user,
              posts,
              featuredPost: {
                ...posts[0],
                comments,
              },
            }))
          )
        )
      )
    )
  );

const program = Effect.gen(function* () {
  yield* Effect.logInfo(
    "=== Writing Sequential Code with Effect.gen Demo ==="
  );

  yield* Effect.logInfo(
    "\n1. Sequential operations with Effect.gen:"
  );
  const userData = yield* getUserDataWithGen(123).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(
          `Failed to get user data: ${error}`
        );
        return null;
      })
    )
  );

  if (userData) {
    yield* Effect.logInfo(
      `Final result: User "${userData.user.name}" has ${userData.posts.length} posts`
    );
    yield* Effect.logInfo(
      `Featured post: "${userData.featuredPost.title}" with ${userData.featuredPost.comments.length} comments`
    );
  }

  yield* Effect.logInfo(
    "\n2. Same logic without Effect.gen (for comparison):"
  );
  const userData2 = yield* getUserDataWithoutGen(456).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(
          `Failed to get user data: ${error}`
        );
        return null;
      })
    )
  );

  if (userData2) {
    yield* Effect.logInfo(
      `Result from traditional approach: User "${userData2.user.name}"`
    );
  }

  yield* Effect.logInfo(
    "\n3. Error handling in sequential operations:"
  );
  const errorHandling = yield* Effect.gen(function* () {
    try {
      const user = yield* fetchUser(999);
      const posts = yield* fetchUserPosts(user.id);
      return { user, posts };
    } catch (error) {
      yield* Effect.logError(
        `Error in sequential operations: ${error}`
      );
      return null;
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Caught error: ${error}`);
        return { user: null, posts: [] };
      })
    )
  );

  yield* Effect.logInfo(
    `Error handling result: ${
      errorHandling ? "Success" : "Handled error"
    }`
  );

  yield* Effect.logInfo(
    "\n✅ Sequential code demonstration completed!"
  );
  yield* Effect.logInfo(
    "Effect.gen makes sequential async code look like synchronous code!"
  );
});

Effect.runPromise(program);
```
