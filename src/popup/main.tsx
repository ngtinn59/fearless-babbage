import { render } from 'preact';

function PopupApp() {
  return (
    <div>
      <h1>Smart Proxy</h1>
    </div>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<PopupApp />, root);
}
