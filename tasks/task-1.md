# Task 1: Manifest V3, Icon, Locale & Khung Trang

**Agent:** A
**Branch:** `task/1`
**Trạng thái:** ✅ DUYỆT

---

## 1. Mục tiêu và phạm vi
- Khởi tạo `public/manifest.json` chuẩn Manifest V3:
  - Khai báo permissions: `proxy`, `storage`, `webRequest`, `webRequestAuthProvider`, `contextMenus`, `notifications`.
  - Khai báo `host_permissions`: `<all_urls>`.
  - Khai báo commands: `toggle-proxy` (phím tắt `Alt+Shift+P`).
- Sinh bộ icon PNG (16, 32, 48, 128) từ `public/icons/icon.svg` qua script `scripts/gen-icons.mjs` sử dụng `sharp`.
- Thiết lập từ điển đa ngôn ngữ trong `public/_locales/en/messages.json` và `public/_locales/vi/messages.json`.
- Khởi tạo khung giao diện ban đầu cho Popup và Options page.

---

## 2. Kiểm thử và xác thực
- `npm run check` pass thành công.
- `npm run icons` sinh đầy đủ 4 icon PNG.
- Build và nạp unpacked hoạt động tốt, hiển thị đúng chuỗi i18n theo ngôn ngữ trình duyệt.
