import { render } from 'preact';
import { App } from './ui/App';
import { boot } from './store/signals';
import './ui/theme.css';

render(<App />, document.getElementById('app')!);
void boot();
