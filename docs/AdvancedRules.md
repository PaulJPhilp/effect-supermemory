# Advanced Level Effect Rules

> These rules cover advanced Effect patterns: runtime / layer
> composition, fibers, queues / pubsub, graceful shutdown,
> error-cause inspection, and MCP for AI agents.

## Add Caching by Wrapping a Layer

**Rule:** Use a wrapping `Layer` to add cross-cutting concerns like
caching to a service without modifying its original implementation.

```ts
import { Effect, Layer, Ref } from "effect";

class WeatherService extends Effect.Service<WeatherService>()(
  "WeatherService",
  {
    sync: () => ({
      getForecast: (city: string) =>
        Effect.succeed(`Sunny in ${city}`),
    }),
  }
) {}

const WeatherServiceLive = Layer.succeed(
  WeatherService,
  WeatherService.of({
    _tag: "WeatherService",
    getForecast: (city) =>
      Effect.succeed(`Sunny in ${city}`).pipe(
        Effect.delay("2 seconds"),
        Effect.tap(() =>
          Effect.log(`Fetched live forecast for ${city}`)
        )
      ),
  })
);

const WeatherServiceCached = Layer.effect(
  WeatherService,
  Effect.gen(function* () {
    const underlyingService = yield* WeatherService;
    const cache = yield* Ref.make(new Map<string, string>());

    return WeatherService.of({
      _tag: "WeatherService",
      getForecast: (city) =>
        Ref.get(cache).pipe(
          Effect.flatMap((map) =>
            map.has(city)
              ? Effect.log(`Cache HIT for ${city}`).pipe(
                  Effect.as(map.get(city)!)
                )
              : Effect.log(`Cache MISS for ${city}`).pipe(
                  Effect.flatMap(() =>
                    underlyingService.getForecast(city)
                  ),
                  Effect.tap((forecast) =>
                    Ref.update(cache, (map) =>
                      map.set(city, forecast)
                    )
                  )
                )
          )
        ),
    });
  })
);

const AppLayer = Layer.provide(
  WeatherServiceCached,
  WeatherServiceLive
);

const program = Effect.gen(function* () {
  const weather = yield* WeatherService;
  yield* weather.getForecast("London");
  yield* weather.getForecast("London");
});

Effect.runPromise(Effect.provide(program, AppLayer));
```

## Build a Basic HTTP Server

**Rule:** Use a managed server `Layer` and `Layer.launch` to run HTTP
apps.

```ts
import { HttpServer, HttpServerResponse } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { Duration, Effect, Fiber, Layer } from "effect";
import { createServer } from "node:http";

const ServerLive = NodeHttpServer.layer(() => createServer(), {
  port: 3_001,
});

const app = Effect.gen(function* () {
  yield* Effect.logInfo("Received HTTP request");
  return yield* HttpServerResponse.text("Hello World");
});

const serverLayer = HttpServer.serve(app).pipe(
  Layer.provide(ServerLive)
);

const program = Effect.gen(function* () {
  yield* Effect.logInfo(
    "Server starting on http://localhost:3001"
  );
  const fiber = yield* Layer.launch(serverLayer).pipe(
    Effect.fork
  );
  yield* Effect.sleep(Duration.seconds(2));
  yield* Fiber.interrupt(fiber);
  yield* Effect.logInfo("Server shutdown complete");
});

Effect.runPromise(
  program as unknown as Effect.Effect<void, unknown, never>
);
```

## Create a Managed Runtime for Scoped Resources

**Rule:** Use `Effect.scoped` with service `Default` layers to manage
resource lifecycles.

```ts
import { Effect } from "effect";

class DatabasePool extends Effect.Service<DatabasePool>()(
  "DbPool",
  {
    effect: Effect.gen(function* () {
      yield* Effect.log("Acquiring pool");
      return {
        query: () => Effect.succeed("result"),
      };
    }),
  }
) {}

const program = Effect.gen(function* () {
  const db = yield* DatabasePool;
  yield* Effect.log("Using DB");
  yield* db.query();
});

Effect.runPromise(
  program.pipe(
    Effect.provide(DatabasePool.Default),
    Effect.scoped
  )
);
```

## Create a Reusable Runtime from Layers

**Rule:** Compile layers into a reusable `Runtime` once instead of
rebuilding dependencies per call.

