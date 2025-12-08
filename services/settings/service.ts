/** @effect-diagnostics classSelfMismatch:skip-file */
/** biome-ignore-all assist/source/organizeImports: Effect imports must come first */
/**
 * @since 1.0.0
 * @module Settings
 */

import { API_ENDPOINTS, HTTP_METHODS, SERVICE_TAGS } from "@/Constants.js";
import type { SupermemoryError } from "@/Errors.js";
import { SupermemoryHttpClientService } from "@services/client/service.js";
import { Effect } from "effect";
import type { SettingsServiceOps } from "./api.js";
import type {
  SettingsGetResponse,
  SettingsUpdateParams,
  SettingsUpdateResponse,
} from "./types.js";

/**
 * Create the settings service implementation.
 *
 * @since 1.0.0
 * @category Constructors
 */
const makeSettingsService = Effect.gen(function* () {
  const httpClient = yield* SupermemoryHttpClientService;

  const get = (): Effect.Effect<SettingsGetResponse, SupermemoryError> =>
    Effect.gen(function* () {
      return yield* httpClient.request<SettingsGetResponse, unknown, never>(
        HTTP_METHODS.GET,
        API_ENDPOINTS.SETTINGS.BASE,
        {}
      );
    }).pipe(Effect.withSpan("supermemory.settings.get"));

  const update = (
    params?: SettingsUpdateParams
  ): Effect.Effect<SettingsUpdateResponse, SupermemoryError> =>
    Effect.gen(function* () {
      const body = params ?? {};
      return yield* httpClient.request<SettingsUpdateResponse, unknown, never>(
        HTTP_METHODS.PATCH,
        API_ENDPOINTS.SETTINGS.BASE,
        { body }
      );
    }).pipe(Effect.withSpan("supermemory.settings.update"));

  return {
    get,
    update,
  } satisfies SettingsServiceOps;
});

/**
 * Context tag and Service for SettingsService.
 *
 * @since 1.0.0
 * @category Services
 */
export class SettingsService extends Effect.Service<SettingsServiceOps>()(
  SERVICE_TAGS.SETTINGS,
  {
    accessors: true,
    effect: makeSettingsService,
  }
) {}

/**
 * Live layer for SettingsService.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SettingsServiceLive = SettingsService.Default;
