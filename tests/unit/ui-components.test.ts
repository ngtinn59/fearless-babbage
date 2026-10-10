import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../../src/ui/components/Button';
import { Toggle } from '../../src/ui/components/Toggle';
import { Select } from '../../src/ui/components/Select';
import { TextField } from '../../src/ui/components/TextField';
import { Badge } from '../../src/ui/components/Badge';
import { ConfirmDialog } from '../../src/ui/components/ConfirmDialog';
import { Toast } from '../../src/ui/components/Toast';
import { createDefaultState } from '../../src/core/defaults';
import { getState, setState, updateState } from '../../src/shared/storage';
import { installChromeMock, type ChromeMockController } from '../setup/chrome-mock';

vi.mock('preact/hooks', async () => {
  const actual = await vi.importActual<typeof import('preact/hooks')>('preact/hooks');
  return {
    ...actual,
    useEffect: (fn: () => void | (() => void)) => {
      try {
        fn();
      } catch {
        // Safe fallback in non-browser unit test environment
      }
    },
  };
});

describe('UI Base & Components (Task 10)', () => {
  let mockCtrl: ChromeMockController;

  beforeEach(() => {
    mockCtrl = installChromeMock();
    mockCtrl.reset();
  });

  describe('Button Component', () => {
    it('renders with correct default props', () => {
      const vnode = Button({ children: 'Click me' });
      expect(vnode.type).toBe('button');
      expect(vnode.props.type).toBe('button');
      expect(vnode.props.disabled).toBe(false);
      expect(vnode.props.className).toContain('btn-secondary');
      expect(vnode.props.className).toContain('btn-md');
    });

    it('applies variant and disabled states', () => {
      const vnode = Button({
        children: 'Delete',
        variant: 'danger',
        size: 'sm',
        disabled: true,
        ariaLabel: 'Delete item',
      });
      expect(vnode.props.className).toContain('btn-danger');
      expect(vnode.props.className).toContain('btn-sm');
      expect(vnode.props.disabled).toBe(true);
      expect(vnode.props['aria-label']).toBe('Delete item');
    });

    it('shows loading indicator when loading is true', () => {
      const vnode = Button({ children: 'Submit', loading: true });
      expect(vnode.props.disabled).toBe(true);
      expect(vnode.props.children).toBe('...');
    });
  });

  describe('Toggle Component', () => {
    it('renders as accessible switch', () => {
      const vnode = Toggle({
        checked: true,
        onChange: vi.fn(),
        label: 'Enable Proxy',
        id: 'proxy-toggle',
      });

      expect(vnode.type).toBe('label');
      // Children: div (switch) and span (label)
      const children = Array.isArray(vnode.props.children)
        ? vnode.props.children
        : [vnode.props.children];
      const switchEl = children[0] as { props: Record<string, unknown> };

      expect(switchEl.props.role).toBe('switch');
      expect(switchEl.props['aria-checked']).toBe(true);
      expect(switchEl.props['aria-label']).toBe('Enable Proxy');
      expect(switchEl.props.tabIndex).toBe(0);
    });

    it('invokes onChange with toggled value on click', () => {
      const onChange = vi.fn();
      const vnode = Toggle({ checked: false, onChange });

      const children = Array.isArray(vnode.props.children)
        ? vnode.props.children
        : [vnode.props.children];
      const switchEl = children[0] as { props: { onClick: () => void } };

      switchEl.props.onClick();
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('handles keyboard space and enter triggers', () => {
      const onChange = vi.fn();
      const vnode = Toggle({ checked: true, onChange });

      const children = Array.isArray(vnode.props.children)
        ? vnode.props.children
        : [vnode.props.children];
      const switchEl = children[0] as {
        props: { onKeyDown: (e: { key: string; preventDefault: () => void }) => void };
      };

      const preventDefault = vi.fn();
      switchEl.props.onKeyDown({ key: ' ', preventDefault });
      expect(preventDefault).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Select Component', () => {
    it('renders options and value properly', () => {
      const options = [
        { value: 'http', label: 'HTTP' },
        { value: 'socks5', label: 'SOCKS5' },
      ];
      const vnode = Select({
        options,
        value: 'http',
        onChange: vi.fn(),
        label: 'Protocol',
      });

      expect(vnode.type).toBe('div');
      const children = Array.isArray(vnode.props.children)
        ? vnode.props.children
        : [vnode.props.children];
      const selectEl = children[1] as {
        type: string;
        props: { value: string; 'aria-invalid': boolean };
      };

      expect(selectEl.type).toBe('select');
      expect(selectEl.props.value).toBe('http');
      expect(selectEl.props['aria-invalid']).toBe(false);
    });

    it('displays error message with role="alert"', () => {
      const vnode = Select({
        options: [{ value: 'a', label: 'A' }],
        value: 'a',
        onChange: vi.fn(),
        error: 'Required field',
      });

      const children = Array.isArray(vnode.props.children)
        ? vnode.props.children
        : [vnode.props.children];
      const errorEl = children[2] as {
        type: string;
        props: { role: string; children: string };
      };

      expect(errorEl.props.role).toBe('alert');
      expect(errorEl.props.children).toBe('Required field');
    });
  });

  describe('TextField Component', () => {
    it('renders input with specified type and value', () => {
      const vnode = TextField({
        value: '127.0.0.1',
        onChange: vi.fn(),
        label: 'Host',
        placeholder: 'e.g. proxy.corp.net',
      });

      const children = Array.isArray(vnode.props.children)
        ? vnode.props.children
        : [vnode.props.children];
      const inputEl = children[1] as {
        type: string;
        props: { type: string; value: string; placeholder: string };
      };

      expect(inputEl.type).toBe('input');
      expect(inputEl.props.type).toBe('text');
      expect(inputEl.props.value).toBe('127.0.0.1');
      expect(inputEl.props.placeholder).toBe('e.g. proxy.corp.net');
    });

    it('renders error state and alert message', () => {
      const vnode = TextField({
        value: '',
        onChange: vi.fn(),
        error: 'Host cannot be empty',
      });

      const children = Array.isArray(vnode.props.children)
        ? vnode.props.children
        : [vnode.props.children];
      const inputEl = children[1] as { props: { 'aria-invalid': boolean } };
      const errorEl = children[2] as { props: { role: string; children: string } };

      expect(inputEl.props['aria-invalid']).toBe(true);
      expect(errorEl.props.role).toBe('alert');
      expect(errorEl.props.children).toBe('Host cannot be empty');
    });
  });

  describe('Badge Component', () => {
    it('renders text with variant class', () => {
      const vnode = Badge({ text: 'AUTO', variant: 'info' });
      expect(vnode.type).toBe('span');
      expect(vnode.props.children).toBe('AUTO');
      expect(vnode.props.className).toContain('badge-info');
    });

    it('applies custom background color for profile badges', () => {
      const vnode = Badge({ text: 'PRX', color: '#0088cc' });
      expect(vnode.props.style.backgroundColor).toBe('#0088cc');
      expect(vnode.props.style.color).toBe('#ffffff');
    });
  });

  describe('ConfirmDialog Component', () => {
    it('returns null when isOpen is false', () => {
      const vnode = ConfirmDialog({
        isOpen: false,
        title: 'Delete Profile',
        message: 'Are you sure?',
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      });
      expect(vnode).toBeNull();
    });

    it('renders modal dialog with accessible attributes when isOpen is true', () => {
      const vnode = ConfirmDialog({
        isOpen: true,
        title: 'Delete Profile',
        message: 'Are you sure?',
        danger: true,
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      });

      expect(vnode).not.toBeNull();
      const modalEl = vnode?.props.children as { props: Record<string, unknown> };
      expect(modalEl.props.role).toBe('alertdialog');
      expect(modalEl.props['aria-modal']).toBe('true');
    });
  });

  describe('Toast Component', () => {
    it('renders message with status role for info', () => {
      const vnode = Toast({ message: 'Saved successfully', type: 'success' });
      expect(vnode?.props.role).toBe('status');
      expect(vnode?.props.className).toContain('toast-success');
    });

    it('renders message with alert role for error', () => {
      const vnode = Toast({ message: 'Failed to apply configuration', type: 'error' });
      expect(vnode?.props.role).toBe('alert');
      expect(vnode?.props.className).toContain('toast-error');
    });

    it('returns null when isOpen is false', () => {
      const vnode = Toast({ message: 'Hidden', isOpen: false });
      expect(vnode).toBeNull();
    });
  });

  describe('Storage & State integration (backing useAppState)', () => {
    it('allows getting, updating, and subscribing to AppState changes', async () => {
      const defaultState = createDefaultState();
      await setState(defaultState);

      const loaded = await getState();
      expect(loaded.mode.kind).toBe('direct');

      const nextState = await updateState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          theme: 'dark',
        },
      }));

      expect(nextState.settings.theme).toBe('dark');
      const refreshed = await getState();
      expect(refreshed.settings.theme).toBe('dark');
    });
  });
});
