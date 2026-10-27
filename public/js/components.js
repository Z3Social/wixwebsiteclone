// Reusable UI components: post cards, comments, composer, group editor.
import {
  api, state, el, esc, $, $$, icons, avatar, richText, fmtDate, timeAgo, profileUrl, toast, toastError,
  modal, confirmDialog, lightbox, popupMenu, requireAuth, uploadFile, pickFiles, copyLink,
} from './core.js';
import { navigate } from './router.js';
import { EMOJI_KEYWORDS } from './emoji_keywords.js';

export const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑',
      '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
      '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
      '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
      '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱',
      '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿',
      '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖',
    ],
  },
  {
    id: 'people',
    name: 'People & Body',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏',
      '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶',
      '👂', '🦻', '👃', '🫀', '🫁', '🧠', '👀', '👁', '👅', '👄',
    ],
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮',
      '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣',
      '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋',
      '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎',
      '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋',
      '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫',
      '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌',
      '🐕', '🐩', '🦮', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝',
      '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔', '🌲', '🌳', '🌴', '🌵',
      '🌷', '🌸', '🌹', '🌺', '🌻', '🌼', '🌾', '🍀', '🍁', '🍂', '🍃',
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍕',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑',
      '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🫑', '🌽',
      '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚',
      '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕',
      '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜',
      '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🍧', '🍨',
      '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰',
      '🥜', '🍯', '🥛', '🍼', '☕️', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂',
      '🍷', '🥃', '🍸', '🍹', '🍾', '🧊',
    ],
  },
  {
    id: 'activities',
    name: 'Activities & Travel',
    icon: '⚽️',
    emojis: [
      '⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸',
      '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳️', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋',
      '🎽', '🛹', '🛼', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🏋️', '🤼', '🤸', '🧗',
      '🎯', '🎮', '🎲', '🧩', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺',
      '🎸', '🪕', '🎻', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🎫', '🎟', '🎪', '🎭',
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛',
      '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍', '🛺', '🚨', '🚔', '✈️', '🚀',
      '🛸', '🚁', '🛶', '⛵️', '🚤', '🛳', '⛴', '🚢',
    ],
  },
  {
    id: 'objects',
    name: 'Objects & Symbols',
    icon: '💡',
    emojis: [
      '💡', '🔦', '🏮', '🪔', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '📷', '📸',
      '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛',
      '🧭', '⏱', '⏰', '⏳', '⌛️', '📡', '🔋', '🔌', '💎', '💍', '👑', '💄', '🧢',
      '👓', '🕶', '👔', '👕', '👖', '🧣', '🧤', '🧥', '🧦', '👗', '👘', '🥻', '🩴',
      '👠', '👡', '👢', '👞', '👟', '🎒', '🧳', '👛', '👜', '💼', '📦', '🏷', '✉️',
      '📩', '📨', '📧', '💌', '📮', '📝', '📁', '📂', '📄', '📃', '📊', '📈', '📉',
      '🗑', '📌', '📍', '📎', '🔒', '🔓', '🔏', '🔐', '🔑', '🗝', '🔨', '🪓', '⛏',
      '🛠', '🗡', '⚔️', '💣', '🧨', '🪃', '🛡', '🔮', '🧿', '💈', '⚗️', '🔭', '🔬',
      '🕳', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡', '🧹', '🧺',
      '🧻', '🧼', '🧽', '🧯', '🛒', '💰', '🪙', '💴', '💵', '💶', '💷', '💸', '💳',
      '💯', '💢', '💥', '💫', '💦', '💨', '💤', '🛑', '⛔️', '📛', '🚫', '⚠️', '🚸',
      '⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️', '↕️', '↔️', '🔄', '🔃', '🎵',
      '🎶', '➕', '➖', '➗', '✖️', '🟰', '♾', '💲', '💱', '™️', '©️', '®️', '✔️',
      '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫️', '⚪️', '🟤', '🔺', '🔻',
      '🎉', '🎊', '🎈', '🎁', '🪄', '🔥', '✨', '🌟', '⭐️', '⚡️', '☄️', '💥', '☀️',
      '🌤', '⛅️', '🌥', '☁️', '🌦', '🌧', '⛈', '🌩', '🌨', '❄️', '☃️', '⛄️', '🌬',
      '💨', '🌪', '🌫', '🌈', '☂️', '☔️', '💧', '🌊',
    ],
  },
  {
    id: 'hearts',
    name: 'Hearts & Flags',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
      '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯',
      '🕎', '☯️', '☦️', '🛐', '⛎', '♈️', '♉️', '♊️', '♋️', '♌️', '♍️', '♎️', '♏️',
      '♐️', '♑️', '♒️', '♓️', '🆔', '⚛️', '🚩', '🏁', '🏳️', '🏴', '🏴‍☠️', '🏳️‍🌈',
      '🏳️‍⚧️', '🇺🇸', '🇬🇧', '🇪🇸', '🇦🇷', '🇧🇷', '🇫🇷', '🇩🇪', '🇮🇹', '🇯🇵', '🇨🇳', '🇰🇷',
    ],
  },
];
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

const postUrl = (p) => (p && p.group ? `/group/${p.group.slug}/discussion/${p.id}` : '#');
const parentPostUrl = (p) => (p && p.group && p.parentPost ? `/group/${p.group.slug}/discussion/${p.parentPost.id}` : '#');

export function resolveMediaSrc(m) {
  if (!m) return '';
  let url = typeof m === 'string' ? m : m.url || '';
  const km = url.match(/(?:https?:\/\/)?(?:www\.)?klipy\.com\/gifs\/([a-zA-Z0-9_-]+)/i);
  if (km) return `/api/klipy/media/${km[1]}`;
  return url;
}

function mediaHtml(media) {
  if (!media.length) return '';
  const n = Math.min(media.length, 4);
  return `<div class="post-media n${n}">${media
    .map((m) => {
      if (m.type === 'youtube') {
        const id = m.youtubeId || (/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i.exec(m.url) || [])[1];
        return `<div class="youtube-embed" style="position:relative;width:100%;aspect-ratio:16/9;margin:6px 0;background:#000;border-radius:6px;overflow:hidden">
          <iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;display:block"></iframe>
        </div>`;
      }
      if (m.type === 'video') {
        return `<video src="${esc(m.url)}" controls preload="metadata"></video>`;
      }
      if (m.type === 'audio') {
        return `<audio src="${esc(m.url)}" controls></audio>`;
      }
      // Image or GIF
      const src = resolveMediaSrc(m);
      return `<img src="${esc(src)}" alt="${esc(m.title || '')}" loading="lazy" data-zoom="${esc(src)}" class="${m.type === 'gif' ? 'post-gif' : ''}" />`;
    })
    .join('')}</div>`;
}

function pollHtml(poll) {
  if (!poll) return '';
  return `<div class="poll">${poll.question ? `<h4>${esc(poll.question)}</h4>` : ''}
    ${poll.options
      .map((o) => {
        const pct = poll.totalVotes ? Math.round((o.votes / poll.totalVotes) * 100) : 0;
        return `<button type="button" class="poll-option ${o.mine ? 'mine' : ''}" data-vote="${o.id}">
          <div class="bar" style="width:${pct}%"></div><span>${o.mine ? '✓ ' : ''}${esc(o.text)}</span><span>${pct}%</span></button>`;
      })
      .join('')}
    <div class="dim" style="font-size:13px">${poll.totalVotes} vote${poll.totalVotes === 1 ? '' : 's'}</div></div>`;
}

