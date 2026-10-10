import { render } from 'preact';
import { PopupApp } from './App';

const root = document.getElementById('app');
if (root) {
  render(<PopupApp />, root);
}
