import { useState, useRef } from 'preact/hooks';
import type { AppState } from '../../core/types';
import { exportBackup, importBackup, type ImportSummary } from '../../core/backup';
import { createDefaultState } from '../../core/defaults';
import { t } from '../../shared/i18n';
import { Button } from '../../ui/components/Button';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { Toast } from '../../ui/components/Toast';

interface BackupPageProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState | Promise<AppState>) => Promise<boolean>;
}

export function BackupPage({ state, updateState }: BackupPageProps) {
  const [includePasswords, setIncludePasswords] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    newState: AppState;
    summary: ImportSummary;
  } | null>(null);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const jsonStr = exportBackup(state, { includePasswords });
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);

      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-proxy-backup-${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setToastType('success');
      setToastMessage('Đã xuất file sao lưu thành công');
    } catch (err) {
      setToastType('error');
      setToastMessage(err instanceof Error ? err.message : 'Lỗi khi xuất file sao lưu');
    }
  };

  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    try {
      const text = await file.text();
      const res = importBackup(text, state);

      if (!res.success) {
        let errMsg = `File sao lưu không hợp lệ: ${res.error}`;
        if (res.details && res.details.length > 0) {
          errMsg += ` (${res.details.join(', ')})`;
        }
        setImportError(errMsg);
        setToastType('error');
        setToastMessage(errMsg);
        return;
      }

      setImportError(null);
      setPendingImport({
        newState: res.state,
        summary: res.summary,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể đọc file đã chọn';
      setImportError(msg);
      setToastType('error');
      setToastMessage(msg);
    } finally {
      // Reset input value to allow selecting the same file again
      input.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;

    const ok = await updateState(() => pendingImport.newState);
    if (ok) {
      setToastType('success');
      setToastMessage(
        `Đã khôi phục thành công ${pendingImport.summary.profileCount} proxy và ${pendingImport.summary.ruleCount} quy tắc!`,
      );
    }
    setPendingImport(null);
  };

  const handleConfirmResetAll = async () => {
    const ok = await updateState(() => createDefaultState());
    setShowResetAllConfirm(false);
    if (ok) {
      setToastType('success');
      setToastMessage('Đã khôi phục toàn bộ cài đặt gốc của tiện ích');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* 1. Xuất file sao lưu (Export) */}
      <section
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px 0' }}>{t('exportBackup')}</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
            Tải về file định dạng JSON chứa toàn bộ danh sách proxy, quy tắc định tuyến và cài đặt hiện tại.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={includePasswords}
              onChange={(e) => setIncludePasswords((e.target as HTMLInputElement).checked)}
              style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
            />
            <span style={{ fontWeight: 500 }}>Bao gồm mật khẩu proxy trong file sao lưu</span>
          </label>

          {includePasswords ? (
            <div
              style={{
                fontSize: '12px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-danger)',
                border: '1px solid var(--color-danger)',
              }}
            >
              ⚠️ <strong>Cảnh báo bảo mật:</strong> Mật khẩu sẽ được lưu dưới dạng văn bản không mã hóa trong file JSON. Chỉ kích hoạt khi bạn chắc chắn lưu trữ file ở nơi an toàn!
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              (Mặc định bảo mật: mật khẩu proxy được tự động xóa khỏi bản sao lưu. Khi nhập lại, nếu trùng mã proxy trên máy, mật khẩu cũ sẽ được giữ nguyên.)
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
          <Button variant="primary" onClick={handleExport}>
            📥 {t('exportBackup')} (.json)
          </Button>
        </div>
      </section>

      {/* 2. Nhập file sao lưu (Import) */}
      <section
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px 0' }}>{t('importBackup')}</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
            Tải lên file sao lưu JSON hợp lệ. Dữ liệu trong file sẽ thay thế cấu hình hiện tại.
          </p>
        </div>

        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {importError && (
          <div
            style={{
              fontSize: '12px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
            }}
          >
            {importError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            📤 Chọn file sao lưu (.json)
          </Button>
        </div>
      </section>

      {/* 3. Xóa dữ liệu & khôi phục toàn bộ mặc định */}
      <section
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px', color: 'var(--color-danger)' }}>
            Khôi phục toàn bộ cài đặt gốc (Factory Reset)
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Xóa sạch tất cả các profile proxy, quy tắc định tuyến và đưa toàn bộ tiện ích về trạng thái ban đầu.
          </div>
        </div>

        <Button variant="danger" onClick={() => setShowResetAllConfirm(true)}>
          Xóa tất cả & Khôi phục gốc
        </Button>
      </section>

      {/* Confirm Import Modal */}
      {pendingImport && (
        <ConfirmDialog
          isOpen={true}
          title="Xác nhận khôi phục cấu hình"
          message={`File sao lưu hợp lệ chứa ${pendingImport.summary.profileCount} proxy và ${pendingImport.summary.ruleCount} quy tắc. Hành động này sẽ THAY THẾ TOÀN BỘ cấu hình hiện tại. Bạn có chắc chắn muốn tiếp tục?`}
          confirmText={t('confirm')}
          cancelText={t('cancel')}
          danger={true}
          onConfirm={handleConfirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {/* Confirm Reset All Dialog */}
      <ConfirmDialog
        isOpen={showResetAllConfirm}
        title="Khôi phục toàn bộ cài đặt gốc?"
        message="Toàn bộ danh sách proxy và quy tắc định tuyến sẽ bị xóa vĩnh viễn. Tiện ích sẽ trở về cấu hình mặc định ban đầu. Bạn có chắc chắn muốn thực hiện?"
        confirmText="Đồng ý xóa & Khôi phục"
        cancelText={t('cancel')}
        danger={true}
        onConfirm={handleConfirmResetAll}
        onCancel={() => setShowResetAllConfirm(false)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          duration={3500}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