```ts
import { Effect, Layer, Runtime } from "effect";

class GreeterService extends Effect.Service<GreeterService>()(
  "Greeter",
  {
    sync: () => ({
      greet: (name: string) =>
        Effect.sync(() => `Hello ${name}`),
    }),
  }
) {}

const runtime = Effect.runSync(
  Layer.toRuntime(GreeterService.Default).pipe(
    Effect.scoped
  )
);

Runtime.runPromise(runtime)(Effect.log("Hello"));
```

## Decouple Fibers with Queues and PubSub

**Rule:** Use `Queue` for point-to-point work and `PubSub` for
broadcasting across fibers.

### Producer / Consumer with Queue

```ts
import { Effect, Queue, Fiber } from "effect";

const program = Effect.gen(function* () {
  yield* Effect.logInfo("Starting queue demo...");

  const queue = yield* Queue.bounded<string>(10);
  yield* Effect.logInfo("Created bounded queue");

  const producer = yield* Effect.gen(function* () {
    let i = 0;
    while (true) {
      const job = `job-${i++}`;
      yield* Effect.logInfo(`Producing ${job}...`);
      yield* Queue.offer(queue, job);
      yield* Effect.sleep("500 millis");
    }
  }).pipe(Effect.fork);

  yield* Effect.logInfo("Started producer fiber");

  const worker = yield* Effect.gen(function* () {
    while (true) {
      const job = yield* Queue.take(queue);
      yield* Effect.logInfo(`Processing ${job}...`);
      yield* Effect.sleep("1 second");
      yield* Effect.logInfo(`Completed ${job}`);
    }
  }).pipe(Effect.fork);

  yield* Effect.logInfo("Started worker fiber");

  yield* Effect.logInfo("Running for 10 seconds...");
  yield* Effect.sleep("10 seconds");
  yield* Effect.logInfo("Done!");

  yield* Fiber.interrupt(producer);
  yield* Fiber.interrupt(worker);
});

Effect.runPromise(program);
```

### Broadcast with PubSub

```ts
import { Effect, PubSub, Queue } from "effect";

const program = Effect.gen(function* () {
  const pubsub = yield* PubSub.bounded<string>(10);

  const auditSub = PubSub.subscribe(pubsub).pipe(
    Effect.flatMap((subscription) =>
      Effect.gen(function* () {
        while (true) {
          const event = yield* Queue.take(subscription);
          yield* Effect.log(
            `AUDIT: Received event: ${event}`
          );
        }
      })
    ),
    Effect.fork
  );

  const notifierSub = PubSub.subscribe(pubsub).pipe(
    Effect.flatMap((subscription) =>
      Effect.gen(function* () {
        while (true) {
          const event = yield* Queue.take(subscription);
          yield* Effect.log(
            `NOTIFIER: Sending notification for: ${event}`
          );
        }
      })
    ),
    Effect.fork
  );

  yield* Effect.sleep("1 second");
  yield* PubSub.publish(pubsub, "user_logged_in");

  yield* Effect.sleep("1 second");
});

Effect.runPromise(program);
```

## Execute Long-Running Apps with Effect.runFork

**Rule:** Use `Effect.runFork` to launch long-running top-level effects
and manage them via the returned `Fiber`.

```ts
import { Effect, Fiber } from "effect";

const server = Effect.log(
  "Server received a request."
).pipe(Effect.delay("1 second"), Effect.forever);

console.log("Starting server...");

const appFiber = Effect.runFork(server);

setTimeout(() => {
  console.log(
    "Shutdown signal received. Interrupting server fiber..."
  );
  Effect.runPromise(Fiber.interrupt(appFiber));
}, 5_000);
```

## Handle Unexpected Errors by Inspecting the Cause

**Rule:** Use `Cause`-based handlers (`catchAllCause`, `Cause.pretty`,
`Cause.isDie`) to distinguish expected failures from defects.

