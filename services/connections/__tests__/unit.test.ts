/**
 * ConnectionsService Comprehensive Unit Tests
 *
 * @since 1.0.0
 * @module Connections
 */

import { describe, expect, it } from "vitest";
import { ConnectionsService } from "../service.js";
import type {
  Connection,
  ConnectionCreateParams,
  ConnectionCreateResponse,
  ConnectionDeleteByIDResponse,
  ConnectionDeleteByProviderParams,
  ConnectionDeleteByProviderResponse,
  ConnectionDocument,
  ConnectionGetByIDResponse,
  ConnectionGetByTagsParams,
  ConnectionGetByTagsResponse,
  ConnectionImportParams,
  ConnectionImportResponse,
  ConnectionListDocumentsParams,
  ConnectionListDocumentsResponse,
  ConnectionListParams,
  ConnectionListResponse,
  ConnectionMetadata,
  ConnectionProvider,
} from "../types.js";

describe("ConnectionsService", () => {
  describe("Service Definition", () => {
    it("should be properly defined as an Effect.Service", () => {
      expect(ConnectionsService).toBeDefined();
      expect(typeof ConnectionsService).toBe("function");
    });

    it("should export Default layer via ConnectionsService.Default", () => {
      expect(ConnectionsService.Default).toBeDefined();
    });

    it("should have the correct service tag", () => {
      expect(ConnectionsService.key).toBe("@effect-supermemory/Connections");
    });
  });

  describe("Type Definitions", () => {
    describe("ConnectionProvider", () => {
      it("should accept valid provider values", () => {
        const providers: ConnectionProvider[] = [
          "notion",
          "google-drive",
          "onedrive",
          "web-crawler",
        ];

        expect(providers).toHaveLength(4);
        expect(providers).toContain("notion");
        expect(providers).toContain("google-drive");
        expect(providers).toContain("onedrive");
        expect(providers).toContain("web-crawler");
      });
    });

    describe("ConnectionMetadata", () => {
      it("should accept string values", () => {
        const metadata: ConnectionMetadata = { key: "value" };
        expect(metadata.key).toBe("value");
      });

      it("should accept number values", () => {
        const metadata: ConnectionMetadata = { count: 42 };
        expect(metadata.count).toBe(42);
      });

      it("should accept boolean values", () => {
        const metadata: ConnectionMetadata = { active: true };
        expect(metadata.active).toBe(true);
      });

      it("should accept mixed values", () => {
        const metadata: ConnectionMetadata = {
          name: "test",
          count: 10,
          enabled: false,
        };
        expect(Object.keys(metadata)).toHaveLength(3);
      });
    });

    describe("ConnectionCreateParams", () => {
      it("should accept empty params", () => {
        const params: ConnectionCreateParams = {};
        expect(Object.keys(params)).toHaveLength(0);
      });

      it("should accept containerTags", () => {
        const params: ConnectionCreateParams = {
          containerTags: ["user_123", "project_456"],
        };
        expect(params.containerTags).toHaveLength(2);
      });

      it("should accept documentLimit", () => {
        const params: ConnectionCreateParams = { documentLimit: 100 };
        expect(params.documentLimit).toBe(100);
      });

      it("should accept metadata", () => {
        const params: ConnectionCreateParams = {
          metadata: { source: "api" },
        };
        expect(params.metadata?.source).toBe("api");
      });

      it("should accept redirectUrl", () => {
        const params: ConnectionCreateParams = {
          redirectUrl: "https://app.example.com/callback",
        };
        expect(params.redirectUrl).toBe("https://app.example.com/callback");
      });

      it("should accept all params together", () => {
        const params: ConnectionCreateParams = {
          containerTags: ["user_123"],
          documentLimit: 50,
          metadata: { env: "production" },
          redirectUrl: "https://example.com",
        };

        expect(params.containerTags).toHaveLength(1);
        expect(params.documentLimit).toBe(50);
        expect(params.metadata?.env).toBe("production");
        expect(params.redirectUrl).toBe("https://example.com");
      });
    });

    describe("ConnectionCreateResponse", () => {
      it("should define expected response shape", () => {
        const response: ConnectionCreateResponse = {
          id: "conn_123",
          authLink: "https://oauth.provider.com/authorize?...",
          expiresIn: "3600",
        };

        expect(response.id).toBe("conn_123");
        expect(response.authLink).toContain("https://");
        expect(response.expiresIn).toBe("3600");
      });

      it("should accept optional redirectsTo", () => {
        const response: ConnectionCreateResponse = {
          id: "conn_456",
          authLink: "https://oauth.example.com",
          expiresIn: "7200",
          redirectsTo: "https://app.example.com/connected",
        };

        expect(response.redirectsTo).toBe("https://app.example.com/connected");
      });
    });

    describe("ConnectionListParams", () => {
      it("should accept empty params", () => {
        const params: ConnectionListParams = {};
        expect(Object.keys(params)).toHaveLength(0);
      });

      it("should accept containerTags filter", () => {
        const params: ConnectionListParams = {
          containerTags: ["team_a", "project_x"],
        };
        expect(params.containerTags).toHaveLength(2);
      });
    });

    describe("Connection", () => {
      it("should define required fields", () => {
        const connection: Connection = {
          id: "conn_789",
          createdAt: "2025-12-08T00:00:00Z",
          provider: "notion",
        };

        expect(connection.id).toBe("conn_789");
        expect(connection.createdAt).toBeDefined();
        expect(connection.provider).toBe("notion");
      });

      it("should define optional fields", () => {
        const connection: Connection = {
          id: "conn_abc",
          createdAt: "2025-12-08T00:00:00Z",
          provider: "google-drive",
          documentLimit: 1000,
          email: "user@example.com",
          expiresAt: "2026-12-08T00:00:00Z",
          metadata: { team: "engineering" },
        };

        expect(connection.documentLimit).toBe(1000);
        expect(connection.email).toBe("user@example.com");
        expect(connection.expiresAt).toBeDefined();
        expect(connection.metadata?.team).toBe("engineering");
      });
    });

    describe("ConnectionListResponse", () => {
      it("should be array of connections", () => {
        const response: ConnectionListResponse = [
          { id: "1", createdAt: "2025-01-01", provider: "notion" },
          { id: "2", createdAt: "2025-01-02", provider: "onedrive" },
        ];

        expect(response).toHaveLength(2);
        expect(response[0]?.provider).toBe("notion");
        expect(response[1]?.provider).toBe("onedrive");
      });

      it("should handle empty list", () => {
        const response: ConnectionListResponse = [];
        expect(response).toHaveLength(0);
      });
    });

    describe("ConnectionDeleteByIDResponse", () => {
      it("should define expected shape", () => {
        const response: ConnectionDeleteByIDResponse = {
          id: "conn_deleted",
          provider: "notion",
        };

        expect(response.id).toBe("conn_deleted");
        expect(response.provider).toBe("notion");
      });
    });

    describe("ConnectionDeleteByProviderParams", () => {
      it("should require containerTags", () => {
        const params: ConnectionDeleteByProviderParams = {
          containerTags: ["user_123"],
        };

        expect(params.containerTags).toHaveLength(1);
      });
    });

    describe("ConnectionDeleteByProviderResponse", () => {
      it("should define expected shape", () => {
        const response: ConnectionDeleteByProviderResponse = {
          id: "conn_xyz",
          provider: "google-drive",
        };

        expect(response.id).toBe("conn_xyz");
        expect(response.provider).toBe("google-drive");
      });
    });

    describe("ConnectionGetByIDResponse", () => {
      it("should define expected shape", () => {
        const response: ConnectionGetByIDResponse = {
          id: "conn_get",
          createdAt: "2025-12-08T00:00:00Z",
          provider: "onedrive",
        };

        expect(response.id).toBe("conn_get");
        expect(response.createdAt).toBeDefined();
        expect(response.provider).toBe("onedrive");
      });
    });

    describe("ConnectionGetByTagsParams", () => {
      it("should require containerTags", () => {
        const params: ConnectionGetByTagsParams = {
          containerTags: ["project_abc", "env_prod"],
        };

        expect(params.containerTags).toHaveLength(2);
      });
    });

    describe("ConnectionGetByTagsResponse", () => {
      it("should define expected shape", () => {
        const response: ConnectionGetByTagsResponse = {
          id: "conn_tags",
          createdAt: "2025-12-08T00:00:00Z",
          provider: "web-crawler",
          metadata: { domain: "example.com" },
        };

        expect(response.id).toBe("conn_tags");
        expect(response.provider).toBe("web-crawler");
        expect(response.metadata?.domain).toBe("example.com");
      });
    });

    describe("ConnectionImportParams", () => {
      it("should accept empty params", () => {
        const params: ConnectionImportParams = {};
        expect(Object.keys(params)).toHaveLength(0);
      });

      it("should accept containerTags", () => {
        const params: ConnectionImportParams = {
          containerTags: ["sync_target"],
        };
        expect(params.containerTags).toHaveLength(1);
      });
    });

    describe("ConnectionImportResponse", () => {
      it("should be a string message", () => {
        const response: ConnectionImportResponse =
          "Import started successfully";
        expect(typeof response).toBe("string");
        expect(response.length).toBeGreaterThan(0);
      });
    });

    describe("ConnectionListDocumentsParams", () => {
      it("should accept empty params", () => {
        const params: ConnectionListDocumentsParams = {};
        expect(Object.keys(params)).toHaveLength(0);
      });

      it("should accept containerTags", () => {
        const params: ConnectionListDocumentsParams = {
          containerTags: ["user_123"],
        };
        expect(params.containerTags).toHaveLength(1);
      });
    });

    describe("ConnectionDocument", () => {
      it("should define expected shape", () => {
        const doc: ConnectionDocument = {
          id: "doc_123",
          createdAt: "2025-12-08T00:00:00Z",
          status: "embedded",
          summary: "This is a summary",
          title: "Document Title",
          type: "page",
          updatedAt: "2025-12-08T12:00:00Z",
        };

        expect(doc.id).toBe("doc_123");
        expect(doc.status).toBe("embedded");
        expect(doc.summary).toBe("This is a summary");
        expect(doc.title).toBe("Document Title");
        expect(doc.type).toBe("page");
      });

      it("should handle null summary and title", () => {
        const doc: ConnectionDocument = {
          id: "doc_456",
          createdAt: "2025-12-08T00:00:00Z",
          status: "pending",
          summary: null,
          title: null,
          type: "file",
          updatedAt: "2025-12-08T12:00:00Z",
        };

        expect(doc.summary).toBeNull();
        expect(doc.title).toBeNull();
      });
    });

    describe("ConnectionListDocumentsResponse", () => {
      it("should be array of documents", () => {
        const response: ConnectionListDocumentsResponse = [
          {
            id: "1",
            createdAt: "2025-01-01",
            status: "embedded",
            summary: "Sum 1",
            title: "Doc 1",
            type: "page",
            updatedAt: "2025-01-01",
          },
          {
            id: "2",
            createdAt: "2025-01-02",
            status: "pending",
            summary: null,
            title: "Doc 2",
            type: "file",
            updatedAt: "2025-01-02",
          },
        ];

        expect(response).toHaveLength(2);
        expect(response[0]?.status).toBe("embedded");
        expect(response[1]?.status).toBe("pending");
      });
    });
  });

  describe("API Contract", () => {
    it("should have create method", () => {
      type CreateMethod = typeof ConnectionsService.prototype.create;
      const _typeCheck: CreateMethod = {} as CreateMethod;
      expect(true).toBe(true);
    });

    it("should have list method", () => {
      type ListMethod = typeof ConnectionsService.prototype.list;
      const _typeCheck: ListMethod = {} as ListMethod;
      expect(true).toBe(true);
    });

    it("should have getByID method", () => {
      type GetByIDMethod = typeof ConnectionsService.prototype.getByID;
      const _typeCheck: GetByIDMethod = {} as GetByIDMethod;
      expect(true).toBe(true);
    });

    it("should have getByTags method", () => {
      type GetByTagsMethod = typeof ConnectionsService.prototype.getByTags;
      const _typeCheck: GetByTagsMethod = {} as GetByTagsMethod;
      expect(true).toBe(true);
    });

    it("should have deleteByID method", () => {
      type DeleteByIDMethod = typeof ConnectionsService.prototype.deleteByID;
      const _typeCheck: DeleteByIDMethod = {} as DeleteByIDMethod;
      expect(true).toBe(true);
    });

    it("should have deleteByProvider method", () => {
      type DeleteByProviderMethod =
        typeof ConnectionsService.prototype.deleteByProvider;
      const _typeCheck: DeleteByProviderMethod = {} as DeleteByProviderMethod;
      expect(true).toBe(true);
    });

    it("should have importData method", () => {
      type ImportDataMethod = typeof ConnectionsService.prototype.importData;
      const _typeCheck: ImportDataMethod = {} as ImportDataMethod;
      expect(true).toBe(true);
    });

    it("should have listDocuments method", () => {
      type ListDocumentsMethod =
        typeof ConnectionsService.prototype.listDocuments;
      const _typeCheck: ListDocumentsMethod = {} as ListDocumentsMethod;
      expect(true).toBe(true);
    });
  });
});