function reactionsHtml(reactions) {
  const like = reactions.find((r) => r.emoji === '👍');
  const others = reactions.filter((r) => r.emoji !== '👍');
  return `
    <button type="button" class="react-chip ${like && like.mine ? 'mine' : ''}" data-react="👍" aria-label="👍 ${like ? like.count : 0}">${icons.like} ${like ? like.count : 0}</button>
    ${others.map((r) => `<button type="button" class="react-chip ${r.mine ? 'mine' : ''}" data-react="${r.emoji}">${r.emoji} ${r.count}</button>`).join('')}
    <span class="picker-wrap"><button type="button" class="react-chip add-reaction-btn" data-picker aria-label="Add reaction" title="Add reaction" style="font-weight:600;font-size:15px;line-height:1;padding:4px 10px">+</button></span>`;
}

export function openPicker(btn, onPick) {
  const wrap = btn.parentElement;
  wrap.style.position = 'relative';
  const old = $('.emoji-picker-dropdown', wrap);
  if (old) return old.remove();

  let activeCategory = 'smileys';
  let searchQuery = '';

  const picker = el(`
    <div class="emoji-picker-dropdown">
      <div class="ep-search-row">
        <input class="ep-search" placeholder="Search emojis (or Win + .)" autocomplete="off" />
      </div>
      <div class="ep-category-bar">
        ${EMOJI_CATEGORIES.map((c) => `<button type="button" class="ep-cat-btn ${c.id === activeCategory ? 'active' : ''}" data-cat="${c.id}" title="${esc(c.name)}">${c.icon}</button>`).join('')}
      </div>
      <div class="ep-grid-container"></div>
    </div>
  `);

  const grid = $('.ep-grid-container', picker);
  const searchInput = $('.ep-search', picker);

  const renderGrid = () => {
    grid.innerHTML = '';
    const q = searchQuery.toLowerCase().trim();

    if (q) {
      const all = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
      const unique = [...new Set(all)];
      const matches = unique.filter((e) => {
        const k = (EMOJI_KEYWORDS && EMOJI_KEYWORDS[e]) || '';
        const words = k.toLowerCase().split(/\s+/);
        return words.some((w) => w.startsWith(q)) || k.toLowerCase().includes(q) || e.includes(q);
      });
      if (!matches.length) {
        grid.innerHTML = '<div style="padding:28px 10px;text-align:center;color:var(--dim);font-size:13px">No emojis found</div>';
        return;
      }
      const exact = matches.filter((e) => {
        const k = (EMOJI_KEYWORDS && EMOJI_KEYWORDS[e]) || '';
        return k.toLowerCase().split(/\s+/).includes(q);
      });
      const rest = matches.filter((e) => !exact.includes(e));
      const sorted = [...exact, ...rest];

      sorted.forEach((e) => {
        const desc = (EMOJI_KEYWORDS && EMOJI_KEYWORDS[e]) || e;
        const item = el(`<button type="button" class="ep-item" data-e="${e}" title="${esc(desc)}">${e}</button>`);
        grid.appendChild(item);
      });
      return;
    }

    const cat = EMOJI_CATEGORIES.find((c) => c.id === activeCategory) || EMOJI_CATEGORIES[0];
    const header = el(`<div class="ep-cat-title">${esc(cat.name)}</div>`);
    grid.appendChild(header);
    cat.emojis.forEach((e) => {
      const desc = (EMOJI_KEYWORDS && EMOJI_KEYWORDS[e]) || e;
      const item = el(`<button type="button" class="ep-item" data-e="${e}" title="${esc(desc)}">${e}</button>`);
      grid.appendChild(item);
    });
  };

  renderGrid();

  picker.onclick = (e) => {
    const item = e.target.closest('[data-e]');
    if (item) {
      picker.remove();
      onPick(item.dataset.e);
      return;
    }
    const catBtn = e.target.closest('[data-cat]');
    if (catBtn) {
      activeCategory = catBtn.dataset.cat;
      $$('.ep-cat-btn', picker).forEach((b) => b.classList.toggle('active', b.dataset.cat === activeCategory));
      searchQuery = '';
      searchInput.value = '';
      renderGrid();
    }
  };

  searchInput.oninput = (e) => {
    searchQuery = e.target.value;
    renderGrid();
  };

  wrap.appendChild(picker);
  setTimeout(() => searchInput.focus(), 30);

  const h = (e) => {
    if (!picker.contains(e.target) && !btn.contains(e.target)) {
      picker.remove();
      document.removeEventListener('mousedown', h);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', h));
}

export function openCommentModal({ post, comment = null, parentId = null, replyingTo = '', startWith = '', onSubmitted } = {}) {
  if (!requireAuth()) return;
  const isEditing = !!comment;
  const attachments = Array.isArray(comment?.media) ? comment.media.map((m) => ({ ...m })) : [];
  let poll = isEditing ? !!comment.poll : startWith === 'poll';

  let title = 'Write a comment';
  if (isEditing) title = 'Edit Comment';
  else if (replyingTo) title = 'Write a reply';

  let subtext = `Commenting on post in ${esc(post?.group?.name || 'group')}`;
  if (isEditing) subtext = 'Editing comment';
  else if (replyingTo) subtext = `Replying to ${esc(replyingTo)}`;

  const btnText = isEditing ? 'Save' : (replyingTo ? 'Reply' : 'Publish');

  const m = modal({
    title,
    wide: true,
    body: `
      <div class="modal-body">
        <div class="row" style="gap:12px;align-items:center">
          ${avatar(state.user, 'sm')}
          <div>
            <b>${esc(state.user?.displayName || 'You')}</b>
            <div class="dim" style="font-size:13px">${subtext}</div>
          </div>
        </div>
        <textarea class="textarea" name="text" placeholder="${replyingTo ? 'Write a reply…' : 'Share your thoughts…'}" style="min-height:140px;border:0;padding:4px 0;font-size:17px">${esc(comment?.text || '')}</textarea>
        <div class="poll-editor" ${poll ? '' : 'hidden'}>
          <input class="input" name="question" placeholder="Ask a question (optional)" value="${esc(comment?.poll?.question || '')}" style="margin-bottom:8px" />
          <div class="opts stack" style="gap:8px"></div>
          <button type="button" class="btn ghost small" data-addopt style="margin-top:8px">+ Add option</button>
        </div>
        <div class="attach-preview"></div>
        <div class="composer-tools">
          <button type="button" class="btn ghost small" data-img>${icons.image} Photo</button>
          <button type="button" class="btn ghost small" data-vid>${icons.video} Video</button>
          <button type="button" class="btn ghost small" data-gif style="color:#00e5ff">${icons.gif} GIF</button>
          <button type="button" class="btn ghost small" data-poll>${icons.poll} Poll</button>
          <span class="spacer"></span>
          <span class="dim upload-status" style="font-size:13px"></span>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn outline" data-close>Cancel</button>
        <button class="btn" data-submit>${btnText}</button>
      </div>`,
  });

  const root = m.root;
  const textarea = $('[name=text]', root);
  const preview = $('.attach-preview', root);
  const pollEd = $('.poll-editor', root);
  const opts = $('.opts', pollEd);
  const status = $('.upload-status', root);

  const addOpt = (v = '') => {
    if ($$('input', opts).length >= 10) return;
    opts.appendChild(el(`<input class="input" placeholder="Option ${$$('input', opts).length + 1}" value="${esc(v)}" />`));
  };

  const togglePoll = (on) => {
    poll = on;
    pollEd.hidden = !on;
    if (on && !$$('input', opts).length) {
      addOpt();
      addOpt();
    }
  };

  // Pre-fill existing poll options if any
  if (comment?.poll && Array.isArray(comment.poll.options)) {
    comment.poll.options.forEach((o) => addOpt(o.text || ''));
  } else if (poll) {
    togglePoll(true);
  }

  const drawPreview = () => {
    preview.innerHTML = '';
    attachments.forEach((a, i) => {
      let inner = '';
      if (a.type === 'youtube') {
        const id = a.youtubeId || (/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i.exec(a.url) || [])[1];
        inner = `<img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="YouTube thumbnail" />`;
      } else if (a.type === 'video') {
        inner = `<video src="${esc(a.url)}"></video>`;
      } else {
        const src = resolveMediaSrc(a);
        inner = `<img src="${esc(src)}" alt="${esc(a.title || '')}" />`;
      }
      const item = el(`<div class="item">${inner}<button type="button" aria-label="Remove">✕</button></div>`);
      $('button', item).onclick = () => {
        attachments.splice(i, 1);
        drawPreview();
      };
      preview.appendChild(item);
    });
  };

  drawPreview();

  textarea.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (text && !attachments.length) {
      const trimmed = text.trim();
      const km = /(?:https?:\/\/)?(?:www\.)?klipy\.com\/gifs\/([a-zA-Z0-9_-]+)/i.exec(trimmed);
      if (km) {
        status.textContent = 'Resolving GIF…';
        api(`/klipy/resolve?url=${encodeURIComponent(trimmed)}`)
          .then((res) => {
            if (res && res.url) {
              attachments.push({ type: 'gif', url: res.url, slug: res.slug, title: res.title, originalUrl: trimmed });
              drawPreview();
            }
          })
          .catch(() => {})
          .finally(() => { status.textContent = ''; });
      }
    }
  });

  const attach = async (accept) => {
    const files = await pickFiles({ accept, multiple: true });
    for (const f of files) {
      if (attachments.length >= 10) break;
      status.textContent = `Uploading ${f.name}…`;
      try {
        const r = await uploadFile(f);
        attachments.push({ type: r.type, url: r.url });
        drawPreview();
      } catch (e) {
        toastError(e);
      }
    }
    status.textContent = '';
  };

  $('[data-close]', root).onclick = m.close;
  $('[data-img]', root).onclick = () => attach('image/*');
  $('[data-vid]', root).onclick = () => openVideoPrompt((vidData) => {
    if (vidData.type === 'upload') {
      attach('video/*');
    } else {
      attachments.push(vidData);
      drawPreview();
    }
  });
  $('[data-gif]', root).onclick = () => openKlipyGifPicker((gifUrl, extra) => {
    attachments.push({ type: 'gif', url: gifUrl, ...(extra || {}) });
    drawPreview();
  });
  $('[data-poll]', root).onclick = () => togglePoll(!poll);
  $('[data-addopt]', root).onclick = () => addOpt();

  if (startWith === 'photo') setTimeout(() => attach('image/*'), 60);
  else if (startWith === 'video') setTimeout(() => $('[data-vid]', root)?.click(), 60);
  else if (startWith === 'gif') setTimeout(() => $('[data-gif]', root)?.click(), 60);
  else if (startWith === 'poll') togglePoll(true);

  $('[data-submit]', root).onclick = async (e) => {
    const btn = e.currentTarget;
    const text = textarea.value.trim();
    const body = { text, media: attachments };
    if (poll) {
      const q = $('[name=question]', root).value.trim();
      const o = $$('input', opts).map((i) => i.value.trim()).filter(Boolean);
      if (o.length < 2) {
        toast('A poll needs at least two options.', 'error');
        return;
      }
      body.poll = { question: q, options: o };
    } else {
      body.poll = null;
    }
    if (!text && !attachments.length && !body.poll) {
      toast('Write a comment, attach media, or add a poll first.', 'error');
      return;
    }
    btn.disabled = true;
    try {
      if (isEditing) {
        const { comment: updated } = await api(`/comments/${comment.id}`, { method: 'PATCH', body });
        m.close();
        toast('Comment updated!');
        onSubmitted && onSubmitted(updated);
      } else {
        body.parentId = parentId;
        const targetPostId = post?.id || (comment ? comment.postId : null);
        const { comment: created } = await api(`/posts/${targetPostId}/comments`, { method: 'POST', body });
        m.close();
        toast('Comment published!');
        onSubmitted && onSubmitted(created);
      }
    } catch (err) {
      btn.disabled = false;
      toastError(err);
    }
  };
}