```ts
import { Cause, Effect, Data, Schedule, Duration } from "effect";

interface DatabaseConfig {
  readonly url: string;
}

interface DatabaseConnection {
  readonly success: true;
}

interface UserData {
  readonly id: string;
  readonly name: string;
}

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: string;
  readonly details: string;
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly message: string;
}> {}

class DatabaseService extends Effect.Service<DatabaseService>()(
  "DatabaseService",
  {
    sync: () => ({
      connect: (
        config: DatabaseConfig
      ): Effect.Effect<DatabaseConnection, DatabaseError> =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `Connecting to database: ${config.url}`
          );

          if (!config.url) {
            const error = new DatabaseError({
              operation: "connect",
              details: "Missing URL",
            });
            yield* Effect.logError(
              `Database error: ${JSON.stringify(error)}`
            );
            return yield* Effect.fail(error);
          }

          if (config.url === "invalid") {
            yield* Effect.logError(
              "Invalid connection string"
            );
            return yield* Effect.sync(() => {
              throw new Error(
                "Failed to parse connection string"
              );
            });
          }

          if (config.url === "timeout") {
            yield* Effect.logError("Connection timeout");
            return yield* Effect.sync(() => {
              throw new Error("Connection timed out");
            });
          }

          yield* Effect.logInfo("Database connection successful");
          return { success: true };
        }),
    }),
  }
) {}

class UserService extends Effect.Service<UserService>()(
  "UserService",
  {
    sync: () => ({
      parseUser: (
        input: unknown
      ): Effect.Effect<UserData, ValidationError> =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `Parsing user data: ${JSON.stringify(input)}`
          );

          try {
            if (typeof input !== "object" || !input) {
              const error = new ValidationError({
                field: "input",
                message: "Invalid input type",
              });
              yield* Effect.logWarning(
                `Validation error: ${JSON.stringify(error)}`
              );
              throw error;
            }

            const data = input as Record<string, unknown>;

            if (
              typeof data.id !== "string" ||
              typeof data.name !== "string"
            ) {
              const error = new ValidationError({
                field: "input",
                message: "Missing required fields",
              });
              yield* Effect.logWarning(
                `Validation error: ${JSON.stringify(error)}`
              );
              throw error;
            }

            const user = {
              id: data.id,
              name: data.name,
            };
            yield* Effect.logInfo(
              `Successfully parsed user: ${JSON.stringify(
                user
              )}`
            );
            return user;
          } catch (e) {
            if (e instanceof ValidationError) {
              return yield* Effect.fail(e);
            }
            yield* Effect.logError(
              `Unexpected error: ${
                e instanceof Error ? e.message : String(e)
              }`
            );
            throw e;
          }
        }),
    }),
  }
) {}

class TestService extends Effect.Service<TestService>()(
  "TestService",
  {
    sync: () => {
      const printCause = (
        prefix: string,
        cause: Cause.Cause<unknown>
      ): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`\n=== ${prefix} ===`);

          if (Cause.isDie(cause)) {
            const defect = Cause.failureOption(cause);
            if (defect._tag === "Some") {
              const error = defect.value as Error;
              yield* Effect.logError(
                "Defect (unexpected error)"
              );
              yield* Effect.logError(
                `Message: ${error.message}`
              );
              yield* Effect.logError(
                `Stack: ${
                  error.stack?.split("\n")[1]?.trim() ??
                  "N/A"
                }`
              );
            }
          } else if (Cause.isFailure(cause)) {
            const error = Cause.failureOption(cause);
            yield* Effect.logWarning("Expected failure");
            yield* Effect.logWarning(
              `Error: ${JSON.stringify(error)}`
            );
          }
        });

      const runScenario = <E, A extends Record<string, unknown>>(
        name: string,
        program: Effect.Effect<A, E>
      ): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`\n=== Testing: ${name} ===`);

          type TestError = {
            readonly _tag: "error";
            readonly cause: Cause.Cause<E>;
          };

          const result = yield* Effect.catchAllCause(
            program,
            (cause) =>
              Effect.succeed({
                _tag: "error" as const,
                cause,
              } as TestError)
          );

          if ("cause" in result) {
            yield* printCause("Error details", result.cause);
          } else {
            yield* Effect.logInfo(
              `Success: ${JSON.stringify(result)}`
            );
          }
        });

      return { printCause, runScenario };
    },
  }
) {}

const program = Effect.gen(function* () {
  const db = yield* DatabaseService;
  const users = yield* UserService;
  const test = yield* TestService;

  yield* Effect.logInfo(
    "=== Starting Error Handling Tests ==="
  );

  yield* test.runScenario(
    "Expected database error",
    Effect.gen(function* () {
      const result = yield* Effect.retry(
        db.connect({ url: "" }),
        Schedule.exponential(100)
      ).pipe(
        Effect.timeout(Duration.seconds(5)),
        Effect.catchAll(() =>
          Effect.fail("Connection timeout")
        )
      );
      return result;
    })
  );

  yield* test.runScenario(
    "Unexpected connection error",
    Effect.gen(function* () {
      const result = yield* Effect.retry(
        db.connect({ url: "invalid" }),
        Schedule.recurs(3)
      ).pipe(
        Effect.catchAllCause((cause) =>
          Effect.gen(function* () {
            yield* Effect.logError(
              "Failed after 3 retries"
            );
            yield* Effect.logError(Cause.pretty(cause));
            return yield* Effect.fail("Max retries exceeded");
          })
        )
      );
      return result as never;
    })
  );

  yield* test.runScenario(
    "Valid user data",
    Effect.gen(function* () {
      const result = yield* users
        .parseUser({ id: "1", name: "John" })
        .pipe(
          Effect.orElse(() =>
            Effect.succeed({
              id: "default",
              name: "Default User",
            })
          )
        );
      return result;
    })
  );

  yield* test.runScenario(
    "Concurrent operations",
    Effect.gen(function* () {
      const results = yield* Effect.all(
        [
          db.connect({ url: "" }).pipe(
            Effect.timeout(Duration.seconds(1)),
            Effect.catchAll(() =>
              Effect.succeed({ success: true })
            )
          ),
          users
            .parseUser({ id: "invalid" })
            .pipe(
              Effect.timeout(Duration.seconds(1)),
              Effect.catchAll(() =>
                Effect.succeed({
                  id: "timeout",
                  name: "Timeout",
                })
              )
            ),
        ],
        { concurrency: 2 }
      );
      return results as never;
    })
  );

  yield* Effect.logInfo(
    "\n=== Error Handling Tests Complete ==="
  );

  return Effect.succeed(void 0);
});

Effect.runPromise(
  Effect.provide(
    Effect.provide(
      Effect.provide(
        program,
        TestService.Default
      ),
      DatabaseService.Default
    ),
    UserService.Default
  )
);
```

