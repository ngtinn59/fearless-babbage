# Smart Proxy

**Smart Proxy** là tiện ích mở rộng (Chrome Extension Manifest V3) quản lý và chuyển đổi proxy thông minh một chạm cho trình duyệt Google Chrome và Chromium. Tiện ích hỗ trợ nhiều giao thức (HTTP, HTTPS, SOCKS4, SOCKS5), chế độ định tuyến linh hoạt theo quy tắc PAC, tự động xác thực và kiểm tra kết nối mạng.

---

## 🌟 Tính Năng Nổi Bật

1. **Chế độ hoạt động đa dạng:**
   - **Trực tiếp (Direct):** Tắt proxy, truy cập trực tiếp bằng kết nối mạng gốc.
   - **Hệ thống (System):** Sử dụng cấu hình proxy mặc định của hệ điều hành.
   - **Cố định (Fixed):** Định tuyến toàn bộ lưu lượng qua một proxy chỉ định.
   - **Tự động (Auto PAC):** Định tuyến thông minh theo danh sách quy tắc (Rule-based) biên dịch thành file PAC Script chuẩn, an toàn tuyệt đối chống PAC injection.

2. **Quản lý Profile Proxy mạnh mẽ:**
   - Hỗ trợ giao thức `HTTP`, `HTTPS`, `SOCKS4`, `SOCKS5`.
   - Gán màu sắc và tên nhận diện trực quan cho từng profile.
   - Xác thực tự động (Proxy Authentication): tự động cung cấp thông tin đăng nhập mà không làm gián đoạn việc duyệt web, tích hợp cơ chế chống vòng lặp (loop prevention).
   - Danh sách bỏ qua (Bypass List) và tùy chọn bỏ qua địa chỉ nội bộ (`localhost`, `127.0.0.1`, intranet).

3. **Hệ thống quy tắc định tuyến (Routing Rules):**
   - Hỗ trợ 5 loại khớp: `domain`, `host-wildcard`, `url-wildcard`, `regex`, và `cidr` (IPv4).
   - Kéo/thả hoặc đổi thứ tự ưu tiên (Up/Down) nhanh chóng.
   - Công cụ thử nghiệm rule thời gian thực (Rule Tester): kiểm tra URL/host sẽ đi qua proxy nào ngay lập tức.
   - Nhập hàng loạt domain (Batch Import) với tính năng lọc trùng lặp tự động.
   - Cảnh báo rule mồ côi (Orphan Rules) khi proxy đích bị xóa.

4. **Giao diện hiện đại & tiện ích:**
   - Popup 340px tinh gọn, toggle bật/tắt nhanh, hỗ trợ phím tắt `Alt+Shift+P`.
   - Context Menu chuột phải trên trang web: Thêm domain hiện tại vào proxy chỉ với 1 click.
   - Hỗ trợ Dark Mode / Light Mode theo hệ thống hoặc tùy chọn.
   - Song ngữ đầy đủ: Tiếng Việt và Tiếng Anh (`_locales`).
   - Sao lưu & khôi phục (Backup & Restore): Xuất/nhập file JSON cấu hình, an toàn mật khẩu.

---

## 🚀 Cài Đặt & Phát Triển

### Yêu cầu môi trường
- Node.js >= 20.0.0
- npm >= 9.0.0

### Cài đặt dependencies
```bash
npm install
```

### Chạy chế độ phát triển (Watch mode)
```bash
npm run dev
```

### Build sản phẩm
```bash
npm run build
```
Thư mục `dist/` sẽ được tạo ra chứa toàn bộ mã nguồn đóng gói sẵn sàng nạp vào Chrome.

### Nạp tiện ích vào Chrome (Load Unpacked)
1. Mở trình duyệt Chrome và truy cập: `chrome://extensions/`
2. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
3. Nhấn nút **Tải tiện ích đã giải nén (Load unpacked)**.
4. Chọn thư mục `dist` trong thư mục dự án này.

---

## 🧪 Kiểm Thử (Testing)

Dự án có hệ thống kiểm thử tự động toàn diện:

### 1. Kiểm tra chất lượng mã nguồn (Typecheck, Lint, Unit Tests)
```bash
npm run check
```
Lệnh này sẽ chạy tuần tự:
- `npm run typecheck`: Kiểm tra TypeScript với `tsc --noEmit`.
- `npm run lint`: Kiểm tra chuẩn code với ESLint.
- `npm run test`: Chạy toàn bộ 160+ unit tests với Vitest.

### 2. Kiểm thử End-to-End (E2E) với Playwright
```bash
npm run test:e2e
```
Chạy bộ kiểm thử tự động khởi chạy Chrome Chromium thật và 2 proxy server local (`proxy-chain`), xác minh 6 kịch bản hoạt động:
1. Proxy cố định không auth.
2. Proxy cố định có auth (vượt qua xác thực tự động).
3. Sai mật khẩu proxy (hủy request, ghi lỗi, chống lặp).
4. Chế độ PAC tự động định tuyến đúng domain.
5. Tắt proxy về Direct mode.
6. Thao tác bật/tắt trên Popup UI thật.

### 3. Đóng gói phân phối (.zip)
```bash
npm run zip
```
Tạo file `release/smart-proxy-1.0.0.zip` sẵn sàng để chia sẻ hoặc phát hành lên Chrome Web Store.

---

## 📁 Cấu Trúc Thư Mục