export function editCommentModal(c, onUpdated) {
  openCommentModal({ comment: c, onSubmitted: onUpdated });
}

export function buildCommentComposer({ post, postId, parentId = null, replyingTo = '', onSubmitted, onCancel } = {}) {
  const p = post || { id: postId };
  const node = el(`
    <div class="composer-trigger ${parentId ? 'reply' : ''}" style="margin-top:14px;cursor:pointer">
      ${state.user ? avatar(state.user, 'sm') : ''}
      <span class="fake" style="font-size:14px;color:var(--dim)">${replyingTo ? `Reply to ${esc(replyingTo)}…` : 'Write a comment…'}</span>
      <span class="tools">
        <button type="button" class="icon-btn" data-k="photo" aria-label="Add photo">${icons.image}</button>
        <button type="button" class="icon-btn" data-k="video" aria-label="Add video">${icons.video}</button>
        <button type="button" class="icon-btn" data-k="gif" aria-label="Add GIF" style="color:#00e5ff">${icons.gif}</button>
        <button type="button" class="icon-btn" data-k="poll" aria-label="Create poll">${icons.poll}</button>
      </span>
    </div>
  `);

  node.onclick = (e) => {
    if (!requireAuth()) return;
    const k = e.target.closest('[data-k]');
    openCommentModal({
      post: p,
      parentId,
      replyingTo,
      startWith: k ? k.dataset.k : '',
      onSubmitted,
    });
  };

  return node;
}

/**
 * Renders a post card element.
 * opts: { feed: bool (show "posted in" + suggested bar), boxed, showPinnedLabel, expanded, onDeleted, onChanged }
 */
