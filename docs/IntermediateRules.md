# Intermediate Level Effect Rules

> These rules cover intermediate Effect patterns used in and around
> `effect-supermemory`: configuration, Clock, metrics, retries,
> resource lifecycles, HTTP, schema, Option / Either, streaming, and
> more.

## Access Configuration from the Context

**Rule:** Access configuration from the Effect context.

```ts
import { Config, Effect, Layer } from "effect";

class AppConfig extends Effect.Service<AppConfig>()(
  "AppConfig",
  {
    sync: () => ({
      host: "localhost",
      port: 3000,
    }),
  }
) {}

const program = Effect.gen(function* () {
  const config = yield* AppConfig;
  yield* Effect.log(
    `Starting server on http://${config.host}:${config.port}`
  );
});

Effect.runPromise(Effect.provide(program, AppConfig.Default));
```

## Accessing the Current Time with Clock

**Rule:** Use the `Clock` service to get the current time to keep time-
aware logic testable.

```ts
import { Effect, Clock, Duration } from "effect";

interface Token {
  readonly value: string;
  readonly expiresAt: number;
}

const isTokenExpired = (
  token: Token
): Effect.Effect<boolean, never, Clock.Clock> =>
  Clock.currentTimeMillis.pipe(
    Effect.map((now) => now > token.expiresAt),
    Effect.tap((expired) =>
      Effect.log(
        `Token expired? ${expired} (current time: ${new Date().toISOString()})`
      )
    )
  );

const makeTestClock = (timeMs: number): Clock.Clock => ({
  currentTimeMillis: Effect.succeed(timeMs),
  currentTimeNanos: Effect.succeed(BigInt(timeMs * 1_000_000)),
  sleep: (_duration: Duration.Duration) => Effect.succeed(void 0),
  unsafeCurrentTimeMillis: () => timeMs,
  unsafeCurrentTimeNanos: () => BigInt(timeMs * 1_000_000),
  [Clock.ClockTypeId]: Clock.ClockTypeId,
});

const token: Token = {
  value: "abc",
  expiresAt: Date.now() + 1000,
};

const program = Effect.gen(function* () {
  yield* Effect.log("Checking with current time...");
  yield* isTokenExpired(token);

  yield* Effect.log(
    "\nChecking with past time (1 minute ago)..."
  );
  const pastClock = makeTestClock(Date.now() - 60_000);
  yield* isTokenExpired(token).pipe(
    Effect.provideService(Clock.Clock, pastClock)
  );

  yield* Effect.log(
    "\nChecking with future time (1 hour ahead)..."
  );
  const futureClock = makeTestClock(Date.now() + 3_600_000);
  yield* isTokenExpired(token).pipe(
    Effect.provideService(Clock.Clock, futureClock)
  );
});

Effect.runPromise(
  program.pipe(
    Effect.provideService(Clock.Clock, makeTestClock(Date.now()))
  )
);
```

## Accumulate Multiple Errors with Either

**Rule:** Use `Schema.decode` (which uses `Either` under the hood) with
`errors: "all"` to accumulate validation errors instead of failing fast.

```ts
import { Effect, Schema, Data } from "effect";

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly message: string;
}> {}

type User = {
  name: string;
  email: string;
};

const UserSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.minLength(3),
    Schema.filter((name) => /^[A-Za-z\s]+$/.test(name), {
      message: () =>
        "name must contain only letters and spaces",
    })
  ),
  email: Schema.String.pipe(
    Schema.pattern(/@/),
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: () =>
        "email must be a valid email address",
    })
  ),
});

const invalidInputs: User[] = [
  {
    name: "Al",
    email: "bob-no-at-sign.com",
  },
  {
    name: "John123",
    email: "john@incomplete",
  },
  {
    name: "Alice Smith",
    email: "alice@example.com",
  },
];

const validateUser = (input: User) =>
  Effect.gen(function* () {
    const result = yield* Schema.decode(UserSchema)(input, {
      errors: "all",
    });
    return result;
  });

const program = Effect.gen(function* () {
  console.log("Validating users...\n");

  for (const input of invalidInputs) {
    const result = yield* Effect.either(validateUser(input));

    console.log(
      `Validating user: ${input.name} <${input.email}>`
    );

    yield* Effect.match(result, {
      onFailure: (error) =>
        Effect.sync(() => {
          console.log("❌ Validation failed:");
          console.log(error.message);
          console.log();
        }),
      onSuccess: (user) =>
        Effect.sync(() => {
          console.log("✅ User is valid:", user);
          console.log();
        }),
    });
  }
});

Effect.runSync(program);
```

## Add Custom Metrics to Your Application

**Rule:** Use `Metric.counter`, `Metric.gauge`, and `Metric.timer` to
instrument code for monitoring.

```ts
import { Effect, Metric, Duration } from "effect";

const userRegisteredCounter = Metric.counter(
  "users_registered_total",
  {
    description:
      "A counter for how many users have been registered.",
  }
);

const dbDurationTimer = Metric.timer(
  "db_operation_duration",
  "A timer for DB operation durations"
);

const saveUserToDb = Effect.succeed("user saved").pipe(
  Effect.delay(Duration.millis(Math.random() * 100))
);

const createUser = Effect.gen(function* () {
  yield* saveUserToDb.pipe(Metric.trackDuration(dbDurationTimer));
  yield* Metric.increment(userRegisteredCounter);
  return { status: "success" };
});

Effect.runPromise(createUser).then(console.log);
```

## Automatically Retry Failed Operations

**Rule:** Use retry policies (`Schedule`) with `Effect.retry` to recover
from transient failures.

```ts
import { Effect, Schedule } from "effect";

const processItem = (id: number): Effect.Effect<string, Error> =>
  Effect.gen(function* () {
    yield* Effect.log(`Attempting to process item ${id}...`);

    if (id === 2) {
      const random = Math.random();
      if (random < 0.5) {
        yield* Effect.log(`Item ${id} failed, will retry...`);
        return yield* Effect.fail(
          new Error("API is temporarily down")
        );
      }
    }

    yield* Effect.log(`✅ Successfully processed item ${id}`);
    return `Processed item ${id}`;
  });

const ids = [1, 2, 3];

const retryPolicy = Schedule.recurs(3).pipe(
  Schedule.addDelay(() => "100 millis")
);

const program = Effect.gen(function* () {
  yield* Effect.log("=== Stream Retry on Failure Demo ===");
  yield* Effect.log(
    "Processing items with retry policy (3 attempts, 100ms delay)"
  );

  const results = yield* Effect.forEach(
    ids,
    (id) =>
      processItem(id).pipe(
        Effect.retry(retryPolicy),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.log(
              `❌ Item ${id} failed after all retries: ${
                error.message
              }`
            );
            return `Failed: item ${id}`;
          })
        )
      ),
    { concurrency: 1 }
  );

  yield* Effect.log("=== Results ===");
  results.forEach((result, index) => {
    console.log(`Item ${ids[index]}: ${result}`);
  });

  yield* Effect.log("✅ Stream processing completed");
});

Effect.runPromise(program).catch((error) => {
  console.error("Unexpected error:", error);
});
```

## Avoid Long Chains of andThen; Use Generators Instead

**Rule:** Prefer `Effect.gen` over long chains of combinators for
sequential logic.

```ts
import { Effect } from "effect";

const step1 = (): Effect.Effect<number> =>
  Effect.succeed(42).pipe(
    Effect.tap((n) => Effect.log(`Step 1: ${n}`))
  );

const step2 = (a: number): Effect.Effect<string> =>
  Effect.succeed(`Result: ${a * 2}`).pipe(
    Effect.tap((s) => Effect.log(`Step 2: ${s}`))
  );

const program = Effect.gen(function* () {
  const a = yield* step1();
  const b = yield* step2(a);
  return b;
});

Effect.runPromise(program).then((result) =>
  Effect.runSync(Effect.log(`Final result: ${result}`))
);
```

## Beyond the Date Type – Real-World Dates, Times, and Timezones

**Rule:** Use the `Clock` service plus primitive timestamps instead of
mutating `Date` instances.

```ts
import { Effect, Clock } from "effect";
import type * as Types from "effect/Clock";

interface Event {
  readonly message: string;
  readonly timestamp: number;
}

const createEvent = (
  message: string
): Effect.Effect<Event, never, Types.Clock> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis;
    return { message, timestamp };
  });

const program = Effect.gen(function* () {
  const loginEvent = yield* createEvent("User logged in");
  console.log("Login event:", loginEvent);

  const logoutEvent = yield* createEvent("User logged out");
  console.log("Logout event:", logoutEvent);
});

Effect.runPromise(
  program.pipe(
    Effect.provideService(Clock.Clock, Clock.make())
  )
).catch(console.error);
```

## Compose Resource Lifecycles with Layer.merge

**Rule:** Compose multiple scoped layers using `Layer.merge`.

```ts
import { Effect, Layer, Console } from "effect";

interface DatabaseOps {
  query: (sql: string) => Effect.Effect<string, never>;
}

class Database extends Effect.Service<DatabaseOps>()(
  "Database",
  {
    sync: () => ({
      query: (sql: string) =>
        Effect.sync(() => `db says: ${sql}`),
    }),
  }
) {}