## Implement Graceful Shutdown for Your Application

**Rule:** Combine `Effect.scoped`, finalizers, and `runFork`/fibers with
OS signals to implement graceful shutdown.

```ts
import { Effect } from "effect";
import * as http from "http";

class Database extends Effect.Service<Database>()(
  "Database",
  {
    effect: Effect.gen(function* () {
      yield* Effect.log("Acquiring DB connection");
      return {
        query: () => Effect.succeed("data"),
      };
    }),
  }
) {}

const server = Effect.gen(function* () {
  const db = yield* Database;

  const httpServer = yield* Effect.sync(() => {
    const server = http.createServer((_req, res) => {
      Effect.runFork(
        Effect.provide(
          db.query().pipe(
            Effect.map((data) => res.end(data))
          ),
          Database.Default
        )
      );
    });
    return server;
  });

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      httpServer.close();
      console.log("Server closed");
    })
  );

  yield* Effect.async<void, Error>((resume) => {
    httpServer.once("error", (err: Error) => {
      resume(
        Effect.fail(
          new Error(
            `Failed to start server: ${err.message}`
          )
        )
      );
    });

    httpServer.listen(3_456, () => {
      resume(Effect.succeed(void 0));
    });
  });

  yield* Effect.log(
    "Server started on port 3456. Press Ctrl+C to exit."
  );

  yield* Effect.sleep("2 seconds");
  yield* Effect.log("Shutting down gracefully...");
});

const app = Effect.provide(
  server.pipe(Effect.scoped),
  Database.Default
);

Effect.runPromise(app).catch((error) => {
  console.error("Application error:", error);
  process.exit(1);
});
```

## Manage Resource Lifecycles with Scope

**Rule:** Use `Effect.acquireRelease` and `Effect.scoped` (or
`Scope.addFinalizer`) to guarantee cleanup.

