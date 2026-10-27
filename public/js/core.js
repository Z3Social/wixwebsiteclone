// Core helpers: state, API client, DOM utilities, modals, toasts, icons.
export const state = { user: null, site: {}, listeners: new Set() };

export function onAuthChange(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}
export function setUser(user) {
  state.user = user;
  state.listeners.forEach((fn) => fn(user));
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    if (res.status === 401 && state.user) refreshMe();
    throw err;
  }
  return data;
}

export async function refreshMe() {
  const { user, site } = await api('/me');
  state.site = site || {};
  setUser(user);
  return user;
}

// ---------------------------------------------------------------- DOM
export const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Renders post/comment text: escapes HTML, supports **bold**, links and @mentions. */
export function richText(s) {
  let out = esc(s);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  return out;
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
export function timeAgo(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return fmtDate(iso);
}
export function fmtSize(n) {
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

const AVATAR_COLORS = ['#0475c2', '#7501d9', '#eb484d', '#13a37f', '#d97706', '#4b5761'];
export function avatar(user, size = '') {
  const cls = `avatar ${size}`;
  if (user && user.avatar) return `<img class="${cls}" src="${esc(user.avatar)}" alt="${esc(user.displayName)}" />`;
  const name = (user && user.displayName) || '?';
  const color = AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return `<span class="${cls}" style="background:${color}">${esc(name.trim().charAt(0).toUpperCase())}</span>`;
}

export const profileUrl = (u) => `/profile/${encodeURIComponent(u.username)}/profile`;

// ---------------------------------------------------------------- toasts & modals
export function toast(msg, type = '') {
  const t = el(`<div class="toast ${type}">${esc(msg)}</div>`);
  $('#toast-root').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
export const toastError = (e) => toast(e.message || String(e), 'error');

export function modal({ title = '', body = '', wide = false, className = '', onClose } = {}) {
  const root = el(`
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal ${wide ? 'wide' : ''} ${className}">
        ${title ? `<div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>` : ''}
        <div class="modal-content"></div>
      </div>
    </div>`);
  const content = $('.modal-content', root);
  if (typeof body === 'string') content.innerHTML = body;
  else content.appendChild(body);
  const close = () => {
    root.remove();
    document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  root.addEventListener('mousedown', (e) => e.target === root && close());
  $$('[data-close]', root).forEach((b) => b.addEventListener('click', close));
  document.addEventListener('keydown', onKey);
  $('#modal-root').appendChild(root);
  setTimeout(() => {
    const f = $('input, textarea', content);
    f && f.focus();
  }, 30);
  return { root, content, close };
}

export function confirmDialog(message, { okText = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: 'Are you sure?',
      body: `<div class="modal-body"><p class="muted" style="margin:0">${esc(message)}</p></div>
             <div class="modal-foot"><button class="btn outline" data-no>Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-yes>${esc(okText)}</button></div>`,
      onClose: () => !done && resolve(false),
    });
    $('[data-no]', m.root).onclick = () => m.close();
    $('[data-yes]', m.root).onclick = () => {
      done = true;
      m.close();
      resolve(true);
    };
  });
}

export function lightbox(url, type = 'image') {
  const node = el(
    `<div class="lightbox">${type === 'video' ? `<video src="${esc(url)}" controls autoplay></video>` : `<img src="${esc(url)}" alt="" />`}</div>`
  );
  node.addEventListener('click', (e) => e.target === node || e.target.tagName === 'IMG' ? node.remove() : null);
  const onKey = (e) => {
    if (e.key === 'Escape') {
      node.remove();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);
  document.body.appendChild(node);
}

export function closeOnOutside(menu, trigger) {
  const handler = (e) => {
    if (!menu.contains(e.target) && !trigger.contains(e.target)) {
      menu.hidden = true;
      trigger.setAttribute && trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', handler);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', handler));
}

/** Simple popup menu anchored to a button. items: [{label, onClick, danger}] */
export function popupMenu(trigger, items) {
  const wrap = trigger.parentElement;
  wrap.style.position = 'relative';
  const existing = $('.dropdown.popup', wrap);
  if (existing) return existing.remove();
  const menu = el(`<div class="dropdown right popup"></div>`);
  items.forEach((it) => {
    const b = el(`<button type="button" class="${it.danger ? 'danger' : ''}">${esc(it.label)}</button>`);
    b.onclick = () => {
      menu.remove();
      it.onClick();
    };
    menu.appendChild(b);
  });
  wrap.appendChild(menu);
  const handler = (e) => {
    if (!menu.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
      menu.remove();
      document.removeEventListener('mousedown', handler);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', handler));
}

// ---------------------------------------------------------------- files
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function uploadFile(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than 20 MB.`);
  const dataUrl = await readFile(file);
  return api('/upload', { method: 'POST', body: { dataUrl, name: file.name } });
}

export function pickFiles({ accept = '*/*', multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = el(`<input type="file" accept="${accept}" ${multiple ? 'multiple' : ''} hidden />`);
    input.onchange = () => resolve([...input.files]);
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 60000);
  });
}

export async function copyLink(path) {
  const url = location.origin + path;
  try {
    if (navigator.share && matchMedia('(pointer:coarse)').matches) {
      await navigator.share({ url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast('Link copied to clipboard');
  } catch {
    prompt('Copy this link:', url);
  }
}

// ---------------------------------------------------------------- auth
export function requireAuth(mode = 'login') {
  if (state.user) return true;
  openAuth(mode);
  return false;
}

export function openAuth(mode = 'login') {
  const m = modal({ className: 'auth-modal', body: '<div></div>' });
  const render = () => {
    const signup = mode === 'signup';
    m.content.innerHTML = `
      <div class="modal-head" style="border:0;padding-bottom:0"><span class="spacer"></span><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
      <div class="modal-body" style="padding-top:0">
        <h2>${signup ? 'Sign Up' : 'Log In'}</h2>
        <div class="switch">${signup ? 'Already a member?' : 'New to this site?'} <button type="button" data-switch>${signup ? 'Log In' : 'Sign Up'}</button></div>
        <form class="stack" novalidate>
          ${signup ? `<div class="field"><label>Display name</label><input class="input" name="displayName" autocomplete="nickname" /></div>` : ''}
          <div class="field"><label>${signup ? 'Email' : 'Email or username'}</label><input class="input" name="login" type="${signup ? 'email' : 'text'}" autocomplete="${signup ? 'email' : 'username'}" required /></div>
          ${signup ? `<div class="field"><label>Username</label><input class="input" name="username" autocomplete="username" placeholder="letters, numbers, . _ -" /></div>` : ''}
          <div class="field"><label>Password</label><input class="input" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required /></div>
          <div class="form-error"></div>
          <button class="btn" type="submit" style="width:100%">${signup ? 'Sign Up' : 'Log In'}</button>
        </form>
      </div>`;
    $('[data-close]', m.content).onclick = m.close;
    $('[data-switch]', m.content).onclick = () => {
      mode = signup ? 'login' : 'signup';
      render();
    };
    const form = $('form', m.content);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try {
        const body = signup
          ? { email: f.login, password: f.password, username: f.username, displayName: f.displayName }
          : { login: f.login, password: f.password };
        const { user } = await api(signup ? '/auth/signup' : '/auth/login', { method: 'POST', body });
        m.close();
        await refreshMe();
        toast(signup ? `Welcome to Z3 Social, ${user.displayName}!` : `Welcome back, ${user.displayName}!`);
      } catch (err) {
        $('.form-error', form).textContent = err.message;
        btn.disabled = false;
      }
    };
    setTimeout(() => $('input', form).focus(), 20);
  };
  render();
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  await refreshMe();
  toast('You have logged out.');
}

// ---------------------------------------------------------------- icons (inline SVG)
const svg = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const icons = {
  user: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 14a8 8 0 0 1-6.2-2.9C7 15.4 9.4 14.5 12 14.5s5 .9 6.2 2.6A8 8 0 0 1 12 20Z"/></svg>`,
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>'),
  chevronRight: svg('<path d="m9 6 6 6-6 6"/>'),
  share: svg('<path d="M14 5l7 6-7 6v-3.5c-5 0-8.5 1.5-11 5 1-5 4-9.5 11-10.5V5Z"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  like: svg('<path d="M7 11v9H4v-9h3Zm0 0 4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/>'),
  smile: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0M9 10h.01M15 10h.01"/>'),
  comment: svg('<path d="M4 5h16v11H9l-5 4V5Z"/>'),
  pin: svg('<path d="M14.5 3.5 20.5 9.5l-3 1-3.5 3.5.5 4-1.5 1.5-3.5-3.5L5 20.5 3.5 19l4.5-4.5-3.5-3.5L6 9.5l4 .5 3.5-3.5 1-3Z"/>'),
  more: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
  video: svg('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>'),
  poll: svg('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  file: svg('<path d="M14 3H6v18h12V7l-4-4Z"/><path d="M14 3v4h4"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  bellSlash: svg('<path d="M10.3 2A6 6 0 0 1 18 11v2m-1.3 4H4l2-2v-5c0-.6.1-1.2.3-1.8"/><path d="M10 20a2 2 0 0 0 4 0"/><line x1="2" y1="2" x2="22" y2="22"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/>'),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'),
  youtube: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  gif: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M8 10H6a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h2v-2"/><path d="M12 10v4"/><path d="M16 10h4M16 12h3M16 14h0"/></svg>`,
  admin: `<svg class="admin-badge" viewBox="0 0 24 24" fill="currentColor" aria-label="Admin"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm0 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/></svg>`,
};
