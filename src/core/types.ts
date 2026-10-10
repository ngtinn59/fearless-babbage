export type ProxyScheme = 'http' | 'https' | 'socks4' | 'socks5';

export interface ProxyProfile {
  id: string; // crypto.randomUUID()
  name: string; // 1–40 ký tự, không trùng
  color: string; // #RRGGBB
  scheme: ProxyScheme;
  host: string; // hostname hoặc IPv4, không chứa scheme/port
  port: number; // 1–65535
  auth?: { username: string; password: string }; // chỉ cho http/https
  bypassList: string[]; // dùng cho mode fixed, cú pháp bypassList của Chrome
}

export type Target = { type: 'direct' } | { type: 'profile'; profileId: string };

export type RuleMatchType = 'domain' | 'wildcard' | 'regex' | 'ip-cidr';

export interface Rule {
  id: string;
  enabled: boolean;
  matchType: RuleMatchType;
  pattern: string;
  target: Target;
  note?: string;
}

export type Mode =
  | { kind: 'direct' }
  | { kind: 'system' }
  | { kind: 'fixed'; profileId: string }
  | { kind: 'auto'; defaultTarget: Target };

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  bypassLocal: boolean; // luôn DIRECT cho localhost, 127.0.0.0/8, tên host không có dấu chấm
  notifyOnError: boolean;
  healthCheckUrl: string; // mặc định https://www.gstatic.com/generate_204
  ipCheckUrl: string; // mặc định https://api.ipify.org?format=json, cho phép để trống = tắt
}

export interface AppState {
  schemaVersion: 1;
  mode: Mode;
  lastActiveMode: Exclude<Mode, { kind: 'direct' }> | null; // để toggle bật lại
  profiles: ProxyProfile[];
  rules: Rule[]; // thứ tự mảng = thứ tự ưu tiên
  settings: Settings;
}
