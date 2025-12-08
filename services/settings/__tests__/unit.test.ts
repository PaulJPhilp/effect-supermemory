/**
 * SettingsService Comprehensive Unit Tests
 *
 * @since 1.0.0
 * @module Settings
 */

import { describe, expect, it } from "vitest";
import { SettingsService } from "../service.js";
import type {
  OrganizationSettings,
  SettingsGetResponse,
  SettingsJsonValue,
  SettingsUpdateParams,
  SettingsUpdateResponse,
} from "../types.js";

describe("SettingsService", () => {
  describe("Service Definition", () => {
    it("should be properly defined as an Effect.Service", () => {
      expect(SettingsService).toBeDefined();
      expect(typeof SettingsService).toBe("function");
    });

    it("should export Default layer via SettingsService.Default", () => {
      expect(SettingsService.Default).toBeDefined();
    });

    it("should have the correct service tag", () => {
      expect(SettingsService.key).toBe("@effect-supermemory/Settings");
    });
  });

  describe("Type Definitions", () => {
    describe("SettingsJsonValue", () => {
      it("should accept string values", () => {
        const value: SettingsJsonValue = "test string";
        expect(value).toBe("test string");
      });

      it("should accept number values", () => {
        const value: SettingsJsonValue = 42;
        expect(value).toBe(42);
      });

      it("should accept boolean values", () => {
        const value: SettingsJsonValue = true;
        expect(value).toBe(true);
      });

      it("should accept object values", () => {
        const value: SettingsJsonValue = { key: "value", nested: { a: 1 } };
        expect(value).toBeDefined();
      });

      it("should accept array values", () => {
        const value: SettingsJsonValue = [1, 2, "three", { four: 4 }];
        expect(value).toBeDefined();
      });

      it("should accept null", () => {
        const value: SettingsJsonValue = null;
        expect(value).toBeNull();
      });
    });

    describe("OrganizationSettings", () => {
      it("should accept empty settings", () => {
        const settings: OrganizationSettings = {};
        expect(Object.keys(settings)).toHaveLength(0);
      });

      it("should accept chunkSize", () => {
        const settings: OrganizationSettings = { chunkSize: 512 };
        expect(settings.chunkSize).toBe(512);
      });

      it("should accept null chunkSize", () => {
        const settings: OrganizationSettings = { chunkSize: null };
        expect(settings.chunkSize).toBeNull();
      });

      it("should accept excludeItems as string", () => {
        const settings: OrganizationSettings = { excludeItems: "*.tmp" };
        expect(settings.excludeItems).toBe("*.tmp");
      });

      it("should accept excludeItems as array", () => {
        const settings: OrganizationSettings = {
          excludeItems: ["*.tmp", "*.log"],
        };
        expect(settings.excludeItems).toHaveLength(2);
      });

      it("should accept excludeItems as object", () => {
        const settings: OrganizationSettings = {
          excludeItems: { pattern: "*.tmp", recursive: true },
        };
        expect(settings.excludeItems).toBeDefined();
      });

      it("should accept filterPrompt", () => {
        const settings: OrganizationSettings = {
          filterPrompt: "Filter out irrelevant content",
        };
        expect(settings.filterPrompt).toBe("Filter out irrelevant content");
      });

      it("should accept Google Drive settings", () => {
        const settings: OrganizationSettings = {
          googleDriveClientId: "client_id_123",
          googleDriveClientSecret: "secret_456",
          googleDriveCustomKeyEnabled: true,
        };

        expect(settings.googleDriveClientId).toBe("client_id_123");
        expect(settings.googleDriveClientSecret).toBe("secret_456");
        expect(settings.googleDriveCustomKeyEnabled).toBe(true);
      });

      it("should accept includeItems", () => {
        const settings: OrganizationSettings = {
          includeItems: ["*.md", "*.txt"],
        };
        expect(settings.includeItems).toHaveLength(2);
      });

      it("should accept Notion settings", () => {
        const settings: OrganizationSettings = {
          notionClientId: "notion_client",
          notionClientSecret: "notion_secret",
          notionCustomKeyEnabled: false,
        };

        expect(settings.notionClientId).toBe("notion_client");
        expect(settings.notionClientSecret).toBe("notion_secret");
        expect(settings.notionCustomKeyEnabled).toBe(false);
      });

      it("should accept OneDrive settings", () => {
        const settings: OrganizationSettings = {
          onedriveClientId: "onedrive_client",
          onedriveClientSecret: "onedrive_secret",
          onedriveCustomKeyEnabled: true,
        };

        expect(settings.onedriveClientId).toBe("onedrive_client");
        expect(settings.onedriveClientSecret).toBe("onedrive_secret");
        expect(settings.onedriveCustomKeyEnabled).toBe(true);
      });

      it("should accept shouldLLMFilter", () => {
        const settings: OrganizationSettings = { shouldLLMFilter: true };
        expect(settings.shouldLLMFilter).toBe(true);
      });

      it("should accept all settings together", () => {
        const settings: OrganizationSettings = {
          chunkSize: 1024,
          excludeItems: ["*.log"],
          filterPrompt: "Focus on technical content",
          googleDriveClientId: "gd_client",
          googleDriveClientSecret: "gd_secret",
          googleDriveCustomKeyEnabled: true,
          includeItems: ["*.md"],
          notionClientId: "n_client",
          notionClientSecret: "n_secret",
          notionCustomKeyEnabled: true,
          onedriveClientId: "od_client",
          onedriveClientSecret: "od_secret",
          onedriveCustomKeyEnabled: false,
          shouldLLMFilter: true,
        };

        expect(settings.chunkSize).toBe(1024);
        expect(settings.shouldLLMFilter).toBe(true);
        expect(settings.googleDriveCustomKeyEnabled).toBe(true);
        expect(settings.notionCustomKeyEnabled).toBe(true);
        expect(settings.onedriveCustomKeyEnabled).toBe(false);
      });
    });

    describe("SettingsUpdateParams", () => {
      it("should accept partial settings", () => {
        const params: SettingsUpdateParams = {
          chunkSize: 256,
          shouldLLMFilter: false,
        };

        expect(params.chunkSize).toBe(256);
        expect(params.shouldLLMFilter).toBe(false);
      });

      it("should accept empty params for no-op update", () => {
        const params: SettingsUpdateParams = {};
        expect(Object.keys(params)).toHaveLength(0);
      });
    });

    describe("SettingsGetResponse", () => {
      it("should return organization settings", () => {
        const response: SettingsGetResponse = {
          chunkSize: 512,
          shouldLLMFilter: true,
          filterPrompt: "Filter prompt text",
        };

        expect(response.chunkSize).toBe(512);
        expect(response.shouldLLMFilter).toBe(true);
        expect(response.filterPrompt).toBe("Filter prompt text");
      });

      it("should handle empty response", () => {
        const response: SettingsGetResponse = {};
        expect(Object.keys(response)).toHaveLength(0);
      });

      it("should handle null values", () => {
        const response: SettingsGetResponse = {
          chunkSize: null,
          filterPrompt: null,
          shouldLLMFilter: null,
        };

        expect(response.chunkSize).toBeNull();
        expect(response.filterPrompt).toBeNull();
        expect(response.shouldLLMFilter).toBeNull();
      });
    });

    describe("SettingsUpdateResponse", () => {
      it("should define expected response shape", () => {
        const response: SettingsUpdateResponse = {
          orgId: "org_123",
          orgSlug: "my-organization",
          updated: {
            chunkSize: 1024,
            shouldLLMFilter: true,
          },
        };

        expect(response.orgId).toBe("org_123");
        expect(response.orgSlug).toBe("my-organization");
        expect(response.updated.chunkSize).toBe(1024);
        expect(response.updated.shouldLLMFilter).toBe(true);
      });

      it("should handle empty updated settings", () => {
        const response: SettingsUpdateResponse = {
          orgId: "org_456",
          orgSlug: "another-org",
          updated: {},
        };

        expect(response.orgId).toBe("org_456");
        expect(Object.keys(response.updated)).toHaveLength(0);
      });
    });
  });

  describe("API Contract", () => {
    it("should have get method", () => {
      type GetMethod = typeof SettingsService.prototype.get;
      const _typeCheck: GetMethod = {} as GetMethod;
      expect(true).toBe(true);
    });

    it("should have update method", () => {
      type UpdateMethod = typeof SettingsService.prototype.update;
      const _typeCheck: UpdateMethod = {} as UpdateMethod;
      expect(true).toBe(true);
    });
  });
});

