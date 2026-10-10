### Task 12 — Options: Profiles — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - `src/options/pages/Profiles.tsx`:
    - Danh sách toàn bộ Profile với màu sắc, tên, giao thức, host:port, nhãn Auth, số lượng quy tắc đang trỏ tới.
    - Thêm / Sửa Profile qua Form modal với validation realtime (màu sắc, scheme, host, port 1-65535, bypass list).
    - Ẩn/hiện trường thông tin Auth khi giao thức là socks4 / socks5; nút bấm Hiện / Ẩn mật khẩu (type text / password).
    - Nhân bản (Duplicate) Profile: tạo bản sao với tên `${name} (Copy)` và UUID mới.
    - Xóa Profile với ConfirmDialog: cảnh báo số rule bị mồ côi; tự động chuyển `mode` và `defaultTarget` về `direct` nếu profile bị xóa đang được dùng cố định.
  - `src/options/App.tsx`: Tích hợp thanh điều hướng 4 tabs (Profiles, Rules, General, Backup) và render `ProfilesPage`.
  - `tests/unit/options-profiles.test.ts`: 10 unit tests kiểm tra validation (tên trùng, port sai, host có scheme, socks auth), thao tác CRUD, nhân bản, và xóa profile an toàn.
- **File chính:** `src/options/pages/Profiles.tsx`, `src/options/App.tsx`, `tests/unit/options-profiles.test.ts`, `tasks/task-12.md`.
- **Kết quả kiểm tra:** `npm run check` ✅ (13 test files, 140 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅.
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** xem git log master..HEAD

---

### Task 12: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 140 tests pass) | ✅ `npm run build` pass.
- **Tiêu chí nghiệm thu:**
  - Danh sách và form profile đầy đủ các trường, validate realtime bằng schema.
  - Ẩn auth với socks, có nút hiện/ẩn mật khẩu.
  - Xóa profile có dialog cảnh báo và fallback an toàn về direct khi profile đang hoạt động.
  - Nhân bản profile hoạt động chính xác.
- **Việc phải sửa:** Không có.