interface ApiClientOps {
  fetch: (path: string) => Effect.Effect<string, never>;
}

class ApiClient extends Effect.Service<ApiClientOps>()(
  "ApiClient",
  {
    sync: () => ({
      fetch: (path: string) =>
        Effect.sync(() => `api says: ${path}`),
    }),
  }
) {}

const AppLayer = Layer.merge(Database.Default, ApiClient.Default);

const program = Effect.gen(function* () {
  const db = yield* Database;
  const api = yield* ApiClient;

  const dbResult = yield* db.query("SELECT *");
  const apiResult = yield* api.fetch("/users");

  yield* Console.log(dbResult);
  yield* Console.log(apiResult);
});

Effect.runPromise(Effect.provide(program, AppLayer));
```

## Conditionally Branching Workflows

**Rule:** Use `Effect.filterOrFail` and `Effect.if` for declarative
branching.

```ts
import { Effect } from "effect";

interface User {
  id: number;
  status: "active" | "inactive";
  roles: string[];
}

type UserError = "DbError" | "UserIsInactive" | "UserIsNotAdmin";

const findUser = (id: number): Effect.Effect<User, "DbError"> =>
  Effect.succeed({ id, status: "active", roles: ["admin"] });

const isActive = (user: User): boolean => user.status === "active";

const isAdmin = (user: User): boolean =>
  user.roles.includes("admin");

const program = (id: number): Effect.Effect<string, UserError> =>
  findUser(id).pipe(
    Effect.filterOrFail(isActive, () => "UserIsInactive" as const),
    Effect.filterOrFail(isAdmin, () => "UserIsNotAdmin" as const),
    Effect.map((user) => `Welcome, admin user #${user.id}!`)
  );

const handled = program(123).pipe(
  Effect.match({
    onFailure: (error) => {
      switch (error) {
        case "UserIsNotAdmin":
          return "Access denied: requires admin role.";
        case "UserIsInactive":
          return "Access denied: user is not active.";
        case "DbError":
          return "Error: could not find user.";
        default:
          return `Unknown error: ${error}`;
      }
    },
    onSuccess: (result) => result,
  })
);

Effect.runPromise(handled).then(console.log);
```

## Control Flow with Conditional Combinators

**Rule:** Use `Effect.if` for branchy logic inside the Effect world.

```ts
import { Effect } from "effect";

const attemptAdminAction = (user: { isAdmin: boolean }) =>
  Effect.if(user.isAdmin, {
    onTrue: () => Effect.succeed("Admin action completed."),
    onFalse: () => Effect.fail("Permission denied."),
  });

const program = Effect.gen(function* () {
  yield* Effect.logInfo("\nTrying with admin user...");
  const adminResult = yield* Effect.either(
    attemptAdminAction({ isAdmin: true })
  );
  yield* Effect.logInfo(
    `Admin result: ${
      adminResult._tag === "Right"
        ? adminResult.right
        : adminResult.left
    }`
  );

  yield* Effect.logInfo(
    "\nTrying with non-admin user..."
  );
  const userResult = yield* Effect.either(
    attemptAdminAction({ isAdmin: false })
  );
  yield* Effect.logInfo(
    `User result: ${
      userResult._tag === "Right"
        ? userResult.right
        : userResult.left
    }`
  );
});

Effect.runPromise(program);
```

## Control Repetition with Schedule

**Rule:** Use `Schedule` to build composable repetition and retry
policies.

```ts
import { Effect, Schedule, Duration } from "effect";

const flakyEffect = Effect.try({
  try: () => {
    if (Math.random() > 0.2) {
      throw new Error("Transient error");
    }
    return "Operation succeeded!";
  },
  catch: (error: unknown) => {
    Effect.logInfo("Operation failed, retrying...");
    return error;
  },
});

const exponentialBackoff = Schedule.exponential("100 millis");

const withJitter = Schedule.jittered(exponentialBackoff);

const limitedWithJitter = Schedule.compose(
  withJitter,
  Schedule.recurs(5)
);

const program = Effect.gen(function* () {
  yield* Effect.logInfo("Starting operation...");
  const result = yield* Effect.retry(
    flakyEffect,
    limitedWithJitter
  );
  yield* Effect.logInfo(`Final result: ${result}`);
});

Effect.runPromise(program);
```

## Create a Service Layer from a Managed Resource

**Rule:** Use `Effect.Service` with a `scoped` implementation to
represent managed resources.

```ts
import { Effect, Console } from "effect";

interface DatabaseService {
  readonly query: (
    sql: string
  ) => Effect.Effect<string[], never>;
}

class Database extends Effect.Service<DatabaseService>()(
  "Database",
  {
    scoped: Effect.gen(function* () {
      const id = Math.floor(Math.random() * 1_000);

      yield* Console.log(`[Pool ${id}] Acquired`);

      yield* Effect.addFinalizer(() =>
        Console.log(`[Pool ${id}] Released`)
      );

      return {
        query: (sql: string) =>
          Effect.sync(() => [
            `Result for '${sql}' from pool ${id}`,
          ]),
      };
    }),
  }
) {}

const program = Effect.gen(function* () {
  const db = yield* Database;
  const users = yield* db.query("SELECT * FROM users");
  yield* Console.log(`Query successful: ${users[0]}`);
});

Effect.runPromise(
  Effect.scoped(program).pipe(
    Effect.provide(Database.Default)
  )
);
```

## Create a Testable HTTP Client Service

**Rule:** Define an `HttpClient` service with live and test layers so
API-dependent logic stays testable.

```ts
import { Effect, Data, Layer } from "effect";

interface HttpErrorType {
  readonly _tag: "HttpError";
  readonly error: unknown;
}

const HttpError = Data.tagged<HttpErrorType>("HttpError");

interface HttpClientType {
  readonly get: <T>(url: string) => Effect.Effect<T, HttpErrorType>;
}

class HttpClient extends Effect.Service<HttpClientType>()(
  "HttpClient",
  {
    sync: () => ({
      get: <T>(url: string) =>
        Effect.tryPromise({
          try: () => fetch(url).then((res) => res.json()),
          catch: (error) => HttpError({ error }),
        }),
    }),
  }
) {}

const TestLayer = Layer.succeed(
  HttpClient,
  HttpClient.of({
    get: <T>(_url: string) =>
      Effect.succeed({ title: "Mock Data" } as T),
  })
);

const program = Effect.gen(function* () {
  const client = yield* HttpClient;
  yield* Effect.logInfo("Fetching data...");
  const data = yield* client.get<{ title: string }>(
    "https://api.example.com/data"
  );
  yield* Effect.logInfo(
    `Received data: ${JSON.stringify(data)}`
  );
});

Effect.runPromise(Effect.provide(program, TestLayer));
```

## Define a Type-Safe Configuration Schema

**Rule:** Use `Config` and `ConfigProvider` for structured, typed
configuration.

```ts
import { Config, Effect, ConfigProvider, Layer } from "effect";

const ServerConfig = Config.nested("SERVER")(
  Config.all({
    host: Config.string("HOST"),
    port: Config.number("PORT"),
  })
);

const program = Effect.gen(function* () {
  const config = yield* ServerConfig;
  yield* Effect.logInfo(
    `Server config loaded: ${JSON.stringify(config)}`
  );
});

const TestConfig = ConfigProvider.fromMap(
  new Map([
    ["SERVER.HOST", "localhost"],
    ["SERVER.PORT", "3000"],
  ])
);

Effect.runPromise(
  Effect.provide(
    program,
    Layer.setConfigProvider(TestConfig)
  )
);
```

## Define Contracts Upfront with Schema

**Rule:** Define data contracts with `Schema` and enforce them at
boundaries.

```ts
import { Schema, Effect, Data } from "effect";

const UserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
});

type User = Schema.Schema.Type<typeof UserSchema>;

class UserNotFound extends Data.TaggedError("UserNotFound")<{
  readonly id: number;
}> {}

export class Database extends Effect.Service<Database>()(
  "Database",
  {
    sync: () => ({
      getUser: (id: number) =>
        id === 1
          ? Effect.succeed({ id: 1, name: "John" })
          : Effect.fail(new UserNotFound({ id })),
    }),
  }
) {}

const program = Effect.gen(function* () {
  const db = yield* Database;

  yield* Effect.logInfo("Looking up user 1...");
  const user1 = yield* db.getUser(1);
  yield* Effect.logInfo(
    `Found user: ${JSON.stringify(user1)}`
  );

  yield* Effect.logInfo("\nLooking up user 999...");
  yield* Effect.logInfo("Attempting to get user 999...");
  yield* Effect.gen(function* () {
    const user = yield* db.getUser(999);
    yield* Effect.logInfo(
      `Found user: ${JSON.stringify(user)}`
    );
  }).pipe(
    Effect.catchAll((error) => {
      if (error instanceof UserNotFound) {
        return Effect.logInfo(
          `Error: User with id ${error.id} not found`
        );
      }
      return Effect.logInfo(
        `Unexpected error: ${error}`
      );
    })
  );

  yield* Effect.logInfo(
    "\nTrying to decode invalid user data..."
  );
  const invalidUser = {
    id: "not-a-number",
    name: 123,
  } as any;
  yield* Effect.gen(function* () {
    const user = yield* Schema.decode(UserSchema)(
      invalidUser
    );
    yield* Effect.logInfo(
      `Decoded user: ${JSON.stringify(user)}`
    );
  }).pipe(
    Effect.catchAll((error) =>
      Effect.logInfo(
        `Validation failed:\n${JSON.stringify(
          error,
          null,
          2
        )}`
      )
    )
  );
});

