import { render } from 'preact';
import { OptionsApp } from './App';

const root = document.getElementById('app');
if (root) {
  render(<OptionsApp />, root);
}
