// A short line at the bottom of the page. Home and Breed share it.

const el = () => document.getElementById('appToast');

export function say(text) {
  const node = el();
  if (!node) return;
  node.textContent = text;
  node.classList.add('show');
  clearTimeout(say.timer);
  say.timer = setTimeout(() => node.classList.remove('show'), 1500);
}
