# Task 16: Kiểm Thử Toàn Diện E2E với Playwright

**Agent:** A
**Worktree:** `..\fearless-babbage-t16`
**Branch:** `task/16`
**Trạng thái:** ✅ DUYỆT

---

## 1. Mục tiêu và phạm vi
- Xây dựng bộ kiểm thử End-to-End (E2E) với Playwright trong `tests/e2e/proxy.spec.ts`, khởi chạy Chromium persistent context với extension thật đã build (`--load-extension=dist`).
- Dựng các proxy server HTTP nội bộ dùng thư viện `proxy-chain`:
  - Proxy không yêu cầu xác thực (`unauthProxy`).
  - Proxy yêu cầu xác thực (`authProxy`) với `user: testuser`, `pass: testpass`.
  - Proxy kiểm tra sai mật khẩu (`badAuthProxy`).
- Hiện thực đầy đủ 6 kịch bản kiểm thử:
  1. **Kịch bản 1 (Mode fixed - Không auth):** Trình duyệt gửi request qua proxy unauthenticated, tải trang thành công, proxy ghi nhận đúng số request.
  2. **Kịch bản 2 (Mode fixed - Có auth):** Trình duyệt gửi request qua proxy authenticated, background tự động xử lý `onAuthRequired` và tiêm credentials, trang tải thành công không hiện hộp thoại hỏi mật khẩu của Chrome.
  3. **Kịch bản 3 (Sai mật khẩu):** Cung cấp mật khẩu không chính xác, cơ chế chống vòng lặp trong `auth.ts` phát hiện sau 2 lần thử, hủy request (`cancel: true`), ghi nhận lỗi chi tiết vào `storage.session.errors`, ngăn chặn triệt để vòng lặp request vô tận.
  4. **Kịch bản 4 (Mode auto - Quy tắc PAC):** Rule domain `site-a.custom` trỏ tới proxy, còn `defaultTarget` là `DIRECT`. Truy cập `site-a.custom` đi qua proxy và ghi nhận host; truy cập domain khác `site-b.custom` đi trực tiếp và hoàn toàn không chạm vào proxy.
  5. **Kịch bản 5 (Toggle off - Direct mode):** Chuyển chế độ sang `direct`, các request không đi qua proxy.
  6. **Kịch bản 6 (Popup UI Interaction):** Mở trang Popup UI thật của extension (`chrome-extension://<id>/src/popup/index.html`), click nút Switch toggle lớn, kiểm tra `chrome.proxy.settings.get` trong Service Worker chuyển đổi chính xác giữa `direct` và `fixed_servers`.

---

## 2. Kiểm thử và xác thực
- Cấu hình Playwright (`playwright.config.ts`) với `workers: 1`, chạy tuần tự độc lập.
- Kết quả chạy kiểm thử:
  - `npm run check`: 17 test files passed (167 unit tests), 0 lỗi typecheck, 0 lỗi lint.
  - `npm run test:e2e`: Đạt 100% (6/6 kịch bản) ổn định 3 lần liên tiếp:
    - Lần 1: 6 passed (8.0s)
    - Lần 2: 6 passed (8.0s)
    - Lần 3: 6 passed (8.1s)

---

## 3. Tự đánh giá và Review (Self-Review Checklist)
- [x] Không cài thêm dependencies vào `package.json` (sử dụng `@playwright/test` và `proxy-chain` có sẵn).
- [x] Không sửa `src/core/` (giữ nguyên tính độc lập).
- [x] Không phụ thuộc vào internet công cộng (dùng proxy-chain local và DNS ảo).
- [x] Dọn dẹp an toàn các thư mục tạm và server sau khi chạy test (`afterAll`).