```text
├── public/                  # Manifest V3, icon, từ điển i18n
│   ├── _locales/            # Đa ngôn ngữ (en, vi)
│   ├── icons/               # Icon 16, 32, 48, 128
│   └── manifest.json        # Cấu hình Chrome Manifest V3
├── src/
│   ├── background/          # Background Service Worker
│   │   ├── auth.ts          # Xử lý xác thực proxy & chống vòng lặp
│   │   ├── badge.ts         # Hiển thị trạng thái trên badge icon
│   │   ├── commands.ts      # Phím tắt Alt+Shift+P
│   │   ├── context-menu.ts  # Menu ngữ cảnh chuột phải trên trang
│   │   ├── errors.ts        # Ring buffer lỗi & thông báo
│   │   ├── health-check.ts  # Đo độ trễ kết nối & kiểm tra IP công khai
│   │   ├── index.ts         # Điểm khởi chạy service worker
│   │   ├── message-router.ts# Xử lý thông điệp runtime
│   │   └── proxy-controller.ts # Bộ điều khiển cài đặt proxy Chrome
│   ├── core/                # Module thuật toán thuần TypeScript (100% không phụ thuộc Chrome API)
│   │   ├── backup.ts        # Xuất và nhập bản sao lưu JSON
│   │   ├── config-builder.ts# Chuyển đổi AppState thành Chrome ProxyConfig
│   │   ├── defaults.ts      # Giá trị khởi tạo mặc định
│   │   ├── migrate.ts       # Nâng cấp phiên bản schema lưu trữ
│   │   ├── pac-generator.ts # Sinh mã PAC script bảo mật chống injection
│   │   ├── rule-matcher.ts  # Thuật toán so khớp URL và quy tắc
│   │   ├── schema.ts        # Bộ xác thực dữ liệu chặt chẽ
│   │   ├── toggle.ts        # Logic chuyển đổi bật/tắt proxy
│   │   └── types.ts         # Định nghĩa kiểu dữ liệu toàn hệ thống
│   ├── options/             # Trang Cài đặt (Options Page)
│   │   ├── pages/           # Profiles, Rules, General, Backup
│   │   └── App.tsx          # Ứng dụng Preact trang Options
│   ├── popup/               # Cửa sổ Popup nhanh (Popup Page)
│   │   └── App.tsx          # Ứng dụng Preact popup 340px
│   ├── shared/              # Thư viện dùng chung (storage, messaging, i18n)
│   └── ui/                  # Design system, components, token CSS
├── tests/
│   ├── e2e/                 # Kiểm thử Playwright E2E với Chrome & proxy-chain
│   ├── setup/               # Chrome API In-memory Mock controller
│   └── unit/                # 17 bộ unit test toàn diện
├── scripts/                 # Công cụ đóng gói zip và sinh icon
└── package.json             # Cấu hình dự án & dependencies
```

---

## ⚠️ Giới Hạn Đã Biết (Known Limitations)

1. **Giao thức SOCKS không hỗ trợ xác thực trong Chrome:**
   - Đây là giới hạn từ kiến trúc mạng cốt lõi của Chromium. Chrome không kích hoạt sự kiện `chrome.webRequest.onAuthRequired` cho các kết nối thông qua SOCKS proxy (chỉ hỗ trợ HTTP/HTTPS proxy). Vì vậy, trường nhập tài khoản/mật khẩu được ẩn khi chọn scheme SOCKS.
2. **Quy tắc IP/CIDR:**
   - Trong PAC script của Chrome, hàm `isInNet()` so khớp CIDR áp dụng cho địa chỉ IPv4 literal (ví dụ `192.168.1.0/24`). Đối với tên miền chữ, hàm sẽ giải quyết DNS phân giải IP trước khi so khớp.
3. **Mục đích của quyền `<all_urls>`:**
   - Tiện ích sử dụng quyền `<all_urls>` và `webRequestAuthProvider` để lắng nghe sự kiện `chrome.webRequest.onAuthRequired`. Quyền này cho phép tiện ích tự động cung cấp thông tin đăng nhập proxy cho bất kỳ trang web nào người dùng truy cập qua proxy có bảo vệ mà không làm đứt đoạn kết nối. Tiện ích **không can thiệp, không đọc và không lưu trữ** nội dung request duyệt web của người dùng.

---

## 🔒 Quyền Riêng Tư (Privacy Policy)

- **Không thu thập dữ liệu:** Tiện ích Smart Proxy hoàn toàn không thu thập, không theo dõi và không gửi bất kỳ dữ liệu cá nhân hay lịch sử duyệt web nào về máy chủ từ xa.
- **Yêu cầu mạng có kiểm soát:** Tiện ích chỉ thực hiện kết nối HTTP khi:
  - Người dùng chủ động nhấn nút **"Kiểm tra kết nối"** trong Popup (gọi tới `healthCheckUrl` và `ipCheckUrl` do người dùng cấu hình).
- **Lưu trữ cục bộ:** Mọi cấu hình (profiles, rules, cài đặt) được lưu trữ hoàn toàn nội bộ trên máy tính của bạn qua API `chrome.storage.local`.
- **Mật khẩu Proxy:** Mật khẩu proxy được lưu trong `chrome.storage.local` ở dạng văn bản không mã hóa nhằm phục vụ việc xác thực tự động với Chrome. Khi xuất file sao lưu JSON, tính năng mặc định sẽ **xóa toàn bộ mật khẩu** để đảm bảo an toàn trừ khi bạn chọn lưu mật khẩu có cảnh báo.

---

## 📄 Bản Quyền

Phát triển bởi đội ngũ công nghệ theo chuẩn Manifest V3. Giấy phép mã nguồn mở MIT.