Effect.runPromise(
  Effect.provide(program, Database.Default)
);
```

## Define Type-Safe Errors with Data.TaggedError

**Rule:** Use `Data.TaggedError` to give errors structure and tags.

```ts
import { Data, Effect } from "effect";

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause: unknown;
}> {}

const findUser = (
  id: number
): Effect.Effect<{ id: number; name: string }, DatabaseError> =>
  Effect.gen(function* () {
    if (id < 0) {
      return yield* Effect.fail(
        new DatabaseError({ cause: "Invalid ID" })
      );
    }
    return { id, name: `User ${id}` };
  });

const program = Effect.gen(function* () {
  yield* Effect.logInfo("Looking up user 1...");
  yield* Effect.gen(function* () {
    const user = yield* findUser(1);
    yield* Effect.logInfo(
      `Found user: ${JSON.stringify(user)}`
    );
  }).pipe(
    Effect.catchAll((error) =>
      Effect.logInfo(
        `Error finding user: ${error._tag} - ${
          (error as DatabaseError).cause
        }`
      )
    )
  );

  yield* Effect.logInfo("\nLooking up user -1...");
  yield* Effect.gen(function* () {
    const user = yield* findUser(-1);
    yield* Effect.logInfo(
      `Found user: ${JSON.stringify(user)}`
    );
  }).pipe(
    Effect.catchTag("DatabaseError", (error) =>
      Effect.logInfo(
        `Database error: ${error._tag} - ${error.cause}`
      )
    )
  );
});

Effect.runPromise(program);
```

## Distinguish "Not Found" from Errors

**Rule:** Use `Effect<Option<A>>` to distinguish empty results from
failures.

```ts
import { Effect, Option, Data } from "effect";

interface User {
  id: number;
  name: string;
}

class DatabaseError extends Data.TaggedError("DatabaseError") {}

const findUserInDb = (
  id: number
): Effect.Effect<Option.Option<User>, DatabaseError> =>
  Effect.gen(function* () {
    const dbResult = yield* Effect.try({
      try: () => (id === 1 ? { id: 1, name: "Paul" } : null),
      catch: () => new DatabaseError(),
    });

    return Option.fromNullable(dbResult);
  });

const program = (id: number) =>
  findUserInDb(id).pipe(
    Effect.flatMap((maybeUser) =>
      Option.match(maybeUser, {
        onNone: () =>
          Effect.logInfo(
            `Result: User with ID ${id} was not found.`
          ),
        onSome: (user) =>
          Effect.logInfo(`Result: Found user ${user.name}.`),
      })
    ),
    Effect.catchAll((_error) =>
      Effect.logInfo(
        "Error: Could not connect to the database."
      )
    )
  );

Effect.runPromise(
  Effect.gen(function* () {
    yield* Effect.logInfo("Looking for user with ID 1...");
    yield* program(1);

    yield* Effect.logInfo(
      "\nLooking for user with ID 2..."
    );
    yield* program(2);
  })
);
```

## Handle API Errors

**Rule:** Map domain-specific errors to structured API responses.

```ts
import { Cause, Data, Effect } from "effect";

export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: "admin" | "user";
}

export class UserNotFoundError extends Data.TaggedError(
  "UserNotFoundError"
)<{
  readonly id: string;
}> {}

export class InvalidIdError extends Data.TaggedError("InvalidIdError")<{
  readonly id: string;
  readonly reason: string;
}> {}

export class UnauthorizedError extends Data.TaggedError(
  "UnauthorizedError"
)<{
  readonly action: string;
  readonly role: string;
}> {}

export class ErrorHandlerService extends Effect.Service<
  ErrorHandlerService
>()("ErrorHandlerService", {
  sync: () => ({
    handleApiError: <E>(
      error: E
    ): Effect.Effect<ApiResponse, never> =>
      Effect.gen(function* () {
        yield* Effect.logError(
          `API Error: ${JSON.stringify(error)}`
        );

        if (error instanceof UserNotFoundError) {
          return {
            error: "Not Found",
            message: `User ${error.id} not found`,
          };
        }
        if (error instanceof InvalidIdError) {
          return {
            error: "Bad Request",
            message: error.reason,
          };
        }
        if (error instanceof UnauthorizedError) {
          return {
            error: "Unauthorized",
            message: `${error.role} cannot ${error.action}`,
          };
        }

        return {
          error: "Internal Server Error",
          message: "An unexpected error occurred",
        };
      }),

    handleUnexpectedError: (
      cause: Cause.Cause<unknown>
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* Effect.logError("Unexpected error occurred");

        if (Cause.isDie(cause)) {
          const defect = Cause.failureOption(cause);
          if (defect._tag === "Some") {
            const error = defect.value as Error;
            yield* Effect.logError(
              `Defect: ${error.message}`
            );
            yield* Effect.logError(
              `Stack: ${
                error.stack?.split("\n")[1]?.trim() ?? "N/A"
              }`
            );
          }
        }

        return Effect.succeed(void 0);
      }),
  }),
}) {}

export class UserRepository extends Effect.Service<
  UserRepository
>()("UserRepository", {
  sync: () => {
    const users = new Map<string, User>([
      [
        "user_123",
        {
          id: "user_123",
          name: "Paul",
          email: "paul@example.com",
          role: "admin",
        },
      ],
      [
        "user_456",
        {
          id: "user_456",
          name: "Alice",
          email: "alice@example.com",
          role: "user",
        },
      ],
    ]);

    return {
      getUser: (
        id: string
      ): Effect.Effect<User, UserNotFoundError | InvalidIdError> =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `Attempting to get user with id: ${id}`
          );

          if (!id.match(/^user_\d+$/)) {
            yield* Effect.logWarning(
              `Invalid user ID format: ${id}`
            );
            return yield* Effect.fail(
              new InvalidIdError({
                id,
                reason:
                  "ID must be in format user_<number>",
              })
            );
          }

          const user = users.get(id);
          if (user === undefined) {
            yield* Effect.logWarning(
              `User not found with id: ${id}`
            );
            return yield* Effect.fail(
              new UserNotFoundError({ id })
            );
          }

          yield* Effect.logInfo(
            `Found user: ${JSON.stringify(user)}`
          );
          return user;
        }),

      checkRole: (
        user: User,
        requiredRole: "admin" | "user"
      ): Effect.Effect<void, UnauthorizedError> =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `Checking if user ${user.id} has role: ${
              requiredRole
            }`
          );

          if (
            user.role !== requiredRole &&
            user.role !== "admin"
          ) {
            yield* Effect.logWarning(
              `User ${user.id} with role ${user.role} cannot access ${
                requiredRole
              } resources`
            );
            return yield* Effect.fail(
              new UnauthorizedError({
                action: "access_user",
                role: user.role,
              })
            );
          }

          yield* Effect.logInfo(
            `User ${user.id} has required role: ${
              user.role
            }`
          );
          return Effect.succeed(void 0);
        }),
    };
  },
}) {}

interface ApiResponse {
  readonly error?: string;
  readonly message?: string;
  readonly data?: User;
}

const createRoutes = () =>
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    const errorHandler = yield* ErrorHandlerService;

    yield* Effect.logInfo(
      "=== Processing API request ==="
    );

    for (const userId of [
      "user_123",
      "user_456",
      "invalid_id",
      "user_789",
    ]) {
      yield* Effect.logInfo(
        `\n--- Testing user ID: ${userId} ---`
      );

      const response = yield* repo.getUser(userId).pipe(
        Effect.map((user) => ({
          data: {
            ...user,
            email:
              user.role === "admin"
                ? user.email
                : "[hidden]",
          },
        })),
        Effect.catchAll((error) =>
          errorHandler.handleApiError(error)
        )
      );

      yield* Effect.logInfo(
        `Response: ${JSON.stringify(response)}`
      );
    }

    const adminUser = yield* repo.getUser("user_123");
    const regularUser = yield* repo.getUser("user_456");

    yield* Effect.logInfo("\n=== Testing role checks ===");

    yield* repo.checkRole(adminUser, "admin").pipe(
      Effect.tap(() =>
        Effect.logInfo("Admin access successful")
      ),
      Effect.catchAll((error) =>
        errorHandler.handleApiError(error)
      )
    );

    yield* repo.checkRole(regularUser, "admin").pipe(
      Effect.tap(() =>
        Effect.logInfo("User admin access successful")
      ),
      Effect.catchAll((error) =>
        errorHandler.handleApiError(error)
      )
    );

    return { message: "Tests completed successfully" };
  });

Effect.runPromise(
  Effect.provide(
    Effect.provide(
      createRoutes(),
      ErrorHandlerService.Default
    ),
    UserRepository.Default
  )
);
```

## Handle Errors with catchTag, catchTags, and catchAll

**Rule:** Use `catchTag`, `catchTags`, and `catchAll` to recover from
specific error types.

```ts
import { Data, Effect } from "effect";

