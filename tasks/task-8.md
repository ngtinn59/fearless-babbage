### Task 8 — Xử lý lỗi proxy — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - `src/background/errors.ts`:
    - Lắng nghe `chrome.proxy.onProxyError` với `registerErrorHandler()`.
    - `recordProxyError(error, details, fatal)`: ghi nhận lỗi vào `chrome.storage.session` theo ring buffer (tối đa 50 item, gồm `at`, `error`, `details`, `fatal`).
    - Cập nhật badge đỏ `!` khi có lỗi xảy ra.
    - Gửi `chrome.notifications.create` khi `settings.notifyOnError` bật và lỗi fatal; có cơ chế throttle tối đa 1 notification / 30 giây để chống spam.
    - `clearErrors()`: xóa sạch danh sách lỗi trong `storage.session` và phục hồi badge bình thường từ `state`.
  - `src/background/index.ts`: thêm đúng 1 dòng import và 1 dòng gọi `registerErrorHandler()`.
  - `tests/setup/chrome-mock.ts`: mở rộng mock hỗ trợ `chrome.proxy.onProxyError` (`addListener`, `dispatchProxyError`) và `chrome.notifications.create`.
  - `tests/unit/errors.test.ts`: 8 unit tests kiểm tra ring buffer 50 mục, cắt tỉa khi vượt quá, throttle notification 30s, tắt notification khi setting tắt, `clearErrors()` dọn badge, và listener `registerErrorHandler()`.
- **File chính:** `src/background/errors.ts`, `src/background/index.ts`, `tests/setup/chrome-mock.ts`, `tests/unit/errors.test.ts`, `tasks/task-8.md`.
- **Kết quả kiểm tra:** `npm run check` ✅ (9 test files, 90 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅ sinh `dist/background.js` (15.68 kB).
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** xem git log master..HEAD

---

### Task 8: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 90 tests pass) | ✅ `npm run build` pass.
- **Tiêu chí nghiệm thu:**
  - `errors.ts`: lắng nghe `chrome.proxy.onProxyError` ở top-level service worker.
  - Ring buffer tối đa 50 item trong `storage.session`.
  - Badge `!` hiển thị khi có lỗi và xóa khi `clearErrors()`.
  - Throttle notification 30s hoạt động chính xác với timer.
- **Việc phải sửa:** Không có.
