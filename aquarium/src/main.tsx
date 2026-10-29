import { render } from 'preact';
import { App } from './ui/App';
import { boot } from './store/signals';
import { startSession } from './store/auth';
import { bootBackend } from './store/backend';
import './ui/theme.css';

render(<App />, document.getElementById('app')!);
void (async () => {
  await startSession();
  await boot(bootBackend());
})();