export function postCard(post, opts = {}) {
  let p = post;
  let commentsOpen = !!opts.expanded;
  const card = el(`<article class="post-card ${opts.boxed ? 'boxed' : ''}"></article>`);

  const render = () => {
    if (p.deleted) {
      card.innerHTML = `
        <div class="deleted-post-placeholder" style="padding:14px 18px;background:var(--navy);border:1px dashed var(--line);border-radius:6px;color:var(--dim);font-size:14px;font-style:italic;display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <span style="opacity:0.6;display:flex">${icons.info}</span>
          <span>${esc(p.deletedText || 'This post was deleted by the author.')}</span>
        </div>
        <div class="post-actions" style="margin-top:6px;margin-bottom:10px">
          <button type="button" class="comments-btn" data-toggle-comments aria-label="${p.commentCount} Comments">${icons.comment} ${p.commentCount} Comment${p.commentCount === 1 ? '' : 's'}</button>
        </div>
        <div class="comment-section" ${commentsOpen ? '' : 'hidden'}>
          <div class="comment-list"></div>
          <div class="comment-composer-container"></div>
        </div>`;
      const tbtn = $('[data-toggle-comments]', card);
      if (tbtn) {
        tbtn.onclick = () => {
          commentsOpen = !commentsOpen;
          const sec = $('.comment-section', card);
          if (sec) sec.hidden = !commentsOpen;
          if (commentsOpen) loadComments();
        };
      }
      if (commentsOpen) loadComments();
      const compContainer = $('.comment-composer-container', card);
      if (compContainer) {
        compContainer.innerHTML = '';
        compContainer.appendChild(
          buildCommentComposer({
            postId: p.isComment ? p.postId : p.id,
            parentId: p.isComment ? p.id : null,
            onSubmitted: () => {
              p.commentCount++;
              loadComments();
            },
          })
        );
      }
      return;
    }

    const suggested = opts.feed && p.group && !p.group.isMember;
    card.innerHTML = `
      ${suggested ? `<div class="suggested-bar">${icons.info}<span>This post is from a suggested group</span><span class="spacer"></span>
        <button class="btn small" data-join style="min-width:100px">Join</button></div>` : ''}
      ${p.isComment ? `
        <div class="feed-reply-header" style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dim);margin-bottom:12px;padding-bottom:10px;border-bottom:1px dashed var(--line)">
          <span style="color:var(--blue-hover);display:flex;align-items:center">${icons.comment}</span>
          <span>Replied to <a href="${profileUrl(p.replyToAuthor || p.parentPost?.author || p.author)}" style="color:var(--blue-hover);font-weight:600">@${esc((p.replyToAuthor || p.parentPost?.author)?.username || 'author')}</a>${p.parentPost ? ` · on <a href="${parentPostUrl(p)}" style="color:var(--text);font-weight:500">${esc(p.parentPost.snippet ? `"${p.parentPost.snippet}…"` : 'post')}</a>` : ''}</span>
        </div>` : ''}
      ${opts.showPinnedLabel && p.pinned ? `<div class="pinned-label ${p.isComment ? 'comment-pinned' : ''}">${icons.pin} Pinned ${p.isComment ? 'Comment' : 'Post'}</div>` : ''}
      <div class="post-head">
        <a href="${profileUrl(p.author)}">${avatar(p.author)}</a>
        <div class="who">
          <a class="author" href="${profileUrl(p.author)}">${esc(p.author.displayName)}${p.authorIsAdmin ? icons.admin : ''}</a>
          <div class="sub"><a href="${postUrl(p)}" style="font-weight:500">${fmtDate(p.createdAt)}</a>${p.editedAt ? ' · Edited' : ''}
          ${opts.feed && p.group ? ` · posted in <a href="/group/${esc(p.group.slug)}">${esc(p.group.name)}</a>` : ''}</div>
        </div>
        <button class="icon-btn" data-share aria-label="Share">${icons.share}</button>
        ${p.canEdit || p.canDelete || p.canPin || p.canPinAsPost ? `<span><button class="icon-btn" data-more aria-label="More actions">${icons.more}</button></span>` : ''}
      </div>
      ${p.text ? `<div class="post-body">${richText(p.text)}</div>` : '<div style="height:14px"></div>'}
      ${pollHtml(p.poll)}
      ${mediaHtml(p.media)}
      <div class="post-actions">
        ${reactionsHtml(p.reactions)}
        <button type="button" class="comments-btn" data-toggle-comments aria-label="${p.commentCount} ${p.isComment ? 'Replies' : 'Comments'}">${icons.comment} ${p.commentCount} ${p.commentCount === 1 ? (p.isComment ? 'Reply' : 'Comment') : (p.isComment ? 'Replies' : 'Comments')}</button>
      </div>
      <div class="comment-section" ${commentsOpen ? '' : 'hidden'}>
        <div class="comment-list"></div>
        <div class="comment-composer-container"></div>
      </div>`;
    bind();
    if (commentsOpen) loadComments();
    const compContainer = $('.comment-composer-container', card);
    if (compContainer) {
      compContainer.innerHTML = '';
      compContainer.appendChild(
        buildCommentComposer({
          postId: p.isComment ? p.postId : p.id,
          parentId: p.isComment ? p.id : null,
          replyingTo: p.isComment ? p.author?.displayName : null,
          onSubmitted: () => {
            p.commentCount++;
            commentsOpen = true;
            const sec = $('.comment-section', card);
            if (sec) sec.hidden = false;
            loadComments();
          },
        })
      );
    }
  };

  const update = (np) => {
    p = np;
    render();
    opts.onChanged && opts.onChanged(p);
  };

  const react = async (emoji) => {
    if (!requireAuth()) return;
    try {
      update((await api(`/posts/${p.id}/react`, { method: 'POST', body: { emoji } })).post);
    } catch (e) {
      toastError(e);
    }
  };

  async function loadComments() {
    const list = $('.comment-list', card);
    if (!list) return;
    list.innerHTML = '<div class="dim" style="font-size:13px;padding:6px 0">Loading comments…</div>';
    try {
      const { comments, totalCount } = await api(`/posts/${p.id}/comments`);
      list.innerHTML = '';
      if (!comments.length) {
        list.innerHTML = '<div class="dim" style="font-size:13px;padding:6px 0">No comments yet. Start the conversation!</div>';
      } else {
        comments.forEach((c) => list.appendChild(threadNode(c)));
      }
      if (totalCount !== undefined) {
        p.commentCount = totalCount;
        const btn = $('[data-toggle-comments]', card);
        if (btn) btn.innerHTML = `${icons.comment} ${p.commentCount} ${p.commentCount === 1 ? (p.isComment ? 'Reply' : 'Comment') : (p.isComment ? 'Replies' : 'Comments')}`;
      }
    } catch (e) {
      list.innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
    }
  }

  function threadNode(parentComment) {
    const wrap = el(`<div class="comment-thread"></div>`);
    wrap.appendChild(commentItemNode(parentComment, false));

    const replies = parentComment.replies || [];
    if (replies.length) {
      const repliesWrap = el(`<div class="comment-replies"></div>`);
      replies.forEach((r) => repliesWrap.appendChild(commentItemNode(r, true)));
      wrap.appendChild(repliesWrap);
    }
    return wrap;
  }

  function commentItemNode(c, isReply = false) {
    const node = el(`<div class="comment ${isReply ? 'comment-reply-item' : ''}"></div>`);
    const draw = () => {
      if (c.deleted) {
        node.innerHTML = `
          <div class="comment-card deleted-comment" style="padding:10px 14px;background:var(--navy);border:1px dashed var(--line);border-radius:6px;color:var(--dim);font-size:13px;font-style:italic;margin-bottom:6px">
            ${esc(c.deletedText || 'This comment was deleted by the author.')}
          </div>`;
        return;
      }
      node.innerHTML = `
        <div class="comment-card">
          ${c.pinned ? `<div class="pinned-label comment-pinned">${icons.pin} Pinned Comment</div>` : ''}
          <div class="post-head">
            <a href="${profileUrl(c.author)}">${avatar(c.author, isReply ? 'sm' : '')}</a>
            <div class="who">
              <a class="author" href="${profileUrl(c.author)}">${esc(c.author.displayName)}${c.author?.role === 'owner' ? icons.admin : ''}</a>
              <div class="sub"><a href="${postUrl(p)}#comment-${c.id}">${fmtDate(c.createdAt)}</a>${c.editedAt ? ' · Edited' : ''}</div>
            </div>
            <button class="icon-btn" data-share aria-label="Share">${icons.share}</button>
            ${c.canEdit || c.canDelete || c.canPin || c.canPinAsPost ? `<span><button class="icon-btn" data-more aria-label="More actions">${icons.more}</button></span>` : ''}
          </div>
          ${c.text ? `<div class="post-body">${richText(c.text)}</div>` : ''}
          ${pollHtml(c.poll)}
          ${c.media && c.media.length ? mediaHtml(c.media) : ''}
          <div class="post-actions">
            ${reactionsHtml(c.reactions)}
            <button type="button" class="comments-btn" data-reply aria-label="Reply">${icons.comment} Reply</button>
          </div>
        </div>`;

      const shareBtn = $('[data-share]', node);
      if (shareBtn) shareBtn.onclick = () => copyLink(`${postUrl(p)}#comment-${c.id}`);

      const reactC = async (emoji) => {
        if (!requireAuth()) return;
        try {
          c = (await api(`/comments/${c.id}/react`, { method: 'POST', body: { emoji } })).comment;
          draw();
        } catch (e) {
          toastError(e);
        }
      };

      $$('[data-react]', node).forEach((b) => (b.onclick = () => reactC(b.dataset.react)));
      const pBtn = $('[data-picker]', node);
      if (pBtn) {
        pBtn.onclick = (e) => {
          if (requireAuth()) openPicker(e.currentTarget, reactC);
        };
      }

      $$('[data-zoom]', node).forEach((img) => (img.onclick = () => lightbox(img.dataset.zoom)));

      $$('[data-vote]', node).forEach((b) => {
        b.onclick = async () => {
          if (!requireAuth()) return;
          try {
            const res = await api(`/comments/${c.id}/vote`, {
              method: 'POST',
              body: { optionId: b.dataset.vote },
            });
            c = res.comment;
            draw();
          } catch (e) {
            toastError(e);
          }
        };
      });

      const more = $('[data-more]', node);
      if (more) {
        more.onclick = () => {
          const items = [];
          if (c.canPin) {
            items.push({
              label: c.pinned ? 'Unpin comment' : 'Pin to top',
              onClick: async () => {
                try {
                  const res = await api(`/comments/${c.id}/pin`, { method: 'POST' });
                  toast(res.pinned ? 'Comment pinned to top' : 'Comment unpinned');
                  p.pinnedCommentId = res.pinned ? c.id : null;
                  loadComments();
                } catch (e) {
                  toastError(e);
                }
              },
            });
          }
          if (c.canPinAsPost) {
            items.push({
              label: 'Pin as post in group',
              onClick: async () => {
                try {
                  await api(`/comments/${c.id}/pin-as-post`, { method: 'POST' });
                  toast('Pinned as group post!');
                  opts.onPinned && opts.onPinned();
                } catch (e) {
                  toastError(e);
                }
              },
            });
          }
          if (c.canEdit) {
            items.push({
              label: 'Edit comment',
              onClick: () =>
                openCommentModal({
                  post: p,
                  comment: c,
                  onSubmitted: (updated) => {
                    c = updated;
                    draw();
                  },
                }),
            });
          }
          if (c.canDelete) {
            items.push({
              label: 'Delete comment',
              danger: true,
              onClick: async () => {
                if (!(await confirmDialog('Delete this comment? This cannot be undone.'))) return;
                try {
                  const res = await api(`/comments/${c.id}`, { method: 'DELETE' });
                  toast('Comment deleted');
                  if (res.deleted && res.comment) {
                    c = res.comment;
                    draw();
                  } else {
                    p.commentCount--;
                    loadComments();
                  }
                } catch (e) {
                  toastError(e);
                }
              },
            });
          }
          popupMenu(more, items);
        };
      }

      $('[data-reply]', node).onclick = () => {
        if (!requireAuth()) return;
        const targetParentId = c.parentId || c.id;
        openCommentModal({
          post: p,
          parentId: targetParentId,
          replyingTo: c.author.displayName,
          onSubmitted: () => {
            p.commentCount++;
            loadComments();
          },
        });
      };
    };

    draw();
    return node;
  }

  function bind() {
    $$('[data-react]', card).forEach((b) => (b.onclick = () => react(b.dataset.react)));
    $('[data-picker]', card).onclick = (e) => {
      if (requireAuth()) openPicker(e.currentTarget, react);
    };
    $('[data-share]', card).onclick = () => copyLink(postUrl(p));
    $('[data-toggle-comments]', card).onclick = () => {
      commentsOpen = !commentsOpen;
      const sec = $('.comment-section', card);
      if (sec) sec.hidden = !commentsOpen;
      if (commentsOpen) loadComments();
    };
    $$('[data-zoom]', card).forEach((img) => (img.onclick = () => lightbox(img.dataset.zoom)));
    $$('[data-vote]', card).forEach(
      (b) =>
        (b.onclick = async () => {
          if (!requireAuth()) return;
          try {
            update((await api(`/posts/${p.id}/vote`, { method: 'POST', body: { optionId: b.dataset.vote } })).post);
          } catch (e) {
            toastError(e);
          }
        })
    );
    const join = $('[data-join]', card);
    if (join)
      join.onclick = async () => {
        if (!requireAuth()) return;
        try {
          const { group } = await api(`/groups/${p.group.slug}/join`, { method: 'POST' });
          toast(group.isMember ? `You joined ${group.name}` : 'Request sent');
          p.group.isMember = group.isMember;
          render();
          opts.onJoined && opts.onJoined(group);
        } catch (e) {
          toastError(e);
        }
      };
    const more = $('[data-more]', card);
    if (more)
      more.onclick = () => {
        const items = [];
        if (p.canPin)
          items.push({
            label: p.pinned ? (p.isComment ? 'Unpin comment' : 'Unpin post') : 'Pin to top',
            onClick: async () => {
              try {
                update((await api(`/posts/${p.id}/pin`, { method: 'POST' })).post);
                toast(p.pinned ? `${p.isComment ? 'Comment' : 'Post'} pinned` : `${p.isComment ? 'Comment' : 'Post'} unpinned`);
                opts.onPinned && opts.onPinned();
              } catch (e) {
                toastError(e);
              }
            },
          });
        if (p.canPinAsPost && p.isComment)
          items.push({
            label: 'Pin as post in group',
            onClick: async () => {
              try {
                await api(`/comments/${p.id}/pin-as-post`, { method: 'POST' });
                toast('Pinned as group post!');
                opts.onPinned && opts.onPinned();
              } catch (e) {
                toastError(e);
              }
            },
          });
        if (p.canEdit)
          items.push({
            label: p.isComment ? 'Edit comment' : 'Edit post',
            onClick: () => {
              if (p.isComment) {
                openCommentModal({
                  post: { id: p.postId, group: p.group },
                  comment: p,
                  onSubmitted: (updated) => update({ ...p, ...updated }),
                });
              } else {
                editPost(p, update);
              }
            },
          });
        if (p.canDelete)
          items.push({
            label: p.isComment ? 'Delete comment' : 'Delete post',
            danger: true,
            onClick: async () => {
              if (!(await confirmDialog(`Delete this ${p.isComment ? 'comment' : 'post'}? This cannot be undone.`))) return;
              try {
                const res = await api(`/posts/${p.id}`, { method: 'DELETE' });
                toast(`${p.isComment ? 'Comment' : 'Post'} deleted`);
                if (res.deleted && res.post) {
                  update(res.post);
                } else {
                  card.remove();
                  opts.onDeleted && opts.onDeleted(p);
                }
              } catch (e) {
                toastError(e);
              }
            },
          });
        popupMenu(more, items);
      };
  }

  render();
  return card;
}

