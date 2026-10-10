import { isValidIpv4Literal } from './schema';
import type { AppState, Rule, Target } from './types';

export interface ResolveTargetResult {
  target: Target;
  ruleId: string | null;
  reason: 'local' | 'rule' | 'default';
}

/**
 * Checks if IPv4 address falls within IPv4 CIDR range.
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  if (!isValidIpv4Literal(ip)) return false;
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;
  const [baseIp, maskStr] = parts;
  if (!isValidIpv4Literal(baseIp)) return false;

  const mask = Number(maskStr);
  if (!Number.isInteger(mask) || mask < 0 || mask > 32) return false;

  const ipToInt = (addr: string): number => {
    const octets = addr.split('.').map(Number);
    return (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
  };

  const ipInt = ipToInt(ip);
  const baseInt = ipToInt(baseIp);
  const maskInt = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;

  return (ipInt & maskInt) === (baseInt & maskInt);
}

/**
 * Wildcard matcher implementing shExpMatch semantics:
 * '*' matches 0 or more characters, '?' matches exactly 1 character.
 * Case-insensitive match on full string.
 */
export function matchWildcard(str: string, pattern: string): boolean {
  let regStr = '^';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '*') {
      regStr += '.*';
    } else if (char === '?') {
      regStr += '.';
    } else if ('[\\]^$.|()+{}'.includes(char)) {
      regStr += '\\' + char;
    } else {
      regStr += char;
    }
  }
  regStr += '$';
  return new RegExp(regStr, 'i').test(str);
}

/**
 * Checks if host is considered a local destination under bypassLocal rule:
 * - localhost or ends with .localhost
 * - IPv6 loopback (::1 or [::1])
 * - Plain hostname without dots (e.g. 'router', 'my-pc')
 * - IPv4 in 127.0.0.0/8 loopback subnet
 */
export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '::1' || h === '[::1]') {
    return true;
  }
  if (!h.includes('.')) {
    return true;
  }
  if (isIpInCidr(h, '127.0.0.0/8')) {
    return true;
  }
  return false;
}

/**
 * Evaluate if a single rule matches the given normalized host.
 */
export function matchesRule(rule: Rule, host: string): boolean {
  const h = host.toLowerCase();
  const pattern = rule.pattern.toLowerCase();

  switch (rule.matchType) {
    case 'domain':
      return h === pattern || h.endsWith('.' + pattern);
    case 'wildcard':
      return matchWildcard(h, pattern);
    case 'regex': {
      try {
        return new RegExp(rule.pattern, 'i').test(h);
      } catch {
        return false;
      }
    }
    case 'ip-cidr':
      // Spec 4.1: chỉ khi host là IPv4 literal và nằm trong dải
      if (!isValidIpv4Literal(h)) return false;
      return isIpInCidr(h, rule.pattern);
    default:
      return false;
  }
}

/**
 * Resolve target for a host according to AppState rules and mode.
 * Matching semantics identical to PAC generator.
 */
export function resolveTarget(state: AppState, rawHost: string): ResolveTargetResult {
  const host = (rawHost || '').trim().toLowerCase();

  // 1. Nếu settings.bypassLocal -> host local/plain hostname -> DIRECT
  if (state.settings.bypassLocal && isLocalHost(host)) {
    return { target: { type: 'direct' }, ruleId: null, reason: 'local' };
  }

  const activeProfilesMap = new Map(state.profiles.map((p) => [p.id, p]));

  // 2. Duyệt rule enabled theo thứ tự mảng, khớp rule đầu tiên -> target của rule đó
  for (const rule of state.rules) {
    if (!rule.enabled) continue;

    // Rule trỏ tới profile đã bị xóa -> coi như rule bị tắt (bỏ qua)
    if (rule.target.type === 'profile' && !activeProfilesMap.has(rule.target.profileId)) {
      continue;
    }

    if (matchesRule(rule, host)) {
      return { target: rule.target, ruleId: rule.id, reason: 'rule' };
    }
  }

  // 3. Không khớp rule nào -> mode.defaultTarget (nếu mode là auto) hoặc mode tương ứng
  let defaultTarget: Target = { type: 'direct' };
  if (state.mode.kind === 'auto') {
    defaultTarget = state.mode.defaultTarget;
  } else if (state.mode.kind === 'fixed') {
    defaultTarget = { type: 'profile', profileId: state.mode.profileId };
  }

  // Nếu defaultTarget trỏ tới profile không tồn tại -> fallback direct
  if (defaultTarget.type === 'profile' && !activeProfilesMap.has(defaultTarget.profileId)) {
    defaultTarget = { type: 'direct' };
  }

  return { target: defaultTarget, ruleId: null, reason: 'default' };
}
