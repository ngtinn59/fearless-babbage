import { useEffect, useState } from 'preact/hooks';
import { resolveTarget } from '../core/rule-matcher';
import type { Mode, Rule } from '../core/types';
import { sendMessage, type StatusResponse, type TestConnectionResponse } from '../shared/messaging';
import { t } from '../shared/i18n';
import { Badge } from '../ui/components/Badge';
import { Button } from '../ui/components/Button';
import { Toast } from '../ui/components/Toast';
import { Toggle } from '../ui/components/Toggle';
import { useAppState } from '../ui/hooks/useAppState';
import '../ui/styles/base.css';

export function PopupApp() {
  const { state, loading, error: appError, updateState, clearError } = useAppState();

  const [currentDomain, setCurrentDomain] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [selectedQuickProfileId, setSelectedQuickProfileId] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Trạng thái kiểm tra kết nối
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);

  // 1. Lấy domain của tab hiện tại
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const urlStr = tabs[0]?.url;
        if (urlStr) {
          try {
            const u = new URL(urlStr);
            if (u.protocol === 'http:' || u.protocol === 'https:') {
              setCurrentDomain(u.hostname);
            }
          } catch {
            setCurrentDomain(null);
          }
        }
      });
    }
  }, []);

  // 2. Lấy status (errors, warnings, levelOfControl) từ background
  const refreshStatus = () => {
    sendMessage({ type: 'GET_STATUS' })
      .then(setStatus)
      .catch(() => {});
  };

  useEffect(() => {
    refreshStatus();
  }, [state]);

  // Cập nhật selectedQuickProfileId mặc định
  useEffect(() => {
    if (state?.profiles && state.profiles.length > 0 && !selectedQuickProfileId) {
      setSelectedQuickProfileId(state.profiles[0].id);
    }
  }, [state?.profiles, selectedQuickProfileId]);

  if (loading || !state) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Đang tải cấu hình...
      </div>
    );
  }

  const isProxyActive = state.mode.kind !== 'direct';

  // Toggle lớn Bật / Tắt Proxy
  const handleToggleProxy = async () => {
    if (isProxyActive) {
      // Đang bật -> Tắt (chuyển về direct), lưu lại lastActiveMode
      await updateState((prev) => ({
        ...prev,
        lastActiveMode: prev.mode.kind !== 'direct' ? prev.mode : prev.lastActiveMode,
        mode: { kind: 'direct' },
      }));
    } else {
      // Đang tắt -> Bật lại
      if (state.lastActiveMode) {
        await updateState((prev) => ({
          ...prev,
          mode: prev.lastActiveMode!,
        }));
      } else if (state.profiles.length > 0) {
        await updateState((prev) => ({
          ...prev,
          mode: { kind: 'fixed', profileId: prev.profiles[0].id },
        }));
      } else {
        // Chưa có profile nào -> mở trang Options để thêm
        if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      }
    }
  };

  // Chuyển chế độ hoạt động
  const handleSelectMode = async (newMode: Mode) => {
    await updateState((prev) => ({
      ...prev,
      mode: newMode,
      lastActiveMode: newMode.kind !== 'direct' ? newMode : prev.lastActiveMode,
    }));
  };

  // Nút nhanh: Luôn trực tiếp (domain)
  const handleQuickDirect = async () => {
    if (!currentDomain) return;
    await updateState((prev) => {
      const newRule: Rule = {
        id: crypto.randomUUID(),
        enabled: true,
        matchType: 'domain',
        pattern: currentDomain,
        target: { type: 'direct' },
        note: 'Quick rule: Direct',
      };
      const filtered = prev.rules.filter(
        (r) => !(r.matchType === 'domain' && r.pattern.toLowerCase() === currentDomain.toLowerCase())
      );
      return { ...prev, rules: [newRule, ...filtered] };
    });
    setToastMsg(`Đã thêm quy tắc Trực tiếp cho ${currentDomain}`);
  };

  // Nút nhanh: Đi qua Profile (domain)
  const handleQuickProfile = async () => {
    if (!currentDomain || !selectedQuickProfileId) return;
    await updateState((prev) => {
      const newRule: Rule = {
        id: crypto.randomUUID(),
        enabled: true,
        matchType: 'domain',
        pattern: currentDomain,
        target: { type: 'profile', profileId: selectedQuickProfileId },
        note: 'Quick rule: Proxy profile',
      };
      const filtered = prev.rules.filter(
        (r) => !(r.matchType === 'domain' && r.pattern.toLowerCase() === currentDomain.toLowerCase())
      );
      return { ...prev, rules: [newRule, ...filtered] };
    });
    setToastMsg(`Đã thêm quy tắc proxy cho ${currentDomain}`);
  };

  // Kiểm tra kết nối
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await sendMessage({ type: 'TEST_CONNECTION' });
      setTestResult(res);
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : 'Lỗi kết nối',
      });
    } finally {
      setTesting(false);
    }
  };

  // Xóa danh sách lỗi gần đây
  const handleClearErrors = async () => {
    await sendMessage({ type: 'CLEAR_ERRORS' });
    refreshStatus();
  };

  // Tính target của tab hiện tại
  let currentTabTargetText = 'Trực tiếp (Direct)';
  let currentTabTargetColor: string | undefined;

  if (currentDomain) {
    if (state.mode.kind === 'auto') {
      const resolution = resolveTarget(state, currentDomain);
      const target = resolution.target;
      if (target.type === 'profile') {
        const matchedProfile = state.profiles.find((p) => p.id === target.profileId);
        currentTabTargetText = matchedProfile ? matchedProfile.name : 'Proxy Profile';
        currentTabTargetColor = matchedProfile?.color;
      }
    } else if (state.mode.kind === 'fixed') {
      const fixedMode = state.mode;
      const p = state.profiles.find((item) => item.id === fixedMode.profileId);
      currentTabTargetText = p ? p.name : 'Proxy Cố định';
      currentTabTargetColor = p?.color;
    } else if (state.mode.kind === 'system') {
      currentTabTargetText = 'Proxy Hệ thống';
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '14px',
        width: '340px',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Header: Logo, Tên, Nút Settings */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/icons/icon32.png" alt="" width="20" height="20" />
          <span style={{ fontWeight: 600, fontSize: '15px' }}>{t('popupTitle')}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => chrome.runtime.openOptionsPage()}
          ariaLabel={t('openOptions')}
        >
          ⚙ {t('openOptions')}
        </Button>
      </div>

      {/* 2. Toggle lớn Bật/Tắt Proxy */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            {isProxyActive ? t('proxyEnabled') : t('proxyDisabled')}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {isProxyActive ? 'Đang áp dụng cấu hình proxy' : 'Mọi kết nối đi trực tiếp'}
          </span>
        </div>
        <Toggle
          checked={isProxyActive}
          onChange={handleToggleProxy}
          ariaLabel="Bật tắt proxy"
        />
      </div>

      {/* 3. Lựa chọn chế độ (Mode Selector) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '10px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          CHẾ ĐỘ PROXY
        </span>

        {/* Option: Direct */}
        <div
          onClick={() => handleSelectMode({ kind: 'direct' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            backgroundColor: state.mode.kind === 'direct' ? 'var(--color-primary-light)' : 'transparent',
            color: state.mode.kind === 'direct' ? 'var(--color-primary)' : 'inherit',
            fontWeight: state.mode.kind === 'direct' ? 600 : 400,
            fontSize: '13px',
          }}
        >
          <span>{t('modeDirect')}</span>
          {state.mode.kind === 'direct' && <span>✓</span>}
        </div>

        {/* Option: Auto PAC */}
        <div
          onClick={() =>
            handleSelectMode({
              kind: 'auto',
              defaultTarget: state.mode.kind === 'auto' ? state.mode.defaultTarget : { type: 'direct' },
            })
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            backgroundColor: state.mode.kind === 'auto' ? 'var(--color-primary-light)' : 'transparent',
            color: state.mode.kind === 'auto' ? 'var(--color-primary)' : 'inherit',
            fontWeight: state.mode.kind === 'auto' ? 600 : 400,
            fontSize: '13px',
          }}
        >
          <span>{t('modeAuto')}</span>
          {state.mode.kind === 'auto' && <span>✓</span>}
        </div>

        {/* Option: System */}
        <div
          onClick={() => handleSelectMode({ kind: 'system' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            backgroundColor: state.mode.kind === 'system' ? 'var(--color-primary-light)' : 'transparent',
            color: state.mode.kind === 'system' ? 'var(--color-primary)' : 'inherit',
            fontWeight: state.mode.kind === 'system' ? 600 : 400,
            fontSize: '13px',
          }}
        >
          <span>{t('modeSystem')}</span>
          {state.mode.kind === 'system' && <span>✓</span>}
        </div>

        {/* Danh sách từng Profile (Fixed) */}
        {state.profiles.map((p) => {
          const isSelected = state.mode.kind === 'fixed' && state.mode.profileId === p.id;
          return (
            <div
              key={p.id}
              onClick={() => handleSelectMode({ kind: 'fixed', profileId: p.id })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                backgroundColor: isSelected ? 'var(--color-primary-light)' : 'transparent',
                color: isSelected ? 'var(--color-primary)' : 'inherit',
                fontWeight: isSelected ? 600 : 400,
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: p.color,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              {isSelected && <span>✓</span>}
            </div>
          );
        })}
      </div>

      {/* 4. Thẻ tab hiện tại (Current Tab Inspection) */}
      {currentDomain && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              TAB HIỆN TẠI
            </span>
            <Badge
              text={currentTabTargetText}
              color={currentTabTargetColor}
              variant={currentTabTargetColor ? undefined : 'neutral'}
              size="sm"
            />
          </div>

          <div
            style={{
              fontSize: '13px',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={currentDomain}
          >
            {currentDomain}
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleQuickDirect}
              ariaLabel="Luôn trực tiếp cho trang này"
              className="flex-1"
            >
              {t('alwaysDirect')}
            </Button>

            {state.profiles.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                <select
                  value={selectedQuickProfileId}
                  onChange={(e) => setSelectedQuickProfileId(e.currentTarget.value)}
                  style={{
                    padding: '4px 6px',
                    fontSize: '11px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    flex: 1,
                    maxWidth: '85px',
                  }}
                >
                  {state.profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleQuickProfile}
                  ariaLabel="Đi qua profile cho trang này"
                >
                  {t('routeThrough')}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Cảnh báo & Lỗi gần nhất (Warnings & Errors) */}
      {status && (status.warnings.length > 0 || status.errors.length > 0) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '10px',
            backgroundColor: 'var(--color-warning-bg)',
            color: 'var(--color-warning-text)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
          }}
        >
          {status.warnings.map((w, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <span>⚠️</span>
              <span>{w}</span>
            </div>
          ))}

          {status.errors.length > 0 && (
            <div
              style={{
                marginTop: '4px',
                paddingTop: '6px',
                borderTop: '1px solid rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'var(--color-danger-text)' }}>
                {status.errors.length} lỗi proxy gần đây ({status.errors[0]?.error})
              </span>
              <Button variant="ghost" size="sm" onClick={handleClearErrors}>
                {t('clearErrors')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 6. Kiểm tra kết nối (Test Connection) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '10px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('testConnection')}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            loading={testing}
          >
            {testing ? t('testingConnection') : t('testConnection')}
          </Button>
        </div>

        {testResult && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: testResult.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: testResult.ok ? 'var(--color-success-text)' : 'var(--color-danger-text)',
            }}
          >
            {testResult.ok ? (
              <>
                <span>✓ {t('connectionOk')} ({testResult.latencyMs} ms)</span>
                {testResult.ip && <span>IP: {testResult.ip}</span>}
              </>
            ) : (
              <span>✕ {t('connectionFailed')}: {testResult.error}</span>
            )}
          </div>
        )}
      </div>

      {/* Toast thông báo tương tác */}
      {toastMsg && (
        <Toast
          message={toastMsg}
          type="success"
          duration={2500}
          onClose={() => setToastMsg(null)}
        />
      )}

      {/* Lỗi ứng dụng (nếu có) */}
      {appError && (
        <Toast
          message={appError}
          type="error"
          duration={4000}
          onClose={clearError}
        />
      )}
    </div>
  );
}
