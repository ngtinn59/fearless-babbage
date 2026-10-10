### Task 5 — Config builder — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - `src/core/config-builder.ts`:
    - Định nghĩa các kiểu cấu hình Chrome ProxyConfig: `ChromeProxyConfigMode`, `ChromeProxyServer`, `ChromeProxyRules`, `ChromePacScript`, `ChromeProxyConfig`, `BuildConfigResult`.
    - Viết hàm thuần `buildProxyConfig(state: AppState): BuildConfigResult`:
      - `direct` → `{ mode: 'direct' }` không cảnh báo.
      - `system` → `{ mode: 'system' }` không cảnh báo.
      - `fixed` → `{ mode: 'fixed_servers', rules: { singleProxy: { scheme, host, port }, bypassList } }`. Tự động thêm `<local>` vào đầu `bypassList` khi `settings.bypassLocal` bật mà không nhân bản nếu đã có sẵn.
      - `fixed` với profileId không tồn tại → fallback `direct` và trả về thông điệp cảnh báo trong mảng `warnings`.
      - `auto` → `{ mode: 'pac_script', pacScript: { data: generatePac(state) } }`.
      - Mọi mode lạ/không xác định → fallback `direct` kèm cảnh báo.
    - Tuyệt đối không gọi bất kỳ API runtime `chrome.*` nào bên trong `src/core/`.
  - `tests/unit/config-builder.test.ts`:
    - Viết 8 unit tests bao quát toàn bộ các mode: direct, system, fixed (HTTP, SOCKS5), tự động chèn `<local>`, không chèn `<local>` khi bypassLocal tắt, chống duplicate `<local>`, trường hợp fallback khi profile thiếu, và mode auto sinh PAC script.
- **File chính:** `src/core/config-builder.ts`, `tests/unit/config-builder.test.ts`, `tasks/task-5.md`.
- **Kết quả kiểm tra:** `npm run check` ✅ (6 test files, 62 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅.
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** xem git log master..HEAD

---

### Task 5: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 62 tests pass) | ✅ `npm run build` pass.
- **Tiêu chí nghiệm thu:**
  - `config-builder.ts`: trả về đúng cấu trúc Chrome ProxyConfig cho cả 4 chế độ.
  - Hỗ trợ bypass local cho mode fixed khi `bypassLocal: true`.
  - Xử lý fallback về direct khi profileId không tồn tại, có cảnh báo rõ ràng.
  - Test suite bao quát 100% các mode và fallback.
- **Việc phải sửa:** Không có.