interface User {
  readonly id: string;
  readonly name: string;
}

class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly url: string;
  readonly code: number;
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly message: string;
}> {}

class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly id: string;
}> {}

class UserService extends Effect.Service<UserService>()(
  "UserService",
  {
    sync: () => ({
      fetchUser: (
        id: string
      ): Effect.Effect<User, NetworkError | NotFoundError> =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `Fetching user with id: ${id}`
          );

          if (id === "invalid") {
            const url = "/api/users/" + id;
            yield* Effect.logWarning(
              `Network error accessing: ${url}`
            );
            return yield* Effect.fail(
              new NetworkError({ url, code: 500 })
            );
          }

          if (id === "missing") {
            yield* Effect.logWarning(
              `User not found: ${id}`
            );
            return yield* Effect.fail(
              new NotFoundError({ id })
            );
          }

          const user = { id, name: "John Doe" };
          yield* Effect.logInfo(
            `Found user: ${JSON.stringify(user)}`
          );
          return user;
        }),

      validateUser: (
        user: User
      ): Effect.Effect<string, ValidationError> =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `Validating user: ${JSON.stringify(user)}`
          );

          if (user.name.length < 3) {
            yield* Effect.logWarning(
              `Validation failed: name too short for user ${
                user.id
              }`
            );
            return yield* Effect.fail(
              new ValidationError({
                field: "name",
                message: "Name too short",
              })
            );
          }

          const message = `User ${user.name} is valid`;
          yield* Effect.logInfo(message);
          return message;
        }),
    }),
  }
) {}

const processUser = (
  userId: string
): Effect.Effect<string, never, UserService> =>
  Effect.gen(function* () {
    const userService = yield* UserService;

    yield* Effect.logInfo(
      `=== Processing user ID: ${userId} ===`
    );

    const result = yield* userService
      .fetchUser(userId)
      .pipe(
        Effect.flatMap(userService.validateUser),
        Effect.catchTags({
          NetworkError: (e) =>
            Effect.gen(function* () {
              const message = `Network error: ${e.code} for ${
                e.url
              }`;
              yield* Effect.logError(message);
              return message;
            }),
          NotFoundError: (e) =>
            Effect.gen(function* () {
              const message = `User ${e.id} not found`;
              yield* Effect.logWarning(message);
              return message;
            }),
          ValidationError: (e) =>
            Effect.gen(function* () {
              const message = `Invalid ${e.field}: ${
                e.message
              }`;
              yield* Effect.logWarning(message);
              return message;
            }),
        })
      );

    yield* Effect.logInfo(`Result: ${result}`);
    return result;
  });

const runTests = Effect.gen(function* () {
  yield* Effect.logInfo(
    "=== Starting User Processing Tests ==="
  );

  const testCases = ["valid", "invalid", "missing"];
  const results = yield* Effect.forEach(
    testCases,
    (id) => processUser(id)
  );

  yield* Effect.logInfo(
    "=== User Processing Tests Complete ==="
  );
  return results;
});

Effect.runPromise(
  Effect.provide(runTests, UserService.Default)
);
```

## Handle Flaky Operations with Retries and Timeouts

**Rule:** Combine `Effect.retry` and `Effect.timeout` to harden flaky
operations.

```ts
import { Data, Duration, Effect, Schedule } from "effect";

interface ApiResponse {
  readonly data: string;
}

class ApiError extends Data.TaggedError("ApiError")<{
  readonly message: string;
  readonly attempt: number;
}> {}

class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly duration: string;
  readonly attempt: number;
}> {}

class ApiService extends Effect.Service<ApiService>()(
  "ApiService",
  {
    sync: () => ({
      fetchData: () =>
        Effect.gen(function* () {
          const attempt = Math.floor(Math.random() * 5) + 1;
          yield* Effect.logInfo(
            `Attempt ${attempt}: Making API call...`
          );

          if (Math.random() > 0.3) {
            yield* Effect.logWarning(
              `Attempt ${attempt}: API call failed`
            );
            return yield* Effect.fail(
              new ApiError({
                message: "API Error",
                attempt,
              })
            );
          }

          const delay = Math.random() * 3_000;
          yield* Effect.logInfo(
            `Attempt ${attempt}: API call will take ${
              delay.toFixed(0)
            }ms`
          );

          yield* Effect.sleep(Duration.millis(delay));

          const response = { data: "some important data" };
          yield* Effect.logInfo(
            `Attempt ${attempt}: API call succeeded with data: ${JSON.stringify(
              response
            )}`
          );
          return response;
        }),
    }),
  }
) {}

const retryPolicy = Schedule.exponential(
  Duration.millis(100)
).pipe(
  Schedule.compose(Schedule.recurs(3)),
  Schedule.tapInput((error: ApiError | TimeoutError) =>
    Effect.logWarning(
      `Retrying after error: ${error._tag} (Attempt ${
        error.attempt
      })`
    )
  )
);

const program = Effect.gen(function* () {
  const api = yield* ApiService;

  yield* Effect.logInfo(
    "=== Starting API calls with retry and timeout ==="
  );

  for (let i = 1; i <= 3; i++) {
    yield* Effect.logInfo(`\n--- Test Call ${i} ---`);

    const result = yield* api
      .fetchData()
      .pipe(
        Effect.timeout(Duration.seconds(2)),
        Effect.catchTag("TimeoutException", () =>
          Effect.fail(
            new TimeoutError({
              duration: "2 seconds",
              attempt: i,
            })
          )
        ),
        Effect.retry(retryPolicy),
        Effect.catchTags({
          ApiError: (error) =>
            Effect.gen(function* () {
              yield* Effect.logError(
                `All retries failed: ${error.message} (Last attempt: ${
                  error.attempt
                })`
              );
              return {
                data: "fallback data due to API error",
              } as ApiResponse;
            }),
          TimeoutError: (error) =>
            Effect.gen(function* () {
              yield* Effect.logError(
                `All retries timed out after ${
                  error.duration
                } (Last attempt: ${error.attempt})`
              );
              return {
                data: "fallback data due to timeout",
              } as ApiResponse;
            }),
        })
      );

    yield* Effect.logInfo(
      `Result: ${JSON.stringify(result)}`
    );
  }

  yield* Effect.logInfo(
    "\n=== API calls complete ==="
  );
});

Effect.runPromise(
  Effect.provide(program, ApiService.Default)
);
```

## Leverage Effect's Built-In Structured Logging

**Rule:** Prefer Effect's logging combinators over `console.log` for
structured logs.

```ts
import { Effect } from "effect";

const program = Effect.logDebug("Processing user", {
  userId: 123,
});

Effect.runSync(
  program.pipe(
    Effect.tap(() => Effect.log("Debug logging enabled"))
  )
);
```

## Make an Outgoing HTTP Client Request

**Rule:** Use the `@effect/platform` HTTP stack for fully Effectful HTTP
clients and servers.

```ts
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import * as HttpRouter from "@effect/platform/HttpRouter";
import * as HttpServer from "@effect/platform/HttpServer";
import * as HttpResponse from "@effect/platform/HttpServerResponse";
import { Console, Data, Duration, Effect, Fiber, Layer } from "effect";

class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  id: string;
}> {}

export class Database extends Effect.Service<Database>()(
  "Database",
  {
    sync: () => ({
      getUser: (id: string) =>
        id === "123"
          ? Effect.succeed({ name: "Paul" })
          : Effect.fail(new UserNotFoundError({ id })),
    }),
  }
) {}

const userHandler = Effect.flatMap(HttpRouter.params, (p) =>
  Effect.flatMap(Database, (db) => db.getUser(p["userId"] ?? "")).pipe(
    Effect.flatMap(HttpResponse.json)
  )
);

const app = HttpRouter.empty.pipe(
  HttpRouter.get("/users/:userId", userHandler)
);

const server = NodeHttpServer.layer(
  () => require("node:http").createServer(),
  {
    port: 3_457,
  }
);

const serverLayer = HttpServer.serve(app);

const mainLayer = Layer.merge(Database.Default, server);

const program = Effect.gen(function* () {
  yield* Console.log("Server started on http://localhost:3457");
  const layer = Layer.provide(serverLayer, mainLayer);

  const serverFiber = yield* Layer.launch(layer).pipe(
    Effect.fork
  );

  yield* Effect.sleep(Duration.seconds(1));

  yield* Console.log(
    "Server is running and ready to handle requests"
  );
  yield* Effect.sleep(Duration.seconds(2));

  yield* Fiber.interrupt(serverFiber);
  yield* Console.log("Server shutdown complete");
});

NodeRuntime.runMain(
  Effect.provide(
    program,
    Layer.provide(serverLayer, Layer.merge(Database.Default, server))
  ) as Effect.Effect<void, unknown>
);
```

## Manage Shared State Safely with Ref

**Rule:** Use `Ref` for concurrent, mutable state with atomic updates.

```ts
import { Effect, Ref } from "effect";

const program = Effect.gen(function* () {
  const ref = yield* Ref.make(0);

  const increment = Ref.update(ref, (n) => n + 1);

  const tasks = Array.from({ length: 1_000 }, () => increment);

  yield* Effect.all(tasks, { concurrency: "unbounded" });

  return yield* Ref.get(ref);
});