export function openVideoPrompt(onAddVideo) {
  const m = modal({
    title: 'Add Video',
    body: `
      <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">YouTube Link or Shorts</label>
          <div style="display:flex;gap:8px">
            <input class="input" id="yt-url-input" placeholder="https://www.youtube.com/watch?v=... or youtu.be/..." style="flex:1" />
            <button class="btn small" id="yt-add-btn" style="background:#ff3333;color:#fff">${icons.youtube} Add</button>
          </div>
          <div class="form-error" id="yt-error" style="font-size:12px;color:var(--danger, #ff4444);margin-top:4px"></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin:2px 0">
          <div style="flex:1;height:1px;background:var(--line)"></div>
          <span class="dim" style="font-size:12px;text-transform:uppercase">OR</span>
          <div style="flex:1;height:1px;background:var(--line)"></div>
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">Upload Video File</label>
          <button type="button" class="btn outline small" id="upload-vid-btn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px">
            ${icons.video} Upload video from your device (MP4, WebM, etc.)
          </button>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn outline" data-close>Cancel</button>
      </div>`
  });
  $('[data-close]', m.root).onclick = m.close;
  const input = $('#yt-url-input', m.root);
  const err = $('#yt-error', m.root);
  $('#yt-add-btn', m.root).onclick = () => {
    const val = input.value.trim();
    const id = (/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i.exec(val) || [])[1];
    if (!id) {
      err.textContent = 'Please enter a valid YouTube URL.';
      return;
    }
    onAddVideo({ type: 'youtube', url: val, youtubeId: id });
    m.close();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#yt-add-btn', m.root).click();
    }
  };
  $('#upload-vid-btn', m.root).onclick = () => {
    m.close();
    onAddVideo({ type: 'upload' });
  };
}

