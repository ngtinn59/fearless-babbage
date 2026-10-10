import type {
  AppState,
  ProxyProfile,
  ProxyScheme,
  Rule,
  RuleMatchType,
  Settings,
} from './types';

export interface ValidationErrorItem {
  path: string;
  code: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationErrorItem[] };

const IPV4_LITERAL_REGEX =
  /^(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$/;

export function isValidIpv4Literal(ip: string): boolean {
  return IPV4_LITERAL_REGEX.test(ip);
}

export function isValidIpv4Cidr(cidr: string): boolean {
  if (typeof cidr !== 'string') return false;
  const parts = cidr.split('/');
  if (parts.length !== 2) return false;

  const [ip, maskStr] = parts;
  if (!isValidIpv4Literal(ip)) return false;

  const mask = Number(maskStr);
  if (!Number.isInteger(mask) || mask < 0 || mask > 32) return false;

  // Strict check: no leading zeroes in mask (except "0")
  if (maskStr !== String(mask)) return false;

  return true;
}

export function isValidHost(host: string): boolean {
  if (typeof host !== 'string' || host.trim().length === 0) return false;
  // Host must not contain scheme (e.g. http://) or port (:) or path (/) or whitespace
  if (
    host.includes('://') ||
    host.includes(':') ||
    host.includes('/') ||
    host.includes('\\') ||
    /\s/.test(host)
  ) {
    return false;
  }

  // Check IPv4 literal
  if (isValidIpv4Literal(host)) return true;

  // Check standard domain name / hostname
  // Labels separated by dot; each label 1-63 alphanumeric chars or hyphen, not starting/ending with hyphen
  const labels = host.split('.');
  for (const label of labels) {
    if (label.length === 0 || label.length > 63) return false;
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) {
      return false;
    }
  }

  return true;
}

export function isValidHexColor(color: string): boolean {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}

