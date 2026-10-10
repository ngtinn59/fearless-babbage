# CLAUDE_TASK.md — Smart Proxy (Chrome Extension, Manifest V3)

> File này là **nguồn sự thật duy nhất** cho kế hoạch dự án.
> - **Claude (Tech Lead)**: viết plan, review code sau mỗi task.
> - **Antigravity (thi công)**: làm từng task theo thứ tự, tự test, cập nhật tiến độ ở mục 7.

---

## 0. Quy tắc làm việc cho Antigravity

1. Làm **đúng một task mỗi lần**, theo thứ tự. Không làm trước task sau.
2. Một task chỉ được coi là xong khi đạt **toàn bộ tiêu chí nghiệm thu** của task đó **và** Definition of Done chung (mục 5).
3. Khi xong task:
   - Đánh `[x]` vào checkbox của task.
   - Thêm một mục vào **Nhật ký tiến độ** (mục 7) theo mẫu có sẵn.
   - Commit riêng cho task, message: `task(N): <tên task>`.
4. **Không sửa mục 1–5** (kiến trúc, mô hình dữ liệu, danh sách task). Nếu thấy cần đổi thiết kế, thêm dependency ngoài danh sách, hoặc gặp vướng mắc → ghi vào mục 8 **Đề xuất / Câu hỏi** và dừng lại chờ duyệt.
5. Code trong `src/core/` **không được gọi `chrome.*`**: phải là TypeScript thuần để unit test được.
6. Không dùng inline script, `eval`, `new Function` trong trang extension (CSP của MV3).

### 0.1 Giao thức phối hợp Antigravity ↔ Claude

Vòng lặp cho mỗi task N:

1. **Antigravity** làm Task N → commit `task(N): ...` → thêm mục nhật ký (mục 7) với `**Trạng thái:** CHỜ REVIEW`.
2. **Antigravity** gọi Claude review bằng lệnh ở mục 0.2 (chạy trong PowerShell tại thư mục gốc repo).
3. **Claude** ghi kết quả vào mục 9 với một trong hai nhãn:
   - `Task N: ✅ DUYỆT` → Antigravity sang Task N+1.
   - `Task N: 🔁 CẦN SỬA` + danh sách việc → Antigravity sửa, commit `task(N): fix review #k`, rồi quay lại bước 2.
4. Antigravity **chỉ được bắt đầu Task N+1 khi mục 9 có `Task N: ✅ DUYỆT`.**

**Điều kiện DỪNG và chờ người dùng** (không tự làm tiếp):
- Vừa được duyệt task cuối của một giai đoạn: **Task 3, Task 9, Task 15, Task 17**.
- Cùng một task bị `🔁 CẦN SỬA` lần thứ 3.
- Có câu hỏi/đề xuất mới ở mục 8.
- Lệnh review ở mục 0.2 lỗi hoặc không ghi được kết quả vào mục 9.

### 0.2 Lệnh gọi Claude review

```powershell
claude -p "Bạn là Tech Lead. Review Task N theo quy trình ở mục 9 của CLAUDE_TASK.md." --allowedTools "Read" "Grep" "Glob" "Bash(git log:*)" "Bash(git show:*)" "Bash(git diff:*)" "Bash(git status:*)" "Bash(npm run check)" "Bash(npm run build)" "Edit(CLAUDE_TASK.md)"
```

(Thay `N` bằng số task. Claude chỉ được đọc code, chạy check/build và sửa duy nhất file này.)

---

## 1. Mục tiêu sản phẩm

Extension cho phép người dùng quản lý nhiều proxy và chuyển đổi **một chạm**, gồm:

