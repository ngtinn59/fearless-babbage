# Task 13: Options: Trang Quản Lý Rules

**Agent:** A
**Worktree:** `..\fearless-babbage-t13`
**Branch:** `task/13`
**Trạng thái:** ✅ DUYỆT

---

## 1. Mục tiêu và phạm vi
- Xây dựng giao diện Quản lý Rules (`src/options/pages/Rules.tsx`) và tích hợp tab `'rules'` trong `src/options/App.tsx`.
- Hỗ trợ:
  - Bảng danh sách rules với thứ tự ưu tiên (ưu tiên cao hơn ở trên).
  - Bật/tắt rule nhanh (`enabled`), chuyển đổi vị trí Lên / Xuống (Up / Down).
  - Modal Thêm / Chỉnh sửa rule với đầy đủ các trường: loại khớp (`domain`, `host-wildcard`, `url-wildcard`, `regex`, `cidr`), pattern (realtime validation theo đúng matchType), đích chuyển tiếp (`TargetSelector` hỗ trợ Direct, Profile, phân biệt trực quan), và ghi chú (`note`).
  - Xóa rule với toast hoàn tác 5 giây (Undo Toast).
  - Bộ chọn `defaultTarget` khi không khớp rule nào (hỗ trợ Direct / Profiles).
  - Bộ thử nghiệm rule trực tiếp (Rule Tester): người dùng nhập URL hoặc Host, nhấn thử nghiệm hoặc tự động đánh giá, hiển thị kết quả khớp rule nào (kèm rule pattern và target) hoặc fallback về `defaultTarget`, đồng thời làm nổi bật (highlight viền xanh) rule tương ứng trong bảng.
  - Nhập hàng loạt domain (Batch Domain Import): textarea cho phép paste nhiều dòng hoặc phân tách bằng dấu phẩy/chấm phẩy/dấu cách, chọn đích đến chung, tự động loại bỏ domain trùng lặp (`Set`), thêm vào đầu hoặc cuối danh sách.
  - Hiển thị nhãn cảnh báo Orphan Rule nếu target trỏ tới profile đã bị xóa.

---

## 2. Kiểm thử và xác thực
- Đã tạo `tests/unit/options-rules.test.ts` với 6 bộ test chi tiết:
  1. Priority swapping (đổi chỗ lên/xuống giữa các rule liền kề).
  2. Batch import domains với loại bỏ trùng lặp và chuyển thành domain rules.
  3. Xóa và hoàn tác trong 5s.
  4. Realtime regex/CIDR validation logic.
  5. URL tester & match resolution against rules + default target.
  6. Phát hiện orphan rules khi target profileId không tồn tại.
- Kết quả chạy kiểm tra:
  - `npm run check`: 14 test files passed (146 unit tests), 0 error, 0 lint warnings.
  - `npm run build`: Build thành công ra `dist/` (Popup, Options, Background service worker).

---

## 3. Tự đánh giá và Review (Self-Review Checklist)
- [x] Không sửa `src/core/` (core giữ nguyên thuần TypeScript).
- [x] Không cài thêm thư viện runtime mới ngoài Preact và các component token đã dựng.
- [x] Giao diện responsive, tuân thủ token CSS, màu sắc semantic (`var(--color-...)`).
- [x] Hỗ trợ song ngữ en/vi qua dictionary `t(...)`.
- [x] Xử lý an toàn khi hoàn tác (undo stack lưu trữ rule và vị trí index gốc).