export function isValidHttpsUrl(url: string): boolean {
  if (typeof url !== 'string' || url.trim().length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate a single ProxyProfile.
 */
export function validateProfile(
  raw: unknown,
  existingProfiles: ProxyProfile[] = [],
): ValidationResult<ProxyProfile> {
  const errors: ValidationErrorItem[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: [{ path: '', code: 'INVALID_OBJECT' }] };
  }

  const p = raw as Record<string, unknown>;

  // id
  if (typeof p.id !== 'string' || p.id.trim().length === 0) {
    errors.push({ path: 'id', code: 'INVALID_ID' });
  }

  // name (1-40 characters, unique)
  if (typeof p.name !== 'string' || p.name.trim().length === 0 || p.name.length > 40) {
    errors.push({ path: 'name', code: 'INVALID_NAME' });
  } else {
    const isDuplicate = existingProfiles.some(
      (ep) => ep.name === p.name && ep.id !== p.id,
    );
    if (isDuplicate) {
      errors.push({ path: 'name', code: 'DUPLICATE_NAME' });
    }
  }

  // color
  if (!isValidHexColor(p.color as string)) {
    errors.push({ path: 'color', code: 'INVALID_COLOR' });
  }

  // scheme
  const validSchemes: ProxyScheme[] = ['http', 'https', 'socks4', 'socks5'];
  if (!validSchemes.includes(p.scheme as ProxyScheme)) {
    errors.push({ path: 'scheme', code: 'INVALID_SCHEME' });
  }

  // host
  if (!isValidHost(p.host as string)) {
    errors.push({ path: 'host', code: 'INVALID_HOST' });
  }

  // port (1-65535)
  const port = p.port;
  if (
    typeof port !== 'number' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    errors.push({ path: 'port', code: 'INVALID_PORT' });
  }

  // auth
  if (p.auth !== undefined && p.auth !== null) {
    if (p.scheme === 'socks4' || p.scheme === 'socks5') {
      errors.push({ path: 'auth', code: 'AUTH_NOT_ALLOWED_FOR_SOCKS' });
    } else if (typeof p.auth === 'object') {
      const authObj = p.auth as Record<string, unknown>;
      if (typeof authObj.username !== 'string' || typeof authObj.password !== 'string') {
        errors.push({ path: 'auth', code: 'INVALID_AUTH_CREDENTIALS' });
      }
    } else {
      errors.push({ path: 'auth', code: 'INVALID_AUTH' });
    }
  }

  // bypassList
  if (!Array.isArray(p.bypassList) || p.bypassList.some((item) => typeof item !== 'string')) {
    errors.push({ path: 'bypassList', code: 'INVALID_BYPASS_LIST' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: raw as ProxyProfile };
}

/**
 * Validate a Target.
 */
export function validateTarget(
  raw: unknown,
  availableProfiles?: ProxyProfile[],
  pathPrefix = 'target',
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];

  if (typeof raw !== 'object' || raw === null) {
    errors.push({ path: pathPrefix, code: 'INVALID_TARGET' });
    return errors;
  }

  const t = raw as Record<string, unknown>;
  if (t.type === 'direct') {
    return errors;
  }

  if (t.type === 'profile') {
    if (typeof t.profileId !== 'string' || t.profileId.trim().length === 0) {
      errors.push({ path: `${pathPrefix}.profileId`, code: 'INVALID_PROFILE_ID' });
    } else if (
      availableProfiles !== undefined &&
      !availableProfiles.some((p) => p.id === t.profileId)
    ) {
      errors.push({ path: `${pathPrefix}.profileId`, code: 'PROFILE_NOT_FOUND' });
    }
  } else {
    errors.push({ path: `${pathPrefix}.type`, code: 'INVALID_TARGET_TYPE' });
  }

  return errors;
}

/**
 * Validate a single Rule.
 */
export function validateRule(
  raw: unknown,
  availableProfiles?: ProxyProfile[],
): ValidationResult<Rule> {
  const errors: ValidationErrorItem[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: [{ path: '', code: 'INVALID_OBJECT' }] };
  }

  const r = raw as Record<string, unknown>;

  // id
  if (typeof r.id !== 'string' || r.id.trim().length === 0) {
    errors.push({ path: 'id', code: 'INVALID_ID' });
  }

  // enabled
  if (typeof r.enabled !== 'boolean') {
    errors.push({ path: 'enabled', code: 'INVALID_ENABLED' });
  }

  // matchType
  const validMatchTypes: RuleMatchType[] = ['domain', 'wildcard', 'regex', 'ip-cidr'];
  if (!validMatchTypes.includes(r.matchType as RuleMatchType)) {
    errors.push({ path: 'matchType', code: 'INVALID_MATCH_TYPE' });
  }

  // pattern
  if (typeof r.pattern !== 'string' || r.pattern.trim().length === 0) {
    errors.push({ path: 'pattern', code: 'INVALID_PATTERN' });
  } else {
    const pattern = r.pattern;
    if (r.matchType === 'regex') {
      try {
        new RegExp(pattern);
      } catch {
        errors.push({ path: 'pattern', code: 'INVALID_REGEX' });
      }
    } else if (r.matchType === 'ip-cidr') {
      if (!isValidIpv4Cidr(pattern)) {
        errors.push({ path: 'pattern', code: 'INVALID_IPV4_CIDR' });
      }
    } else if (r.matchType === 'domain') {
      if (pattern.includes('/') || pattern.includes('://') || /\s/.test(pattern)) {
        errors.push({ path: 'pattern', code: 'INVALID_DOMAIN_PATTERN' });
      }
    }
  }

  // target
  const targetErrors = validateTarget(r.target, availableProfiles, 'target');
  errors.push(...targetErrors);

  // note
  if (r.note !== undefined && typeof r.note !== 'string') {
    errors.push({ path: 'note', code: 'INVALID_NOTE' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: raw as Rule };
}

/**
 * Validate Settings.
 */
export function validateSettings(raw: unknown): ValidationResult<Settings> {
  const errors: ValidationErrorItem[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: [{ path: 'settings', code: 'INVALID_SETTINGS' }] };
  }

  const s = raw as Record<string, unknown>;

  if (s.theme !== 'system' && s.theme !== 'light' && s.theme !== 'dark') {
    errors.push({ path: 'settings.theme', code: 'INVALID_THEME' });
  }

  if (typeof s.bypassLocal !== 'boolean') {
    errors.push({ path: 'settings.bypassLocal', code: 'INVALID_BYPASS_LOCAL' });
  }

  if (typeof s.notifyOnError !== 'boolean') {
    errors.push({ path: 'settings.notifyOnError', code: 'INVALID_NOTIFY_ON_ERROR' });
  }

  if (!isValidHttpsUrl(s.healthCheckUrl as string)) {
    errors.push({ path: 'settings.healthCheckUrl', code: 'INVALID_HEALTH_CHECK_URL' });
  }

  if (
    typeof s.ipCheckUrl !== 'string' ||
    (s.ipCheckUrl !== '' && !isValidHttpsUrl(s.ipCheckUrl))
  ) {
    errors.push({ path: 'settings.ipCheckUrl', code: 'INVALID_IP_CHECK_URL' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: raw as Settings };
}

/**
 * Validate Mode.
 */
export function validateMode(
  raw: unknown,
  availableProfiles?: ProxyProfile[],
  pathPrefix = 'mode',
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];

  if (typeof raw !== 'object' || raw === null) {
    errors.push({ path: pathPrefix, code: 'INVALID_MODE' });
    return errors;
  }

  const m = raw as Record<string, unknown>;
  if (m.kind === 'direct' || m.kind === 'system') {
    return errors;
  }

  if (m.kind === 'fixed') {
    if (typeof m.profileId !== 'string' || m.profileId.trim().length === 0) {
      errors.push({ path: `${pathPrefix}.profileId`, code: 'INVALID_PROFILE_ID' });
    } else if (
      availableProfiles !== undefined &&
      !availableProfiles.some((p) => p.id === m.profileId)
    ) {
      errors.push({ path: `${pathPrefix}.profileId`, code: 'PROFILE_NOT_FOUND' });
    }
  } else if (m.kind === 'auto') {
    const targetErrors = validateTarget(
      m.defaultTarget,
      availableProfiles,
      `${pathPrefix}.defaultTarget`,
    );
    errors.push(...targetErrors);
  } else {
    errors.push({ path: `${pathPrefix}.kind`, code: 'INVALID_MODE_KIND' });
  }

  return errors;
}

/**
 * Validate entire AppState.
 */
export function validateState(raw: unknown): ValidationResult<AppState> {
  const errors: ValidationErrorItem[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: [{ path: '', code: 'INVALID_OBJECT' }] };
  }

  const s = raw as Record<string, unknown>;

  // schemaVersion
  if (s.schemaVersion !== 1) {
    errors.push({ path: 'schemaVersion', code: 'INVALID_SCHEMA_VERSION' });
  }

  // profiles
  const profiles: ProxyProfile[] = [];
  if (!Array.isArray(s.profiles)) {
    errors.push({ path: 'profiles', code: 'INVALID_PROFILES' });
  } else {
    for (let i = 0; i < s.profiles.length; i++) {
      const p = s.profiles[i];
      const res = validateProfile(p, profiles);
      if (res.ok) {
        profiles.push(res.value);
      } else {
        for (const err of res.errors) {
          errors.push({ path: `profiles[${i}].${err.path}`, code: err.code });
        }
      }
    }
  }

  // mode
  const modeErrors = validateMode(s.mode, profiles, 'mode');
  errors.push(...modeErrors);

  // lastActiveMode (null hoặc mode khác direct)
  if (s.lastActiveMode !== null && s.lastActiveMode !== undefined) {
    if (
      typeof s.lastActiveMode === 'object' &&
      (s.lastActiveMode as Record<string, unknown>).kind === 'direct'
    ) {
      errors.push({
        path: 'lastActiveMode',
        code: 'LAST_ACTIVE_MODE_CANNOT_BE_DIRECT',
      });
    } else {
      const lastActiveErrors = validateMode(s.lastActiveMode, profiles, 'lastActiveMode');
      errors.push(...lastActiveErrors);
    }
  }

  // rules
  if (!Array.isArray(s.rules)) {
    errors.push({ path: 'rules', code: 'INVALID_RULES' });
  } else {
    for (let i = 0; i < s.rules.length; i++) {
      const r = s.rules[i];
      const res = validateRule(r, profiles);
      if (!res.ok) {
        for (const err of res.errors) {
          errors.push({ path: `rules[${i}].${err.path}`, code: err.code });
        }
      }
    }
  }

  // settings
  const settingsRes = validateSettings(s.settings);
  if (!settingsRes.ok) {
    errors.push(...settingsRes.errors);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: raw as AppState };
}
