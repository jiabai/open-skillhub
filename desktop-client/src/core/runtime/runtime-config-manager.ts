import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { createAgentDetectionService } from "@/core/detection/agent-detection-service";
import { resolveLocale } from "@/i18n/config";
import { APP_NAME, ensureAppDirectories, type AppPathsOptions } from "@/core/storage/app-paths";
import { resolveApiTokenBootstrap, type ApiTokenBootstrapResult } from "@/core/storage/auth-bootstrap";
import { createJsonConfigStore, type ConfigStore, type JsonRecord } from "@/core/storage/config-store";
import { createKeytarSecretStore, type SecretStore } from "@/core/storage/secret-store";
import type { AgentDetectionSnapshot, AppLocale, ConfigurationPayload } from "@/types";

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8001";

export interface DesktopRuntimeConfig {
  apiBaseUrl: string;
  locale: AppLocale;
  apiToken: string | null;
  pollIntervalMs: number;
  cacheDirectory: string;
  agentDetection: AgentDetectionSnapshot;
}

export type DesktopLocalConfig = JsonRecord & {
  apiBaseUrl: string;
  locale: AppLocale;
};

export interface RuntimeConfigurationState {
  config: DesktopRuntimeConfig;
  bootstrap: ApiTokenBootstrapResult;
}

export interface RuntimeConfigManager {
  reload(): Promise<RuntimeConfigurationState>;
  getState(): RuntimeConfigurationState;
  saveConfiguration(payload: ConfigurationPayload): Promise<RuntimeConfigurationState>;
  saveLocale(locale: AppLocale): Promise<RuntimeConfigurationState>;
  clearConfiguration(): Promise<RuntimeConfigurationState>;
}

export interface RuntimeConfigManagerOptions {
  appPathsOptions?: AppPathsOptions;
  configStore?: ConfigStore<DesktopLocalConfig>;
  env?: NodeJS.ProcessEnv;
  secretStore?: SecretStore;
}

export function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? DEFAULT_API_BASE_URL).trim();
  return (trimmed || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export function validateApiBaseUrl(value: string | undefined): string {
  const normalized = normalizeBaseUrl(value);

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("API Base URL must be a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("API Base URL must use http or https.");
  }

  return normalized;
}

export function normalizePollInterval(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "30000", 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 30000;
  }

  return parsed;
}

export function createRuntimeConfigManager(options: RuntimeConfigManagerOptions = {}): RuntimeConfigManager {
  const env = options.env ?? process.env;
  const paths = ensureAppDirectories(options.appPathsOptions);
  const secretStore = options.secretStore ?? createKeytarSecretStore(APP_NAME);
  const configStore =
    options.configStore ??
    createJsonConfigStore<DesktopLocalConfig>(paths.configFilePath, {
      apiBaseUrl: normalizeBaseUrl(env.SKILLDRIVE_API_BASE_URL),
      locale: resolveInitialLocale(env),
    });

  let currentState: RuntimeConfigurationState | null = null;
  let environmentBootstrapEnabled = true;

  const buildRuntimeConfig = async (): Promise<RuntimeConfigurationState> => {
    const localConfig = await configStore.read();
    const apiBaseUrl = validateApiBaseUrl(localConfig.apiBaseUrl ?? env.SKILLDRIVE_API_BASE_URL);
    const locale = resolveLocale(localConfig.locale);
    const bootstrap = await resolveApiTokenBootstrap({
      envToken: environmentBootstrapEnabled ? env.SKILLDRIVE_API_TOKEN : undefined,
      secretStore,
    });
    const cacheDirectory = env.SKILLDRIVE_CACHE_DIR ?? join(paths.rootDir, "cache");
    mkdirSync(cacheDirectory, { recursive: true });
    const agentDetection = await createAgentDetectionService({
      env,
      homeDir: () => homedir()
    }).refresh();

    return {
      bootstrap,
      config: {
        agentDetection,
        apiBaseUrl,
        locale,
        apiToken: bootstrap.apiToken,
        cacheDirectory,
        pollIntervalMs: normalizePollInterval(env.SKILLDRIVE_POLL_INTERVAL_MS),
      },
    };
  };

  return {
    async reload() {
      currentState = await buildRuntimeConfig();
      return currentState;
    },
    getState() {
      if (!currentState) {
        throw new Error("Runtime configuration has not been loaded.");
      }

      return currentState;
    },
    async saveConfiguration(payload) {
      const apiBaseUrl = validateApiBaseUrl(payload.apiBaseUrl);
      const currentToken = currentState?.config.apiToken?.trim() ?? "";
      const apiToken = payload.apiToken.trim() || currentToken;

      if (!apiToken) {
        throw new Error("API token is required.");
      }

      environmentBootstrapEnabled = false;
      await secretStore.setApiToken(apiToken);
      const currentLocalConfig = await configStore.read();
      await configStore.write({
        apiBaseUrl,
        locale: resolveLocale(currentLocalConfig.locale),
      });

      return this.reload();
    },
    async saveLocale(locale: AppLocale) {
      const currentLocalConfig = await configStore.read();
      await configStore.write({
        apiBaseUrl: currentLocalConfig.apiBaseUrl ?? normalizeBaseUrl(env.SKILLDRIVE_API_BASE_URL),
        locale: resolveLocale(locale),
      });

      return this.reload();
    },
    async clearConfiguration() {
      environmentBootstrapEnabled = false;
      await secretStore.clearApiToken();
      const currentLocalConfig = await configStore.read();
      await configStore.write({
        apiBaseUrl: normalizeBaseUrl(env.SKILLDRIVE_API_BASE_URL),
        locale: resolveLocale(currentLocalConfig.locale),
      });

      return this.reload();
    },
  };
}

function resolveInitialLocale(env: NodeJS.ProcessEnv): AppLocale {
  return resolveLocale(
    env.SKILLDRIVE_LOCALE ?? env.LANG ?? env.LC_ALL ?? env.LC_MESSAGES ?? env.LANGUAGE
  );
}
