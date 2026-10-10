# Task 15: Context Menu & Phím Tắt (Shortcut Commands)

**Agent:** A
**Worktree:** `..\fearless-babbage-t15`
**Branch:** `task/15`
**Trạng thái:** ✅ DUYỆT

---

## 1. Mục tiêu và phạm vi
- Xây dựng chức năng Context Menu (`src/background/context-menu.ts`):
  - Tạo context menu trên trang (`contexts: ['page']`): "Smart Proxy: Thêm domain này".
  - Danh mục con gồm từng proxy profile ("Đi qua [tên profile]") + đường phân cách + mục "Luôn trực tiếp".
  - Chạy tuần tự (`rebuildContextMenu` dùng Promise queue) và tự động cập nhật khi danh sách profile thay đổi qua storage subscriber mà không cần reload extension.
  - Khi người dùng click chọn: trích xuất hostname hợp lệ, tạo rule kiểu `domain` đưa lên đầu danh sách rule (nếu domain đã có thì cập nhật target và di chuyển lên đầu danh sách, tránh tạo trùng lặp).
  - Nếu chế độ hiện tại không phải là `auto`, hiển thị thông báo Chrome notification gợi ý chuyển sang chế độ Tự động (Auto).
- Xây dựng module dùng chung `src/core/toggle.ts`:
  - Hàm thuần `toggleProxyMode(state)` xử lý logic bật/tắt proxy:
    - Nếu đang bật (fixed, auto, system) → chuyển về `direct` và lưu lại `lastActiveMode`.
    - Nếu đang tắt (`direct`) → khôi phục `lastActiveMode` nếu có, hoặc chuyển sang fixed với profile đầu tiên, hoặc báo `shouldOpenOptions: true` nếu chưa có profile nào.
  - Tái sử dụng đồng nhất giữa Popup (`src/popup/App.tsx`) và Background command shortcut.
- Xây dựng xử lý phím tắt (`src/background/commands.ts`):
  - Lắng nghe `chrome.commands.onCommand` với lệnh `'toggle-proxy'` (phím tắt `Alt+Shift+P`).
  - Sử dụng `toggleProxyMode` để cập nhật trạng thái lưu trữ hoặc mở trang cài đặt.
- Tích hợp vào `src/background/index.ts` theo đúng quy ước: mỗi tính năng 1 dòng import + 1 lệnh gọi `registerXxx()`.

---

## 2. Kiểm thử và xác thực
- Đã tạo `tests/unit/toggle.test.ts` (5 test cases) kiểm tra trọn vẹn logic chuyển đổi mode của `toggleProxyMode`.
- Đã tạo `tests/unit/context-menu-and-commands.test.ts` (8 test cases):
  - Trích xuất hostname từ các loại URL web, loại bỏ các scheme đặc biệt như chrome://.
  - Tạo đầy đủ menu gốc, menu con cho các profile, separator, và mục trực tiếp.
  - Thao tác click menu tạo rule mới ở đầu danh sách và gửi notification khi mode không phải auto.
  - Thao tác click không gửi notification thừa khi mode đã là auto.
  - Di chuyển rule cũ lên đầu khi thêm lại domain đã có.
  - Nhận phím tắt `toggle-proxy` và cập nhật state lưu trữ qua lại giữa Direct và Profile.
  - Tự động rebuild menu khi danh sách profile thay đổi trong storage.
- Mở rộng mock `tests/setup/chrome-mock.ts` hỗ trợ đầy đủ `chrome.contextMenus` và `chrome.commands`.
- Kết quả chạy kiểm tra:
  - `npm run check`: 17 test files passed (167 unit tests), 0 lint error, 0 type error.
  - `npm run build`: Build thành công ra `dist/` (Popup, Options, Background worker).

---

## 3. Tự đánh giá và Review (Self-Review Checklist)
- [x] `src/core/toggle.ts` 100% thuần TypeScript (không phụ thuộc Chrome API).
- [x] `src/background/index.ts` tuân thủ đúng quy tắc: 1 dòng import + 1 hàm `registerXxx()` cho mỗi tính năng.
- [x] Không cài thêm dependencies mới vào `package.json`.
- [x] Logic toggle đồng nhất 100% giữa Popup UI và background command shortcut.
- [x] Quản lý rebuild menu tuần tự chống race condition.