| Tính năng | Mô tả |
|---|---|
| Profiles | Nhiều proxy server: HTTP / HTTPS / SOCKS4 / SOCKS5, host, port, auth (chỉ HTTP/HTTPS), bypass list, màu nhận diện |
| Chế độ (Mode) | `direct` (tắt), `system` (theo hệ thống), `fixed` (mọi traffic qua 1 profile), `auto` (theo quy tắc domain → PAC) |
| Toggle 1 chạm | Bật/tắt nhanh: tắt → `direct`; bật → khôi phục mode gần nhất khác `direct` |
| Quy tắc (Rules) | domain / wildcard / regex / IPv4 CIDR → profile hoặc DIRECT, có thứ tự ưu tiên, bật/tắt từng rule, target mặc định |
| Popup | Toggle, chọn mode/profile, hiện domain tab hiện tại + target đang áp dụng, thêm nhanh rule cho domain này, nút kiểm tra kết nối, cảnh báo xung đột |
| Options | CRUD profile, CRUD + sắp xếp rule, thử URL xem khớp rule nào, nhập hàng loạt domain, cài đặt chung, import/export JSON |
| Xác thực proxy | Tự điền username/password qua `webRequest.onAuthRequired` |
| Xử lý lỗi | `proxy.onProxyError` → log, badge đỏ, notification (có throttle) |
| Badge | Hiển thị trạng thái/mode trên icon |
| Context menu + phím tắt | Thêm domain trang hiện tại vào rule; `Alt+Shift+P` để toggle |
| Phát hiện xung đột | Cảnh báo khi extension khác đang điều khiển proxy |
| i18n + Dark mode | Tiếng Việt + English; giao diện theo `prefers-color-scheme` hoặc chọn tay |

**Ngoài phạm vi bản này:** đồng bộ qua `storage.sync`, IPv6 CIDR, import định dạng SwitchyOmega/gfwlist, proxy riêng cho incognito.

---

## 2. Tech stack

| Hạng mục | Lựa chọn |
|---|---|
| Ngôn ngữ | TypeScript (`strict: true`) |
| UI | Preact + `@preact/preset-vite` |
| Build | Vite (multi-entry: popup, options, background) |
| Test | Vitest (unit), Playwright (E2E, load unpacked extension), `proxy-chain` (proxy giả lập cho E2E) |
| Lint/Format | ESLint (typescript-eslint) + Prettier |
| Kiểu Chrome API | `@types/chrome` |
| Tạo icon | `sharp` (devDependency, script sinh PNG từ SVG) |
| Runtime | Node ≥ 20, Chrome ≥ 116 (`minimum_chrome_version: "116"`) |

Cài bản stable mới nhất của mỗi package, ghi lại phiên bản thực tế vào Nhật ký tiến độ ở Task 0.

---

## 3. Kiến trúc

### 3.1 Cấu trúc thư mục

```
.
├── CLAUDE_TASK.md
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── scripts/
│   ├── gen-icons.mjs          # sinh PNG 16/32/48/128 từ public/icons/icon.svg
│   └── zip.mjs                # đóng gói dist/ → release/smart-proxy-<version>.zip
├── public/                    # copy nguyên vào dist/
│   ├── manifest.json
│   ├── _locales/{en,vi}/messages.json
│   └── icons/{icon.svg, icon16.png, icon32.png, icon48.png, icon128.png}
├── src/
│   ├── core/                  # TS thuần, KHÔNG gọi chrome.*
│   │   ├── types.ts           # mô hình dữ liệu (mục 4)
│   │   ├── defaults.ts        # state mặc định
│   │   ├── schema.ts          # validate AppState / Profile / Rule / file import
│   │   ├── migrate.ts         # nâng schemaVersion
│   │   ├── rule-matcher.ts    # host → target (dùng cho UI preview)
│   │   ├── pac-generator.ts   # AppState → chuỗi PAC script
│   │   ├── config-builder.ts  # AppState → chrome ProxyConfig
│   │   └── backup.ts          # export/import JSON (strip mật khẩu, merge mật khẩu cũ)
│   ├── shared/                # dùng chung cho UI + background, được gọi chrome.*
│   │   ├── storage.ts         # getState / setState / updateState / subscribe
│   │   ├── messaging.ts       # kiểu message + sendMessage có type
│   │   └── i18n.ts            # wrapper chrome.i18n.getMessage
│   ├── background/
│   │   ├── index.ts           # entry service worker: đăng ký MỌI listener ở top-level
│   │   ├── proxy-controller.ts# áp dụng state → chrome.proxy.settings (tuần tự hóa)
│   │   ├── auth.ts            # onAuthRequired
│   │   ├── errors.ts          # onProxyError, error log, notification
│   │   ├── badge.ts
│   │   ├── context-menu.ts
│   │   ├── commands.ts
│   │   ├── health-check.ts    # kiểm tra kết nối
│   │   └── message-router.ts
│   ├── ui/                    # component + style dùng chung cho popup/options
│   │   ├── components/
│   │   └── styles/{tokens.css, base.css}
│   ├── popup/{index.html, main.tsx, App.tsx}
│   └── options/
│       ├── index.html, main.tsx, App.tsx
│       └── pages/{Profiles.tsx, Rules.tsx, General.tsx, Backup.tsx}
└── tests/
    ├── setup/chrome-mock.ts   # fake chrome.storage / chrome.runtime cho Vitest
    ├── unit/
    └── e2e/
```

