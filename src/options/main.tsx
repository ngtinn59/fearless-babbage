import { render } from 'preact';

function OptionsApp() {
  return (
    <div>
      <h1>Smart Proxy Options</h1>
    </div>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<OptionsApp />, root);
}
