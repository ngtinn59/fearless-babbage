### Task 4 — Rule matcher + PAC generator — 2026-10-10
- **Agent:** Agent A
- **Trạng thái:** ĐÃ DUYỆT
- **Đã làm:**
  - `src/core/rule-matcher.ts`:
    - `isIpInCidr(ip, cidr)`: so khớp địa chỉ IPv4 trong dải CIDR dạng 32-bit integer netmask.
    - `matchWildcard(str, pattern)`: so khớp wildcard `*` và `?` theo chuẩn `shExpMatch` không phân biệt hoa thường.
    - `isLocalHost(host)`: nhận diện các đích đến local theo `settings.bypassLocal` (`localhost`, `*.localhost`, `::1`, hostname plain không có dấu chấm, dải loopback `127.0.0.0/8`).
    - `matchesRule(rule, host)`: so khớp theo từng loại rule (`domain`, `wildcard`, `regex`, `ip-cidr` chỉ khi host là IPv4 literal).
    - `resolveTarget(state, host)`: duyệt rule enabled theo thứ tự mảng, tự động bỏ qua rule trỏ tới profile đã bị xóa, fallback về `mode.defaultTarget` an toàn.
  - `src/core/pac-generator.ts`:
    - `targetToPacString(target, profilesMap)`: chuyển đổi target sang định dạng chuỗi proxy chuẩn của Chrome (`PROXY`, `HTTPS`, `SOCKS5 ...; SOCKS ...`, `SOCKS`, `DIRECT`).
    - `prefixLengthToDottedMask(prefixLength)`: chuyển đổi prefix CIDR sang subnet mask dạng dotted-decimal.
    - `generatePac(state)`: sinh mã JavaScript `FindProxyForURL(url, host)` hoàn chỉnh. Toàn bộ input người dùng đều được bọc qua `JSON.stringify` để chống injection 100%.
  - `tests/unit/matcher-and-pac.test.ts`:
    - Chạy PAC trong `node:vm` với đầy đủ polyfills (`isPlainHostName`, `shExpMatch`, `dnsDomainIs`, `isInNet`).
    - **Test tương đương bắt buộc:** kiểm tra 50 host khác nhau (subdomain, hoa/thường, IP literal, localhost, regex, wildcard, rule disabled, rule mồ côi, SOCKS5...) cho kết quả giữa `resolveTarget` và PAC trong VM giống nhau 100%.
    - **Test injection:** kiểm tra các chuỗi độc hại chứa `"`, `\`, `);`, `return "DIRECT";`, `alert(1)`... vẫn được parse an toàn và không phá vỡ logic PAC.
- **File chính:** `src/core/rule-matcher.ts`, `src/core/pac-generator.ts`, `tests/unit/matcher-and-pac.test.ts`, `tasks/task-4.md`.
- **Kết quả kiểm tra:** `npm run check` ✅ (5 test files, 54 tests passed, 0 lint error, typecheck strict pass) | `npm run build` ✅.
- **Lệch so với plan (nếu có):** Không có.
- **Commit:** xem git log master..HEAD

---

### Task 4: ✅ DUYỆT — 2026-10-10 (lần review #1)
- **check/build:** ✅ `npm run check` pass (typecheck strict, 0 lint error, 54 tests pass) | ✅ `npm run build` pass.
- **Tiêu chí nghiệm thu:**
  - `rule-matcher.ts`: `resolveTarget` đúng ngữ nghĩa mục 4.1.
  - `pac-generator.ts`: `generatePac` đúng mục 4.1 và 4.2, chống injection an toàn qua `JSON.stringify`.
  - Test tương đương VM PAC vs matcher trên 50 hosts (vượt mốc ≥ 40 hosts yêu cầu).
  - Test injection pass, không phá vỡ cú pháp PAC.
- **Việc phải sửa:** Không có.