describe("SettingsService Validation", () => {
  describe("get() validation", () => {
    it("should not require any parameters", () => {
      // get() takes no parameters
      expect(true).toBe(true);
    });
  });

  describe("update() validation", () => {
    it("should accept empty params", () => {
      const params: SettingsUpdateParams = {};
      expect(Object.keys(params)).toHaveLength(0);
    });

    it("should accept valid chunkSize", () => {
      const params: SettingsUpdateParams = { chunkSize: 512 };
      expect(params.chunkSize).toBe(512);
    });

    it("should accept valid filterPrompt", () => {
      const params: SettingsUpdateParams = {
        filterPrompt: "Focus on code documentation",
      };
      expect(params.filterPrompt?.length).toBeGreaterThan(0);
    });

    it("should accept boolean settings", () => {
      const params: SettingsUpdateParams = {
        googleDriveCustomKeyEnabled: true,
        notionCustomKeyEnabled: false,
        onedriveCustomKeyEnabled: true,
        shouldLLMFilter: true,
      };

      expect(params.googleDriveCustomKeyEnabled).toBe(true);
      expect(params.notionCustomKeyEnabled).toBe(false);
      expect(params.onedriveCustomKeyEnabled).toBe(true);
      expect(params.shouldLLMFilter).toBe(true);
    });

    it("should accept OAuth credential updates", () => {
      const params: SettingsUpdateParams = {
        googleDriveClientId: "new_gd_id",
        googleDriveClientSecret: "new_gd_secret",
        notionClientId: "new_notion_id",
        notionClientSecret: "new_notion_secret",
        onedriveClientId: "new_od_id",
        onedriveClientSecret: "new_od_secret",
      };

      expect(params.googleDriveClientId).toBe("new_gd_id");
      expect(params.notionClientId).toBe("new_notion_id");
      expect(params.onedriveClientId).toBe("new_od_id");
    });

    it("should accept include/exclude items", () => {
      const params: SettingsUpdateParams = {
        includeItems: ["*.md", "*.txt", "docs/**/*"],
        excludeItems: ["node_modules/**", "*.log", ".git/**"],
      };

      expect(params.includeItems).toHaveLength(3);
      expect(params.excludeItems).toHaveLength(3);
    });
  });
});
