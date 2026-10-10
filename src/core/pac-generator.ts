import type { AppState, ProxyProfile, Target } from './types';

/**
 * Converts CIDR prefix length (0-32) to dotted decimal netmask.
 * e.g. 24 -> "255.255.255.0"
 */
export function prefixLengthToDottedMask(prefixLength: number): string {
  if (prefixLength === 0) return '0.0.0.0';
  const maskInt = (~0 << (32 - prefixLength)) >>> 0;
  return `${(maskInt >>> 24) & 255}.${(maskInt >>> 16) & 255}.${(maskInt >>> 8) & 255}.${maskInt & 255}`;
}

/**
 * Maps a Target and profiles map to the standard PAC proxy return string.
 */
export function targetToPacString(
  target: Target,
  profilesMap: Map<string, ProxyProfile>,
): string {
  if (target.type === 'direct') {
    return 'DIRECT';
  }

  const profile = profilesMap.get(target.profileId);
  if (!profile) {
    return 'DIRECT';
  }

  const { scheme, host, port } = profile;
  switch (scheme) {
    case 'http':
      return `PROXY ${host}:${port}`;
    case 'https':
      return `HTTPS ${host}:${port}`;
    case 'socks5':
      return `SOCKS5 ${host}:${port}; SOCKS ${host}:${port}`;
    case 'socks4':
      return `SOCKS ${host}:${port}`;
    default:
      return 'DIRECT';
  }
}

/**
 * Generates a clean, injection-safe PAC script from AppState.
 */
export function generatePac(state: AppState): string {
  const profilesMap = new Map(state.profiles.map((p) => [p.id, p]));
  const lines: string[] = [];

  lines.push('function FindProxyForURL(url, host) {');
  lines.push('  host = (host || "").toLowerCase();');
  lines.push('');

  // 1. Bypass local destinations if enabled
  if (state.settings.bypassLocal) {
    lines.push('  // Bypass local');
    lines.push(
      '  if (isPlainHostName(host) || host === "localhost" || shExpMatch(host, "*.localhost") || host === "::1" || isInNet(host, "127.0.0.0", "255.0.0.0")) {',
    );
    lines.push('    return "DIRECT";');
    lines.push('  }');
    lines.push('');
  }

  // 2. Rules in array order
  lines.push('  // Rules');
  for (const rule of state.rules) {
    if (!rule.enabled) continue;

    // Skip rules targeting non-existent profiles
    if (rule.target.type === 'profile' && !profilesMap.has(rule.target.profileId)) {
      continue;
    }

    const targetPac = targetToPacString(rule.target, profilesMap);
    const pattern = rule.pattern;

    switch (rule.matchType) {
      case 'domain': {
        const lowerPattern = pattern.toLowerCase();
        const dotPattern = '.' + lowerPattern;
        lines.push(
          `  if (host === ${JSON.stringify(lowerPattern)} || dnsDomainIs(host, ${JSON.stringify(dotPattern)})) {`,
        );
        lines.push(`    return ${JSON.stringify(targetPac)};`);
        lines.push('  }');
        break;
      }
      case 'wildcard': {
        lines.push(`  if (shExpMatch(host, ${JSON.stringify(pattern.toLowerCase())})) {`);
        lines.push(`    return ${JSON.stringify(targetPac)};`);
        lines.push('  }');
        break;
      }
      case 'regex': {
        lines.push(`  try {`);
        lines.push(`    if (new RegExp(${JSON.stringify(pattern)}, "i").test(host)) {`);
        lines.push(`      return ${JSON.stringify(targetPac)};`);
        lines.push(`    }`);
        lines.push(`  } catch (e) {}`);
        break;
      }
      case 'ip-cidr': {
        const [baseIp, maskStr] = pattern.split('/');
        const maskNum = Number(maskStr);
        if (baseIp && Number.isInteger(maskNum) && maskNum >= 0 && maskNum <= 32) {
          const dottedMask = prefixLengthToDottedMask(maskNum);
          lines.push(
            `  if (/^(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$/.test(host) && isInNet(host, ${JSON.stringify(baseIp)}, ${JSON.stringify(dottedMask)})) {`,
          );
          lines.push(`    return ${JSON.stringify(targetPac)};`);
          lines.push('  }');
        }
        break;
      }
    }
  }

  // 3. Default fallback
  let defaultTarget: Target = { type: 'direct' };
  if (state.mode.kind === 'auto') {
    defaultTarget = state.mode.defaultTarget;
  } else if (state.mode.kind === 'fixed') {
    defaultTarget = { type: 'profile', profileId: state.mode.profileId };
  }

  const defaultPac = targetToPacString(defaultTarget, profilesMap);
  lines.push('');
  lines.push('  // Default target');
  lines.push(`  return ${JSON.stringify(defaultPac)};`);
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}
