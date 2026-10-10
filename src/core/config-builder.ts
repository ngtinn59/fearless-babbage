import { generatePac } from './pac-generator';
import type { AppState } from './types';

export type ChromeProxyConfigMode =
  | 'direct'
  | 'auto_detect'
  | 'pac_script'
  | 'fixed_servers'
  | 'system';

export interface ChromeProxyServer {
  scheme?: string;
  host: string;
  port?: number;
}

export interface ChromeProxyRules {
  singleProxy?: ChromeProxyServer;
  proxyForHttp?: ChromeProxyServer;
  proxyForHttps?: ChromeProxyServer;
  proxyForFtp?: ChromeProxyServer;
  fallbackProxy?: ChromeProxyServer;
  bypassList?: string[];
}

export interface ChromePacScript {
  url?: string;
  data?: string;
  mandatory?: boolean;
}

export interface ChromeProxyConfig {
  mode: ChromeProxyConfigMode;
  pacScript?: ChromePacScript;
  rules?: ChromeProxyRules;
}

export interface BuildConfigResult {
  config: ChromeProxyConfig;
  warnings: string[];
}

/**
 * Builds Chrome ProxyConfig object from current AppState.
 * Strict pure TypeScript without calling any chrome.* runtime APIs.
 */
export function buildProxyConfig(state: AppState): BuildConfigResult {
  const warnings: string[] = [];
  const { mode, profiles, settings } = state;

  switch (mode.kind) {
    case 'direct':
      return {
        config: { mode: 'direct' },
        warnings,
      };

    case 'system':
      return {
        config: { mode: 'system' },
        warnings,
      };

    case 'fixed': {
      const targetProfile = profiles.find((p) => p.id === mode.profileId);
      if (!targetProfile) {
        warnings.push(
          `Profile "${mode.profileId}" not found in fixed mode. Falling back to direct mode.`,
        );
        return {
          config: { mode: 'direct' },
          warnings,
        };
      }

      // Combine user bypassList and local bypass if bypassLocal is enabled
      const bypassList = [...(targetProfile.bypassList || [])];
      if (settings.bypassLocal) {
        // Standard Chrome bypass token for local addresses
        if (!bypassList.includes('<local>')) {
          bypassList.unshift('<local>');
        }
      }

      const config: ChromeProxyConfig = {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: targetProfile.scheme,
            host: targetProfile.host,
            port: targetProfile.port,
          },
          bypassList,
        },
      };

      return {
        config,
        warnings,
      };
    }

    case 'auto': {
      const pacData = generatePac(state);
      const config: ChromeProxyConfig = {
        mode: 'pac_script',
        pacScript: {
          data: pacData,
        },
      };

      return {
        config,
        warnings,
      };
    }

    default:
      warnings.push(`Unknown mode kind: ${(mode as { kind: string }).kind}. Falling back to direct.`);
      return {
        config: { mode: 'direct' },
        warnings,
      };
  }
}