### 3.2 Luồng dữ liệu (bắt buộc tuân thủ)

```
 Popup / Options ──updateState()──▶ chrome.storage.local["state"]
                                            │ storage.onChanged
                                            ▼
                                  background/proxy-controller
                                    ├─ config-builder (core) ─▶ chrome.proxy.settings.set
                                    ├─ badge
                                    └─ context-menu (rebuild khi profiles đổi)
 Popup / Options ──sendMessage()──▶ background/message-router  (chỉ cho: GET_STATUS, TEST_CONNECTION, CLEAR_ERRORS)
```

- **Storage là nguồn sự thật duy nhất.** UI không bao giờ gọi `chrome.proxy.settings.set` trực tiếp.
- Background áp dụng lại config khi: `runtime.onInstalled`, `runtime.onStartup`, và mỗi lần key `state` thay đổi.
- Các lần áp dụng phải **chạy tuần tự** (hàng đợi promise) để không bị race khi state đổi liên tục.
- Service worker có thể bị tắt bất kỳ lúc nào: **mọi listener đăng ký đồng bộ ở top-level** của `background/index.ts`, không lưu state quan trọng trong biến toàn cục.

### 3.3 Manifest (khung)

```json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "description": "__MSG_extDescription__",
  "default_locale": "en",
  "version": "1.0.0",
  "minimum_chrome_version": "116",
  "icons": { "16": "icons/icon16.png", "32": "icons/icon32.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
  "action": { "default_popup": "src/popup/index.html" },
  "options_page": "src/options/index.html",
  "background": { "service_worker": "background.js", "type": "module" },
  "permissions": ["proxy", "storage", "webRequest", "webRequestAuthProvider", "contextMenus", "notifications"],
  "host_permissions": ["<all_urls>"],
  "commands": {
    "toggle-proxy": { "suggested_key": { "default": "Alt+Shift+P" }, "description": "__MSG_cmdToggle__" }
  }
}
```

Đường dẫn popup/options phải khớp với output thật của Vite; nếu khác thì sửa manifest cho khớp và ghi chú lại.

---

## 4. Mô hình dữ liệu (`src/core/types.ts`)

```ts
export type ProxyScheme = 'http' | 'https' | 'socks4' | 'socks5';

export interface ProxyProfile {
  id: string;                 // crypto.randomUUID()
  name: string;               // 1–40 ký tự, không trùng
  color: string;              // #RRGGBB
  scheme: ProxyScheme;
  host: string;               // hostname hoặc IPv4, không chứa scheme/port
  port: number;               // 1–65535
  auth?: { username: string; password: string }; // chỉ cho http/https
  bypassList: string[];       // dùng cho mode fixed, cú pháp bypassList của Chrome
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
  bypassLocal: boolean;       // luôn DIRECT cho localhost, 127.0.0.0/8, tên host không có dấu chấm
  notifyOnError: boolean;
  healthCheckUrl: string;     // mặc định https://www.gstatic.com/generate_204
  ipCheckUrl: string;         // mặc định https://api.ipify.org?format=json, cho phép để trống = tắt
}

export interface AppState {
  schemaVersion: 1;
  mode: Mode;
  lastActiveMode: Exclude<Mode, { kind: 'direct' }> | null; // để toggle bật lại
  profiles: ProxyProfile[];
  rules: Rule[];               // thứ tự mảng = thứ tự ưu tiên
  settings: Settings;
}
```

