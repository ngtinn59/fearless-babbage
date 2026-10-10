### Task 7 — Xác thực proxy — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - `src/background/auth.ts`:
    - `findMatchingProfileAuth(profiles, challenger)`: tìm profile khớp host (không phân biệt hoa/thường) và port của proxy được yêu cầu xác thực.
    - `handleAuthRequired(details, profiles, attemptsMap)`:
      - Bỏ qua khi `isProxy: false` (xác thực máy chủ đích, không phải proxy).
      - Lần 1: cung cấp credentials `{ username, password }` nếu có profile khớp.
      - Lần 2 trở đi cho cùng `requestId`: ghi log cảnh báo và trả về `{ cancel: true }` để hủy request, chống lặp vô hạn (infinite 407 retry loop) khi sai thông tin đăng nhập.
      - Không có profile khớp: trả về `{}` để Chrome xử lý mặc định.
    - `registerAuthHandler()`: đăng ký đồng bộ `chrome.webRequest.onAuthRequired` với `['asyncBlocking']`, và dọn dẹp Map `authAttempts` khi request hoàn tất (`onCompleted`) hoặc bị lỗi (`onErrorOccurred`).
  - `src/background/index.ts`: thêm đúng 1 dòng import và 1 dòng gọi `registerAuthHandler()`.
  - `tests/unit/auth.test.ts`: 10 unit tests kiểm tra khớp host/port, phân biệt hoa thường, trường hợp thiếu credentials, cấp credentials ở lần 1, chặn lặp ở lần 2, và phân tách các requestId độc lập.
- **File chính:** `src/background/auth.ts`, `src/background/index.ts`, `tests/unit/auth.test.ts`, `tasks/task-7.md`.
- **Kết quả kiểm tra:** `npm run check` ✅ (8 test files, 82 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅ sinh `dist/background.js` (14.87 kB).
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** xem git log master..HEAD

---

### Task 7: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 82 tests pass) | ✅ `npm run build` pass.
- **Tiêu chí nghiệm thu:**
  - `auth.ts`: lắng nghe `onAuthRequired` với `['asyncBlocking']`, kiểm tra `details.isProxy`.
  - Khớp challenger host và port với profile.
  - Cơ chế chống vòng lặp theo `requestId`: lần thứ 2 trả `{ cancel: true }`.
  - Dọn dẹp bộ nhớ trên `onCompleted` và `onErrorOccurred`.
- **Việc phải sửa:** Không có.