const CURATED_GIFS = [
  {
    title: 'Steve Minecraft Steve',
    slug: 'steve-minecraft-steve-2',
    url: 'https://static.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/37/ce/U1VVU1T8AVwmm2pj.gif',
    preview: 'https://static.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/37/ce/1eru8gHOKqn99RFTrvJE.gif',
  },
  {
    title: 'Dancing Celebration',
    slug: 'dancing-celebration',
    url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
    preview: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
  },
  {
    title: 'Thumbs Up',
    slug: 'thumbs-up',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    preview: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  },
  {
    title: 'Working Cat',
    slug: 'working-cat',
    url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    preview: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
  },
  {
    title: 'Mind Blown',
    slug: 'mind-blown',
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    preview: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
  },
  {
    title: 'Popcorn Time',
    slug: 'popcorn-time',
    url: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif',
    preview: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif',
  },
];

export function openKlipyGifPicker(onSelect) {
  const m = modal({
    title: 'Search GIFs (Powered by KLIPY)',
    wide: true,
    body: `
      <div class="modal-body" style="padding-bottom:12px">
        <div class="row" style="gap:10px">
          <input class="input" id="klipy-search" placeholder="Search animated GIFs or paste KLIPY link..." autocomplete="off" />
        </div>
        <div class="klipy-grid" id="klipy-results" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;max-height:360px;overflow-y:auto;margin-top:12px;padding:4px">
        </div>
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center">
          <span style="font-size:13px;color:var(--muted)">Or paste GIF link:</span>
          <input class="input" id="custom-gif-url" placeholder="https://klipy.com/gifs/steve-minecraft-steve-2 or direct .gif link" style="flex:1" />
          <button class="btn small outline" id="custom-gif-add">Insert</button>
        </div>
      </div>`
  });
  const resultsEl = $('#klipy-results', m.root);
  const searchInput = $('#klipy-search', m.root);
  const customInput = $('#custom-gif-url', m.root);
  const customAdd = $('#custom-gif-add', m.root);

  const renderList = (items) => {
    resultsEl.innerHTML = '';
    if (!items || !items.length) {
      resultsEl.innerHTML = '<div class="dim center" style="padding:40px 0;grid-column:1/-1">No GIFs found. Paste any KLIPY or GIF link in the box below!</div>';
      return;
    }
    items.forEach((item) => {
      const url = item.url;
      const previewUrl = item.preview || item.url;
      const card = el(`
        <div style="cursor:pointer;position:relative;border-radius:6px;overflow:hidden;background:#111;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center" title="${esc(item.title || '')}">
          <img src="${esc(previewUrl)}" alt="${esc(item.title || '')}" loading="lazy" style="width:100%;height:100%;object-fit:cover" />
          <div style="position:absolute;bottom:0;left:0;right:0;padding:2px 4px;background:rgba(0,0,0,0.65);font-size:11px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.title || '')}</div>
        </div>
      `);
      card.onclick = () => {
        onSelect(url, item);
        m.close();
      };
      resultsEl.appendChild(card);
    });
  };

  // Initially show curated popular GIFs, then load live trending GIFs from KLIPY
  renderList(CURATED_GIFS);
  api('/klipy/trending')
    .then((res) => {
      if (res && res.gifs && res.gifs.length && !searchInput.value) {
        renderList(res.gifs);
      }
    })
    .catch(() => {});

  const handleInsert = async () => {
    const u = customInput.value.trim();
    if (!u) return;
    customAdd.disabled = true;
    customAdd.textContent = 'Inserting…';
    try {
      const res = await api(`/klipy/resolve?url=${encodeURIComponent(u)}`);
      if (res && res.url) {
        onSelect(res.url, { slug: res.slug, title: res.title, originalUrl: u });
        m.close();
        return;
      }
    } catch {
      // Fallback: direct selection
    }
    onSelect(u, { originalUrl: u });
    m.close();
  };

  customAdd.onclick = handleInsert;
  customInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInsert();
    }
  };

  let t;
  const searchGifs = async (query) => {
    if (!query) {
      api('/klipy/trending')
        .then((res) => {
          if (res && res.gifs && res.gifs.length && !searchInput.value) {
            renderList(res.gifs);
          } else {
            renderList(CURATED_GIFS);
          }
        })
        .catch(() => renderList(CURATED_GIFS));
      return;
    }

    // Check if user pasted a KLIPY link directly into the search bar
    const km = /(?:https?:\/\/)?(?:www\.)?klipy\.com\/gifs\/([a-zA-Z0-9_-]+)/i.exec(query);
    if (km) {
      resultsEl.innerHTML = '<div class="dim center" style="padding:40px 0;grid-column:1/-1">Resolving KLIPY GIF…</div>';
      try {
        const res = await api(`/klipy/resolve?url=${encodeURIComponent(query)}`);
        if (res && res.url) {
          renderList([res]);
          return;
        }
      } catch {}
    }

    resultsEl.innerHTML = '<div class="dim center" style="padding:40px 0;grid-column:1/-1">Searching KLIPY…</div>';
    try {
      const res = await api(`/klipy/search?q=${encodeURIComponent(query)}`);
      if (res && res.gifs && res.gifs.length) {
        renderList(res.gifs);
        return;
      }
    } catch {}

    // Fallback: check curated list
    const filtered = CURATED_GIFS.filter((g) => g.title.toLowerCase().includes(query) || (g.slug && g.slug.includes(query)));
    if (filtered.length) {
      renderList(filtered);
      return;
    }

    resultsEl.innerHTML = `
      <div class="dim center" style="padding:30px 0;grid-column:1/-1">
        No matches found for "${esc(query)}". Paste any KLIPY link (like https://klipy.com/gifs/steve-minecraft-steve-2) in the box below!
      </div>`;
  };

  searchInput.oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => searchGifs(e.target.value.trim().toLowerCase()), 250);
  };
  setTimeout(() => searchInput.focus(), 50);
}