### 4.1 Ngữ nghĩa khớp rule (matcher và PAC phải giống hệt nhau)

So khớp trên **host** đã lowercase (không dùng URL, vì Chrome cắt path của URL https trước khi gọi PAC).

| matchType | Ví dụ pattern | Khớp khi |
|---|---|---|
| `domain` | `example.com` | `host === pattern` hoặc host kết thúc bằng `.` + pattern |
| `wildcard` | `*.google.*` | `shExpMatch(host, pattern)`: `*` = chuỗi bất kỳ, `?` = 1 ký tự, khớp toàn chuỗi |
| `regex` | `^(www\.)?ex.*\.com$` | `new RegExp(pattern, 'i').test(host)`; regex không hợp lệ bị chặn khi lưu |
| `ip-cidr` | `10.0.0.0/8` | **chỉ khi host là IPv4 literal** và nằm trong dải. Không gọi `dnsResolve` (tránh rò rỉ DNS, tránh chậm) |

Thứ tự đánh giá trong mode `auto`:
1. Nếu `settings.bypassLocal` → host local/plain hostname → `DIRECT`.
2. Duyệt rule `enabled` theo thứ tự mảng, khớp rule đầu tiên → target của rule đó.
3. Không khớp rule nào → `mode.defaultTarget`.

Rule trỏ tới profile đã bị xóa → coi như rule bị tắt (bỏ qua). UI phải cảnh báo rule mồ côi.

### 4.2 Chuỗi proxy trong PAC

| scheme | Chuỗi trả về |
|---|---|
| http | `PROXY host:port` |
| https | `HTTPS host:port` |
| socks5 | `SOCKS5 host:port; SOCKS host:port` |
| socks4 | `SOCKS host:port` |
| direct | `DIRECT` |

Mọi giá trị do người dùng nhập (pattern, host) phải chèn vào PAC qua `JSON.stringify`, **không nối chuỗi trực tiếp** (chống injection làm hỏng PAC).

---

## 5. Definition of Done chung (áp dụng cho mọi task)

- [ ] `npm run check` pass (= `typecheck` + `lint` + `test`).
- [ ] `npm run build` thành công; load `dist/` dạng unpacked không có lỗi ở `chrome://extensions`.
- [ ] Service worker console không có lỗi/cảnh báo mới.
- [ ] Không có `any` (trừ khi có comment giải thích lý do).
- [ ] Chuỗi hiển thị cho người dùng đi qua i18n (bắt buộc từ Task 10 trở đi).
- [ ] Đã cập nhật checkbox, Nhật ký tiến độ, commit `task(N): ...`.

---

## 6. Danh sách task

### Giai đoạn A — Nền móng

