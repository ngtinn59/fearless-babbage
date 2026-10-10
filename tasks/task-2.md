### Task 2 — Core types, defaults, schema, migrate — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - Định nghĩa đầy đủ mô hình dữ liệu trong `src/core/types.ts` theo mục 4: `ProxyScheme`, `ProxyProfile`, `Target`, `RuleMatchType`, `Rule`, `Mode`, `Settings`, `AppState`.
  - Tạo `src/core/defaults.ts`: `DEFAULT_SETTINGS`, `DEFAULT_STATE`, cùng các hàm khởi tạo độc lập `createDefaultSettings()`, `createDefaultState()`.
  - Viết tay toàn bộ validation trong `src/core/schema.ts` (không dùng thư viện ngoài):
    - `validateProfile`: kiểm tra host hợp lệ (không chứa port/scheme/path), port trong khoảng 1–65535, auth chỉ áp dụng cho http/https (báo lỗi `AUTH_NOT_ALLOWED_FOR_SOCKS` khi đi cùng socks4/socks5), tên profile trùng, màu hex.
    - `validateRule`: kiểm tra regex biên dịch được, CIDR IPv4 hợp lệ, kiểm tra tồn tại của `target.profileId` trong danh sách profiles.
    - `validateSettings`: kiểm tra theme, bypassLocal, notifyOnError, URL healthCheckUrl và ipCheckUrl https.
    - `validateState`: kiểm tra toàn bộ AppState, mode `fixed` và `auto.defaultTarget` trỏ tới profileId tồn tại, `lastActiveMode` không được là `direct`.
  - Viết hàm `migrate(raw: unknown): AppState` trong `src/core/migrate.ts`: dữ liệu rỗng, hỏng hoặc kiểu dữ liệu bất kỳ đều chuyển đổi an toàn về state hợp lệ, không bao giờ throw.
  - Toàn bộ code trong `src/core/` là TypeScript thuần, tuyệt đối không gọi `chrome.*`.
  - Viết 30 unit test chi tiết bao phủ toàn bộ các trường hợp hợp lệ/không hợp lệ trong `tests/unit/core.test.ts`.
- **File chính:** `src/core/types.ts`, `src/core/defaults.ts`, `src/core/schema.ts`, `src/core/migrate.ts`, `tests/unit/core.test.ts`.
- **Kết quả kiểm tra:** `npm run check` ✅ (3 test files, 33 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅.
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** c01dd46

---

### Task 2: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 33 tests pass) | ✅ `npm run build` pass.
- **Tiêu chí nghiệm thu:**
  - `types.ts` khớp chính xác mục 4.
  - `defaults.ts`: mode `direct`, chưa có profile và rule, settings mặc định.
  - `schema.ts`: viết tay toàn bộ, validate host, port, socks auth, regex, CIDR, profile name duplication, mode/target references.
  - `migrate.ts`: chuyển đổi an toàn mọi input hỏng về valid state, không bao giờ throw.
  - Test suite: 30 tests riêng cho core (vượt yêu cầu ≥ 25 tests).
- **Việc phải sửa:** Không có.