Effect.runPromise(program).then(console.log);
```

## Model Optional Values Safely with Option

**Rule:** Use `Option<A>` instead of `null` / `undefined` for optional
values.

```ts
import { Option } from "effect";

interface User {
  id: number;
  name: string;
}

const users: User[] = [
  { id: 1, name: "Paul" },
  { id: 2, name: "Alex" },
];

const findUserById = (id: number): Option.Option<User> => {
  const user = users.find((u) => u.id === id);
  return Option.fromNullable(user);
};

const greeting = (id: number): string =>
  findUserById(id).pipe(
    Option.match({
      onNone: () => "User not found.",
      onSome: (user) => `Welcome, ${user.name}!`,
    })
  );

console.log(greeting(1));
console.log(greeting(3));
```

## Model Validated Domain Types with Brand

**Rule:** Use `Brand` to represent values that have passed validation.

```ts
import { Brand, Option } from "effect";

type Email = string & Brand.Brand<"Email">;

const makeEmail = (s: string): Option.Option<Email> =>
  s.includes("@") ? Option.some(s as Email) : Option.none();

const sendEmail = (email: Email, body: string) => {
  // ...
};
```

## Parse and Validate Data with Schema.decode

**Rule:** Prefer `Schema.decode` for parsing and validating unknown
inputs.

```ts
import { Effect, Schema } from "effect";

interface User {
  name: string;
}

const UserSchema = Schema.Struct({
  name: Schema.String,
}) as Schema.Schema<User>;

const processUserInput = (input: unknown) =>
  Effect.gen(function* () {
    const user = yield* Schema.decodeUnknown(UserSchema)(
      input
    );
    return `Welcome, ${user.name}!`;
  }).pipe(
    Effect.catchTag("ParseError", () =>
      Effect.succeed("Invalid user data.")
    )
  );

const program = Effect.gen(function* () {
  const validInput = { name: "Paul" };
  const validResult = yield* processUserInput(validInput);
  yield* Effect.logInfo(
    `Valid input result: ${validResult}`
  );

  const invalidInput = { age: 25 };
  const invalidResult = yield* processUserInput(invalidInput);
  yield* Effect.logInfo(
    `Invalid input result: ${invalidResult}`
  );

  const badInput = "not an object";
  const badResult = yield* processUserInput(badInput);
  yield* Effect.logInfo(
    `Bad input result: ${badResult}`
  );
});

Effect.runPromise(program);
```

## Process a Collection in Parallel with Effect.forEach

**Rule:** Use `Effect.forEach` with `concurrency` to process
collections in parallel.

```ts
import { Effect } from "effect";

const fetchUserById = (id: number) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Fetching user ${id}...`);
    yield* Effect.sleep("1 second");
    return {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
    };
  });

const userIds = Array.from({ length: 10 }, (_, i) => i + 1);

const program = Effect.gen(function* () {
  yield* Effect.logInfo("Starting parallel processing...");

  const startTime = Date.now();
  const users = yield* Effect.forEach(
    userIds,
    fetchUserById,
    { concurrency: 5 }
  );
  const endTime = Date.now();

  yield* Effect.logInfo(
    `Processed ${users.length} users in ${endTime - startTime}ms`
  );
  yield* Effect.logInfo(
    `First few users: ${JSON.stringify(
      users.slice(0, 3),
      null,
      2
    )}`
  );

  return users;
});

Effect.runPromise(program);
```

## Process a Large File with Constant Memory

**Rule:** Use streaming APIs to process large files without loading
everything into memory.

```ts
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import type { PlatformError } from "@effect/platform/Error";
import { Effect, Stream } from "effect";
import * as path from "node:path";

const processFile = (
  filePath: string,
  content: string
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    yield* fs.writeFileString(filePath, content);

    const fileStream = Stream.fromEffect(
      fs.readFileString(filePath)
    ).pipe(
      Stream.map((text) => text.split("\n")),
      Stream.flatMap(Stream.fromIterable),
      Stream.tap((line) =>
        Effect.log(`Processing: ${line}`)
      )
    );

    yield* Stream.runDrain(fileStream);

    yield* fs.remove(filePath);
  });

const program = Effect.gen(function* () {
  const filePath = path.join(__dirname, "large-file.txt");

  yield* processFile(
    filePath,
    "line 1\nline 2\nline 3"
  ).pipe(
    Effect.catchAll((error: PlatformError) =>
      Effect.logError(
        `Error processing file: ${error.message}`
      )
    )
  );
});

Effect.runPromise(
  program.pipe(Effect.provide(NodeFileSystem.layer))
).catch(console.error);
```

## Process Collections of Data Asynchronously with Stream

**Rule:** Use `Stream` + `Stream.mapEffect` for effectful, concurrent
collection processing.

```ts
import { Effect, Stream, Chunk } from "effect";

const getUserById = (
  id: number
): Effect.Effect<{ id: number; name: string }, Error> =>
  Effect.succeed({ id, name: `User ${id}` }).pipe(
    Effect.delay("100 millis"),
    Effect.tap(() => Effect.log(`Fetched user ${id}`))
  );

const program = Stream.fromIterable([1, 2, 3, 4, 5]).pipe(
  Stream.mapEffect(getUserById, { concurrency: 2 }),
  Stream.runCollect
);

Effect.runPromise(program).then((users) => {
  console.log(
    "All users fetched:",
    Chunk.toArray(users)
  );
});
```

## Process Items Concurrently with Stream

**Rule:** Use `Stream.mapEffect` with a `concurrency` limit to process
items in parallel.

```ts
import { Effect, Stream } from "effect";

const processItem = (
  id: number
): Effect.Effect<string, Error> =>
  Effect.log(`Starting item ${id}...`).pipe(
    Effect.delay("1 second"),
    Effect.map(() => `Finished item ${id}`),
    Effect.tap(Effect.log)
  );

const ids = [1, 2, 3, 4];

const program = Stream.fromIterable(ids).pipe(
  Stream.mapEffect(processItem, { concurrency: 2 }),
  Stream.runDrain
);

const timedProgram = Effect.timed(program);

Effect.runPromise(timedProgram).then(([duration]) => {
  const durationMs = Number(duration);
  console.log(
    `\nTotal time: ${Math.round(durationMs / 1_000)} seconds`
  );
});
```

## Process Items in Batches

**Rule:** Use `Stream.grouped(n)` to batch items before effectful
processing.

```ts
import { Effect, Stream, Chunk } from "effect";

const saveUsersInBulk = (
  userBatch: Chunk.Chunk<{ id: number }>
): Effect.Effect<void, Error> =>
  Effect.log(
    `Saving batch of ${userBatch.length} users: ${Chunk.toArray(
      userBatch
    )
      .map((u) => u.id)
      .join(", ")}`
  );

const userIds = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
}));

const program = Stream.fromIterable(userIds).pipe(
  Stream.grouped(5),
  Stream.mapEffect(saveUsersInBulk, { concurrency: 1 }),
  Stream.runDrain
);

Effect.runPromise(program);
```

## Process Streaming Data with Stream

**Rule:** Use `Stream.paginateEffect` for paginated sources and flatten
into a single stream.

```ts
import { Effect, Stream, Option } from "effect";

interface User {
  id: number;
  name: string;
}

interface PaginatedResponse {
  users: User[];
  nextPage: number | null;
}

const fetchUserPage = (
  page: number
): Effect.Effect<PaginatedResponse, "ApiError"> =>
  Effect.succeed(
    page < 3
      ? {
          users: [
            { id: page * 2 + 1, name: `User ${page * 2 + 1}` },
            { id: page * 2 + 2, name: `User ${page * 2 + 2}` },
          ],
          nextPage: page + 1,
        }
      : { users: [], nextPage: null }
  ).pipe(Effect.delay("50 millis"));

const userStream: Stream.Stream<User, "ApiError"> =
  Stream.paginateEffect(0, (page) =>
    fetchUserPage(page).pipe(
      Effect.map((response) => [
        response.users,
        Option.fromNullable(response.nextPage),
      ] as const)
    )
  ).pipe(
    Stream.flatMap((users) => Stream.fromIterable(users))
  );

const program = Stream.runForEach(userStream, (user: User) =>
  Effect.log(`Processing user: ${user.name}`)
);

Effect.runPromise(program).catch(console.error);
```

## Provide Configuration to Your App via a Layer

**Rule:** Provide configuration services as layers and consume them via
context.

```ts
import { Effect, Layer } from "effect";

class ServerConfig extends Effect.Service<ServerConfig>()(
  "ServerConfig",
  {
    sync: () => ({
      port: process.env.PORT
        ? parseInt(process.env.PORT)
        : 8_080,
    }),
  }
) {}

const program = Effect.gen(function* () {
  const config = yield* ServerConfig;
  yield* Effect.log(
    `Starting application on port ${config.port}...`
  );
});

Effect.runPromise(Effect.provide(program, ServerConfig.Default));
```

## Provide Dependencies to Routes

**Rule:** Use `Effect.Service` + layers to inject dependencies into HTTP
routes.

