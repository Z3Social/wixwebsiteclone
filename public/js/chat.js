// "Direct Messages" chat widget with realtime updates over Server-Sent Events.
import { api, state, el, esc, $, $$, avatar, timeAgo, toastError, openAuth, onAuthChange, refreshMe, toast } from './core.js';

let panel = null;
let view = { type: 'list' }; // or { type: 'thread', user }
let unread = 0;
let source = null;
const tab = el(`<button class="chat-tab" type="button">Direct Messages<span class="badge-count" hidden></span></button>`);

export function initChat() {
  document.getElementById('chat-root').appendChild(tab);
  tab.onclick = () => (state.user ? open() : openAuth());
  onAuthChange((u) => {
    connect(u);
    setUnread(u ? u.unreadMessages : 0);
    if (!u) close();
  });
}

function setUnread(n) {
  unread = n || 0;
  const b = $('.badge-count', tab);
  b.hidden = !unread;
  b.textContent = unread;
}

function connect(user) {
  if (source) {
    source.close();
    source = null;
  }
  if (!user) return;
  source = new EventSource('/api/events');
  source.addEventListener('message', (e) => {
    const { message, from } = JSON.parse(e.data);
    const mine = message.from === state.user.id;
    if (panel && view.type === 'thread' && (view.user.id === message.from || view.user.id === message.to)) {
      appendMessage(message);
      if (!mine) api(`/messages/${encodeURIComponent(view.user.username)}`).then(() => refreshMe()).catch(() => {});
    } else if (!mine) {
      setUnread(unread + 1);
      toast(`New message from ${from.displayName}`);
      if (panel && view.type === 'list') renderList();
    }
  });
  source.addEventListener('notification', (e) => {
    const n = JSON.parse(e.data);
    toast(`${n.actor.displayName} ${n.text}`);
    refreshMe();
  });
}

function open() {
  if (panel) return;
  tab.hidden = true;
  panel = el(`<section class="chat-panel" aria-label="Direct Messages">
    <div class="chat-head"><button data-back aria-label="Back" hidden>‹</button><h3>Direct Messages</h3><button data-min aria-label="Close">✕</button></div>
    <div class="chat-body"></div><form class="chat-foot" hidden><input placeholder="Type a message..." autocomplete="off" /><button type="submit">Send</button></form></section>`);
  document.getElementById('chat-root').appendChild(panel);
  $('[data-min]', panel).onclick = close;
  $('[data-back]', panel).onclick = () => {
    view = { type: 'list' };
    renderList();
  };
  $('form', panel).onsubmit = async (e) => {
    e.preventDefault();
    const input = $('input', panel);
    const text = input.value.trim();
    if (!text || view.type !== 'thread') return;
    input.value = '';
    try {
      await api(`/messages/${encodeURIComponent(view.user.username)}`, { method: 'POST', body: { text } });
    } catch (err) {
      toastError(err);
      input.value = text;
    }
  };
  view.type === 'thread' ? renderThread(view.user) : renderList();
}

function close() {
  if (!panel) return;
  panel.remove();
  panel = null;
  tab.hidden = false;
}

export function openChatWith(user) {
  view = { type: 'thread', user };
  if (!panel) open();
  else renderThread(user);
}

async function renderList() {
  if (!panel) return;
  $('[data-back]', panel).hidden = true;
  $('h3', panel).textContent = 'Direct Messages';
  $('form', panel).hidden = true;
  const body = $('.chat-body', panel);
  body.innerHTML = `<input class="chat-search" placeholder="Search members to message" /><div class="results"></div><div class="convos"><div class="chat-label">Loading…</div></div>`;
  const search = $('.chat-search', body);
  let t;
  search.oninput = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const q = search.value.trim();
      const res = $('.results', body);
      if (!q) return (res.innerHTML = '');
      const { members } = await api(`/members?q=${encodeURIComponent(q)}`);
      res.innerHTML = '<div class="chat-label">Members</div>';
      members
        .filter((m) => m.id !== state.user.id)
        .forEach((m) => {
          const row = el(`<div class="convo">${avatar(m, 'sm')}<div class="t"><div class="n">${esc(m.displayName)}</div><div class="l">@${esc(m.username)}</div></div></div>`);
          row.onclick = () => openChatWith(m);
          res.appendChild(row);
        });
    }, 250);
  };
  try {
    const { conversations } = await api('/messages');
    const box = $('.convos', body);
    box.innerHTML = '<div class="chat-label">Conversations</div>';
    if (!conversations.length) box.innerHTML += '<p style="padding:8px;color:#607085;font-size:14px">No messages yet. Search for a member above to start chatting.</p>';
    conversations.forEach((c) => {
      const row = el(`<div class="convo">${avatar(c.user, 'sm')}<div class="t"><div class="n">${esc(c.user.displayName)}</div>
        <div class="l">${c.last.from === state.user.id ? 'You: ' : ''}${esc(c.last.text)}</div></div>
        ${c.unread ? `<span class="u">${c.unread}</span>` : `<span style="font-size:11px;color:#607085">${timeAgo(c.last.createdAt)}</span>`}</div>`);
      row.onclick = () => openChatWith(c.user);
      box.appendChild(row);
    });
  } catch (e) {
    toastError(e);
  }
}

async function renderThread(user) {
  if (!panel) return;
  $('[data-back]', panel).hidden = false;
  $('h3', panel).textContent = user.displayName;
  $('form', panel).hidden = false;
  const body = $('.chat-body', panel);
  body.innerHTML = '';
  try {
    const { messages } = await api(`/messages/${encodeURIComponent(user.username)}`);
    if (!messages.length) body.innerHTML = `<p class="empty-thread" style="text-align:center;color:#607085;font-size:14px;margin-top:40px">Say hi to ${esc(user.displayName)} 👋</p>`;
    messages.forEach(appendMessage);
    refreshMe();
  } catch (e) {
    toastError(e);
  }
  $('input', panel).focus();
}

function appendMessage(m) {
  if (!panel) return;
  const body = $('.chat-body', panel);
  const empty = $('.empty-thread', body);
  if (empty) empty.remove();
  if ($(`[data-id="${m.id}"]`, body)) return;
  const mine = m.from === state.user.id;
  body.appendChild(
    el(`<div class="msg ${mine ? 'me' : 'them'}" data-id="${m.id}">${esc(m.text)}<div class="msg-time">${timeAgo(m.createdAt)}</div></div>`)
  );
  body.scrollTop = body.scrollHeight;
}