function editPost(p, update) {
  if (!requireAuth()) return;
  const attachments = Array.isArray(p.media) ? p.media.map((m) => ({ ...m })) : [];
  let poll = !!p.poll;
  const groupName = p.group?.name || 'group';
  const m = modal({
    title: 'Edit Post',
    wide: true,
    body: `
      <div class="modal-body">
        <div class="row">${state.user ? avatar(state.user, 'sm') : ''}<div><b>${esc(state.user?.displayName || 'You')}</b><div class="dim" style="font-size:13px">Editing post in ${esc(groupName)}</div></div></div>
        <textarea class="textarea" name="text" placeholder="Share something with the group..." style="min-height:140px;border:0;padding:4px 0;font-size:17px">${esc(p.text || '')}</textarea>
        <div class="poll-editor" ${poll ? '' : 'hidden'}>
          <input class="input" name="question" placeholder="Ask a question (optional)" value="${esc(p.poll?.question || '')}" style="margin-bottom:8px" />
          <div class="opts stack" style="gap:8px"></div>
          <button type="button" class="btn ghost small" data-addopt style="margin-top:8px">+ Add option</button>
        </div>
        <div class="attach-preview"></div>
        <div class="composer-tools">
          <button type="button" class="btn ghost small" data-img>${icons.image} Photo</button>
          <button type="button" class="btn ghost small" data-vid>${icons.video} Video</button>
          <button type="button" class="btn ghost small" data-gif style="color:#00e5ff">${icons.gif} GIF</button>
          <button type="button" class="btn ghost small" data-poll>${icons.poll} Poll</button>
          <span class="spacer"></span>
          <span class="dim upload-status" style="font-size:13px"></span>
        </div>
      </div>
      <div class="modal-foot"><button class="btn outline" data-close>Cancel</button><button class="btn" data-save>Save</button></div>`,
  });

  const root = m.root;
  const preview = $('.attach-preview', root);
  const pollEd = $('.poll-editor', root);
  const opts = $('.opts', pollEd);
  const status = $('.upload-status', root);

  const addOpt = (v = '') => {
    if ($$('input', opts).length >= 10) return;
    opts.appendChild(el(`<input class="input" placeholder="Option ${$$('input', opts).length + 1}" value="${esc(v)}" />`));
  };

  const togglePoll = (on) => {
    poll = on;
    pollEd.hidden = !on;
    if (on && !$$('input', opts).length) {
      addOpt();
      addOpt();
    }
  };

  // Pre-fill existing poll options if any
  if (p.poll && Array.isArray(p.poll.options)) {
    p.poll.options.forEach((o) => addOpt(o.text || ''));
  }

  const drawPreview = () => {
    preview.innerHTML = '';
    attachments.forEach((a, i) => {
      let inner = '';
      if (a.type === 'youtube') {
        const id = a.youtubeId || (/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i.exec(a.url) || [])[1];
        inner = `<img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="YouTube thumbnail" />`;
      } else if (a.type === 'video') {
        inner = `<video src="${esc(a.url)}"></video>`;
      } else {
        const src = resolveMediaSrc(a);
        inner = `<img src="${esc(src)}" alt="${esc(a.title || '')}" />`;
      }
      const item = el(`<div class="item">${inner}<button type="button" aria-label="Remove">✕</button></div>`);
      $('button', item).onclick = () => {
        attachments.splice(i, 1);
        drawPreview();
      };
      preview.appendChild(item);
    });
  };

  drawPreview();

  const textarea = $('[name=text]', root);
  textarea.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (text && !attachments.length) {
      const trimmed = text.trim();
      const km = /(?:https?:\/\/)?(?:www\.)?klipy\.com\/gifs\/([a-zA-Z0-9_-]+)/i.exec(trimmed);
      if (km) {
        status.textContent = 'Resolving GIF…';
        api(`/klipy/resolve?url=${encodeURIComponent(trimmed)}`)
          .then((res) => {
            if (res && res.url) {
              attachments.push({ type: 'gif', url: res.url, slug: res.slug, title: res.title, originalUrl: trimmed });
              drawPreview();
            }
          })
          .catch(() => {})
          .finally(() => { status.textContent = ''; });
      }
    }
  });

  const attach = async (accept) => {
    const files = await pickFiles({ accept, multiple: true });
    for (const f of files) {
      if (attachments.length >= 10) break;
      status.textContent = `Uploading ${f.name}…`;
      try {
        const r = await uploadFile(f);
        attachments.push({ type: r.type, url: r.url });
        drawPreview();
      } catch (e) {
        toastError(e);
      }
    }
    status.textContent = '';
  };

  $('[data-close]', root).onclick = m.close;
  $('[data-img]', root).onclick = () => attach('image/*');
  $('[data-vid]', root).onclick = () => openVideoPrompt((vidData) => {
    if (vidData.type === 'upload') {
      attach('video/*');
    } else {
      attachments.push(vidData);
      drawPreview();
    }
  });
  $('[data-gif]', root).onclick = () => openKlipyGifPicker((gifUrl, extra) => {
    attachments.push({ type: 'gif', url: gifUrl, ...(extra || {}) });
    drawPreview();
  });
  $('[data-poll]', root).onclick = () => togglePoll(!poll);
  $('[data-addopt]', root).onclick = () => addOpt();

  $('[data-save]', root).onclick = async (e) => {
    const btn = e.currentTarget;
    const body = { text: textarea.value, media: attachments };
    if (poll) {
      body.poll = { question: $('[name=question]', root).value, options: $$('input', opts).map((i) => i.value).filter(Boolean) };
    } else {
      body.poll = null;
    }
    btn.disabled = true;
    try {
      const { post } = await api(`/posts/${p.id}`, { method: 'PATCH', body });
      m.close();
      toast('Post updated!');
      update(post);
    } catch (err) {
      btn.disabled = false;
      toastError(err);
    }
  };
}

