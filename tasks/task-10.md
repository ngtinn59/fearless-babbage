### Task 10 — Nền UI dùng chung — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - `src/ui/styles/tokens.css`: Thiết lập toàn bộ CSS variables cho theme light, system dark qua `@media (prefers-color-scheme: dark)`, và override rõ ràng qua `[data-theme="light"]` / `[data-theme="dark"]`. Hỗ trợ màu semantic, typography, radii, shadows, transitions.
  - `src/ui/styles/base.css`: Reset, cấu trúc typography, focus ring trợ năng (`:focus-visible`), form controls, và utilities.
  - Components Preact (`src/ui/components/`):
    - `Button`: Hỗ trợ 4 variants (`primary`, `secondary`, `danger`, `ghost`), 3 sizes, loading state, disabled, `autoFocus`, accessible focus và aria.
    - `Toggle`: Switch component trợ năng đầy đủ với `role="switch"`, `aria-checked`, hỗ trợ phím Space / Enter.
    - `Select`: Dropdown chọn với label, thông báo lỗi `role="alert"`, `aria-invalid`, và `aria-describedby`.
    - `TextField`: Input cho text / number / password / url, có hiển thị lỗi `role="alert"`, `aria-invalid`.
    - `Badge`: Nhãn hiển thị trạng thái (info, success, warning, danger, neutral) và hỗ trợ màu hex tùy chỉnh của Profile.
    - `ConfirmDialog`: Hộp thoại modal xác nhận có `role="alertdialog"`, `aria-modal="true"`, đóng bằng phím Escape hoặc click overlay.
    - `Toast`: Thông báo nổi auto-dismiss với `role="status"` / `role="alert"`, nút đóng.
  - `src/ui/hooks/useAppState.ts`: Custom hook đọc state ban đầu qua `getState()`, lắng nghe thay đổi qua `subscribe()`, tự động đồng bộ `data-theme` trên `document.documentElement` theo `settings.theme`, và cập nhật an toàn với `updateState()`.
  - i18n (`public/_locales/en/messages.json` & `public/_locales/vi/messages.json`): Bổ sung đầy đủ toàn bộ chuỗi đa ngôn ngữ (tiếng Anh và tiếng Việt) cho toàn bộ UI Popup và Options.
  - `tests/unit/ui-components.test.ts`: 18 unit tests kiểm tra cấu trúc component, accessibility roles, switch keyboard handlers, badge styling, modal behavior, toast roles, và tích hợp state hook.
- **File chính:** `src/ui/styles/tokens.css`, `src/ui/styles/base.css`, `src/ui/components/*`, `src/ui/hooks/useAppState.ts`, `public/_locales/en/messages.json`, `public/_locales/vi/messages.json`, `tests/unit/ui-components.test.ts`, `tasks/task-10.md`.
- **Kết quả kiểm tra:** `npm run check` ✅ (11 test files, 124 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅.
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** xem git log master..HEAD

---

### Task 10: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 124 tests pass) | ✅ `npm run build` pass.
- **Tiêu chí nghiệm thu:**
  - CSS tokens hỗ trợ đầy đủ light/dark theo system và data-theme.
  - Bộ 7 components (Button, Toggle, Select, TextField, Badge, ConfirmDialog, Toast) đạt chuẩn trợ năng keyboard focus, ARIA roles.
  - Hook useAppState đồng bộ state và theme.
  - Bản dịch i18n đầy đủ cho cả tiếng Anh và tiếng Việt.
- **Việc phải sửa:** Không có.
