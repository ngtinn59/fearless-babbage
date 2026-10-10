# Task 0: Thiết Lập Môi Trường, Build Tooling & Kiểm Thử

**Agent:** A
**Branch:** `task/0`
**Trạng thái:** ✅ DUYỆT

---

## 1. Mục tiêu và phạm vi
- Thiết lập Vite multi-entry cho Chrome extension Manifest V3:
  - `popup`: `src/popup/index.html`
  - `options`: `src/options/index.html`
  - `background`: `background.js` (ES module service worker)
- Thiết lập Preact với `@preact/preset-vite`.
- Thiết lập linter ESLint v9 flat config, Prettier, TypeScript strict mode (`tsc --noEmit`).
- Thiết lập runner kiểm thử đơn vị Vitest v3 (`tests/unit/`).
- Thiết lập runner kiểm thử tích hợp Playwright (`tests/e2e/`).

---

## 2. Kiểm thử và xác thực
- `npm run check` pass thành công (`typecheck` + `lint` + `test`).
- `npm run build` sinh đúng cấu trúc trong `dist/`.
