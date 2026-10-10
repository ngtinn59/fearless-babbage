import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { validateProfile } from '../../core/schema';
import type { AppState, Mode, ProxyProfile, ProxyScheme } from '../../core/types';
import { t } from '../../shared/i18n';
import { Badge } from '../../ui/components/Badge';
import { Button } from '../../ui/components/Button';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { Select } from '../../ui/components/Select';
import { TextField } from '../../ui/components/TextField';
import { Toast } from '../../ui/components/Toast';

export interface ProfilesPageProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState | Promise<AppState>) => Promise<boolean>;
}

const PRESET_COLORS = [
  '#2563eb', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Slate
];

interface ProfileFormData {
  id?: string;
  name: string;
  color: string;
  scheme: ProxyScheme;
  host: string;
  port: number | string;
  hasAuth: boolean;
  username: string;
  password: string;
  bypassListRaw: string;
}

export function ProfilesPage({ state, updateState }: ProfilesPageProps) {
  const [editingProfile, setEditingProfile] = useState<ProfileFormData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Dialog xóa profile
  const [deleteTarget, setDeleteTarget] = useState<ProxyProfile | null>(null);

  // Khởi tạo form thêm mới
  const handleStartAdd = () => {
    setEditingProfile({
      name: '',
      color: PRESET_COLORS[state.profiles.length % PRESET_COLORS.length],
      scheme: 'http',
      host: '',
      port: 8080,
      hasAuth: false,
      username: '',
      password: '',
      bypassListRaw: '<local>',
    });
    setShowPassword(false);
  };

  // Khởi tạo form chỉnh sửa
  const handleStartEdit = (p: ProxyProfile) => {
    setEditingProfile({
      id: p.id,
      name: p.name,
      color: p.color,
      scheme: p.scheme,
      host: p.host,
      port: p.port,
      hasAuth: !!p.auth,
      username: p.auth?.username || '',
      password: p.auth?.password || '',
      bypassListRaw: p.bypassList.join('\n'),
    });
    setShowPassword(false);
  };

  // Nhân bản profile
  const handleDuplicate = async (p: ProxyProfile) => {
    const newId = crypto.randomUUID();
    let newName = `${p.name} (Copy)`;
    let counter = 1;
    while (state.profiles.some((existing) => existing.name === newName)) {
      counter++;
      newName = `${p.name} (Copy ${counter})`;
    }

    const cloned: ProxyProfile = {
      ...p,
      id: newId,
      name: newName,
      bypassList: [...p.bypassList],
      auth: p.auth ? { ...p.auth } : undefined,
    };

    await updateState((prev) => ({
      ...prev,
      profiles: [...prev.profiles, cloned],
    }));

    setToastMsg(`Đã nhân bản "${p.name}" thành "${newName}"`);
  };

  // Xóa profile
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    const targetName = deleteTarget.name;

    await updateState((prev) => {
      const nextProfiles = prev.profiles.filter((p) => p.id !== targetId);

      let nextMode: Mode = prev.mode;
      let nextLastActive: AppState['lastActiveMode'] = prev.lastActiveMode;

      // Nếu mode fixed đang trỏ tới profile bị xóa -> chuyển về direct
      if (prev.mode.kind === 'fixed' && prev.mode.profileId === targetId) {
        nextMode = { kind: 'direct' };
      }

      // Nếu mode auto có defaultTarget trỏ tới profile bị xóa -> chuyển về direct
      if (
        prev.mode.kind === 'auto' &&
        prev.mode.defaultTarget.type === 'profile' &&
        prev.mode.defaultTarget.profileId === targetId
      ) {
        nextMode = { kind: 'auto', defaultTarget: { type: 'direct' } };
      }

      // Nếu lastActiveMode trỏ tới profile bị xóa -> xóa lastActiveMode
      if (
        prev.lastActiveMode &&
        prev.lastActiveMode.kind === 'fixed' &&
        prev.lastActiveMode.profileId === targetId
      ) {
        nextLastActive = null;
      }

      return {
        ...prev,
        profiles: nextProfiles,
        mode: nextMode,
        lastActiveMode: nextLastActive,
      };
    });

    setDeleteTarget(null);
    setToastMsg(`Đã xóa proxy "${targetName}"`);
  };

  // Tính toán validation realtime cho form
  const getValidationErrors = (formData: ProfileFormData) => {
    const portNum = Number(formData.port);
    const bypassList = formData.bypassListRaw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const candidate: Record<string, unknown> = {
      id: formData.id || 'temp-id',
      name: formData.name.trim(),
      color: formData.color,
      scheme: formData.scheme,
      host: formData.host.trim(),
      port: portNum,
      bypassList,
    };

    if (formData.hasAuth && (formData.scheme === 'http' || formData.scheme === 'https')) {
      candidate.auth = {
        username: formData.username,
        password: formData.password,
      };
    }

    const otherProfiles = state.profiles.filter((p) => p.id !== formData.id);
    const result = validateProfile(candidate, otherProfiles);

    const errorMap: Record<string, string> = {};
    if (!result.ok) {
      for (const err of result.errors) {
        errorMap[err.path] = err.code;
      }
    }

    return { isValid: result.ok, errorMap, candidate: result.ok ? result.value : null };
  };

  // Lưu form thêm/sửa
  const handleSaveProfile = async (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProfile) return;

    const { isValid, candidate } = getValidationErrors(editingProfile);
    if (!isValid || !candidate) return;

    if (editingProfile.id) {
      // Cập nhật profile hiện có
      await updateState((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === editingProfile.id ? candidate : p)),
      }));
      setToastMsg(`Đã cập nhật proxy "${candidate.name}"`);
    } else {
      // Thêm mới profile
      const newProfile: ProxyProfile = {
        ...candidate,
        id: crypto.randomUUID(),
      };
      await updateState((prev) => ({
        ...prev,
        profiles: [...prev.profiles, newProfile],
      }));
      setToastMsg(`Đã thêm proxy "${newProfile.name}"`);
    }

    setEditingProfile(null);
  };

  const validation = editingProfile ? getValidationErrors(editingProfile) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header khu vực Profiles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{t('tabProfiles')}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Quản lý các máy chủ proxy để gán cố định hoặc định tuyến theo quy tắc
          </p>
        </div>
        <Button variant="primary" onClick={handleStartAdd}>
          + {t('addProfile')}
        </Button>
      </div>

      {/* Danh sách Profiles */}
      {state.profiles.length === 0 ? (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-color)',
          }}
        >
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
            {t('noProfiles')}
          </p>
          <Button variant="secondary" onClick={handleStartAdd}>
            + {t('addProfile')}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {state.profiles.map((p) => {
            const rulesPointing = state.rules.filter(
              (r) => r.target.type === 'profile' && r.target.profileId === p.id
            ).length;
            const isCurrentFixed = state.mode.kind === 'fixed' && state.mode.profileId === p.id;

            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: p.color,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{p.name}</span>
                      <Badge text={p.scheme.toUpperCase()} variant="info" size="sm" />
                      {p.auth && <Badge text="Auth" variant="neutral" size="sm" />}
                      {isCurrentFixed && <Badge text="Đang dùng" variant="success" size="sm" />}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <code>
                        {p.host}:{p.port}
                      </code>
                      {rulesPointing > 0 && (
                        <span style={{ marginLeft: '12px', color: 'var(--text-muted)' }}>
                          • {rulesPointing} quy tắc đang trỏ tới
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button variant="secondary" size="sm" onClick={() => handleStartEdit(p)}>
                    {t('editProfile')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDuplicate(p)}>
                    Nhân bản
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(p)}>
                    {t('delete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Form thêm hoặc chỉnh sửa profile */}
      {editingProfile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--bg-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingProfile(null);
          }}
        >
          <form
            onSubmit={handleSaveProfile}
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              width: '100%',
              maxWidth: '460px',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              {editingProfile.id ? t('editProfile') : t('addProfile')}
            </h3>

            {/* Tên Profile */}
            <TextField
              label={t('profileName')}
              value={editingProfile.name}
              onChange={(val) => setEditingProfile({ ...editingProfile, name: val })}
              placeholder="VD: Cty Proxy, Singapore VPS..."
              error={
                validation?.errorMap.name === 'DUPLICATE_NAME'
                  ? 'Tên profile đã tồn tại'
                  : validation?.errorMap.name
                    ? 'Tên phải từ 1 đến 40 ký tự'
                    : undefined
              }
              autoFocus
            />

            {/* Màu sắc Profile */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {t('color')}
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {PRESET_COLORS.map((c) => (
                  <span
                    key={c}
                    onClick={() => setEditingProfile({ ...editingProfile, color: c })}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: c,
                      cursor: 'pointer',
                      border:
                        editingProfile.color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                      boxShadow: editingProfile.color === c ? '0 0 0 2px var(--color-primary)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Giao thức & Cổng */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '8px' }}>
              <Select
                label={t('scheme')}
                value={editingProfile.scheme}
                onChange={(val) =>
                  setEditingProfile({ ...editingProfile, scheme: val as ProxyScheme })
                }
                options={[
                  { value: 'http', label: 'HTTP' },
                  { value: 'https', label: 'HTTPS' },
                  { value: 'socks5', label: 'SOCKS5' },
                  { value: 'socks4', label: 'SOCKS4' },
                ]}
              />

              <TextField
                label={t('host')}
                value={editingProfile.host}
                onChange={(val) => setEditingProfile({ ...editingProfile, host: val })}
                placeholder="proxy.example.com"
                error={validation?.errorMap.host ? 'Host không hợp lệ (không chứa scheme/port)' : undefined}
              />

              <TextField
                label={t('port')}
                type="number"
                min={1}
                max={65535}
                value={editingProfile.port}
                onChange={(val) => setEditingProfile({ ...editingProfile, port: val })}
                error={validation?.errorMap.port ? '1-65535' : undefined}
              />
            </div>

            {/* Xác thực người dùng (Auth) - chỉ cho HTTP/HTTPS */}
            {(editingProfile.scheme === 'http' || editingProfile.scheme === 'https') && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>Yêu cầu đăng nhập proxy (Auth)</span>
                  <input
                    type="checkbox"
                    checked={editingProfile.hasAuth}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, hasAuth: e.currentTarget.checked })
                    }
                  />
                </div>

                {editingProfile.hasAuth && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <TextField
                      label={t('username')}
                      value={editingProfile.username}
                      onChange={(val) => setEditingProfile({ ...editingProfile, username: val })}
                    />
                    <div style={{ position: 'relative' }}>
                      <TextField
                        label={t('password')}
                        type={showPassword ? 'text' : 'password'}
                        value={editingProfile.password}
                        onChange={(val) => setEditingProfile({ ...editingProfile, password: val })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '26px',
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          color: 'var(--color-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        {showPassword ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Danh sách Bypass */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {t('bypassList')} (mỗi dòng một địa chỉ / host)
              </label>
              <textarea
                value={editingProfile.bypassListRaw}
                onInput={(e) =>
                  setEditingProfile({ ...editingProfile, bypassListRaw: e.currentTarget.value })
                }
                rows={3}
                placeholder="<local>&#10;192.168.1.0/24&#10;*.internal.corp"
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Nút thao tác Form */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setEditingProfile(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={!validation?.isValid}>
                {t('save')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Dialog xác nhận xóa Profile */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={true}
          danger={true}
          title={`Xóa proxy "${deleteTarget.name}"?`}
          message={(() => {
            const rulesCount = state.rules.filter(
              (r) => r.target.type === 'profile' && r.target.profileId === deleteTarget.id
            ).length;
            const isCurrentFixed = state.mode.kind === 'fixed' && state.mode.profileId === deleteTarget.id;

            let msg = `Bạn có chắc chắn muốn xóa proxy "${deleteTarget.name}"?`;
            if (rulesCount > 0) {
              msg += ` Có ${rulesCount} quy tắc đang trỏ tới proxy này (chúng sẽ trở thành quy tắc mồ côi).`;
            }
            if (isCurrentFixed) {
              msg += ' Proxy này đang được dùng cố định; sau khi xóa, kết nối sẽ chuyển về Trực tiếp (Direct).';
            }
            return msg;
          })()}
          confirmText={t('delete')}
          cancelText={t('cancel')}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast thông báo */}
      {toastMsg && (
        <Toast
          message={toastMsg}
          type="success"
          duration={2500}
          onClose={() => setToastMsg(null)}
        />
      )}
    </div>
  );
}