```ts
import { Effect } from "effect";

const acquireFile = Effect.log("File opened").pipe(
  Effect.as({
    write: (data: string) =>
      Effect.log(`Wrote: ${data}`),
  })
);
const releaseFile = Effect.log("File closed.");

const scopedFile = Effect.acquireRelease(
  acquireFile,
  () => releaseFile
);

const program = Effect.gen(function* () {
  const file = yield* Effect.scoped(scopedFile);

  yield* file.write("hello");
  yield* file.write("world");
});

Effect.runPromise(program);
```

## Manage Resources Safely in a Pipeline

**Rule:** Use scopes and finalizers (or `Stream.acquireRelease`) to
ensure streaming pipelines clean up resources even on failure.

```ts
import { Effect } from "effect";
import * as path from "node:path";

interface ProcessError {
  readonly _tag: "ProcessError";
  readonly message: string;
}

const ProcessError = (message: string): ProcessError => ({
  _tag: "ProcessError",
  message,
});

interface FileServiceType {
  readonly createTempFile: () => Effect.Effect<{
    filePath: string;
  }>;
  readonly cleanup: (
    filePath: string
  ) => Effect.Effect<void>;
  readonly readFile: (
    filePath: string
  ) => Effect.Effect<string>;
}

export class FileService extends Effect.Service<FileService>()(
  "FileService",
  {
    sync: () => {
      const filePath = path.join(
        __dirname,
        "temp-resource.txt"
      );
      return {
        createTempFile: () => Effect.succeed({ filePath }),
        cleanup: (filePath: string) =>
          Effect.sync(() =>
            console.log(
              "✅ Resource cleaned up successfully"
            )
          ),
        readFile: (_filePath: string) =>
          Effect.succeed("data 1\ndata 2\nFAIL\ndata 4"),
      };
    },
  }
) {}

const processLine = (
  line: string
): Effect.Effect<void, ProcessError> =>
  line === "FAIL"
    ? Effect.fail(ProcessError("Failed to process line"))
    : Effect.sync(() =>
        console.log(`Processed: ${line}`)
      );

const program = Effect.gen(function* () {
  console.log("=== Stream Resource Management Demo ===");
  console.log(
    "This demonstrates proper resource cleanup even when errors occur"
  );

  const fileService = yield* FileService;
  const { filePath } = yield* fileService.createTempFile();

  yield* Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.addFinalizer(() =>
        fileService.cleanup(filePath)
      );

      const content = yield* fileService.readFile(
        filePath
      );
      const lines = content.split("\n");

      for (const line of lines) {
        yield* processLine(line).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() =>
              console.log(
                `⚠️  Skipped line due to error: ${
                  error.message
                }`
              )
            )
          )
        );
      }

      console.log(
        "✅ Processing completed with proper resource management"
      );
    })
  );
});

Effect.runPromise(
  Effect.provide(program, FileService.Default)
).catch((error) => {
  console.error("Unexpected error:", error);
});
```

## Manually Manage Lifecycles with Scope

**Rule:** Use `Effect.scoped` + multiple `Effect.acquireRelease` calls
when you need explicit, ordered resource cleanup.

```ts
import { Effect, Console } from "effect";

const openFile = (path: string) =>
  Effect.succeed({ path, handle: Math.random() }).pipe(
    Effect.tap((f) =>
      Console.log(`Opened ${f.path}`)
    )
  );
const createTempFile = (path: string) =>
  Effect.succeed({ path: `${path}.tmp`, handle: Math.random() }).pipe(
    Effect.tap((f) =>
      Console.log(`Created temp file ${f.path}`)
    )
  );
const closeFile = (file: { path: string }) =>
  Effect.sync(() => Console.log(`Closed ${file.path}`));
const deleteFile = (file: { path: string }) =>
  Effect.sync(() => Console.log(`Deleted ${file.path}`));

const program = Effect.gen(function* () {
  const file = yield* Effect.acquireRelease(
    openFile("data.csv"),
    (f) => closeFile(f)
  );

  const tempFile = yield* Effect.acquireRelease(
    createTempFile("data.csv"),
    (f) => deleteFile(f)
  );

  yield* Console.log(
    "...writing data from temp file to main file..."
  );
});

Effect.runPromise(Effect.scoped(program));
```

## Organize Layers into Composable Modules

**Rule:** Organize services and layers into feature modules and wire
them together via an `AppLayer`.

