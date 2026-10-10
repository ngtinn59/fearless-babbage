### Task 11 — Popup — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - `src/popup/index.html`: Cố định kích thước popup rộng đúng 340px (`width: 340px; margin: 0; padding: 0; overflow-x: hidden;`).
  - `src/popup/App.tsx`: Triển khai đầy đủ giao diện Popup hoàn chỉnh:
    1. Header: Biểu tượng Smart Proxy, tiêu đề, và nút/liên kết cài đặt gọi `chrome.runtime.openOptionsPage()`.
    2. Toggle lớn Bật/Tắt Proxy: chuyển đổi giữa Direct và LastActiveMode (hoặc profile đầu tiên nếu lastActiveMode rỗng, hoặc mở options nếu chưa có profile nào).
    3. Bộ chọn chế độ (Mode Selector): Direct, Tự động PAC rules, Proxy Hệ thống, và danh sách từng Proxy Profile cố định với chấm màu và tên.
    4. Thẻ tab hiện tại (Current Tab Inspection): lấy hostname bằng `chrome.tabs.query`, hiển thị nhãn đích định tuyến được tính toán qua `resolveTarget` trong chế độ auto, và 2 nút nhanh: "Luôn trực tiếp" và "Đi qua [profile ▾]" chèn quy tắc mới lên đầu danh sách `rules` mà không tạo bản trùng lặp. Tự động ẩn khi ở các trang nội bộ/đặc biệt (`chrome://`, `file://`, ...).
    5. Cảnh báo: hiển thị cảnh báo khi tiện ích khác chiếm quyền điều khiển proxy, khi có quy tắc mồ côi, và danh sách lỗi gần nhất kèm nút "Xóa lỗi".
    6. Kiểm tra kết nối: nút "Kiểm tra kết nối" gửi message `TEST_CONNECTION` tới service worker, hiển thị độ trễ (latency ms) và IP công khai hoặc lỗi chi tiết.
    7. Tích hợp Toast phản hồi tức thời cho các thao tác người dùng.
  - `tests/unit/popup.test.ts`: 6 unit tests kiểm tra logic Big Toggle (lưu và phục hồi lastActiveMode, fallback profile), tạo quy tắc nhanh không trùng lặp và đẩy lên đầu, phân giải target tab hiện tại.
- **File chính:** `src/popup/index.html`, `src/popup/App.tsx`, `tests/unit/popup.test.ts`, `tasks/task-11.md`.
- **Kết quả kiểm tra:** `npm run check` ✅ (12 test files, 130 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅.
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** xem git log master..HEAD

---

### Task 11: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 130 tests pass) | ✅ `npm run build` pass.
- **Tiêu chí nghiệm thu:**
  - Popup rộng 340px với đầy đủ 6 phân khu chức năng theo đặc tả.
  - Big toggle chuyển đổi mượt mà giữa Direct và LastActiveMode.
  - Kiểm tra tab hiện tại hiển thị domain và đích đến; thêm rule nhanh chèn lên đầu mảng rules không trùng.
  - Cảnh báo và kiểm tra kết nối tương tác chính xác qua service worker.
- **Việc phải sửa:** Không có.
