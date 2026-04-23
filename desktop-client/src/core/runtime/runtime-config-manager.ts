import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentId } from "@/adapters/agents/base";
import { listAgentAdapters } from "@/adapters/agents/registry";
import { APP_NAME, ensureAppDirectories, type AppPathsOptions } from "@/core/storage/app-paths";
import { resolveApiTokenBootstrap, type ApiTokenBootstrapResult } from "@/core/storage/auth-bootstrap";
import { createJsonConfigStore, type ConfigStore, type JsonRecord } from "@/core/storage/config-store";
import { createKeytarSecretStore, type SecretStore } from "@/core/storage/secret-store";
import type { ConfigurationPayload } from "@/types";

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8001";

export interface DesktopRuntimeConfig {
  apiBaseUrl: string;
  apiToken: string | null;
  pollIntervalMs: number;
  cacheDirectory: string;
  agentSkillsPaths: Partial<Record<AgentId, string>>;
}

export type DesktopLocalConfig = JsonRecord & {
  apiBaseUrl: string;
};

export interface RuntimeConfigurationState {
  config: DesktopRuntimeConfig;
  bootstrap: ApiTokenBootstrapResult;
}

export interface RuntimeConfigManager {
  reload(): Promise<RuntimeConfigurationState>;
  getState(): RuntimeConfigurationState;
  saveConfiguration(payload: ConfigurationPayload): Promise<RuntimeConfigurationState>;
  clearConfiguration(): Promise<RuntimeConfigurationState>;
}

export interface RuntimeConfigManagerOptions {
  appPathsOptions?: AppPathsOptions;
  configStore?: ConfigStore<DesktopLocalConfig>;
  env?: NodeJS.ProcessEnv;
  secretStore?: SecretStore;
}

const agentPathEnvVars: Record<AgentId, string> = {
  codex: "OPEN_SKILLHUB_CODEX_SKILLS_PATH",
  "claude-code": "OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH",
  "gemini-cli": "OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH",
};

const defaultAgentRoots: Record<AgentId, string> = {
  codex: join(homedir(), ".codex"),
  "claude-code": join(homedir(), ".claude"),
  "gemini-cli": join(homedir(), ".gemini"),
};

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
      apiBaseUrl: normalizeBaseUrl(env.OPEN_SKILLHUB_API_BASE_URL),
    });

  let currentState: RuntimeConfigurationState | null = null;
  let environmentBootstrapEnabled = true;

  const buildRuntimeConfig = async (): Promise<RuntimeConfigurationState> => {
    const localConfig = await configStore.read();
    const apiBaseUrl = validateApiBaseUrl(localConfig.apiBaseUrl ?? env.OPEN_SKILLHUB_API_BASE_URL);
    const bootstrap = await resolveApiTokenBootstrap({
      envToken: environmentBootstrapEnabled ? env.OPEN_SKILLHUB_API_TOKEN : undefined,
      secretStore,
    });
    const cacheDirectory = env.OPEN_SKILLHUB_CACHE_DIR ?? join(paths.rootDir, "cache");
    mkdirSync(cacheDirectory, { recursive: true });

    return {
      bootstrap,
      config: {
        agentSkillsPaths: resolveAgentSkillsPaths(env),
        apiBaseUrl,
        apiToken: bootstrap.apiToken,
        cacheDirectory,
        pollIntervalMs: normalizePollInterval(env.OPEN_SKILLHUB_POLL_INTERVAL_MS),
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
      await configStore.write({ apiBaseUrl });

      return this.reload();
    },
    async clearConfiguration() {
      environmentBootstrapEnabled = false;
      await secretStore.clearApiToken();
      await configStore.clear();

      return this.reload();
    },
  };
}

function resolveAgentSkillsPaths(env: NodeJS.ProcessEnv): Partial<Record<AgentId, string>> {
  return listAgentAdapters().reduce<Partial<Record<AgentId, string>>>((pathsByAgent, adapter) => {
    const configuredPath = normalizeAgentSkillsPath(env[agentPathEnvVars[adapter.id]]);

    if (configuredPath) {
      pathsByAgent[adapter.id] = configuredPath;
      return pathsByAgent;
    }

    if (existsSync(defaultAgentRoots[adapter.id])) {
      pathsByAgent[adapter.id] = join(defaultAgentRoots[adapter.id], "skills");
    }

    return pathsByAgent;
  }, {});
}

function normalizeAgentSkillsPath(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
