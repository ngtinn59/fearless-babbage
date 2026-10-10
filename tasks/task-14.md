# Task 14: Options: Cài Đặt Chung & Sao Lưu / Khôi Phục (General & Backup)

**Agent:** A
**Worktree:** `..\fearless-babbage-t14`
**Branch:** `task/14`
**Trạng thái:** ✅ DUYỆT

---

## 1. Mục tiêu và phạm vi
- Xây dựng module thuần `src/core/backup.ts`:
  - `exportBackup(state, options)`: Định dạng `{ format: 'smart-proxy-backup', version: 1, exportedAt, state }`. Mặc định xóa mật khẩu (thay bằng chuỗi rỗng để đảm bảo schema hợp lệ nhưng bảo mật), có tùy chọn `includePasswords: true`.
  - `importBackup(jsonString, currentState)`: Kiểm tra JSON hợp lệ, format, version 1, validate state qua `validateState`. Đặc biệt: nếu profile nhập vào không có mật khẩu nhưng trùng `id` với profile hiện có trên máy thì giữ nguyên mật khẩu cũ.
  - Xử lý chi tiết các trường hợp file hỏng, sai cấu trúc, sai version, sai schema dữ liệu.
- Xây dựng giao diện `src/options/pages/General.tsx`:
  - Chọn giao diện (Theme: Theo hệ thống, Sáng, Tối).
  - Bật/tắt bỏ qua proxy cho địa chỉ cục bộ (`bypassLocal`).
  - Bật/tắt thông báo lỗi kết nối (`notifyOnError`).
  - Nhập URL kiểm tra kết nối (`healthCheckUrl`, kiểm tra HTTPS hợp lệ).
  - Nhập URL kiểm tra IP công khai (`ipCheckUrl`, kiểm tra HTTPS hoặc cho phép để trống).
  - Khôi phục cài đặt chung về mặc định (có modal xác nhận `ConfirmDialog`).
- Xây dựng giao diện `src/options/pages/Backup.tsx`:
  - Xuất cấu hình ra file JSON: có checkbox "Bao gồm mật khẩu" kèm cảnh báo màu đỏ; tải xuống file `smart-proxy-backup-YYYY-MM-DD.json`.
  - Nhập cấu hình: chọn file JSON, kiểm tra tính hợp lệ, mở modal tóm tắt số lượng profiles/rules và cảnh báo thay thế toàn bộ, sau đó áp dụng.
  - Khôi phục toàn bộ cài đặt gốc (Factory Reset) với modal cảnh báo nguy hiểm.
- Tích hợp 2 tab `'general'` và `'backup'` vào `src/options/App.tsx`.

---

## 2. Kiểm thử và xác thực
- Đã tạo `tests/unit/backup.test.ts` gồm 8 test cases:
  1. `exportBackup()` mặc định xóa mật khẩu.
  2. `exportBackup()` giữ mật khẩu khi `includePasswords: true`.
  3. `importBackup()` khôi phục trọn vẹn state từ file export hợp lệ.
  4. `importBackup()` giữ mật khẩu cũ của profile khi file import không có mật khẩu.
  5. Báo lỗi `FILE_CORRUPT_NOT_VALID_JSON` khi file hỏng.
  6. Báo lỗi `INVALID_BACKUP_FORMAT` khi format không phải `smart-proxy-backup`.
  7. Báo lỗi `UNSUPPORTED_BACKUP_VERSION` khi version không phải 1.
  8. Báo lỗi `INVALID_APP_STATE` khi schema state vi phạm schema validation.
- Kết quả kiểm tra:
  - `npm run check`: 15 test files passed (154 unit tests), 0 lint errors, 0 type errors.
  - `npm run build`: Build thành công ra `dist/` (Popup, Options, SW).

---

## 3. Tự đánh giá và Review (Self-Review Checklist)
- [x] Không sửa `src/core/` ngoài việc bổ sung `src/core/backup.ts` (100% thuần TypeScript).
- [x] Không thêm package mới vào `package.json`.
- [x] Giao diện hỗ trợ đầy đủ phím tắt, dark/light theme, accessibility, song ngữ en/vi.
- [x] Đã xử lý đầy đủ các trường hợp biên của import/export và an toàn mật khẩu.
