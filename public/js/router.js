// Minimal history-API router.
const routes = [];
let notFound = null;
let current = null;

export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp(
    '^' +
      pattern.replace(/\/:(\w+)/g, (_, k) => {
        keys.push(k);
        return '/([^/]+)';
      }) +
      '/?$'
  );
  routes.push({ re, keys, handler });
}
export const setNotFound = (h) => (notFound = h);

export function navigate(path, { replace = false } = {}) {
  if (path === location.pathname + location.search) return render();
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  render();
}

export async function render() {
  const path = decodeURI(location.pathname);
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      current = { handler: r.handler, params };
      return r.handler(params, new URLSearchParams(location.search));
    }
  }
  current = null;
  notFound && notFound();
}

export function start() {
  window.addEventListener('popstate', render);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const href = a.getAttribute('href');
    if (!href.startsWith('/') || href.startsWith('//') || /^\/(uploads|media|api)\//.test(href)) return;
    e.preventDefault();
    navigate(href);
  });
  render();
}