```ts
import * as HttpRouter from "@effect/platform/HttpRouter";
import * as HttpResponse from "@effect/platform/HttpServerResponse";
import * as HttpServer from "@effect/platform/HttpServer";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Duration, Fiber } from "effect";
import { Data } from "effect";

export class Database extends Effect.Service<Database>()(
  "Database",
  {
    sync: () => ({
      getUser: (id: string) =>
        id === "123"
          ? Effect.succeed({ name: "Paul" })
          : Effect.fail(new UserNotFoundError({ id })),
    }),
  }
) {}

class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  id: string;
}> {}

const userHandler = Effect.flatMap(HttpRouter.params, (p) =>
  Effect.flatMap(Database, (db) => db.getUser(p["userId"] ?? "")).pipe(
    Effect.flatMap(HttpResponse.json)
  )
);

const app = HttpRouter.empty.pipe(
  HttpRouter.get("/users/:userId", userHandler)
);

const serverEffect = HttpServer.serveEffect(app).pipe(
  Effect.provide(Database.Default),
  Effect.provide(
    NodeHttpServer.layer(
      () => require("node:http").createServer(),
      { port: 3_458 }
    )
  )
);

const program = Effect.gen(function* () {
  yield* Effect.logInfo("Starting server on port 3458...");

  const serverFiber = yield* Effect.scoped(
    serverEffect
  ).pipe(Effect.fork);

  yield* Effect.logInfo(
    "Server started successfully on http://localhost:3458"
  );
  yield* Effect.logInfo(
    "Try: curl http://localhost:3458/users/123"
  );
  yield* Effect.logInfo(
    "Try: curl http://localhost:3458/users/456"
  );

  yield* Effect.sleep(Duration.seconds(3));

  yield* Effect.logInfo("Shutting down server...");
  yield* Fiber.interrupt(serverFiber);
  yield* Effect.logInfo("Server shutdown complete");
});

NodeRuntime.runMain(program);
```

## Race Concurrent Effects for the Fastest Result

**Rule:** Use `Effect.race` to get the fastest successful result and
cancel the losers.

```ts
import { Effect, Option } from "effect";

type User = { id: number; name: string };

const checkCache: Effect.Effect<Option.Option<User>> =
  Effect.succeed(Option.none()).pipe(
    Effect.delay("200 millis")
  );

const queryDatabase: Effect.Effect<Option.Option<User>> =
  Effect.succeed(Option.some({ id: 1, name: "Paul" })).pipe(
    Effect.delay("50 millis")
  );

const program = Effect.race(checkCache, queryDatabase).pipe(
  Effect.flatMap((result: Option.Option<User>) =>
    Option.match(result, {
      onNone: () =>
        Effect.fail("User not found anywhere."),
      onSome: (user) => Effect.succeed(user),
    })
  )
);

Effect.runPromise(program)
  .then((user) => {
    console.log("User found:", user);
  })
  .catch((error) => {
    console.log("Error:", error);
  });
```

## Representing Time Spans with Duration

**Rule:** Use `Duration` instead of raw numbers for time intervals.

```ts
import { Effect, Duration } from "effect";

const fiveSeconds = Duration.seconds(5);
const oneHundredMillis = Duration.millis(100);

const program = Effect.log("Starting...").pipe(
  Effect.delay(oneHundredMillis),
  Effect.flatMap(() => Effect.log("Running after 100ms")),
  Effect.timeout(fiveSeconds)
);

const isLonger = Duration.greaterThan(
  fiveSeconds,
  oneHundredMillis
);

const demonstration = Effect.gen(function* () {
  yield* Effect.logInfo("=== Duration Demonstration ===");

  yield* Effect.logInfo(
    `Five seconds: ${Duration.toMillis(fiveSeconds)}ms`
  );
  yield* Effect.logInfo(
    `One hundred millis: ${Duration.toMillis(
      oneHundredMillis
    )}ms`
  );

  yield* Effect.logInfo(
    `Is 5 seconds longer than 100ms? ${isLonger}`
  );

  yield* Effect.logInfo("Running timed program...");
  yield* program;

  const combined = Duration.sum(
    fiveSeconds,
    oneHundredMillis
  );
  yield* Effect.logInfo(
    `Combined duration: ${Duration.toMillis(combined)}ms`
  );

  const oneMinute = Duration.minutes(1);
  yield* Effect.logInfo(
    `One minute: ${Duration.toMillis(oneMinute)}ms`
  );

  const isMinuteLonger = Duration.greaterThan(
    oneMinute,
    fiveSeconds
  );
  yield* Effect.logInfo(
    `Is 1 minute longer than 5 seconds? ${isMinuteLonger}`
  );
});

Effect.runPromise(demonstration);
```

## Retry Operations Based on Specific Errors

**Rule:** Use predicate-based schedules to retry only for specific,
recoverable errors.

```ts
import { Effect, Data, Schedule } from "effect";

class ServerBusyError extends Data.TaggedError("ServerBusyError") {}

class NotFoundError extends Data.TaggedError("NotFoundError") {}

let attemptCount = 0;

const flakyApiCall = Effect.try({
  try: () => {
    attemptCount++;
    const random = Math.random();

    if (attemptCount <= 2) {
      console.log(
        `Attempt ${attemptCount}: API call failed - Server is busy. Retrying...`
      );
      throw new ServerBusyError();
    }

    console.log(
      `Attempt ${attemptCount}: API call succeeded!`
    );
    return { data: "success", attempt: attemptCount };
  },
  catch: (e) => e as ServerBusyError | NotFoundError,
});

const isRetryableError = (
  e: ServerBusyError | NotFoundError
) => e._tag === "ServerBusyError";

const selectiveRetryPolicy = Schedule.recurs(3).pipe(
  Schedule.whileInput(isRetryableError),
  Schedule.addDelay(() => "100 millis")
);

const program = Effect.gen(function* () {
  yield* Effect.logInfo(
    "=== Retry Based on Specific Errors Demo ==="
  );

  const result = yield* flakyApiCall.pipe(
    Effect.retry(selectiveRetryPolicy)
  );
  yield* Effect.logInfo(`Success: ${JSON.stringify(result)}`);
  return result;
}).pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      if (error instanceof NotFoundError) {
        yield* Effect.logInfo(
          "Failed with NotFoundError - not retrying"
        );
      } else if (error instanceof ServerBusyError) {
        yield* Effect.logInfo(
          "Failed with ServerBusyError after all retries"
        );
      } else {
        yield* Effect.logInfo(
          `Failed with unexpected error: ${error}`
        );
      }
      return null;
    })
  )
);

const demonstrateNotFound = Effect.gen(function* () {
  yield* Effect.logInfo(
    "\n=== Demonstrating Non-Retryable Error ==="
  );

  const alwaysNotFound = Effect.fail(new NotFoundError());

  const result = yield* alwaysNotFound.pipe(
    Effect.retry(selectiveRetryPolicy),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logInfo(
          `NotFoundError was not retried: ${error._tag}`
        );
        return null;
      })
    )
  );

  return result;
});

Effect.runPromise(
  program.pipe(Effect.flatMap(() => demonstrateNotFound))
);
```

## Run Independent Effects in Parallel with Effect.all

**Rule:** Use `Effect.all` to execute independent effects concurrently.

```ts
import { Effect } from "effect";

const fetchUser = Effect.succeed({ id: 1, name: "Paul" }).pipe(
  Effect.delay("1 second")
);

const fetchPosts = Effect.succeed([
  { title: "Effect is great" },
]).pipe(Effect.delay("1.5 seconds"));

const program = Effect.all([fetchUser, fetchPosts]);

Effect.runPromise(program).then(console.log);
```

## Supercharge Your Editor with the Effect LSP

**Rule:** Use the Effect LSP for rich type hints and diagnostics.

```ts
import { Effect } from "effect";

class Logger extends Effect.Service<Logger>()(
  "Logger",
  {
    sync: () => ({
      log: (msg: string) =>
        Effect.sync(() => console.log(`LOG: ${msg}`)),
    }),
  }
) {}

const program = Effect.succeed(42).pipe(
  Effect.map((n) => n.toString()),
  Effect.flatMap((s) => Effect.log(s)),
  Effect.provide(Logger.Default)
);

Effect.runPromise(program);
// Hovering `program` with Effect LSP installed might show:
// program: Effect<void, never, never>
```

## Trace Operations Across Services with Spans

**Rule:** Use `Effect.withSpan` to create tracing spans across logical
operations.

