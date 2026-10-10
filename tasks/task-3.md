### Task 3 — Storage layer — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - Xây dựng tầng lưu trữ `src/shared/storage.ts`:
    - `getState()`: đọc `chrome.storage.local['state']`, tự động chuyển qua `migrate()` để luôn trả về `AppState` hợp lệ khi rỗng hoặc hỏng dữ liệu.
    - `setState(nextState)`: kiểm tra hợp lệ chặt chẽ qua `validateState(nextState)`. Nếu không hợp lệ sẽ ném `Error` chi tiết và không sửa đổi storage.
    - `updateState(updater)`: đọc state hiện tại, chạy hàm biến đổi (hỗ trợ cả sync lẫn async updater), validate và lưu vào storage.
    - `subscribe(callback)`: lắng nghe sự kiện `chrome.storage.onChanged` cho area `local` và key `state`, tự động migrate dữ liệu mới trước khi gọi callback, trả về hàm hủy (unsubscribe) gỡ listener sạch sẽ.
  - Tinh chỉnh `src/core/schema.ts`: hỗ trợ kiểm tra profile tồn tại trong `validateMode` và `validateTarget` khi state profiles rỗng.
  - Xây dựng mock in-memory đầy đủ trong `tests/setup/chrome-mock.ts`: giả lập `chrome.storage.local`, `chrome.storage.session` và bộ phát sự kiện `chrome.storage.onChanged`.
  - Viết 13 unit tests chi tiết trong `tests/unit/storage.test.ts` kiểm thử toàn diện mọi trường hợp: get mặc định, storage hỏng, get dữ liệu hợp lệ, set thành công, set từ chối state lỗi, update sync/async, rollback khi updater lỗi, subscribe nhận tin và unsubscribe.
- **File chính:** `src/shared/storage.ts`, `src/core/schema.ts`, `tests/setup/chrome-mock.ts`, `tests/unit/storage.test.ts`, `tasks/task-3.md`.
- **Kết quả kiểm tra:** `npm run check` ✅ (4 test files, 46 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅.
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** xem git log master..HEAD

---

### Task 3: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 46 tests pass) | ✅ `npm run build` pass.
- **Tiêu chí nghiệm thu:**
  - `shared/storage.ts`: `getState` (gọi `migrate`), `setState` (validate trước khi ghi, sai thì throw), `updateState`, `subscribe` (trả về hàm hủy).
  - `tests/setup/chrome-mock.ts`: fake `chrome.storage.local`/`session` trong bộ nhớ, phát `onChanged`.
  - Unit tests bao phủ đầy đủ get/set/update/subscribe, ghi state sai bị từ chối, storage hỏng trả về defaults.
- **Việc phải sửa:** Không có.
