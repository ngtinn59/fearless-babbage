import { t } from '../shared/i18n';

export function PopupApp() {
  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui, sans-serif', minWidth: '300px' }}>
      <header>
        <h1 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>{t('popupTitle')}</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>{t('extDescription')}</p>
      </header>
    </div>
  );
}
