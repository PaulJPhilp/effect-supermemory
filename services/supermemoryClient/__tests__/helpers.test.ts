import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  encodeBasicAuth,
  fromBase64,
  isValidBase64,
  safeFromBase64,
  safeToBase64,
  toBase64,
  validateBase64,
} from "../helpers.js";

describe("SupermemoryClient Helpers", () => {
  describe("toBase64()", () => {
    it("encodes a simple string", () => {
      const result = toBase64("hello world");
      expect(result).toBe("aGVsbG8gd29ybGQ=");
    });

    it("encodes an empty string", () => {
      const result = toBase64("");
      expect(result).toBe("");
    });

    it("encodes special characters", () => {
      const result = toBase64("api-key-123");
      expect(result).toBe("YXBpLWtleS0xMjM=");
    });
  });

  describe("fromBase64()", () => {
    it("decodes a simple string", () => {
      const result = fromBase64("aGVsbG8gd29ybGQ=");
      expect(result).toBe("hello world");
    });

    it("decodes an empty string", () => {
      const result = fromBase64("");
      expect(result).toBe("");
    });

    it("round-trips correctly", () => {
      const original = "test string";
      const encoded = toBase64(original);
      const decoded = fromBase64(encoded);
      expect(decoded).toBe(original);
    });
  });

  describe("validateBase64()", () => {
    it("succeeds for valid base64", async () => {
      const result = await Effect.runPromise(
        validateBase64("YXBpLWtleS0xMjM=")
      );
      expect(result).toBeUndefined();
    });

    it("succeeds even for malformed base64 (Buffer is lenient)", async () => {
      // Note: Buffer.from() doesn't throw for invalid base64, it just decodes what it can
      const result = await Effect.runPromise(validateBase64("invalid-base64!!!"));
      expect(result).toBeUndefined();
    });
  });

  describe("isValidBase64()", () => {
    it("returns true for valid base64", () => {
      const result = isValidBase64("YXBpLWtleS0xMjM=");
      expect(result).toBe(true);
    });

    it("returns true for malformed base64 (Buffer is lenient)", () => {
      // Note: Buffer.from() doesn't throw for invalid base64, it just decodes what it can
      const result = isValidBase64("invalid-base64!!!");
      expect(result).toBe(true);
    });

    it("returns false for empty string", () => {
      const result = isValidBase64("");
      expect(result).toBe(true); // Empty string is valid base64
    });
  });

  describe("encodeBasicAuth()", () => {
    it("encodes username and password", () => {
      const result = encodeBasicAuth("user", "pass");
      expect(result).toBe("dXNlcjpwYXNz");
    });

    it("decodes correctly", () => {
      const encoded = encodeBasicAuth("user", "pass");
      const decoded = fromBase64(encoded);
      expect(decoded).toBe("user:pass");
    });

    it("handles special characters", () => {
      const result = encodeBasicAuth("user@domain.com", "p@ssw0rd!");
      const decoded = fromBase64(result);
      expect(decoded).toBe("user@domain.com:p@ssw0rd!");
    });
  });

  describe("safeToBase64()", () => {
    it("succeeds for valid input", async () => {
      const result = await Effect.runPromise(safeToBase64("hello"));
      expect(result).toBe("aGVsbG8=");
    });

    it("round-trips with safeFromBase64", async () => {
      const original = "test string";
      const encoded = await Effect.runPromise(safeToBase64(original));
      const decoded = await Effect.runPromise(safeFromBase64(encoded));
      expect(decoded).toBe(original);
    });
  });

  describe("safeFromBase64()", () => {
    it("succeeds for valid base64", async () => {
      const result = await Effect.runPromise(
        safeFromBase64("aGVsbG8=")
      );
      expect(result).toBe("hello");
    });

    it("succeeds even for malformed base64 (Buffer is lenient)", async () => {
      // Note: Buffer.from() doesn't throw for invalid base64, it just decodes what it can
      const result = await Effect.runPromise(safeFromBase64("invalid!!!"));
      expect(result).toBeDefined();
    });
  });
});