- [ ] **Task 0 — Khởi tạo dự án**
  - Tạo `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `.gitignore` (`node_modules`, `dist`, `release`, `test-results`, `playwright-report`).
  - Scripts: `dev` (`vite build --watch`), `build`, `typecheck` (`tsc --noEmit`), `lint`, `test` (`vitest run`), `test:e2e`, `check`, `icons`, `zip`.
  - Vite multi-entry: `src/popup/index.html`, `src/options/index.html`, `src/background/index.ts`. Background phải ra đúng `dist/background.js` (dùng `output.entryFileNames`), các chunk khác vào `assets/`.
  - **Nghiệm thu:** `npm run check` pass với 1 test mẫu; `npm run build` sinh `dist/background.js`, `dist/manifest.json` cùng 2 file HTML.

- [ ] **Task 1 — Manifest, icon, locale, khung trang**
  - `public/manifest.json` theo mục 3.3; `public/icons/icon.svg` + `scripts/gen-icons.mjs` sinh 4 PNG.
  - `_locales/en` và `_locales/vi` có tối thiểu `extName`, `extDescription`, `cmdToggle`.
  - Popup và options hiển thị tiêu đề lấy từ i18n; background `console.info` khi khởi động.
  - **Nghiệm thu:** load unpacked không lỗi; bấm icon mở được popup; mở được trang options; đổi ngôn ngữ Chrome sang `vi` thì thấy tên tiếng Việt.

- [ ] **Task 2 — Core types, defaults, schema, migrate**
  - `types.ts` đúng mục 4. `defaults.ts`: mode `direct`, chưa có profile và rule, settings mặc định.
  - `schema.ts`: hàm `validateProfile`, `validateRule`, `validateState` trả về `{ ok: true, value } | { ok: false, errors: { path: string; code: string }[] }`. Viết tay, không thêm thư viện validate. Kiểm tra: host hợp lệ, port trong khoảng, auth không đi cùng socks, tên profile trùng, regex biên dịch được, CIDR IPv4 hợp lệ, `target.profileId` tồn tại, `mode.profileId` tồn tại.
  - `migrate.ts`: `migrate(unknown): AppState`. Dữ liệu rỗng/hỏng → trả về defaults (không throw).
  - **Nghiệm thu:** ≥ 25 unit test bao các trường hợp hợp lệ/không hợp lệ ở trên.

- [ ] **Task 3 — Storage layer**
  - `shared/storage.ts`: `getState()` (gọi `migrate`), `setState(s)` (validate trước khi ghi, sai thì throw), `updateState(fn)`, `subscribe(cb)` (trả về hàm hủy).
  - `tests/setup/chrome-mock.ts`: fake `chrome.storage.local`/`session` trong bộ nhớ, có phát `onChanged`.
  - **Nghiệm thu:** unit test cho get/set/update/subscribe, ghi state sai bị từ chối, storage hỏng thì trả về defaults.

### Giai đoạn B — Lõi proxy

- [ ] **Task 4 — Rule matcher + PAC generator**
  - `rule-matcher.ts`: `resolveTarget(state, host): { target: Target; ruleId: string | null; reason: 'local' | 'rule' | 'default' }`.
  - `pac-generator.ts`: `generatePac(state): string` theo mục 4.1 và 4.2.
  - **Test tương đương (bắt buộc):** chạy PAC sinh ra trong `node:vm` với polyfill `shExpMatch`, `dnsDomainIs`, `isPlainHostName`, `isInNet` (chỉ nhận IP literal), rồi so kết quả với `resolveTarget` trên bảng ≥ 40 host (subdomain, hoa/thường, IP, localhost, regex, wildcard, rule tắt, rule mồ côi, profile socks5...).
  - Test injection: pattern chứa `"`, `\`, `);` không phá được PAC (PAC vẫn parse được và hành vi đúng).
  - **Nghiệm thu:** toàn bộ test tương đương + injection pass.

- [ ] **Task 5 — Config builder**
  - `config-builder.ts`: `buildProxyConfig(state)` trả về object `ProxyConfig` cho `chrome.proxy.settings.set({ value, scope: 'regular' })`:
    - `direct` → `{ mode: 'direct' }`; `system` → `{ mode: 'system' }`
    - `fixed` → `{ mode: 'fixed_servers', rules: { singleProxy: { scheme, host, port }, bypassList } }` (gộp thêm bypass local nếu `bypassLocal`)
    - `auto` → `{ mode: 'pac_script', pacScript: { data: generatePac(state) } }`
    - `fixed` trỏ tới profile không tồn tại → fallback `direct` + trả về cảnh báo.
  - **Nghiệm thu:** unit test cho mọi mode và trường hợp fallback.

- [ ] **Task 6 — Background: proxy controller + badge**
  - `proxy-controller.ts`: `applyState()` đọc storage → build config → `chrome.proxy.settings.set`, chạy tuần tự. Gọi khi `onInstalled`, `onStartup`, `storage.onChanged` (key `state`).
  - Đọc `levelOfControl` sau khi set; nếu `controlled_by_other_extensions` hoặc `not_controllable` thì lưu vào `storage.session` key `status` để UI hiển thị.
  - `badge.ts`: direct → không text, icon xám (`setBadgeText('')`); system → `SYS`; fixed → 3 ký tự đầu tên profile + nền màu profile; auto → `AUTO`; có lỗi → `!` nền đỏ.
  - **Nghiệm thu (thủ công, ghi kết quả vào nhật ký):** sửa state trực tiếp qua console của service worker (`chrome.storage.local.set(...)`) → `chrome://net-internals/#proxy` (hoặc `chrome.proxy.settings.get`) phản ánh đúng; badge đổi đúng; reload extension thì config vẫn được áp dụng lại.

