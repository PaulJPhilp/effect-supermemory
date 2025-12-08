/**
 * Ingest Service Tests
 *
 * @since 1.0.0
 * @module Ingest
 */

import { describe, expect, it } from "vitest";
import { IngestService, IngestServiceLive } from "../service.js";

describe("IngestService", () => {
  it("should be properly defined as an Effect.Service", () => {
    expect(IngestService).toBeDefined();
  });

  it("should export IngestServiceLive layer", () => {
    expect(IngestServiceLive).toBeDefined();
  });

  it("should have the correct service tag", () => {
    expect(IngestService.key).toBe("@effect-supermemory/Ingest");
  });
});