// ---------------------------------------------------------------- composer
export async function openComposer(initialGroup, { onPosted, startWith } = {}) {
  if (!requireAuth()) return;

  // Load groups available for the user to post in
  let availableGroups = [];
  try {
    const { groups } = await api('/groups');
    availableGroups = groups.filter((g) => g.isMember || g.privacy === 'public' || (state.user && state.user.role === 'owner'));
    if (!availableGroups.length) availableGroups = groups;
  } catch {}

  let selectedGroup = initialGroup || availableGroups.find((g) => g.isMember) || availableGroups[0] || { slug: 'z3-central', name: 'Z3 Central' };
  if (initialGroup) {
    const found = availableGroups.find((g) => g.slug === initialGroup.slug);
    if (found) {
      selectedGroup = found;
    } else {
      availableGroups.unshift(initialGroup);
      selectedGroup = initialGroup;
    }
  }

  const attachments = [];
  let poll = startWith === 'poll';
  const m = modal({
    title: `Create a post`,
    wide: true,
    body: `
      <div class="modal-body">
        <div class="row" style="gap:12px;align-items:center">
          ${avatar(state.user, 'sm')}
          <div style="flex:1">
            <b>${esc(state.user.displayName)}</b>
            <div style="display:flex;align-items:center;gap:6px;margin-top:2px;font-size:13px">
              <span class="dim">Posting in:</span>
              <select class="select" id="composer-group-select" style="padding:2px 8px;font-size:13px;border-radius:6px;background:var(--navy-light, #1e293b);color:var(--text);border:1px solid var(--line);cursor:pointer">
                ${availableGroups.map((g) => `<option value="${g.slug}" ${g.slug === selectedGroup.slug ? 'selected' : ''}>${esc(g.name)}${g.privacy === 'hidden' ? ' (Hidden)' : g.privacy === 'private' ? ' (Private)' : ''}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <textarea class="textarea" name="text" placeholder="Share something with the group..." style="min-height:140px;border:0;padding:4px 0;font-size:17px"></textarea>
        <div class="poll-editor" hidden>
          <input class="input" name="question" placeholder="Ask a question (optional)" style="margin-bottom:8px" />
          <div class="opts stack" style="gap:8px"></div>
          <button type="button" class="btn ghost small" data-addopt style="margin-top:8px">+ Add option</button>
        </div>
        <div class="attach-preview"></div>
        <div class="composer-tools">
          <button type="button" class="btn ghost small" data-img>${icons.image} Photo</button>
          <button type="button" class="btn ghost small" data-vid>${icons.video} Video</button>
          <button type="button" class="btn ghost small" data-gif style="color:#00e5ff">${icons.gif} GIF</button>
          <button type="button" class="btn ghost small" data-poll>${icons.poll} Poll</button>
          <span class="spacer"></span>
          <span class="dim upload-status" style="font-size:13px"></span>
        </div>
      </div>
      <div class="modal-foot"><button class="btn outline" data-close>Cancel</button><button class="btn" data-publish>Publish</button></div>`,
  });

  const root = m.root;
  const groupSelect = $('#composer-group-select', root);
  if (groupSelect) {
    groupSelect.onchange = () => {
      const g = availableGroups.find((x) => x.slug === groupSelect.value);
      if (g) selectedGroup = g;
    };
  }

  const preview = $('.attach-preview', root);
  const pollEd = $('.poll-editor', root);
  const opts = $('.opts', pollEd);
  const status = $('.upload-status', root);

  const addOpt = (v = '') => {
    if ($$('input', opts).length >= 10) return;
    opts.appendChild(el(`<input class="input" placeholder="Option ${$$('input', opts).length + 1}" value="${esc(v)}" />`));
  };
  const togglePoll = (on) => {
    poll = on;
    pollEd.hidden = !on;
    if (on && !$$('input', opts).length) {
      addOpt();
      addOpt();
    }
  };
  togglePoll(poll);

  const drawPreview = () => {
    preview.innerHTML = '';
    attachments.forEach((a, i) => {
      let inner = '';
      if (a.type === 'youtube') {
        const id = a.youtubeId || (/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i.exec(a.url) || [])[1];
        inner = `<img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="YouTube thumbnail" />`;
      } else if (a.type === 'video') {
        inner = `<video src="${esc(a.url)}"></video>`;
      } else {
        const src = resolveMediaSrc(a);
        inner = `<img src="${esc(src)}" alt="${esc(a.title || '')}" />`;
      }
      const item = el(`<div class="item">${inner}<button type="button" aria-label="Remove">✕</button></div>`);
      $('button', item).onclick = () => {
        attachments.splice(i, 1);
        drawPreview();
      };
      preview.appendChild(item);
    });
  };

  const textarea = $('[name=text]', root);
  textarea.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (text && !attachments.length) {
      const trimmed = text.trim();
      const km = /(?:https?:\/\/)?(?:www\.)?klipy\.com\/gifs\/([a-zA-Z0-9_-]+)/i.exec(trimmed);
      if (km) {
        status.textContent = 'Resolving GIF…';
        api(`/klipy/resolve?url=${encodeURIComponent(trimmed)}`)
          .then((res) => {
            if (res && res.url) {
              attachments.push({ type: 'gif', url: res.url, slug: res.slug, title: res.title, originalUrl: trimmed });
              drawPreview();
            }
          })
          .catch(() => {})
          .finally(() => { status.textContent = ''; });
      }
    }
  });

  const attach = async (accept) => {
    const files = await pickFiles({ accept, multiple: true });
    for (const f of files) {
      if (attachments.length >= 10) break;
      status.textContent = `Uploading ${f.name}…`;
      try {
        const r = await uploadFile(f);
        attachments.push({ type: r.type, url: r.url });
        drawPreview();
      } catch (e) {
        toastError(e);
      }
    }
    status.textContent = '';
  };

  $('[data-close]', root).onclick = m.close;
  $('[data-img]', root).onclick = () => attach('image/*');
  $('[data-vid]', root).onclick = () => openVideoPrompt((vidData) => {
    if (vidData.type === 'upload') {
      attach('video/*');
    } else {
      attachments.push(vidData);
      drawPreview();
    }
  });
  $('[data-gif]', root).onclick = () => openKlipyGifPicker((gifUrl, extra) => {
    attachments.push({ type: 'gif', url: gifUrl, ...(extra || {}) });
    drawPreview();
  });
  $('[data-poll]', root).onclick = () => togglePoll(!poll);
  $('[data-addopt]', root).onclick = () => addOpt();

  if (startWith === 'photo') {
    setTimeout(() => attach('image/*'), 100);
  } else if (startWith === 'video') {
    setTimeout(() => $('[data-vid]', root).click(), 100);
  } else if (startWith === 'gif') {
    setTimeout(() => $('[data-gif]', root).click(), 100);
  }

  $('[data-publish]', root).onclick = async (e) => {
    const btn = e.currentTarget;
    const body = { text: $('[name=text]', root).value, media: attachments };
    if (poll) body.poll = { question: $('[name=question]', root).value, options: $$('input', opts).map((i) => i.value).filter(Boolean) };
    btn.disabled = true;
    try {
      const { post } = await api(`/groups/${selectedGroup.slug}/posts`, { method: 'POST', body });
      m.close();
      toast('Your post is live!');
      onPosted && onPosted(post);
    } catch (err) {
      toastError(err);
      btn.disabled = false;
    }
  };
}

// ---------------------------------------------------------------- group create / edit
export function openGroupEditor(group, { onSaved } = {}) {
  if (!requireAuth()) return;
  const editing = !!group;
  const g = group || { name: '', description: '', cover: '', privacy: 'public', visible: true, hasFiles: false };
  let cover = g.cover;
  const m = modal({
    title: editing ? 'Group Settings' : 'Create a Group',
    wide: true,
    body: `
      <form class="modal-body" novalidate>
        <div class="field"><label>Cover image</label>
          <div class="cover-prev" style="height:140px;border-radius:6px;background:#0b1220 center/cover no-repeat;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px dashed var(--line-strong)">
            <span class="btn outline small">${icons.upload} Upload cover</span></div></div>
        <div class="field"><label>Group name</label><input class="input" name="name" maxlength="80" value="${esc(g.name)}" required /></div>
        <div class="field"><label>Category</label><input class="input" name="category" maxlength="50" placeholder="e.g. General, Music, Gaming, Tech..." value="${esc(g.category || 'General')}" /></div>
        <div class="field"><label>About</label><textarea class="textarea" name="description" maxlength="2000">${esc(g.description)}</textarea></div>
        <div class="field"><label>Privacy</label><select class="select" name="privacy">
          <option value="public" ${g.privacy === 'public' ? 'selected' : ''}>Public – anyone can view and join</option>
          <option value="private" ${g.privacy === 'private' ? 'selected' : ''}>Private – visible in directory, members must be approved</option>
          <option value="hidden" ${g.privacy === 'hidden' ? 'selected' : ''}>Hidden (Secret) – unlisted, only invited members can find and access</option>
        </select></div>
        <label class="check"><input type="checkbox" name="hasFiles" ${g.hasFiles ? 'checked' : ''} /> Enable the Files tab</label>
        <div class="form-error"></div>
      </form>
      <div class="modal-foot">
        ${editing ? `<button class="btn danger" data-delete style="margin-right:auto">Delete group</button>` : ''}
        <button class="btn outline" data-close>Cancel</button><button class="btn" data-save>${editing ? 'Save' : 'Create Group'}</button></div>`,
  });
  const root = m.root;
  const prev = $('.cover-prev', root);
  const drawCover = () => (prev.style.backgroundImage = cover ? `url("${cover}")` : '');
  drawCover();
  prev.onclick = async () => {
    const [f] = await pickFiles({ accept: 'image/*' });
    if (!f) return;
    try {
      cover = (await uploadFile(f)).url;
      drawCover();
    } catch (e) {
      toastError(e);
    }
  };
  $('[data-close]', root).onclick = m.close;
  $('[data-save]', root).onclick = async (e) => {
    const f = $('form', root);
    const body = {
      name: f.name.value,
      category: f.category.value,
      description: f.description.value,
      privacy: f.privacy.value,
      hasFiles: f.hasFiles.checked,
      cover,
    };
    e.currentTarget.disabled = true;
    try {
      const { group: saved } = editing
        ? await api(`/groups/${g.slug}`, { method: 'PATCH', body })
        : await api('/groups', { method: 'POST', body });
      m.close();
      toast(editing ? 'Group updated' : 'Group created!');
      onSaved ? onSaved(saved) : navigate(`/group/${saved.slug}`);
    } catch (err) {
      $('.form-error', root).textContent = err.message;
      e.currentTarget.disabled = false;
    }
  };
  const del = $('[data-delete]', root);
  if (del)
    del.onclick = async () => {
      if (!(await confirmDialog(`Delete "${g.name}" and all of its posts? This cannot be undone.`))) return;
      try {
        await api(`/groups/${g.slug}`, { method: 'DELETE' });
        m.close();
        toast('Group deleted');
        navigate('/groups');
      } catch (e) {
        toastError(e);
      }
    };
}

/** Follow button that keeps itself updated. */
export function followButton(user, { small = true, className = '' } = {}) {
  if (state.user && state.user.id === user.id) return el('<span></span>');
  const b = el(`<button type="button" class="btn ${small ? 'small' : ''} ${className}"></button>`);
  let following = !!user.isFollowing;
  const draw = () => {
    b.textContent = following ? 'Following' : 'Follow';
    b.classList.toggle('outline', following);
  };
  draw();
  b.onclick = async () => {
    if (!requireAuth()) return;
    try {
      const { user: u } = await api(`/users/${encodeURIComponent(user.username)}/follow`, { method: 'POST' });
      following = u.isFollowing;
      draw();
      b.dispatchEvent(new CustomEvent('follow-change', { detail: u, bubbles: true }));
    } catch (e) {
      toastError(e);
    }
  };
  return b;
}