- [ ] **Task 7 — Xác thực proxy**
  - `auth.ts`: `chrome.webRequest.onAuthRequired` với `['asyncBlocking']`, chỉ xử lý khi `details.isProxy`. Tìm profile khớp `challenger.host` + `challenger.port`, trả `authCredentials`.
  - Chống vòng lặp: đếm số lần theo `requestId` (Map trong bộ nhớ); lần thứ 2 cho cùng request → `{ cancel: true }` và ghi lỗi "sai thông tin đăng nhập". Dọn Map ở `onCompleted`/`onErrorOccurred`.
  - Không có profile khớp → trả `{}` (để Chrome xử lý mặc định).
  - **Nghiệm thu:** unit test logic chọn credentials + chống vòng lặp (tách hàm thuần, mock `details`). Phần E2E thật ở Task 16.

- [ ] **Task 8 — Xử lý lỗi proxy**
  - `errors.ts`: lắng nghe `chrome.proxy.onProxyError`; ghi vào `storage.session` key `errors` (ring buffer 50 mục: `{ at, error, details, fatal }`); đặt badge `!`.
  - `settings.notifyOnError` bật và lỗi `fatal` → `chrome.notifications.create`, tối đa 1 notification / 30 giây.
  - Badge `!` bị xóa khi người dùng `CLEAR_ERRORS` hoặc khi apply thành công một state mới.
  - **Nghiệm thu:** unit test cho ring buffer + throttle (dùng fake timers); thủ công: đặt profile trỏ tới `127.0.0.1:1` ở mode fixed → mở một trang → thấy badge `!` và notification.

- [ ] **Task 9 — Messaging + kiểm tra kết nối**
  - `shared/messaging.ts` định nghĩa kiểu:
    ```ts
    type Req =
      | { type: 'GET_STATUS' }       // → { levelOfControl, mode, errors, warnings }
      | { type: 'TEST_CONNECTION' }  // → { ok, latencyMs?, ip?, error? }
      | { type: 'CLEAR_ERRORS' };    // → { ok: true }
    ```
    `sendMessage<R extends Req>(req)` trả về đúng kiểu response.
  - `health-check.ts`: `fetch(healthCheckUrl, { cache: 'no-store' })` với timeout 8 giây (AbortController), đo latency; nếu `ipCheckUrl` khác rỗng thì lấy IP công khai. Request đi qua đúng cấu hình proxy đang bật.
  - **Nghiệm thu:** unit test router với fetch mock (thành công, timeout, HTTP lỗi); thủ công: gọi `TEST_CONNECTION` từ console popup.

### Giai đoạn C — Giao diện

- [ ] **Task 10 — Nền UI dùng chung**
  - `ui/styles/tokens.css`: biến màu cho light/dark, hỗ trợ `prefers-color-scheme` và `data-theme` theo `settings.theme`.
  - Component: `Button`, `Toggle`, `Select`, `TextField` (có hiện lỗi), `Badge`, `ConfirmDialog`, `Toast`.
  - Hook `useAppState()`: đọc state + subscribe thay đổi + `update(fn)`, hiện lỗi validate thành toast.
  - Bổ sung đủ chuỗi i18n en/vi cho mọi text UI từ đây.
  - **Nghiệm thu:** component có thể focus bằng bàn phím, có `aria-label`/label; dark mode đổi đúng khi đổi theme.

