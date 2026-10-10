### Task 6 — Background: proxy controller + badge — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - `src/background/badge.ts`:
    - `updateBadge(state, hasError)`:
      - Khi có lỗi (`hasError: true`): đặt badge `!` nền đỏ `#dc2626`.
      - Mode `direct`: xóa badge text (chuỗi rỗng).
      - Mode `system`: badge `SYS` nền xám trung tính `#475569`.
      - Mode `fixed`: lấy 3 ký tự đầu của tên profile (uppercase), nền theo màu `profile.color`.
      - Mode `auto`: badge `AUTO` nền xanh lá `#16a34a`.
  - `src/background/proxy-controller.ts`:
    - `applyState()`: đọc state mới nhất từ `getState()`, sinh `config` từ `buildProxyConfig(state)`, gọi `chrome.proxy.settings.set({ value: config, scope: 'regular' })`.
    - Đọc `levelOfControl` qua `chrome.proxy.settings.get({})`. Xác định xem proxy có bị chiếm quyền bởi extension khác hoặc chính sách quản trị không (`controlled_by_other_extensions` hoặc `not_controllable`), lưu vào `chrome.storage.session` key `status`.
    - Gọi `updateBadge(state)` để đồng bộ icon badge ngay lập tức.
    - Hàng đợi Promise `enqueueApplyState()` đảm bảo các lần áp dụng cấu hình chạy tuần tự tuyệt đối, không race condition.
    - `registerProxyController()`: đăng ký đồng bộ các listener top-level (`runtime.onInstalled`, `runtime.onStartup`, `storage.onChanged` cho key `state`) và tự động gọi `enqueueApplyState()` khi service worker khởi động.
  - `src/background/index.ts`: thêm đúng 1 dòng import và 1 dòng gọi `registerProxyController()`.
  - `tests/setup/chrome-mock.ts`: mở rộng mock đầy đủ cho `chrome.action`, `chrome.proxy.settings` và `chrome.runtime`.
  - `tests/unit/proxy-controller.test.ts`: 10 unit tests kiểm thử toàn diện badge, apply direct, apply fixed, kiểm tra `levelOfControl`, queue tuần tự và đăng ký lifecycle.
- **File chính:** `src/background/badge.ts`, `src/background/proxy-controller.ts`, `src/background/index.ts`, `tests/setup/chrome-mock.ts`, `tests/unit/proxy-controller.test.ts`, `tasks/task-6.md`.
- **Kết quả kiểm tra:** `npm run check` ✅ (7 test files, 72 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅ sinh `dist/background.js` (13.77 kB).
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** xem git log master..HEAD

---

### Task 6: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 72 tests pass) | ✅ `npm run build` pass (sinh background.js hoàn chỉnh).
- **Tiêu chí nghiệm thu:**
  - `proxy-controller.ts`: đọc storage, build config, set proxy settings, tuần tự hóa hàng đợi, đăng ký onInstalled/onStartup/onChanged.
  - Kiểm tra `levelOfControl` và lưu session status.
  - `badge.ts`: hiển thị đúng badge cho mọi mode và cờ lỗi.
  - `index.ts`: tuân thủ đúng 1 dòng import + 1 dòng gọi hàm.
- **Việc phải sửa:** Không có.
