import { t } from '../shared/i18n';

export function OptionsApp() {
  return (
    <div style={{ maxWidth: '800px', margin: '32px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '16px', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 600 }}>{t('optionsTitle')}</h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>{t('optionsSubtitle')}</p>
      </header>
    </div>
  );
}