```ts
import { Effect, Duration } from "effect";

const validateInput = (input: unknown) =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Starting input validation...");
    yield* Effect.sleep(Duration.millis(10));
    const result = { email: "paul@example.com" };
    yield* Effect.logInfo(
      `✅ Input validated: ${result.email}`
    );
    return result;
  }).pipe(Effect.withSpan("validateInput"));

const saveToDatabase = (user: { email: string }) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(
      `Saving user to database: ${user.email}`
    );
    yield* Effect.sleep(Duration.millis(50));
    const result = { id: 123, ...user };
    yield* Effect.logInfo(
      `✅ User saved with ID: ${result.id}`
    );
    return result;
  }).pipe(
    Effect.withSpan("saveToDatabase", {
      attributes: {
        "db.system": "postgresql",
        "db.user.email": user.email,
      },
    })
  );

const createUser = (input: unknown) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(
      "=== Creating User with Tracing ==="
    );
    yield* Effect.logInfo(
      "This demonstrates how spans trace operations through the call stack"
    );

    const validated = yield* validateInput(input);
    const user = yield* saveToDatabase(validated);

    yield* Effect.logInfo(
      `✅ User creation completed: ${JSON.stringify(user)}`
    );
    yield* Effect.logInfo(
      "Note: In production, spans would be sent to a tracing system like Jaeger or Zipkin"
    );

    return user;
  }).pipe(Effect.withSpan("createUserOperation"));

const program = Effect.gen(function* () {
  yield* Effect.logInfo(
    "=== Trace Operations with Spans Demo ==="
  );

  const user1 = yield* createUser({
    email: "user1@example.com",
  });

  yield* Effect.logInfo("\n--- Creating second user ---");
  const user2 = yield* createUser({
    email: "user2@example.com",
  });

  yield* Effect.logInfo("\n=== Summary ===");
  yield* Effect.logInfo(
    "Created users with tracing spans:"
  );
  yield* Effect.logInfo(
    `User 1: ID ${user1.id}, Email: ${user1.email}`
  );
  yield* Effect.logInfo(
    `User 2: ID ${user2.id}, Email: ${user2.email}`
  );
});

Effect.runPromise(program);
```

## Transform Data During Validation with Schema

**Rule:** Use `Schema.transform` / `transformOrFail` to change types
while validating.

```ts
import { Schema, Effect, Brand, Either } from "effect";

type RawEvent = {
  name: string;
  timestamp: string;
};

type ParsedEvent = {
  name: string;
  timestamp: Date;
};

const ApiEventSchema = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.String,
});

const rawInput: RawEvent = {
  name: "User Login",
  timestamp: "2025-06-22T20:08:42.000Z",
};

const program = Effect.gen(function* () {
  const parsed = yield* Schema.decode(ApiEventSchema)(
    rawInput
  );
  return {
    name: parsed.name,
    timestamp: new Date(parsed.timestamp),
  } as ParsedEvent;
});

Effect.runPromise(program).then(
  (event) => {
    console.log("Event year:", event.timestamp.getFullYear());
    console.log("Full event:", event);
  },
  (error) => {
    console.error("Failed to parse event:", error);
  }
);

// Branded email example

type Email = string & Brand.Brand<"Email">;

const Email = Schema.string.pipe(
  Schema.transformOrFail(
    Schema.brand<Email>("Email"),
    (s, _, ast) =>
      s.includes("@")
        ? Either.right(s as Email)
        : Either.left(
            Schema.ParseError.create(
              ast,
              "Invalid email format"
            )
          ),
    (email) => Either.right(email)
  )
);

const result = Schema.decode(Email)(
  "paul@example.com"
);
const errorResult = Schema.decode(Email)(
  "invalid-email"
);
```

## Turn a Paginated API into a Single Stream

**Rule:** Use `Stream.paginateEffect` to model paginated APIs as a
single stream.

```ts
import { Effect, Stream, Chunk, Option } from "effect";

interface User {
  id: number;
  name: string;
}

interface PaginatedResponse {
  users: User[];
  nextPage: number | null;
}

class FetchError {
  readonly _tag = "FetchError" as const;
  constructor(readonly message: string) {}
}

const fetchError = (message: string): FetchError =>
  new FetchError(message);

const allUsers: User[] = Array.from({ length: 25 }, (
  _,
  i
) => ({
  id: i + 1,
  name: `User ${i + 1}`,
}));

const fetchUsersPage = (
  page: number
): Effect.Effect<
  [Chunk.Chunk<User>, Option.Option<number>],
  FetchError
> =>
  Effect.gen(function* () {
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    if (page < 1) {
      return yield* Effect.fail(
        fetchError("Invalid page number")
      );
    }

    const users = Chunk.fromIterable(
      allUsers.slice(offset, offset + pageSize)
    );

    const nextPage =
      Chunk.isNonEmpty(users) &&
      allUsers.length > offset + pageSize
        ? Option.some(page + 1)
        : Option.none();

    yield* Effect.log(`Fetched page ${page}`);
    return [users, nextPage];
  });

const userStream = Stream.paginateEffect(1, fetchUsersPage);

const program = userStream.pipe(
  Stream.runCollect,
  Effect.map((users) => users.length),
  Effect.tap((totalUsers) =>
    Effect.log(`Total users fetched: ${totalUsers}`)
  ),
  Effect.catchTag("FetchError", (error) =>
    Effect.succeed(
      `Error fetching users: ${error.message}`
    )
  )
);

Effect.runPromise(program).then(console.log);
```

## Understand Layers for Dependency Injection

**Rule:** Think of a `Layer<R, E, A>` as a blueprint to build service
`A` from requirements `R`.

```ts
import { Effect } from "effect";

export class Logger extends Effect.Service<Logger>()(
  "Logger",
  {
    sync: () => ({
      log: (msg: string) =>
        Effect.sync(() => console.log(`LOG: ${msg}`)),
    }),
  }
) {}

export class Notifier extends Effect.Service<Notifier>()(
  "Notifier",
  {
    effect: Effect.gen(function* () {
      const logger = yield* Logger;
      return {
        notify: (msg: string) => logger.log(`Notifying: ${msg}`),
      };
    }),
    dependencies: [Logger.Default],
  }
) {}

const program = Effect.gen(function* () {
  const notifier = yield* Notifier;
  yield* notifier.notify("Hello, World!");
});

Effect.runPromise(Effect.provide(program, Notifier.Default));
```

## Use Chunk for High-Performance Collections

**Rule:** Prefer `Chunk` over `Array` for immutable collection
operations in performance-sensitive code.

```ts
import { Chunk } from "effect";

let numbers = Chunk.fromIterable([1, 2, 3, 4, 5]);

numbers = Chunk.append(numbers, 6);

numbers = Chunk.prepend(numbers, 0);

const firstThree = Chunk.take(numbers, 3);

const finalArray = Chunk.toReadonlyArray(firstThree);

console.log(finalArray);
```

## Use Effect.gen for Business Logic

**Rule:** Use `Effect.gen` to keep business logic readable while fully
composable.

```ts
import { Effect } from "effect";

const validateUser = (
  data: any
): Effect.Effect<{
  email: string;
  password: string;
}, Error> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(
      `Validating user data: ${JSON.stringify(data)}`
    );

    if (!data.email || !data.password) {
      return yield* Effect.fail(
        new Error("Email and password are required")
      );
    }

    if (data.password.length < 6) {
      return yield* Effect.fail(
        new Error(
          "Password must be at least 6 characters"
        )
      );
    }

    yield* Effect.logInfo(
      "✅ User data validated successfully"
    );
    return { email: data.email, password: data.password };
  });

const hashPassword = (
  pw: string
): Effect.Effect<string> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Hashing password...");
    const hashed = `hashed_${pw}_${Date.now()}`;
    yield* Effect.logInfo("✅ Password hashed successfully");
    return hashed;
  });

const dbCreateUser = (
  data: {
    email: string;
    password: string;
  }
): Effect.Effect<{
  id: number;
  email: string;
}> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(
      `Creating user in database: ${data.email}`
    );
    const user = {
      id: Math.floor(Math.random() * 1_000),
      email: data.email,
    };
    yield* Effect.logInfo(
      `✅ User created with ID: ${user.id}`
    );
    return user;
  });

const createUser = (
  userData: any
): Effect.Effect<{
  id: number;
  email: string;
}, Error> =>
  Effect.gen(function* () {
    const validated = yield* validateUser(userData);
    const hashed = yield* hashPassword(validated.password);
    return yield* dbCreateUser({
      ...validated,
      password: hashed,
    });
  });

const program = Effect.gen(function* () {
  yield* Effect.logInfo(
    "=== Using Effect.gen for Business Logic Demo ==="
  );

  yield* Effect.logInfo(
    "\n1. Creating a valid user:"
  );
  const validUser = yield* createUser({
    email: "paul@example.com",
    password: "securepassword123",
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(
          `Failed to create user: ${error.message}`
        );
        return { id: -1, email: "error" };
      })
    )
  );
  yield* Effect.logInfo(
    `Created user: ${JSON.stringify(validUser)}`
  );

  yield* Effect.logInfo(
    "\n2. Attempting to create user with invalid data:"
  );
  const invalidUser = yield* createUser({
    email: "invalid@example.com",
    password: "123",
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(
          `Failed to create user: ${error.message}`
        );
        return { id: -1, email: "error" };
      })
    )
  );
  yield* Effect.logInfo(
    `Result: ${JSON.stringify(invalidUser)}`
  );

  yield* Effect.logInfo(
    "\n✅ Business logic demonstration completed!"
  );
});

Effect.runPromise(program);
```

## Use the Auto-Generated .Default Layer in Tests

**Rule:** Use the `.Default` layer generated by `Effect.Service` in
programs and tests.

