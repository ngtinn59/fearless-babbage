import { useState, useEffect } from 'preact/hooks';
import type { AppState, Settings } from '../../core/types';
import { createDefaultSettings } from '../../core/defaults';
import { isValidHttpsUrl } from '../../core/schema';
import { t } from '../../shared/i18n';
import { Select } from '../../ui/components/Select';
import { Toggle } from '../../ui/components/Toggle';
import { TextField } from '../../ui/components/TextField';
import { Button } from '../../ui/components/Button';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { Toast } from '../../ui/components/Toast';

interface GeneralPageProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState | Promise<AppState>) => Promise<boolean>;
}

export function GeneralPage({ state, updateState }: GeneralPageProps) {
  const [healthCheckUrl, setHealthCheckUrl] = useState(state.settings.healthCheckUrl);
  const [ipCheckUrl, setIpCheckUrl] = useState(state.settings.ipCheckUrl);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [ipError, setIpError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state if changed externally
  useEffect(() => {
    setHealthCheckUrl(state.settings.healthCheckUrl);
    setIpCheckUrl(state.settings.ipCheckUrl);
  }, [state.settings.healthCheckUrl, state.settings.ipCheckUrl]);

  const handleThemeChange = async (newTheme: string) => {
    await updateState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: newTheme as Settings['theme'],
      },
    }));
  };

  const handleToggleBypassLocal = async (enabled: boolean) => {
    await updateState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        bypassLocal: enabled,
      },
    }));
  };

  const handleToggleNotifyOnError = async (enabled: boolean) => {
    await updateState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        notifyOnError: enabled,
      },
    }));
  };

  const handleSaveUrls = async () => {
    let hasErr = false;

    if (!isValidHttpsUrl(healthCheckUrl)) {
      setHealthError('URL kiểm tra kết nối phải bắt đầu bằng https:// và hợp lệ');
      hasErr = true;
    } else {
      setHealthError(null);
    }

    if (ipCheckUrl.trim() !== '' && !isValidHttpsUrl(ipCheckUrl)) {
      setIpError('URL kiểm tra IP phải bắt đầu bằng https:// (hoặc để trống để tắt)');
      hasErr = true;
    } else {
      setIpError(null);
    }

    if (hasErr) return;

    const ok = await updateState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        healthCheckUrl: healthCheckUrl.trim(),
        ipCheckUrl: ipCheckUrl.trim(),
      },
    }));

    if (ok) {
      setToastMessage('Đã lưu cài đặt kiểm tra mạng thành công');
    }
  };

  const handleResetDefaults = async () => {
    const defaults = createDefaultSettings();
    setHealthCheckUrl(defaults.healthCheckUrl);
    setIpCheckUrl(defaults.ipCheckUrl);
    setHealthError(null);
    setIpError(null);

    const ok = await updateState((prev) => ({
      ...prev,
      settings: defaults,
    }));

    setShowResetConfirm(false);
    if (ok) {
      setToastMessage('Đã khôi phục cài đặt chung về mặc định');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* 1. Giao diện & hiển thị */}
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
        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{t('theme')}</h2>

        <div style={{ maxWidth: '320px' }}>
          <Select
            label="Chế độ màu hiển thị"
            value={state.settings.theme}
            options={[
              { value: 'system', label: t('themeSystem') },
              { value: 'light', label: t('themeLight') },
              { value: 'dark', label: t('themeDark') },
            ]}
            onChange={handleThemeChange}
          />
        </div>
      </section>

      {/* 2. Quy tắc chung & Thông báo */}
      <section
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Hành vi & Thông báo</h2>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '2px' }}>
              {t('bypassLocal')}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Luôn kết nối trực tiếp (DIRECT) tới localhost, 127.0.0.1, ::1 và các máy chủ nội bộ không có dấu chấm.
            </div>
          </div>
          <Toggle
            checked={state.settings.bypassLocal}
            onChange={handleToggleBypassLocal}
            label={t('bypassLocal')}
          />
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '2px' }}>
              {t('notifyOnError')}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Hiển thị thông báo trên màn hình Chrome khi xảy ra lỗi kết nối proxy nghiêm trọng (tối đa 1 thông báo/30s).
            </div>
          </div>
          <Toggle
            checked={state.settings.notifyOnError}
            onChange={handleToggleNotifyOnError}
            label={t('notifyOnError')}
          />
        </div>
      </section>

      {/* 3. Kiểm tra mạng & URL chẩn đoán */}
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
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px 0' }}>Kiểm tra kết nối mạng</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
            Tùy chỉnh các endpoint được dùng bởi nút &quot;Kiểm tra kết nối&quot; trong Popup.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <TextField
            label={t('healthCheckUrl')}
            value={healthCheckUrl}
            onChange={(val) => {
              setHealthCheckUrl(val);
              if (healthError) setHealthError(null);
            }}
            placeholder="https://www.gstatic.com/generate_204"
            error={healthError || undefined}
          />

          <TextField
            label={t('ipCheckUrl')}
            value={ipCheckUrl}
            onChange={(val) => {
              setIpCheckUrl(val);
              if (ipError) setIpError(null);
            }}
            placeholder="https://api.ipify.org?format=json (để trống để bỏ qua)"
            error={ipError || undefined}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Button variant="primary" onClick={handleSaveUrls}>
              {t('save')}
            </Button>
          </div>
        </div>
      </section>

      {/* 4. Khôi phục mặc định */}
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
            {t('resetDefaults')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Đặt lại các giá trị cài đặt chung về mặc định ban đầu. Danh sách proxy và quy tắc định tuyến sẽ không bị ảnh hưởng.
          </div>
        </div>

        <Button variant="danger" onClick={() => setShowResetConfirm(true)}>
          {t('resetDefaults')}
        </Button>
      </section>

      {/* Confirm Reset Dialog */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Khôi phục cài đặt chung?"
        message="Hành động này sẽ khôi phục theme, bypassLocal, thông báo lỗi và các URL kiểm tra kết nối về giá trị mặc định. Bạn có muốn tiếp tục?"
        confirmText={t('confirm')}
        cancelText={t('cancel')}
        danger={true}
        onConfirm={handleResetDefaults}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          duration={3000}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
