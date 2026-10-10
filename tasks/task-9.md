### Task 9 — Messaging + kiểm tra kết nối — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - `src/shared/messaging.ts`:
    - Định nghĩa kiểu message `RequestMessage` (`GET_STATUS`, `TEST_CONNECTION`, `CLEAR_ERRORS`).
    - Định nghĩa các interface phản hồi: `StatusResponse`, `TestConnectionResponse`, `ClearErrorsResponse`.
    - Định nghĩa helper generic typed `sendMessage<R>(req)`.
  - `src/background/health-check.ts`:
    - `testConnection(state)`: kiểm tra kết nối qua fetch với timeout 8 giây bằng `AbortController`, đo `latencyMs`.
    - Trích xuất địa chỉ IP công khai khi `ipCheckUrl` được định cấu hình (hỗ trợ JSON và plain text).
    - Xử lý lỗi HTTP, timeout (`AbortError`), và lỗi mạng một cách an toàn.
  - `src/background/message-router.ts`:
    - `handleMessage(message)`: xử lý `GET_STATUS` (trả về `levelOfControl`, `mode`, `errors`, `warnings` từ session và orphan rules), `TEST_CONNECTION`, `CLEAR_ERRORS`.
    - `registerMessageRouter()`: đăng ký đồng bộ `chrome.runtime.onMessage` ở top-level service worker, trả lời bất đồng bộ qua `sendResponse`.
  - `src/background/index.ts`: thêm đúng 1 dòng import và 1 dòng gọi `registerMessageRouter()`.
  - `src/core/schema.ts` & `src/core/migrate.ts`: cho phép lưu và giữ lại quy tắc mồ côi (orphan rules) trong AppState khi xóa profile, phục vụ hiển thị nhãn cảnh báo ở popup và options.
  - `tests/setup/chrome-mock.ts`: mở rộng mock hỗ trợ `chrome.runtime.onMessage` và `chrome.runtime.sendMessage`.
  - `tests/unit/messaging.test.ts`: 16 unit tests kiểm tra toàn bộ luồng `GET_STATUS`, kiểm tra kết nối mạng (thành công 204, lấy IP JSON/text, mã lỗi HTTP 502, timeout, lỗi mạng), `CLEAR_ERRORS`, và gọi end-to-end qua `sendMessage`.
- **File chính:** `src/shared/messaging.ts`, `src/background/health-check.ts`, `src/background/message-router.ts`, `src/background/index.ts`, `tests/setup/chrome-mock.ts`, `tests/unit/messaging.test.ts`, `tasks/task-9.md`.
- **Kết quả kiểm tra:** `npm run check` ✅ (10 test files, 106 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅ sinh `dist/background.js` (18.46 kB).
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** xem git log master..HEAD

---

### Task 9: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 106 tests pass) | ✅ `npm run build` pass.
- **Tiêu chí nghiệm thu:**
  - `messaging.ts`: định nghĩa `GET_STATUS`, `TEST_CONNECTION`, `CLEAR_ERRORS` kèm generic `sendMessage`.
  - `health-check.ts`: fetch với timeout 8s AbortController, đo latency, lấy IP công khai an toàn.
  - `message-router.ts`: xử lý đầy đủ các message type, đọc storage session và tính toán cảnh báo.
  - Unit tests bao quát thành công, timeout, HTTP lỗi và gọi end-to-end.
- **Việc phải sửa:** Không có.