```ts
import { Effect } from "effect";

class MyService extends Effect.Service<MyService>()(
  "MyService",
  {
    sync: () => ({
      doSomething: () =>
        Effect.succeed("done").pipe(
          Effect.tap(() =>
            Effect.log("MyService did something!")
          )
        ),
    }),
  }
) {}

const program = Effect.gen(function* () {
  yield* Effect.log("Getting MyService...");
  const service = yield* MyService;

  yield* Effect.log("Calling doSomething()...");
  const result = yield* service.doSomething();

  yield* Effect.log(`Result: ${result}`);
});

Effect.runPromise(Effect.provide(program, MyService.Default));
```

## Validate Request Body

**Rule:** Use schema-based validation for HTTP request bodies before
business logic.

```ts
import { Duration, Effect } from "effect";
import * as S from "effect/Schema";
import {
  createServer,
  IncomingMessage,
  ServerResponse,
} from "http";

const UserSchema = S.Struct({
  name: S.String,
  email: S.String.pipe(
    S.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  ),
});

type User = S.Schema.Type<typeof UserSchema>;

interface UserServiceInterface {
  readonly validateUser: (
    data: unknown
  ) => Effect.Effect<User, Error>;
}

class UserService extends Effect.Service<UserService>()(
  "UserService",
  {
    sync: () => ({
      validateUser: (data: unknown) =>
        S.decodeUnknown(UserSchema)(data),
    }),
  }
) {}

interface HttpServerInterface {
  readonly handleRequest: (
    request: IncomingMessage,
    response: ServerResponse
  ) => Effect.Effect<void, Error>;
  readonly start: () => Effect.Effect<void, Error>;
}

class HttpServer extends Effect.Service<HttpServer>()(
  "HttpServer",
  {
    effect: Effect.gen(function* () {
      const userService = yield* UserService;

      return {
        handleRequest: (
          request: IncomingMessage,
          response: ServerResponse
        ) =>
          Effect.gen(function* () {
            if (
              request.method !== "POST" ||
              request.url !== "/users"
            ) {
              response.writeHead(404, {
                "Content-Type": "application/json",
              });
              response.end(
                JSON.stringify({ error: "Not Found" })
              );
              return;
            }

            try {
              const body = yield* Effect.async<
                unknown,
                Error
              >((resume) => {
                let data = "";
                request.on("data", (chunk) => {
                  data += chunk;
                });
                request.on("end", () => {
                  try {
                    resume(
                      Effect.succeed(
                        JSON.parse(data)
                      )
                    );
                  } catch (e) {
                    resume(
                      Effect.fail(
                        e instanceof Error
                          ? e
                          : new Error(String(e))
                      )
                    );
                  }
                });
                request.on("error", (e) =>
                  resume(
                    Effect.fail(
                      e instanceof Error
                        ? e
                        : new Error(String(e))
                    )
                  )
                );
              });

              const user = yield* userService.validateUser(
                body
              );

              response.writeHead(200, {
                "Content-Type": "application/json",
              });
              response.end(
                JSON.stringify({
                  message: `Successfully created user: ${user.name}`,
                })
              );
            } catch (error) {
              response.writeHead(400, {
                "Content-Type": "application/json",
              });
              response.end(
                JSON.stringify({ error: String(error) })
              );
            }
          }),

        start: function (this: HttpServer) {
          const self = this;
          return Effect.gen(function* () {
            const server = createServer((req, res) =>
              Effect.runFork(self.handleRequest(req, res))
            );

            yield* Effect.addFinalizer(() =>
              Effect.gen(function* () {
                yield* Effect.sync(() => server.close());
                yield* Effect.logInfo("Server shut down");
              })
            );

            yield* Effect.async<void, Error>((resume) => {
              server.on("error", (error) =>
                resume(Effect.fail(error))
              );
              server.listen(3_456, () => {
                Effect.runFork(
                  Effect.logInfo(
                    "Server running at http://localhost:3456/"
                  )
                );
                resume(Effect.succeed(void 0));
              });
            });

            yield* Effect.sleep(Duration.seconds(3));
            yield* Effect.logInfo(
              "Demo completed - shutting down server"
            );
          });
        },
      };
    }),
    dependencies: [UserService.Default],
  }
) {}

const program = Effect.gen(function* () {
  const server = yield* HttpServer;

  yield* Effect.logInfo("Starting HTTP server...");

  yield* server.start().pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(
          `Server error: ${error}`
        );
        return yield* Effect.fail(error);
      })
    )
  );
}).pipe(Effect.scoped);

Effect.runFork(
  Effect.provide(program, HttpServer.Default)
);
```

## Write Tests That Adapt to Application Code

**Rule:** Keep tests aligned with your real service interfaces instead
of forcing interface changes for testability.

```ts
import { Effect } from "effect";

interface User {
  id: number;
  name: string;
}

class NotFoundError extends Error {
  readonly _tag = "NotFoundError";
  constructor(readonly id: number) {
    super(`User ${id} not found`);
  }
}

interface DatabaseServiceApi {
  getUserById: (
    id: number
  ) => Effect.Effect<User, NotFoundError>;
}

class DatabaseService extends Effect.Service<DatabaseService>()(
  "DatabaseService",
  {
    sync: () => ({
      getUserById: (id: number) => {
        if (id === 404) {
          return Effect.fail(new NotFoundError(id));
        }
        return Effect.succeed({ id, name: `User ${id}` });
      },
    }),
  }
) {}

class TestDatabaseService extends Effect.Service<
  TestDatabaseService
>()("TestDatabaseService", {
  sync: () => ({
    getUserById: (id: number) => {
      const testUsers = [
        { id: 1, name: "Test User 1" },
        { id: 2, name: "Test User 2" },
        { id: 123, name: "User 123" },
      ];

      const user = testUsers.find((u) => u.id === id);
      if (user) {
        return Effect.succeed(user);
      }
      return Effect.fail(new NotFoundError(id));
    },
  }),
}) {}

const getUserWithFallback = (id: number) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService;
    return yield* Effect.gen(function* () {
      const user = yield* db.getUserById(id);
      return user;
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          if (error instanceof NotFoundError) {
            yield* Effect.logInfo(
              `User ${id} not found, using fallback`
            );
            return { id, name: `Fallback User ${id}` };
          }
          return yield* Effect.fail(error);
        })
      )
    );
  });

const program = Effect.gen(function* () {
  yield* Effect.logInfo(
    "=== Writing Tests that Adapt to Application Code Demo ==="
  );

  const db = yield* DatabaseService;

  yield* Effect.logInfo(
    "\n1. Looking up existing user 123..."
  );
  const user = yield* Effect.gen(function* () {
    try {
      return yield* db.getUserById(123);
    } catch (error) {
      yield* Effect.logError(
        `Failed to get user: ${
          error instanceof Error
            ? error.message
            : "Unknown error"
        }`
      );
      return { id: -1, name: "Error" };
    }
  });
  yield* Effect.logInfo(
    `Found user: ${JSON.stringify(user)}`
  );

  yield* Effect.logInfo(
    "\n2. Looking up non-existent user 404..."
  );
  const notFoundUser = yield* Effect.gen(function* () {
    try {
      return yield* db.getUserById(404);
    } catch (error) {
      if (error instanceof NotFoundError) {
        yield* Effect.logInfo(
          `✅ Properly handled NotFoundError: ${
            error.message
          }`
        );
        return { id: 404, name: "Not Found" };
      }
      yield* Effect.logError(
        `Unexpected error: ${
          error instanceof Error
            ? error.message
            : "Unknown error"
        }`
      );
      return { id: -1, name: "Error" };
    }
  });
  yield* Effect.logInfo(
    `Result: ${JSON.stringify(notFoundUser)}`
  );

  yield* Effect.logInfo(
    "\n3. Business logic with fallback for missing user:"
  );
  const userWithFallback = yield* getUserWithFallback(999);
  yield* Effect.logInfo(
    `User with fallback: ${JSON.stringify(
      userWithFallback
    )}`
  );

  yield* Effect.logInfo(
    "\n4. Testing with test service implementation:"
  );
  yield* Effect.provide(
    Effect.gen(function* () {
      const testDb = yield* TestDatabaseService;

      const testUser1 = yield* Effect.gen(function* () {
        try {
          return yield* testDb.getUserById(1);
        } catch (error) {
          yield* Effect.logError(
            `Test failed: ${
              error instanceof Error
                ? error.message
                : "Unknown error"
            }`
          );
          return { id: -1, name: "Test Error" };
        }
      });
      yield* Effect.logInfo(
        `Test user 1: ${JSON.stringify(testUser1)}`
      );

      const testUser404 = yield* Effect.gen(function* () {
        try {
          return yield* testDb.getUserById(404);
        } catch (error) {
          yield* Effect.logInfo(
            `✅ Test service properly threw NotFoundError: ${
              error instanceof Error
                ? error.message
                : "Unknown error"
            }`
          );
          return { id: 404, name: "Test Not Found" };
        }
      });
      yield* Effect.logInfo(
        `Test result: ${JSON.stringify(testUser404)}`
      );
    }),
    TestDatabaseService.Default
  );

  yield* Effect.logInfo(
    "\n✅ Tests that adapt to application code demonstration completed!"
  );
  yield* Effect.logInfo(
    "The same business logic works with different service implementations!"
  );
});

Effect.runPromise(
  Effect.provide(
    program,
    DatabaseService.Default
  ) as Effect.Effect<void, never>
);
```
