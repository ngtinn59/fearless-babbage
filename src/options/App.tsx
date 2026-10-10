import { useState } from 'preact/hooks';
import { t } from '../shared/i18n';
import { useAppState } from '../ui/hooks/useAppState';
import { ProfilesPage } from './pages/Profiles';
import { RulesPage } from './pages/Rules';
import '../ui/styles/base.css';

export type OptionsTab = 'profiles' | 'rules' | 'general' | 'backup';

export function OptionsApp() {
  const { state, loading, error, updateState, clearError } = useAppState();
  const [activeTab, setActiveTab] = useState<OptionsTab>('profiles');

  if (loading || !state) {
    return (
      <div style={{ maxWidth: '840px', margin: '48px auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Đang tải cấu hình...
      </div>
    );
  }

  const tabs: Array<{ id: OptionsTab; label: string; icon: string }> = [
    { id: 'profiles', label: t('tabProfiles'), icon: '🌐' },
    { id: 'rules', label: t('tabRules'), icon: '🔀' },
    { id: 'general', label: t('tabGeneral'), icon: '⚙️' },
    { id: 'backup', label: t('tabBackup'), icon: '💾' },
  ];

  return (
    <div
      style={{
        maxWidth: '840px',
        margin: '32px auto',
        padding: '0 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/icons/icon48.png" alt="" width="32" height="32" />
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{t('optionsTitle')}</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              {t('optionsSubtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '8px',
        }}
        aria-label="Cài đặt Smart Proxy"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--color-primary-light)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab Content */}
      <main style={{ minHeight: '360px' }}>
        {activeTab === 'profiles' && (
          <ProfilesPage state={state} updateState={updateState} />
        )}
        {activeTab === 'rules' && (
          <RulesPage state={state} updateState={updateState} />
        )}
        {activeTab === 'general' && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Tính năng Cài đặt Chung đang được kết nối...
          </div>
        )}
        {activeTab === 'backup' && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Tính năng Sao lưu & Khôi phục đang được kết nối...
          </div>
        )}
      </main>

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
