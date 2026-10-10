import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { resolveTarget } from '../../core/rule-matcher';
import { validateRule } from '../../core/schema';
import type { AppState, Mode, Rule, RuleMatchType, Target } from '../../core/types';
import { t } from '../../shared/i18n';
import { Badge } from '../../ui/components/Badge';
import { Button } from '../../ui/components/Button';
import { Select } from '../../ui/components/Select';
import { TextField } from '../../ui/components/TextField';
import { Toast } from '../../ui/components/Toast';
import { Toggle } from '../../ui/components/Toggle';

export interface RulesPageProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState | Promise<AppState>) => Promise<boolean>;
}

interface RuleFormData {
  id?: string;
  enabled: boolean;
  matchType: RuleMatchType;
  pattern: string;
  targetType: 'direct' | 'profile';
  targetProfileId: string;
  note: string;
}

export function RulesPage({ state, updateState }: RulesPageProps) {
  // Test URL / Host
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{
    target: Target;
    ruleId: string | null;
    reason: 'local' | 'rule' | 'default';
  } | null>(null);

  // Form Thêm/Sửa rule
  const [editingRule, setEditingRule] = useState<RuleFormData | null>(null);

  // Modal Nhập hàng loạt
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchTargetType, setBatchTargetType] = useState<'direct' | 'profile'>('direct');
  const [batchTargetProfileId, setBatchTargetProfileId] = useState(
    state.profiles[0]?.id || ''
  );

  // Undo xóa rule trong 5s
  const [deletedRuleUndo, setDeletedRuleUndo] = useState<{
    rule: Rule;
    index: number;
    timer: NodeJS.Timeout;
  } | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Tính kết quả thử URL realtime
  useEffect(() => {
    const raw = testInput.trim();
    if (!raw) {
      setTestResult(null);
      return;
    }

    let host = raw;
    try {
      if (raw.includes('://')) {
        host = new URL(raw).hostname;
      } else if (raw.includes('/')) {
        host = raw.split('/')[0];
      }
    } catch {
      host = raw;
    }

    const res = resolveTarget(state, host);
    setTestResult(res);
  }, [testInput, state]);

  // Đổi target mặc định của mode auto
  const currentDefaultTarget: Target =
    state.mode.kind === 'auto' ? state.mode.defaultTarget : { type: 'direct' };

  const handleSetDefaultTarget = async (newTarget: Target) => {
    await updateState((prev) => {
      let nextMode: Mode = prev.mode;
      if (prev.mode.kind === 'auto') {
        nextMode = { kind: 'auto', defaultTarget: newTarget };
      }
      return {
        ...prev,
        mode: nextMode,
      };
    });
    setToastMsg('Đã cập nhật đích đến mặc định cho chế độ Tự động');
  };

  // Di chuyển thứ tự ưu tiên (Lên)
  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    await updateState((prev) => {
      const copy = [...prev.rules];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      return { ...prev, rules: copy };
    });
  };

  // Di chuyển thứ tự ưu tiên (Xuống)
  const handleMoveDown = async (index: number) => {
    if (index >= state.rules.length - 1) return;
    await updateState((prev) => {
      const copy = [...prev.rules];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      return { ...prev, rules: copy };
    });
  };

  // Bật/tắt switch của rule
  const handleToggleRule = async (index: number, enabled: boolean) => {
    await updateState((prev) => {
      const copy = [...prev.rules];
      copy[index] = { ...copy[index], enabled };
      return { ...prev, rules: copy };
    });
  };

  // Xóa rule có hỗ trợ Undo trong 5 giây
  const handleDeleteRule = async (index: number) => {
    const ruleToDelete = state.rules[index];
    if (!ruleToDelete) return;

    if (deletedRuleUndo) {
      clearTimeout(deletedRuleUndo.timer);
    }

    await updateState((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));

    const timer = setTimeout(() => {
      setDeletedRuleUndo(null);
    }, 5000);

    setDeletedRuleUndo({
      rule: ruleToDelete,
      index,
      timer,
    });
  };

  // Khôi phục lại rule vừa xóa (Undo)
  const handleUndoDelete = async () => {
    if (!deletedRuleUndo) return;
    const { rule, index, timer } = deletedRuleUndo;
    clearTimeout(timer);

    await updateState((prev) => {
      const copy = [...prev.rules];
      const insertAt = Math.min(index, copy.length);
      copy.splice(insertAt, 0, rule);
      return { ...prev, rules: copy };
    });

    setDeletedRuleUndo(null);
    setToastMsg(`Đã khôi phục quy tắc "${rule.pattern}"`);
  };

  // Khởi tạo form thêm rule mới
  const handleStartAdd = () => {
    setEditingRule({
      enabled: true,
      matchType: 'domain',
      pattern: '',
      targetType: 'direct',
      targetProfileId: state.profiles[0]?.id || '',
      note: '',
    });
  };

  // Khởi tạo form chỉnh sửa rule
  const handleStartEdit = (r: Rule) => {
    setEditingRule({
      id: r.id,
      enabled: r.enabled,
      matchType: r.matchType,
      pattern: r.pattern,
      targetType: r.target.type,
      targetProfileId: r.target.type === 'profile' ? r.target.profileId : state.profiles[0]?.id || '',
      note: r.note || '',
    });
  };

  // Validate form thêm/sửa realtime
  const getValidationErrors = (formData: RuleFormData) => {
    const target: Target =
      formData.targetType === 'profile'
        ? { type: 'profile', profileId: formData.targetProfileId }
        : { type: 'direct' };

    const candidate: Record<string, unknown> = {
      id: formData.id || 'temp-id',
      enabled: formData.enabled,
      matchType: formData.matchType,
      pattern: formData.pattern.trim(),
      target,
      note: formData.note.trim() || undefined,
    };

    const res = validateRule(candidate, state.profiles);
    const errorMap: Record<string, string> = {};
    if (!res.ok) {
      for (const err of res.errors) {
        errorMap[err.path] = err.code;
      }
    }

    return { isValid: res.ok, errorMap, candidate: res.ok ? res.value : null };
  };

  // Lưu form rule
  const handleSaveRule = async (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRule) return;

    const { isValid, candidate } = getValidationErrors(editingRule);
    if (!isValid || !candidate) return;

    if (editingRule.id) {
      // Sửa rule
      await updateState((prev) => ({
        ...prev,
        rules: prev.rules.map((r) => (r.id === editingRule.id ? candidate : r)),
      }));
      setToastMsg(`Đã cập nhật quy tắc "${candidate.pattern}"`);
    } else {
      // Thêm mới rule lên đầu danh sách
      const newRule: Rule = {
        ...candidate,
        id: crypto.randomUUID(),
      };
      await updateState((prev) => ({
        ...prev,
        rules: [newRule, ...prev.rules],
      }));
      setToastMsg(`Đã thêm quy tắc "${newRule.pattern}"`);
    }

    setEditingRule(null);
  };

  // Xử lý Nhập hàng loạt
  const handleBatchImport = async (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    const lines = batchText
      .split('\n')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);

    if (lines.length === 0) return;

    const target: Target =
      batchTargetType === 'profile'
        ? { type: 'profile', profileId: batchTargetProfileId }
        : { type: 'direct' };

    const existingDomainSet = new Set(
      state.rules
        .filter((r) => r.matchType === 'domain')
        .map((r) => r.pattern.toLowerCase())
    );

    let addedCount = 0;
    let skippedCount = 0;
    const newRules: Rule[] = [];

    for (const rawLine of lines) {
      let domain = rawLine;
      try {
        if (domain.includes('://')) {
          domain = new URL(domain).hostname;
        } else if (domain.includes('/')) {
          domain = domain.split('/')[0];
        }
      } catch {
        // bỏ qua lỗi parse
      }

      domain = domain.trim();
      if (!domain || existingDomainSet.has(domain)) {
        skippedCount++;
        continue;
      }

      existingDomainSet.add(domain);
      newRules.push({
        id: crypto.randomUUID(),
        enabled: true,
        matchType: 'domain',
        pattern: domain,
        target,
        note: 'Batch imported',
      });
      addedCount++;
    }

    if (newRules.length > 0) {
      await updateState((prev) => ({
        ...prev,
        rules: [...newRules, ...prev.rules],
      }));
    }

    setShowBatchModal(false);
    setBatchText('');
    setToastMsg(
      `Đã thêm ${addedCount} quy tắc (${skippedCount} dòng bỏ qua do trùng hoặc không hợp lệ)`
    );
  };

  const validation = editingRule ? getValidationErrors(editingRule) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header khu vực Rules */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{t('tabRules')}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Quy tắc khớp từ trên xuống dưới. Khớp dòng đầu tiên sẽ áp dụng đích đến đó.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => setShowBatchModal(true)}>
            Nhập hàng loạt
          </Button>
          <Button variant="primary" onClick={handleStartAdd}>
            + {t('addRule')}
          </Button>
        </div>
      </div>

      {/* Đích đến mặc định của chế độ Auto */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Đích đến mặc định khi không khớp quy tắc</span>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Áp dụng cho mọi trang web không khớp với bất kỳ dòng quy tắc nào dưới đây
          </p>
        </div>
        <div style={{ minWidth: '160px' }}>
          <Select
            value={
              currentDefaultTarget.type === 'profile'
                ? currentDefaultTarget.profileId
                : 'direct'
            }
            onChange={(val) => {
              if (val === 'direct') {
                handleSetDefaultTarget({ type: 'direct' });
              } else {
                handleSetDefaultTarget({ type: 'profile', profileId: val });
              }
            }}
            options={[
              { value: 'direct', label: 'Trực tiếp (Direct)' },
              ...state.profiles.map((p) => ({
                value: p.id,
                label: `Proxy: ${p.name}`,
              })),
            ]}
          />
        </div>
      </div>

      {/* Ô Thử URL / Host */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Kiểm tra định tuyến (Thử URL / Host)</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            value={testInput}
            onInput={(e) => setTestInput(e.currentTarget.value)}
            placeholder="Nhập URL hoặc hostname, ví dụ: https://api.github.com hoặc 10.0.0.1..."
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '13px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
            }}
          />
          {testResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {testResult.reason === 'local'
                  ? 'Bỏ qua cục bộ'
                  : testResult.reason === 'rule'
                    ? 'Khớp quy tắc'
                    : 'Mặc định'}
                :
              </span>
              {testResult.target.type === 'profile' ? (
                (() => {
                  const p = state.profiles.find(
                    (prof) => prof.id === (testResult.target as { profileId: string }).profileId
                  );
                  return (
                    <Badge
                      text={p ? p.name : 'Profile mồ côi'}
                      color={p?.color}
                      variant={p ? undefined : 'warning'}
                    />
                  );
                })()
              ) : (
                <Badge text="Trực tiếp (Direct)" variant="neutral" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bảng danh sách Rules */}
      {state.rules.length === 0 ? (
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
            {t('noRules')}
          </p>
          <Button variant="secondary" onClick={handleStartAdd}>
            + {t('addRule')}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {state.rules.map((r, index) => {
            const target = r.target;
            const isTargetProfile = target.type === 'profile';
            const matchedProfile =
              target.type === 'profile'
                ? state.profiles.find((p) => p.id === target.profileId)
                : null;
            const isOrphan = target.type === 'profile' && !matchedProfile;
            const isHighlighted = testResult?.ruleId === r.id;

            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: isHighlighted ? 'var(--color-primary-light)' : 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: isHighlighted
                    ? '1px solid var(--color-primary)'
                    : '1px solid var(--border-color)',
                  opacity: r.enabled ? 1 : 0.6,
                  transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
                }}
              >
                {/* Trái: Switch, MatchType, Pattern, Target, Note */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <Toggle
                    checked={r.enabled}
                    onChange={(val) => handleToggleRule(index, val)}
                    ariaLabel={`Bật tắt quy tắc ${r.pattern}`}
                  />

                  <Badge text={r.matchType.toUpperCase()} variant="neutral" size="sm" />

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code
                        style={{
                          fontWeight: 600,
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {r.pattern}
                      </code>
                      {isOrphan && (
                        <Badge
                          text="Mồ côi (Profile đã bị xóa)"
                          variant="warning"
                          size="sm"
                        />
                      )}
                    </div>
                    {r.note && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {r.note}
                      </span>
                    )}
                  </div>

                  <div style={{ marginLeft: 'auto', paddingRight: '12px' }}>
                    {isTargetProfile ? (
                      <Badge
                        text={matchedProfile ? matchedProfile.name : 'Profile đã xóa'}
                        color={matchedProfile?.color}
                        variant={matchedProfile ? undefined : 'warning'}
                      />
                    ) : (
                      <Badge text="Direct" variant="neutral" />
                    )}
                  </div>
                </div>

                {/* Phải: Nút Lên, Xuống, Sửa, Xóa */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                    ariaLabel="Di chuyển lên"
                  >
                    ▲
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === state.rules.length - 1}
                    onClick={() => handleMoveDown(index)}
                    ariaLabel="Di chuyển xuống"
                  >
                    ▼
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleStartEdit(r)}>
                    {t('save') === 'Save' ? 'Edit' : 'Sửa'}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteRule(index)}>
                    {t('delete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Thêm / Sửa Rule */}
      {editingRule && (
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
            if (e.target === e.currentTarget) setEditingRule(null);
          }}
        >
          <form
            onSubmit={handleSaveRule}
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
              {editingRule.id ? t('editRule') : t('addRule')}
            </h3>

            {/* Loại khớp */}
            <Select
              label={t('matchType')}
              value={editingRule.matchType}
              onChange={(val) =>
                setEditingRule({ ...editingRule, matchType: val as RuleMatchType })
              }
              options={[
                { value: 'domain', label: 'Domain (khớp domain & subdomain, vd: google.com)' },
                { value: 'wildcard', label: 'Wildcard (kèm dấu * và ?, vd: *.google.*)' },
                { value: 'regex', label: 'Regex (Biểu thức chính quy, vd: ^https?:\\/\\/.*\\.com)' },
                { value: 'ip-cidr', label: 'IP-CIDR (Dải mạng IPv4, vd: 192.168.1.0/24)' },
              ]}
            />

            {/* Mẫu khớp (Pattern) */}
            <TextField
              label={t('pattern')}
              value={editingRule.pattern}
              onChange={(val) => setEditingRule({ ...editingRule, pattern: val })}
              placeholder={
                editingRule.matchType === 'domain'
                  ? 'example.com'
                  : editingRule.matchType === 'wildcard'
                    ? '*.example.com'
                    : editingRule.matchType === 'regex'
                      ? '^https?:\\/\\/.*\\.example\\.com'
                      : '10.0.0.0/8'
              }
              error={
                validation?.errorMap.pattern === 'INVALID_REGEX'
                  ? 'Biểu thức chính quy không hợp lệ'
                  : validation?.errorMap.pattern === 'INVALID_IPV4_CIDR'
                    ? 'Dải CIDR IPv4 không hợp lệ (vd: 192.168.1.0/24)'
                    : validation?.errorMap.pattern
                      ? 'Mẫu khớp không được để trống'
                      : undefined
              }
              autoFocus
            />

            {/* Đích đến (Target) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {t('target')}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Select
                  value={editingRule.targetType}
                  onChange={(val) =>
                    setEditingRule({ ...editingRule, targetType: val as 'direct' | 'profile' })
                  }
                  options={[
                    { value: 'direct', label: 'Trực tiếp (Direct)' },
                    { value: 'profile', label: 'Đi qua Proxy Profile' },
                  ]}
                  className="flex-1"
                />

                {editingRule.targetType === 'profile' && (
                  <Select
                    value={editingRule.targetProfileId}
                    onChange={(val) => setEditingRule({ ...editingRule, targetProfileId: val })}
                    options={state.profiles.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                    className="flex-1"
                  />
                )}
              </div>
            </div>

            {/* Ghi chú */}
            <TextField
              label={t('note')}
              value={editingRule.note}
              onChange={(val) => setEditingRule({ ...editingRule, note: val })}
              placeholder="Ghi chú tùy chọn..."
            />

            {/* Thao tác Form */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setEditingRule(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={!validation?.isValid}>
                {t('save')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Nhập hàng loạt (Batch Import) */}
      {showBatchModal && (
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
            if (e.target === e.currentTarget) setShowBatchModal(false);
          }}
        >
          <form
            onSubmit={handleBatchImport}
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              width: '100%',
              maxWidth: '480px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Nhập danh sách quy tắc hàng loạt
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Nhập danh sách tên miền (mỗi dòng một domain). Các dòng trùng lặp sẽ tự động được bỏ qua.
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Select
                label="Đích đến áp dụng"
                value={batchTargetType}
                onChange={(val) => setBatchTargetType(val as 'direct' | 'profile')}
                options={[
                  { value: 'direct', label: 'Trực tiếp (Direct)' },
                  { value: 'profile', label: 'Đi qua Proxy Profile' },
                ]}
                className="flex-1"
              />

              {batchTargetType === 'profile' && (
                <Select
                  label="Chọn Profile"
                  value={batchTargetProfileId}
                  onChange={(val) => setBatchTargetProfileId(val)}
                  options={state.profiles.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  className="flex-1"
                />
              )}
            </div>

            <textarea
              value={batchText}
              onInput={(e) => setBatchText(e.currentTarget.value)}
              rows={8}
              placeholder="google.com&#10;youtube.com&#10;openai.com&#10;github.com"
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" onClick={() => setShowBatchModal(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={!batchText.trim()}>
                Thêm vào quy tắc
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Toast thông báo hoàn tác (Undo) xóa */}
      {deletedRuleUndo && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            padding: '10px 16px',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span>Đã xóa quy tắc "{deletedRuleUndo.rule.pattern}"</span>
          <Button variant="primary" size="sm" onClick={handleUndoDelete}>
            Khôi phục (Undo)
          </Button>
        </div>
      )}

      {/* Toast thông báo chung */}
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