```ts
import { Effect, Layer } from "effect";

export class Logger extends Effect.Service<Logger>()(
  "App/Core/Logger",
  {
    sync: () => ({
      log: (msg: string) =>
        Effect.sync(() => console.log(`[LOG] ${msg}`)),
    }),
  }
) {}

export class UserRepository extends Effect.Service<
  UserRepository
>()("App/User/UserRepository", {
  effect: Effect.gen(function* () {
    const logger = yield* Logger;
    return {
      findById: (id: number) =>
        Effect.gen(function* () {
          yield* logger.log(`Finding user ${id}`);
          return { id, name: `User ${id}` };
        }),
    };
  }),
  dependencies: [Logger.Default],
}) {}

const program = Effect.gen(function* () {
  const repo = yield* UserRepository;
  const user = yield* repo.findById(1);
  return user;
});

Effect.runPromise(
  Effect.provide(program, UserRepository.Default)
).then(console.log);

// In a real app you would define:
// const BaseLayer = Logger.Default;
// const UserModuleLive = UserRepository.Default;
// const AllModules = Layer.mergeAll(UserModuleLive /*, ... */);
// export const AppLayer = Layer.provide(AllModules, BaseLayer);
```

## Poll for Status Until a Task Completes

**Rule:** Race a repeating polling effect against a main job so polling
stops as soon as the job completes.

```ts
import { Effect, Schedule, Duration } from "effect";

const longRunningJob = Effect.log(
  "Data processing complete!"
).pipe(Effect.delay(Duration.seconds(10)));

const pollStatus = Effect.log(
  "Polling for job status: In Progress..."
);

const pollingSchedule = Schedule.fixed(Duration.seconds(2));

const repeatingPoller = pollStatus.pipe(
  Effect.repeat(pollingSchedule)
);

const program = Effect.race(
  longRunningJob,
  repeatingPoller
);

Effect.runPromise(program);
```

## Run Background Tasks with Effect.fork

**Rule:** Use `Effect.fork` to start background tasks and manage them
via `Fiber` APIs.

```ts
import { Effect, Fiber } from "effect";

const tickingClock = Effect.log("tick").pipe(
  Effect.delay("1 second"),
  Effect.forever
);

const program = Effect.gen(function* () {
  yield* Effect.log(
    "Forking the ticking clock into the background."
  );

  const clockFiber = yield* Effect.fork(tickingClock);

  yield* Effect.log(
    "Main process is now doing other work for 5 seconds..."
  );
  yield* Effect.sleep("5 seconds");

  yield* Effect.log(
    "Main process is done. Interrupting the clock fiber."
  );
  yield* Fiber.interrupt(clockFiber);

  yield* Effect.log("Program finished.");
});

Effect.runPromise(program);
```

## Teach your AI Agents Effect with the MCP Server

**Rule:** Use the Effect MCP server so AI tools can query your
`AppLayer` and generate context-aware code.

```ts
// 1. In your terminal, start the MCP server against your AppLayer:
// npx @effect/mcp-server --layer src/layers.ts:AppLayer
//
// 2. Configure your AI agent (e.g. Cursor) to talk to
//    http://localhost:3333.
//
// 3. Ask high-level questions like:
//    "Use UserService to fetch a user by ID and log with Logger."
//
// 4. The AI discovers services via MCP and generates real code:

import { Effect } from "effect";
import { UserService } from "./features/User/UserService";

const program = Effect.gen(function* () {
  const userService = yield* UserService;

  const user = yield* userService.getUser("123");
  yield* Effect.log(`Found user: ${user.name}`);
});
```

## Understand Fibers as Lightweight Threads

**Rule:** Treat fibers as ultra-lightweight virtual threads suitable for
massive concurrency.

```ts
import { Effect, Fiber } from "effect";

const program = Effect.gen(function* () {
  const fiberCount = 100_000;
  yield* Effect.log(`Forking ${fiberCount} fibers...`);

  const tasks = Array.from({ length: fiberCount }, (_, i) =>
    Effect.sleep("1 second").pipe(Effect.as(i))
  );

  const fibers = yield* Effect.forEach(tasks, Effect.fork);

  yield* Effect.log(
    "All fibers have been forked. Now waiting for them to complete..."
  );

  const results = yield* Fiber.joinAll(fibers);

  yield* Effect.log(
    `All ${results.length} fibers have completed.`
  );
});

Effect.runPromise(program);
```