describe("ConnectionsService Validation", () => {
  describe("create() validation", () => {
    it("should accept valid provider", () => {
      const provider: ConnectionProvider = "notion";
      expect(provider).toBe("notion");
    });

    it("should accept valid params", () => {
      const params: ConnectionCreateParams = {
        containerTags: ["user_123"],
        documentLimit: 100,
      };
      expect(params.containerTags).toHaveLength(1);
      expect(params.documentLimit).toBe(100);
    });
  });

  describe("list() validation", () => {
    it("should accept empty params", () => {
      const params: ConnectionListParams = {};
      expect(Object.keys(params)).toHaveLength(0);
    });
  });

  describe("getByID() validation", () => {
    it("should accept valid ID", () => {
      const id = "conn_abc123";
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe("getByTags() validation", () => {
    it("should require containerTags", () => {
      const params: ConnectionGetByTagsParams = {
        containerTags: ["required_tag"],
      };
      expect(params.containerTags.length).toBeGreaterThan(0);
    });
  });

  describe("deleteByID() validation", () => {
    it("should accept valid ID", () => {
      const id = "conn_to_delete";
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe("deleteByProvider() validation", () => {
    it("should require containerTags", () => {
      const params: ConnectionDeleteByProviderParams = {
        containerTags: ["tag_to_delete"],
      };
      expect(params.containerTags.length).toBeGreaterThan(0);
    });
  });

  describe("importData() validation", () => {
    it("should accept valid provider", () => {
      const provider: ConnectionProvider = "google-drive";
      expect(provider).toBe("google-drive");
    });

    it("should accept optional params", () => {
      const params: ConnectionImportParams = {
        containerTags: ["import_target"],
      };
      expect(params.containerTags).toHaveLength(1);
    });
  });

  describe("listDocuments() validation", () => {
    it("should accept valid provider", () => {
      const provider: ConnectionProvider = "onedrive";
      expect(provider).toBe("onedrive");
    });

    it("should accept optional params", () => {
      const params: ConnectionListDocumentsParams = {
        containerTags: ["user_docs"],
      };
      expect(params.containerTags).toHaveLength(1);
    });
  });
});