- [ ] **Task 11 — Popup**
  - Rộng 340px. Từ trên xuống:
    1. Toggle lớn Bật/Tắt (`direct` ↔ `lastActiveMode`; nếu `lastActiveMode` null và có profile → `fixed` profile đầu tiên; không có profile → mở trang Options).
    2. Chọn mode: System / từng profile (fixed) / Auto.
    3. Thẻ tab hiện tại: domain + target đang áp dụng (`resolveTarget` khi mode auto) + 2 nút nhanh "Đi qua [profile ▾]" / "Luôn trực tiếp" → thêm rule `domain` lên **đầu** danh sách. Trang `chrome://`, file, trang trống → ẩn thẻ này.
    4. Cảnh báo: extension khác đang điều khiển proxy, lỗi gần nhất (nút xóa), rule mồ côi.
    5. Nút "Kiểm tra kết nối" → hiện latency + IP.
    6. Link mở Options.
  - **Nghiệm thu:** mọi thao tác phản ánh ngay ở badge + `chrome.proxy.settings`; đóng rồi mở lại popup thì giữ đúng trạng thái; thêm rule nhanh không tạo bản trùng.

- [ ] **Task 12 — Options: Profiles**
  - Danh sách profile (màu, tên, scheme://host:port, có/không auth). Thêm/sửa trong form, validate realtime bằng `schema.ts`. Ẩn trường auth khi scheme là socks; ô mật khẩu có nút hiện/ẩn.
  - Xóa profile: confirm, cho biết số rule đang trỏ tới; nếu profile đang dùng ở mode fixed hoặc là `defaultTarget` → chuyển về `direct` và báo.
  - Nhân bản profile.
  - **Nghiệm thu:** không lưu được profile sai; xóa profile đang dùng không làm hỏng config (proxy chuyển về direct, không có lỗi trong SW).

- [ ] **Task 13 — Options: Rules**
  - Bảng rule: bật/tắt, loại, pattern, target, ghi chú; nút lên/xuống để đổi ưu tiên; sửa inline hoặc qua form; xóa có undo (toast 5 giây).
  - Chọn target mặc định của mode auto.
  - Ô "Thử URL/host": hiện target + rule khớp (dùng `resolveTarget`), highlight dòng rule đó.
  - Nhập hàng loạt: textarea một domain mỗi dòng + chọn target → tạo rule `domain`; bỏ qua dòng trùng/không hợp lệ, báo số dòng đã thêm/bỏ qua.
  - Đánh dấu rule mồ côi.
  - **Nghiệm thu:** đổi thứ tự rule làm thay đổi kết quả "Thử URL" đúng như PAC thực tế (kiểm tra thủ công với 3 site và ghi vào nhật ký).

- [ ] **Task 14 — Options: General + Backup**
  - General: theme, bypassLocal, notifyOnError, healthCheckUrl, ipCheckUrl (validate URL https), nút "Khôi phục mặc định" (có confirm).
  - `core/backup.ts`: export `{ format: 'smart-proxy-backup', version: 1, exportedAt, state }`; mặc định **xóa mật khẩu**, có checkbox "Bao gồm mật khẩu" kèm cảnh báo.
  - Import: chọn file → validate → hiện tóm tắt (số profile/rule) → confirm **thay thế toàn bộ**. Profile trong file không có mật khẩu nhưng trùng `id` với profile hiện có → giữ mật khẩu cũ.
  - **Nghiệm thu:** unit test `backup.ts` (strip, round-trip, giữ mật khẩu cũ, file hỏng/sai format); export rồi import lại ra state giống hệt.

- [ ] **Task 15 — Context menu + phím tắt**
  - Context menu trên trang (`contexts: ['page']`): "Smart Proxy: thêm domain này" → menu con gồm từng profile + "Luôn trực tiếp". Rebuild menu khi danh sách profile thay đổi (`removeAll` rồi tạo lại, chạy tuần tự).
  - Thêm rule xong mà mode không phải auto → notification gợi ý chuyển sang Auto.
  - Command `toggle-proxy`: cùng logic với toggle trong popup (tách hàm dùng chung trong `core` hoặc `shared`).
  - **Nghiệm thu:** thủ công cả 2 tính năng; menu con cập nhật sau khi thêm/xóa profile mà không cần reload.

### Giai đoạn D — Kiểm thử & phát hành

- [ ] **Task 16 — E2E với Playwright**
  - Chạy Chromium persistent context với `--load-extension=dist`. Dùng `proxy-chain` dựng 2 proxy HTTP local: một không auth, một có auth (`user`/`pass`). Đếm số request đi qua mỗi proxy.
  - Kịch bản:
    1. Mode fixed (proxy không auth) → tải trang test → proxy ghi nhận request.
    2. Mode fixed (proxy có auth) → tải được trang, không hiện hộp thoại đăng nhập.
    3. Sai mật khẩu → request bị hủy, không lặp vô hạn, có lỗi trong log.
    4. Mode auto: rule `domain` A → proxy 1, mặc định DIRECT → chỉ A đi qua proxy. Dùng host do bạn kiểm soát (ví dụ `*.localtest.me` trỏ về 127.0.0.1, hoặc server HTTP local + `--host-resolver-rules`).
    5. Toggle off → không request nào đi qua proxy.
    6. Popup: mở `chrome-extension://<id>/src/popup/index.html`, bấm toggle, kiểm tra `chrome.proxy.settings.get` qua `serviceWorker.evaluate`.
  - **Nghiệm thu:** `npm run test:e2e` pass ổn định 3 lần liên tiếp trên máy local (Windows).

- [ ] **Task 17 — Hoàn thiện & đóng gói**
  - `README.md` (tiếng Việt): tính năng, cài đặt dev, build, load unpacked, cấu trúc, cách chạy test, giới hạn đã biết (SOCKS không hỗ trợ auth trong Chrome, CIDR chỉ áp dụng cho host IPv4 literal, quyền `<all_urls>` dùng để làm gì).
  - Mục **Quyền riêng tư** trong README: không thu thập dữ liệu; chỉ gọi `healthCheckUrl`/`ipCheckUrl` khi người dùng bấm kiểm tra; mật khẩu lưu trong `chrome.storage.local`, không mã hóa.
  - `scripts/zip.mjs` → `release/smart-proxy-<version>.zip` từ `dist/`.
  - Rà lại: không còn `console.log` debug, không còn TODO chưa xử lý.
  - **Nghiệm thu:** `npm run check && npm run build && npm run test:e2e && npm run zip` pass; cài file zip giải nén lên một Chrome profile sạch chạy được đủ luồng chính.

---

## 7. Nhật ký tiến độ (Antigravity cập nhật)

<!-- Mẫu — thêm mục mới ở cuối:
### Task N — <tên> — YYYY-MM-DD
- **Đã làm:** ...
- **File chính:** ...
- **Kết quả kiểm tra:** `npm run check` ✅ | build ✅ | thủ công: ...
- **Lệch so với plan (nếu có):** ...
- **Commit:** <hash>
-->

_(chưa có)_

---

## 8. Đề xuất / Câu hỏi (Antigravity ghi, Claude trả lời)

_(chưa có)_

---

## 9. Review của Claude

**Quy trình review (Claude làm theo khi được gọi review Task N):**
1. Đọc mô tả + tiêu chí nghiệm thu của Task N (mục 6), Definition of Done (mục 5), mục nhật ký của Task N (mục 7).
2. Xem các commit `task(N): ...` (`git log --oneline`, `git show`) — chỉ review phần thay đổi của task này.
3. Chạy `npm run check` và `npm run build`.
4. Đối chiếu: đủ tiêu chí nghiệm thu chưa, có vi phạm kiến trúc (mục 3, 4) không, có bug logic không.
5. Thêm vào cuối mục này một khối theo mẫu dưới. Chỉ dùng `🔁 CẦN SỬA` cho lỗi thật (sai tiêu chí, bug, vi phạm kiến trúc); góp ý nhỏ ghi ở "Gợi ý (không bắt buộc)".
6. Câu trả lời của mục 8 (nếu có) cũng ghi ở đây.

<!-- Mẫu:
### Task N: ✅ DUYỆT | 🔁 CẦN SỬA — YYYY-MM-DD (lần review #k)
- **check/build:** ✅/❌
- **Việc phải sửa:** 1. ... (file:dòng)
- **Gợi ý (không bắt buộc):** ...
-->

_(chưa có)_
