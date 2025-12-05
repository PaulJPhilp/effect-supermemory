/**
 * SupermemoryHttpClient Service Tests
 *
 * @since 1.0.0
 * @module Client
 */

import { describe, expect, it } from "vitest";
import { SupermemoryHttpClientService } from "../service.js";

describe("SupermemoryHttpClientService", () => {
  it("should be properly defined as an Effect.Service", () => {
    expect(SupermemoryHttpClientService).toBeDefined();
  });
});
