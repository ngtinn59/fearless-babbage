import { getState, updateState } from '../shared/storage';
import { toggleProxyMode } from '../core/toggle';

/**
 * Register command shortcuts (e.g. toggle-proxy).
 */
export function registerCommands(): void {
  if (typeof chrome === 'undefined' || !chrome.commands?.onCommand) return;

  chrome.commands.onCommand.addListener(async (command: string) => {
    if (command === 'toggle-proxy') {
      try {
        const state = await getState();
        const { nextState, shouldOpenOptions } = toggleProxyMode(state);

        if (shouldOpenOptions) {
          if (chrome.runtime?.openOptionsPage) {
            chrome.runtime.openOptionsPage();
          }
        } else {
          await updateState(() => nextState);
        }
      } catch (err) {
        console.error('[Smart Proxy] Lỗi khi xử lý phím tắt toggle-proxy:', err);
      }
    }
  });
}
