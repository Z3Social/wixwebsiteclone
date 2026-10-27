// Page views.
import {
  api, state, el, esc, $, $$, icons, avatar, fmtDate, timeAgo, fmtSize, profileUrl, toast, toastError,
  modal, confirmDialog, lightbox, popupMenu, requireAuth, openAuth, uploadFile, pickFiles, copyLink, refreshMe, logout,
} from './core.js';
import { postCard, openComposer, openGroupEditor, followButton } from './components.js';
import { navigate } from './router.js';
import { openChatWith } from './chat.js';

const app = () => document.getElementById('app');

function mount(html, { flush = false, title } = {}) {
  const root = app();
  root.classList.toggle('flush', flush);
  root.innerHTML = html;
  if (title) document.title = `${title} | Z3`;
  window.scrollTo(0, 0);
  return root;
}
const loading = () => mount('<div class="loader"></div>');
function errorPage(e) {
  mount(`<div class="empty" style="padding:120px 20px"><h2 class="section-title">${e.status === 404 ? 'Page not found' : 'Something went wrong'}</h2>
    <p>${esc(e.message)}</p><a class="btn" href="/groups">Back to Groups</a></div>`);
}

// ================================================================ HOME
export function homePage() {
  mount(
    `<section class="hero">
      <h1>Welcome to Z3 Social!</h1>
      <p>Z3 Social. A new way to form communities online with simplicity and freedom. Without anyone to stop all of you. No need of Discord or FANDOM or X or anything like that. Z3 is the best website to form communities online!</p>
      <a class="btn" href="/groups">Get Started</a>
    </section>
    <section class="home-about">
      <img src="/media/ookie.jpg" alt="ookie.jpg" />
      <p>Every online community has a story, and you all want to hear yours. This social space is a great opportunity to give a full background on who you all are, what your community does and what you all have to show and tell. No corporation affairs and freedom forever. You don't have to pay anything to form communities and friendships online with Z3 Social. It works similar to X and the FANDOM wiki forums, but without ads and money going on here. Add a photo, gallery or video in any community group to get started. Or better, create your own community group here today!</p>
    </section>`,
    { title: 'Z3 Social' }
  );
}

// ================================================================ GROUPS LIST
const SORTS = { activity: 'Recent Activity', newest: 'Newest', name: 'Alphabetical', members: 'Members' };
let groupsState = { sort: 'activity', tab: 'all', q: '', category: 'all' };

export async function groupsPage() {
  const root = mount(
    `<div class="groups-toolbar">
       <div style="position:relative"><button class="sort-btn" id="sort-btn" aria-haspopup="true">Sort by: <b id="sort-label"></b> ${icons.chevron.replace('<svg', '<svg width="16" height="16"')}</button>
         <div class="dropdown" id="sort-menu" hidden>${Object.entries(SORTS).map(([k, v]) => `<button data-sort="${k}">${v}</button>`).join('')}</div></div>
       <div class="search-inline"><button class="icon-btn" id="search-btn" aria-label="Search">${icons.search}</button><input id="search-input" placeholder="Search groups" hidden /></div>
       <span class="spacer"></span>
       <button class="btn small" id="create-group" hidden>Create New Group</button>
     </div>
     <div style="height:14px"></div>
     <div class="group-categories-bar" id="cat-bar" style="display:flex;gap:8px;padding:0 40px;overflow-x:auto"></div>
     <div style="height:14px"></div>
     <div class="tabs" role="tablist">
       <button data-tab="all"></button><button data-tab="mine">My Groups</button><button data-tab="suggested">Suggested Groups</button>
     </div>
     <div class="group-list" id="group-list"><div class="loader"></div></div>
     <div class="feed" id="feed"></div>`,
    { title: 'Groups' }
  );
  const sortBtn = $('#sort-btn', root);
  const sortMenu = $('#sort-menu', root);
  $('#sort-label', root).textContent = SORTS[groupsState.sort];
  sortBtn.onclick = () => (sortMenu.hidden = !sortMenu.hidden);
  $$('[data-sort]', sortMenu).forEach(
    (b) =>
      (b.onclick = () => {
        groupsState.sort = b.dataset.sort;
        $('#sort-label', root).textContent = SORTS[groupsState.sort];
        sortMenu.hidden = true;
        loadGroups();
      })
  );
  const si = $('#search-input', root);
  si.value = groupsState.q;
  si.hidden = !groupsState.q;
  $('#search-btn', root).onclick = () => {
    si.hidden = !si.hidden;
    if (!si.hidden) si.focus();
  };
  let t;
  si.oninput = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      groupsState.q = si.value;
      loadGroups();
    }, 250);
  };
  $$('[data-tab]', root).forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.tab === 'mine' && !requireAuth()) return;
        groupsState.tab = b.dataset.tab;
        loadGroups();
        loadFeed();
      })
  );
  $('#create-group', root).onclick = () => openGroupEditor(null);

  async function loadGroups() {
    const list = $('#group-list', root);
    const catBar = $('#cat-bar', root);
    try {
      const url = `/groups?sort=${groupsState.sort}&category=${encodeURIComponent(groupsState.category)}&q=${encodeURIComponent(groupsState.q)}`;
      const { groups, canCreate, categories = [], hasHidden } = await api(url);
      $('#create-group', root).hidden = !canCreate;
      $('[data-tab=all]', root).textContent = `All (${groups.length})`;
      $$('[data-tab]', root).forEach((b) => b.classList.toggle('active', b.dataset.tab === groupsState.tab));

      // Category chips: All, Categories...
      catBar.innerHTML = '';
      const catList = ['All', ...categories];
      catList.forEach(c => {
        const val = c.toLowerCase();
        const isAct = groupsState.category === val || (c === 'All' && groupsState.category === 'all');
        const chip = el(`<button type="button" class="btn small ${isAct ? '' : 'outline'}" style="border-radius:18px;font-size:13px;padding:2px 14px;min-height:28px">${esc(c)}</button>`);
        chip.onclick = () => {
          groupsState.category = val;
          loadGroups();
        };
        catBar.appendChild(chip);
      });

      const shown = groups.filter((g) => (groupsState.tab === 'mine' ? g.isMember : groupsState.tab === 'suggested' ? !g.isMember : true));
      list.innerHTML = '';
      if (!shown.length)
        list.innerHTML = `<div class="empty">${groupsState.tab === 'mine' ? "You haven't joined any groups yet." : 'No groups found.'}</div>`;
      shown.forEach((g) => list.appendChild(groupRow(g, loadGroups)));
    } catch (e) {
      list.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  }

  function feedComposerWidget() {
    const box = el(`
      <div class="composer-trigger">${avatar(state.user, 'sm')}<span class="fake">Share something...</span>
        <span class="tools">
          <button class="icon-btn" data-k="photo" aria-label="Add photo">${icons.image}</button>
          <button class="icon-btn" data-k="video" aria-label="Add video">${icons.video}</button>
          <button class="icon-btn" data-k="gif" aria-label="Add GIF" style="color:#00e5ff">${icons.gif}</button>
          <button class="icon-btn" data-k="poll" aria-label="Create poll">${icons.poll}</button>
        </span>
      </div>
    `);

    box.onclick = (e) => {
      if (!requireAuth()) return;
      const k = e.target.closest('[data-k]');
      openComposer(null, { startWith: k && k.dataset.k, onPosted: () => loadFeed() });
    };

    return box;
  }

  async function loadFeed() {
    const feed = $('#feed', root);
    try {
      let endpoint = '/feed';
      if (groupsState.tab === 'mine') {
        endpoint = '/feed?mine=1';
      } else if (groupsState.tab === 'suggested') {
        endpoint = '/feed?suggested=1';
      }
      let { posts } = await api(endpoint);

      // If user selected "My Groups" but has no joined posts yet, show friendly fallback with suggested posts
      let isFallback = false;
      if (groupsState.tab === 'mine' && (!posts || !posts.length)) {
        const fallback = await api('/feed?suggested=1');
        posts = fallback.posts || [];
        isFallback = true;
      }

      feed.innerHTML = '';
      feed.appendChild(feedComposerWidget());

      if (isFallback) {
        feed.appendChild(
          el(`<div class="notice-box" style="margin-bottom:14px;padding:12px 16px;background:var(--navy);border:1px solid var(--line-strong);border-radius:6px;font-size:14px;color:var(--dim);display:flex;align-items:center;gap:10px">
            <span style="color:var(--blue-hover);display:flex">${icons.info}</span>
            <span>No posts in your joined groups yet. Showing posts from <b>suggested groups</b>:</span>
          </div>`)
        );
      }

      if (!posts || !posts.length) {
        feed.appendChild(el('<div class="empty">No posts in your feed yet. Be the first to share something!</div>'));
      } else {
        posts.forEach((p) => feed.appendChild(postCard(p, { feed: true, onJoined: () => { loadGroups(); loadFeed(); } })));
      }
    } catch (e) {
      feed.innerHTML = '';
      feed.appendChild(feedComposerWidget());
    }
  }
  loadGroups();
  loadFeed();
}

function groupRow(g, reload) {
  const row = el(`
    <div class="group-row">
      <a href="/group/${esc(g.slug)}">${g.cover ? `<img class="group-thumb" src="${esc(g.cover)}" alt="" />` : `<div class="group-thumb" style="background:linear-gradient(120deg,#0b1220,#0475c2)"></div>`}</a>
      <div class="info"><a class="name" href="/group/${esc(g.slug)}">${esc(g.name)}${g.privacy === 'hidden' ? ' <span style="font-size:12px;opacity:0.75;font-weight:normal">(Hidden)</span>' : ''}</a>
        <div class="meta">${esc(g.category || 'General')} · ${g.privacy === 'hidden' ? 'Hidden' : g.privacy === 'private' ? 'Private' : 'Public'} · ${g.memberCount} member${g.memberCount === 1 ? '' : 's'}</div></div>
      <span></span>
    </div>`);
  row.lastElementChild.replaceWith(joinButton(g, reload));
  return row;
}

function joinButton(g, onChange) {
  const wrap = el('<span></span>');
  const b = el('<button class="btn" type="button" style="min-width:100px"></button>');
  wrap.appendChild(b);
  b.textContent = g.isMember ? 'Joined' : g.requested ? 'Requested' : g.privacy === 'private' ? 'Request to Join' : 'Join';
  if (g.isMember || g.requested) b.classList.add('outline');
  b.onclick = async () => {
    if (!requireAuth()) return;
    if (g.isMember || g.requested) {
      const items = [];
      if (g.isMember) {
        items.push({
          label: g.isMuted ? 'Unmute notifications' : 'Mute notifications',
          onClick: async () => {
            try {
              const res = await api(`/groups/${g.slug}/mute`, { method: 'POST' });
              g.isMuted = res.muted;
              await refreshMe();
              toast(g.isMuted ? `Muted notifications for ${g.name}` : `Unmuted notifications for ${g.name}`);
              onChange && onChange(g);
            } catch (e) {
              toastError(e);
            }
          },
        });
      }
      items.push({
        label: g.isMember ? 'Leave group' : 'Cancel request',
        danger: true,
        onClick: async () => {
          if (g.isMember && !(await confirmDialog(`Leave ${g.name}?`, { okText: 'Leave' }))) return;
          try {
            const { group } = await api(`/groups/${g.slug}/leave`, { method: 'POST' });
            onChange && onChange(group);
          } catch (e) {
            toastError(e);
          }
        },
      });
      return popupMenu(b, items);
    }
    try {
      const { group } = await api(`/groups/${g.slug}/join`, { method: 'POST' });
      toast(group.isMember ? `Welcome to ${group.name}!` : 'Your request was sent to the group admins.');
      onChange && onChange(group);
    } catch (e) {
      toastError(e);
    }
  };
  return wrap;
}

// ================================================================ GROUP
export async function groupPage({ slug, tab = 'discussion' }) {
  loading();
  let data;
  try {
    data = await api(`/groups/${encodeURIComponent(slug)}`);
  } catch (e) {
    return errorPage(e);
  }
  let { group: g, stats } = data;
  if (tab === 'files' && !g.hasFiles) tab = 'discussion';
  const tabs = [
    ['discussion', 'Discussion'],
    ['media', 'Media'],
    ...(g.hasFiles ? [['files', 'Files']] : []),
    ['members', 'Members'],
    ['about', 'About'],
  ];
  const root = mount(
    `<nav class="breadcrumbs"><a href="/">Home</a>${icons.chevronRight}<a href="/groups">Groups</a>${icons.chevronRight}<span>${esc(g.name)}</span></nav>
     ${g.cover ? `<img class="group-cover" src="${esc(g.cover)}" alt="" />` : '<div class="group-cover placeholder"></div>'}
     <div class="group-header">
       <div><h1>${esc(g.name)}</h1><div class="meta">${g.privacy === 'private' ? 'Private' : 'Public'} · <a href="/group/${esc(g.slug)}/members">${g.memberCount} member${g.memberCount === 1 ? '' : 's'}</a></div></div>
       <div class="actions">
         <button class="icon-btn" id="g-search" aria-label="Search posts">${icons.search}</button>
         <span class="vsep"></span>
         <span id="g-join"></span>
         ${state.user ? `<button class="icon-btn" id="g-mute" aria-label="${g.isMuted ? 'Unmute group notifications' : 'Mute group notifications'}" title="${g.isMuted ? 'Unmute notifications' : 'Mute notifications'}" style="${g.isMuted ? 'color:var(--danger)' : ''}">${g.isMuted ? icons.bellSlash : icons.bell}</button>` : ''}
         <button class="icon-btn" id="g-share" aria-label="Share">${icons.share}</button>
         ${g.isAdmin ? `<button class="icon-btn" id="g-settings" aria-label="Group settings">${icons.settings}</button>` : ''}
       </div>
     </div>
     <div class="tabs group-tabs">${tabs
       .map(([k, v]) => `<a href="/group/${esc(g.slug)}${k === 'discussion' ? '' : '/' + k}" class="${k === tab ? 'active' : ''}">${v}${k === 'members' && g.requestCount ? ` (${g.requestCount} pending)` : ''}</a>`)
       .join('')}</div>
     <div id="g-search-bar" hidden style="padding:14px 20px 0"><input class="input" placeholder="Search posts in this group" /></div>
     <div id="g-tab"></div>`,
    { title: g.name }
  );
  const rerender = () => groupPage({ slug: g.slug, tab });
  $('#g-join', root).replaceWith(joinButton(g, rerender));
  const muteBtn = $('#g-mute', root);
  if (muteBtn) {
    muteBtn.onclick = async () => {
      if (!requireAuth()) return;
      try {
        const res = await api(`/groups/${g.slug}/mute`, { method: 'POST' });
        g.isMuted = res.muted;
        await refreshMe();
        muteBtn.innerHTML = g.isMuted ? icons.bellSlash : icons.bell;
        muteBtn.title = g.isMuted ? 'Unmute notifications' : 'Mute notifications';
        muteBtn.style.color = g.isMuted ? 'var(--danger)' : '';
        toast(g.isMuted ? `Muted notifications for ${g.name}` : `Unmuted notifications for ${g.name}`);
      } catch (err) {
        toastError(err);
      }
    };
  }
  $('#g-share', root).onclick = () => copyLink(`/group/${g.slug}`);
  const settings = $('#g-settings', root);
  if (settings) settings.onclick = () => openGroupEditor(g, { onSaved: (ng) => groupPage({ slug: ng.slug, tab }) });
  const searchBar = $('#g-search-bar', root);
  $('#g-search', root).onclick = () => {
    if (tab !== 'discussion') return navigate(`/group/${g.slug}`);
    searchBar.hidden = !searchBar.hidden;
    if (!searchBar.hidden) $('input', searchBar).focus();
  };

  const body = $('#g-tab', root);
  if (!g.canViewPosts && tab !== 'about' && tab !== 'members') {
    body.innerHTML = `
      <div class="empty" style="padding:50px 20px 24px">
        ${icons.lock.replace('<svg', '<svg width="40" height="40"')}
        <h3>This group is private</h3>
        <p style="margin-bottom:16px">Join this group to view and participate in discussions.</p>
        <div id="private-join-cta"></div>
      </div>
      <div id="private-suggested" style="margin-top:24px"></div>
    `;
    $('#private-join-cta', body).appendChild(joinButton(g, rerender));
    api('/feed?suggested=1').then(({ posts: sp }) => {
      const container = $('#private-suggested', body);
      if (!container || !sp || !sp.length) return;
      container.innerHTML = `
        <div style="font-size:16px;font-weight:700;margin-bottom:14px;color:var(--text);display:flex;align-items:center;gap:8px">
          ${icons.info}<span>Suggested posts from public groups</span>
        </div>
        <div class="stack" id="suggested-list"></div>
      `;
      const sl = $('#suggested-list', container);
      sp.slice(0, 5).forEach((p) => sl.appendChild(postCard(p, { boxed: true, feed: true, onJoined: rerender })));
    }).catch(() => {});
    return;
  }
  const views = { discussion: groupDiscussion, media: groupMedia, files: groupFiles, members: groupMembers, about: groupAbout };
  views[tab](body, g, stats, { rerender, searchBar });
}

async function groupDiscussion(body, g, stats, { searchBar }) {
  body.innerHTML = `<div class="group-body"><div class="stack" id="posts"></div><aside id="side"></aside></div>`;
  const postsEl = $('#posts', body);
  const side = $('#side', body);

  // sidebar members
  api(`/groups/${g.slug}/members`).then(({ members }) => {
    const box = el(`<div class="side-box"><h3>Members</h3><div class="list"></div>
      <a href="/group/${esc(g.slug)}/members" class="link-btn" style="font-size:16px">See All Members (${members.length})</a></div>`);
    members.slice(0, 5).forEach((m) => {
      const row = el(`<div class="member-mini"><a href="${profileUrl(m)}">${avatar(m, 'sm')}</a><a class="name" href="${profileUrl(m)}">${esc(m.displayName)}${m.groupRole === 'admin' ? icons.admin : ''}</a><span></span></div>`);
      row.lastElementChild.replaceWith(followButton(m, { className: 'ghost' }));
      $('.list', box).appendChild(row);
    });
    side.appendChild(box);
  });

  const load = async (q = '') => {
    postsEl.innerHTML = '<div class="loader"></div>';
    const { posts } = await api(`/groups/${g.slug}/posts?q=${encodeURIComponent(q)}`);
    postsEl.innerHTML = '';
    if (g.isMember || (state.user && state.user.role === 'owner')) {
      const trig = el(`<div class="composer-trigger">${avatar(state.user, 'sm')}<span class="fake">Share something...</span>
        <span class="tools">
          <button class="icon-btn" data-k="photo" aria-label="Add photo">${icons.image}</button>
          <button class="icon-btn" data-k="video" aria-label="Add video">${icons.video}</button>
          <button class="icon-btn" data-k="gif" aria-label="Add GIF" style="color:#00e5ff">${icons.gif}</button>
          <button class="icon-btn" data-k="poll" aria-label="Create poll">${icons.poll}</button>
        </span></div>`);
      trig.onclick = (e) => {
        const k = e.target.closest('[data-k]');
        openComposer(g, { startWith: k && k.dataset.k, onPosted: () => load() });
      };
      postsEl.appendChild(trig);
    } else if (!q) {
      const cta = el(`<div class="composer-trigger"><span class="fake">Join this group to post and comment.</span></div>`);
      cta.appendChild(joinButton(g, () => groupPage({ slug: g.slug })));
      postsEl.appendChild(cta);
    }
    const pinned = !q && posts.find((p) => p.pinned);
    const rest = posts.filter((p) => p !== pinned);
    if (pinned) postsEl.appendChild(postCard(pinned, { boxed: true, showPinnedLabel: true, onPinned: () => load() }));
    rest.forEach((p) => postsEl.appendChild(postCard(p, { boxed: true, onPinned: () => load() })));
    if (!posts.length) {
      postsEl.appendChild(el(`<div class="empty">${q ? 'No posts match your search.' : 'No posts yet in this group.'}</div>`));
      if (!q && !g.isMember) {
        try {
          const { posts: suggestedPosts } = await api('/feed?suggested=1');
          if (suggestedPosts && suggestedPosts.length) {
            const sec = el(`<div class="suggested-section" style="margin-top:24px">
              <div style="font-size:16px;font-weight:700;margin-bottom:14px;color:var(--text);display:flex;align-items:center;gap:8px">
                ${icons.info}<span>Suggested posts from other active groups</span>
              </div>
              <div class="suggested-feed stack"></div>
            </div>`);
            const sf = $('.suggested-feed', sec);
            suggestedPosts.slice(0, 5).forEach((sp) => sf.appendChild(postCard(sp, { boxed: true, feed: true, onJoined: () => load() })));
            postsEl.appendChild(sec);
          }
        } catch (e) {}
      }
    }
  };
  let t;
  $('input', searchBar).oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => load(e.target.value), 300);
  };
  load().catch(toastError);
}

async function groupMedia(body, g) {
  body.innerHTML = '<div class="container"><div class="loader"></div></div>';
  try {
    const { media } = await api(`/groups/${g.slug}/media`);
    const c = $('.container', body);
    if (!media.length) return (c.innerHTML = '<div class="empty">No media has been shared in this group yet.</div>');
    c.innerHTML = `<div class="media-grid">${media
      .map((m) => {
        let src = m.url || '';
        const km = src.match(/(?:https?:\/\/)?(?:www\.)?klipy\.com\/gifs\/([a-zA-Z0-9_-]+)/i);
        if (km) src = `/api/klipy/media/${km[1]}`;
        return m.type === 'video'
          ? `<video src="${esc(src)}" data-v="${esc(src)}" muted></video>`
          : `<img src="${esc(src)}" data-i="${esc(src)}" alt="${esc(m.title || '')}" loading="lazy" />`;
      })
      .join('')}</div>`;
    $$('[data-i]', c).forEach((n) => (n.onclick = () => lightbox(n.dataset.i)));
    $$('[data-v]', c).forEach((n) => (n.onclick = () => lightbox(n.dataset.v, 'video')));
  } catch (e) {
    toastError(e);
  }
}

async function groupFiles(body, g) {
  body.innerHTML = `<div class="container"><div class="row" style="margin-bottom:12px"><h2 class="section-title" style="margin:0">Files</h2><span class="spacer"></span>
    ${g.isMember ? `<button class="btn small" id="up">${icons.upload} Upload File</button>` : ''}</div><div id="files"><div class="loader"></div></div></div>`;
  const list = $('#files', body);
  const load = async () => {
    const { files } = await api(`/groups/${g.slug}/files`);
    list.innerHTML = files.length ? '' : '<div class="empty">No files yet.</div>';
    files.forEach((f) => {
      const ext = (f.name.split('.').pop() || 'file').slice(0, 4);
      const row = el(`<div class="file-row"><div class="ico">${esc(ext)}</div>
        <div style="flex:1;min-width:0"><a href="${esc(f.url)}" target="_blank" download="${esc(f.name)}"><b>${esc(f.name)}</b></a>
        <div class="dim" style="font-size:13px">${fmtSize(f.size)} · ${esc(f.uploader.displayName)} · ${fmtDate(f.createdAt)}</div></div>
        <a class="btn outline small" href="${esc(f.url)}" download="${esc(f.name)}">Download</a>
        ${f.canDelete ? `<button class="icon-btn" data-del aria-label="Delete">${icons.close}</button>` : ''}</div>`);
      const del = $('[data-del]', row);
      if (del)
        del.onclick = async () => {
          if (!(await confirmDialog(`Delete ${f.name}?`))) return;
          await api(`/groups/${g.slug}/files/${f.id}`, { method: 'DELETE' }).catch(toastError);
          load();
        };
      list.appendChild(row);
    });
  };
  const up = $('#up', body);
  if (up)
    up.onclick = async () => {
      const files = await pickFiles({ multiple: true });
      for (const f of files) {
        try {
          toast(`Uploading ${f.name}…`);
          const r = await uploadFile(f);
          await api(`/groups/${g.slug}/files`, { method: 'POST', body: { name: f.name, url: r.url, size: r.size } });
        } catch (e) {
          toastError(e);
        }
      }
      load();
    };
  load().catch(toastError);
}

async function groupMembers(body, g, stats, { rerender }) {
  body.innerHTML = `<div class="container"><input class="input" id="mq" placeholder="Search members" style="max-width:320px;margin-bottom:10px" />
    <div id="reqs"></div><div id="mlist"><div class="loader"></div></div></div>`;
  const load = async (q = '') => {
    const { members, requests } = await api(`/groups/${g.slug}/members?q=${encodeURIComponent(q)}`);
    const reqs = $('#reqs', body);
    reqs.innerHTML = requests.length ? `<h3 style="margin:16px 0 4px">Membership requests</h3>` : '';
    requests.forEach((r) => {
      const row = el(`<div class="member-row">${avatar(r, 'sm')}<div class="info"><a href="${profileUrl(r)}"><b>${esc(r.displayName)}</b></a><div class="role">Requested ${timeAgo(r.requestedAt)}</div></div>
        <button class="btn small" data-a="approve">Approve</button><button class="btn outline small" data-a="decline">Decline</button></div>`);
      $$('[data-a]', row).forEach(
        (b) =>
          (b.onclick = async () => {
            await api(`/groups/${g.slug}/members/${r.id}`, { method: 'POST', body: { action: b.dataset.a } }).catch(toastError);
            rerender();
          })
      );
      reqs.appendChild(row);
    });
    const list = $('#mlist', body);
    list.innerHTML = `<h3 style="margin:16px 0 4px">Members (${members.length})</h3>`;
    members.forEach((m) => {
      const row = el(`<div class="member-row"><a href="${profileUrl(m)}">${avatar(m, 'sm')}</a>
        <div class="info"><a href="${profileUrl(m)}"><b>${esc(m.displayName)}</b></a> ${m.groupRole === 'admin' ? icons.admin : ''}
        <div class="role">${m.groupRole === 'admin' ? 'Admin' : 'Member'} · Joined ${fmtDate(m.joinedAt)}</div></div><span class="f"></span>
        ${g.isAdmin && !m.isSelf ? `<span><button class="icon-btn" data-more aria-label="Manage">${icons.more}</button></span>` : ''}</div>`);
      $('.f', row).replaceWith(followButton(m));
      const more = $('[data-more]', row);
      if (more)
        more.onclick = () =>
          popupMenu(more, [
            m.groupRole === 'admin'
              ? { label: 'Remove admin role', onClick: () => act(m, 'removeAdmin') }
              : { label: 'Make admin', onClick: () => act(m, 'makeAdmin') },
            { label: 'Remove from group', danger: true, onClick: () => act(m, 'remove') },
          ]);
      list.appendChild(row);
    });
  };
  const act = async (m, action) => {
    if (action === 'remove' && !(await confirmDialog(`Remove ${m.displayName} from the group?`, { okText: 'Remove' }))) return;
    try {
      await api(`/groups/${g.slug}/members/${m.id}`, { method: 'POST', body: { action } });
      load($('#mq', body).value);
    } catch (e) {
      toastError(e);
    }
  };
  let t;
  $('#mq', body).oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => load(e.target.value), 250);
  };
  load().catch(toastError);
}

function groupAbout(body, g, stats) {
  body.innerHTML = `<div class="group-body">
    <div class="stack">
      <div class="side-box"><h3>Groups Activity: Last 30 Days</h3>
        <div class="stat-row"><div><div class="muted">New Posts</div><div class="num">${stats.newPosts}</div></div>
        <div><div class="muted">New Members</div><div class="num">${stats.newMembers}</div></div></div></div>
      <div class="side-box"><h3>About</h3><div class="post-body" style="margin:0">${esc(g.description)}</div></div>
    </div>
    <aside class="side-box"><h3>Info</h3>
      <div class="info-item">${g.privacy === 'private' ? icons.lock : icons.globe}<div><div class="t">${g.privacy === 'private' ? 'Private' : 'Public'}</div>
        <div class="d">${g.privacy === 'private' ? 'Only members can see posts.' : 'Anyone can view this group.'}</div></div></div>
      <div class="info-item">${icons.eye}<div><div class="t">${g.visible ? 'Visible' : 'Hidden'}</div><div class="d">${g.visible ? 'Shown to site visitors.' : 'Only members can find this group.'}</div></div></div>
      <div class="info-item">${icons.calendar}<div><div class="t">${fmtDate(g.createdAt)}</div><div class="d">Created</div></div></div>
      <div class="info-item"><a href="${profileUrl(g.createdBy)}">${avatar(g.createdBy, 'xs')}</a><div><a class="t" href="${profileUrl(g.createdBy)}">${esc(g.createdBy.displayName)}</a><div class="d">Created by</div></div></div>
    </aside></div>`;
}

// ================================================================ SINGLE POST
export async function postPage({ slug, id }) {
  loading();
  try {
    const { post, group } = await api(`/posts/${encodeURIComponent(id)}`);
    if (group.slug !== slug) return navigate(`/group/${group.slug}/discussion/${post.id}`, { replace: true });
    const root = mount(
      `<nav class="breadcrumbs"><a href="/">Home</a>${icons.chevronRight}<a href="/groups">Groups</a>${icons.chevronRight}<a href="/group/${esc(group.slug)}">${esc(group.name)}</a>${icons.chevronRight}<span>${post.isComment ? 'Comment' : 'Post'}</span></nav>
       <div class="feed" style="margin-top:10px" id="one"></div>`,
      { title: `${(post.text || '').replace(/\*\*/g, '').slice(0, 60) || (post.isComment ? 'Comment' : 'Post')} | ${group.name}` }
    );
    $('#one', root).appendChild(postCard(post, { boxed: true, expanded: true, feed: true, onDeleted: () => navigate(`/group/${group.slug}`) }));
  } catch (e) {
    errorPage(e);
  }
}

// ================================================================ MEMBERS
export async function membersPage() {
  const root = mount(
    `<div class="container"><div class="row" style="margin-bottom:20px"><h1 class="section-title" style="margin:0">Members</h1><span class="spacer"></span>
     <input class="input" id="q" placeholder="Search members" style="max-width:260px" /></div><div class="member-grid" id="grid"><div class="loader"></div></div></div>`,
    { title: 'Members' }
  );
  const load = async (q = '') => {
    const { members } = await api(`/members?q=${encodeURIComponent(q)}`);
    const grid = $('#grid', root);
    grid.innerHTML = members.length ? '' : '<div class="empty">No members found.</div>';
    members.forEach((m) => {
      const card = el(`<div class="member-card"><a href="${profileUrl(m)}">${avatar(m)}</a><a class="name" href="${profileUrl(m)}">${esc(m.displayName)}${m.role === 'owner' ? ' ' + icons.admin : ''}</a>
        <div class="dim" style="font-size:13px">${m.followers} follower${m.followers === 1 ? '' : 's'}</div><span></span></div>`);
      card.lastElementChild.replaceWith(followButton(m));
      grid.appendChild(card);
    });
  };
  let t;
  $('#q', root).oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => load(e.target.value), 250);
  };
  load().catch(toastError);
}

// ================================================================ PROFILE
export async function profilePage({ username }) {
  if (username === '{userName}' || username === 'me') {
    if (!state.user) {
      openAuth();
      return navigate('/members', { replace: true });
    }
    return navigate(profileUrl(state.user), { replace: true });
  }
  loading();
  let data;
  try {
    data = await api(`/users/${encodeURIComponent(username)}`);
  } catch (e) {
    return errorPage(e);
  }
  const { user: u, groups } = data;
  const root = mount(
    `<div class="profile-cover" ${u.cover ? `style="background-image:url('${esc(u.cover)}')"` : ''}></div>
     <div class="profile-head">${avatar(u, 'lg')}
       <div class="info"><h1>${esc(u.displayName)}${u.role === 'owner' ? icons.admin : ''}</h1><div class="handle">@${esc(u.username)}</div></div>
       <div class="actions" id="p-actions"></div></div>
     <div class="profile-stats"><button data-list="followers"><b id="fc">${u.followers}</b> Followers</button><button data-list="following"><b>${u.following}</b> Following</button></div>
     <div class="profile-body">
       <aside class="stack">
         <div class="side-box"><h3>About</h3>${u.isPrivate ? '<p class="muted">This profile is private.</p>' : `<p class="muted" style="white-space:pre-wrap;margin:0 0 12px">${esc(u.bio || 'No bio yet.')}</p><div class="dim" style="font-size:13px">Member since ${fmtDate(u.createdAt)}</div>`}</div>
         ${u.isPrivate ? '' : `<div class="side-box"><h3>Groups (${groups.length})</h3>${groups.map((g) => `<a class="member-mini" href="/group/${esc(g.slug)}">${g.cover ? `<img src="${esc(g.cover)}" style="width:48px;height:32px;object-fit:cover" alt="" />` : ''}<span>${esc(g.name)}</span></a>`).join('') || '<p class="muted">Not a member of any group.</p>'}</div>`}
       </aside>
       <section><h2 class="section-title" style="font-size:22px">Posts</h2><div class="stack" id="p-posts"></div></section>
     </div>`,
    { title: u.displayName }
  );
  const actions = $('#p-actions', root);
  if (u.isSelf) {
    actions.appendChild(el(`<a class="btn outline small" href="/account/my-account">Edit Profile</a>`));
  } else {
    const fb = followButton(u);
    fb.addEventListener('follow-change', (e) => ($('#fc', root).textContent = e.detail.followers));
    actions.appendChild(fb);
    const msg = el(`<button class="btn outline small">Message</button>`);
    msg.onclick = () => requireAuth() && openChatWith(u);
    actions.appendChild(msg);
  }
  $$('[data-list]', root).forEach((b) => (b.onclick = () => showFollows(u, b.dataset.list)));
  const postsEl = $('#p-posts', root);
  if (u.isPrivate) return (postsEl.innerHTML = '<div class="empty">This profile is private.</div>');
  const { posts } = await api(`/feed?author=${encodeURIComponent(u.username)}`);
  if (!posts.length) postsEl.innerHTML = '<div class="empty">No posts yet.</div>';
  posts.forEach((p) => postsEl.appendChild(postCard(p, { boxed: true, feed: true })));
}

async function showFollows(u, which) {
  const m = modal({ title: which === 'followers' ? 'Followers' : 'Following', body: '<div class="modal-body"><div class="loader"></div></div>' });
  const data = await api(`/users/${encodeURIComponent(u.username)}/follows`);
  const list = data[which];
  const b = $('.modal-body', m.root);
  b.innerHTML = list.length ? '' : '<div class="empty">Nobody here yet.</div>';
  list.forEach((x) => {
    const row = el(`<div class="member-row"><a href="${profileUrl(x)}">${avatar(x, 'sm')}</a><div class="info"><a href="${profileUrl(x)}"><b>${esc(x.displayName)}</b></a><div class="role">@${esc(x.username)}</div></div><span></span></div>`);
    row.lastElementChild.replaceWith(followButton(x));
    $$('a', row).forEach((a) => a.addEventListener('click', m.close));
    b.appendChild(row);
  });
}

// ================================================================ ACCOUNT
function accountShell(active, title) {
  const links = [
    ['my-account', 'My Account'],
    ['notifications', 'Notifications'],
    ['settings', 'Settings'],
  ];
  const root = mount(
    `<div class="account-layout"><nav class="account-nav">
      <a href="${profileUrl(state.user)}">Profile</a>
      ${links.map(([k, v]) => `<a href="/account/${k}" class="${k === active ? 'active' : ''}">${v}</a>`).join('')}
     </nav><div class="account-main" id="acc"></div></div>`,
    { title }
  );
  return $('#acc', root);
}

function needLogin() {
  mount(`<div class="empty" style="padding:120px 20px"><h2 class="section-title">Log in to view this page</h2><button class="btn" id="li">Log In</button></div>`);
  $('#li').onclick = () => openAuth();
  openAuth();
}

export function myAccountPage() {
  if (!state.user) return needLogin();
  const u = state.user;
  const main = accountShell('my-account', 'My Account');
  let av = u.avatar;
  let cover = u.cover;
  main.innerHTML = `
    <h2>My Account</h2><p class="lead">View and edit your personal info below.</p>
    <form id="acc-form">
      <div class="card"><h3>Profile</h3>
        <div class="avatar-edit" style="margin-bottom:18px"><span id="av">${avatar(u, 'lg')}</span>
          <div class="stack" style="gap:8px"><button type="button" class="btn outline small" id="av-up">${icons.upload} Upload photo</button>
          <button type="button" class="btn ghost small" id="av-rm">Remove photo</button></div></div>
        <div class="field" style="margin-bottom:16px"><label>Cover image</label>
          <div id="cv" style="height:110px;border-radius:6px;background:#0b1220 center/cover;cursor:pointer;border:1px dashed var(--line-strong);display:flex;align-items:center;justify-content:center"><span class="btn outline small">Change cover</span></div></div>
        <div class="grid-2">
          <div class="field"><label>Display name</label><input class="input" name="displayName" value="${esc(u.displayName)}" /></div>
          <div class="field"><label>Username</label><input class="input" name="username" value="${esc(u.username)}" /></div>
        </div>
        <div class="field" style="margin-top:16px"><label>Bio</label><textarea class="textarea" name="bio" maxlength="1000">${esc(u.bio || '')}</textarea></div>
      </div>
      <div class="card"><h3>Account</h3>
        <div class="field"><label>Login email</label><input class="input" name="email" type="email" value="${esc(u.email)}" /></div>
      </div>
      <div class="row"><span class="form-error" style="flex:1"></span><button type="button" class="btn outline" id="discard">Discard</button><button class="btn" type="submit">Update Info</button></div>
    </form>`;
  const drawCover = () => ($('#cv', main).style.backgroundImage = cover ? `url("${cover}")` : '');
  drawCover();
  const drawAv = () => ($('#av', main).innerHTML = avatar({ ...u, avatar: av }, 'lg'));
  $('#av-up', main).onclick = async () => {
    const [f] = await pickFiles({ accept: 'image/*' });
    if (f) {
      try {
        av = (await uploadFile(f)).url;
        drawAv();
      } catch (e) {
        toastError(e);
      }
    }
  };
  $('#av-rm', main).onclick = () => {
    av = '';
    drawAv();
  };
  $('#cv', main).onclick = async () => {
    const [f] = await pickFiles({ accept: 'image/*' });
    if (f) {
      try {
        cover = (await uploadFile(f)).url;
        drawCover();
      } catch (e) {
        toastError(e);
      }
    }
  };
  $('#discard', main).onclick = () => myAccountPage();
  $('#acc-form', main).onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      await api('/me', { method: 'PATCH', body: { ...f, avatar: av, cover } });
      await refreshMe();
      toast('Your info was updated');
    } catch (err) {
      $('.form-error', main).textContent = err.message;
    }
  };
}

export async function notificationsPage() {
  if (!state.user) return needLogin();
  const main = accountShell('notifications', 'Notifications');
  main.innerHTML = `<div class="row" style="flex-wrap:wrap;gap:12px;margin-bottom:14px">
    <div style="flex:1;min-width:200px"><h2>Notifications</h2><p class="lead" style="margin-bottom:0">Stay up to date with activity across the site.</p></div>
    <div style="display:flex;gap:8px;align-items:center">
      <a href="/account/settings" class="btn outline small" style="display:inline-flex;align-items:center;gap:6px">${icons.settings} Settings</a>
      <button class="btn outline small" id="mark">Mark all as read</button>
      <button class="btn ghost small" id="clear">Clear</button>
    </div>
  </div>
  <div id="nlist"><div class="loader"></div></div>`;
  const load = async () => {
    const { notifications } = await api('/notifications');
    const list = $('#nlist', main);
    list.innerHTML = notifications.length ? '' : '<div class="empty">No notifications yet.</div>';
    notifications.forEach((n) => {
      const row = el(`<div class="notif-row ${n.read ? '' : 'unread'}">${avatar(n.actor, 'sm')}<div class="t"><b>${esc(n.actor.displayName)}</b> ${esc(n.text)}<div class="when">${timeAgo(n.createdAt)}</div></div></div>`);
      row.onclick = async () => {
        if (!n.read) await api('/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => {});
        refreshMe();
        navigate(n.link || '/');
      };
      list.appendChild(row);
    });
  };
  $('#mark', main).onclick = async () => {
    await api('/notifications/read', { method: 'POST', body: {} });
    refreshMe();
    load();
  };
  $('#clear', main).onclick = async () => {
    if (!(await confirmDialog('Clear all notifications?', { okText: 'Clear' }))) return;
    await api('/notifications', { method: 'DELETE' });
    refreshMe();
    load();
  };
  load().catch(toastError);
}

export function settingsPage() {
  if (!state.user) return needLogin();
  const u = state.user;
  const s = u.settings || {};
  const main = accountShell('settings', 'Settings');
  main.innerHTML = `
    <h2>Settings</h2><p class="lead">Manage your privacy, notifications, community mutes and account security.</p>
    
    <div class="card">
      <h3>Profile privacy</h3>
      <label class="check" style="margin-bottom:8px"><input type="radio" name="privacy" value="public" ${s.privacy !== 'private' ? 'checked' : ''} /> Public – your profile is visible to everyone</label>
      <label class="check"><input type="radio" name="privacy" value="private" ${s.privacy === 'private' ? 'checked' : ''} /> Private – only you can see your profile details</label>
    </div>

    <div class="card" id="notifications">
      <h3 style="display:flex;align-items:center;gap:8px">${icons.bell} Notification Settings</h3>
      <p class="muted" style="margin-top:0;margin-bottom:16px;font-size:14px">Choose what activities trigger in-app notifications and alerts.</p>
      ${[
        ['notifyComments', 'Comments on my posts'],
        ['notifyReplies', 'Replies to my comments'],
        ['notifyReactions', 'Reactions to my posts and comments'],
        ['notifyFollows', 'New followers on my profile'],
        ['notifyGroups', 'Group invites, join requests and admin updates'],
        ['notifyGroupPosts', 'New posts in groups I have joined'],
      ]
        .map(([k, v]) => `<label class="check" style="margin-bottom:10px"><input type="checkbox" data-n="${k}" ${s[k] !== false ? 'checked' : ''} /> ${v}</label>`)
        .join('')}
    </div>

    <div class="card" id="muted-groups">
      <div style="margin-bottom:16px">
        <h3 style="margin:0 0 4px;display:flex;align-items:center;gap:8px">${icons.bellSlash} Muted Groups</h3>
        <p class="muted" style="margin:0;font-size:14px">Like Twitter Communities, muted groups will never send you notifications or appear in your Home feed.</p>
      </div>
      <div id="muted-groups-list"><div class="loader"></div></div>
    </div>

    <div class="card">
      <h3>Change password</h3>
      <form id="pw" class="stack" style="max-width:380px">
        <input class="input" type="password" name="current" placeholder="Current password" autocomplete="current-password" />
        <input class="input" type="password" name="next" placeholder="New password (min 6 characters)" autocomplete="new-password" />
        <div class="form-error"></div>
        <div><button class="btn small" type="submit">Update password</button></div>
      </form>
    </div>

    <div class="card" style="border-color:rgba(235,72,77,.5)">
      <h3>Delete account</h3>
      <p class="muted" style="margin-top:0">This permanently removes your account, follows and notifications.</p>
      <button class="btn danger small" id="del">Delete my account</button>
    </div>

    <button class="btn outline" id="lo">Log Out</button>`;

  const save = async (settings) => {
    try {
      await api('/me', { method: 'PATCH', body: { settings } });
      await refreshMe();
      toast('Settings saved');
    } catch (e) {
      toastError(e);
    }
  };

  $$('[name=privacy]', main).forEach((r) => (r.onchange = () => save({ privacy: r.value })));
  $$('[data-n]', main).forEach((c) => (c.onchange = () => save({ [c.dataset.n]: c.checked })));

  const loadGroupsList = async () => {
    const listEl = $('#muted-groups-list', main);
    if (!listEl) return;
    try {
      const { groups } = await api('/groups');
      const mutedList = Array.isArray(state.user.settings?.mutedGroups) ? [...state.user.settings.mutedGroups] : [];
      if (!groups || !groups.length) {
        listEl.innerHTML = '<div class="dim" style="padding:16px 0">No groups available.</div>';
        return;
      }
      listEl.innerHTML = '';
      groups.forEach((g) => {
        const isMuted = mutedList.includes(g.id);
        const item = el(`
          <div class="row" style="padding:12px 0;border-bottom:1px solid var(--line);align-items:center;gap:14px">
            <a href="/group/${esc(g.slug)}" style="flex:none">
              ${g.cover ? `<img src="${esc(g.cover)}" style="width:52px;height:36px;object-fit:cover;border-radius:4px" alt="" />` : `<div style="width:52px;height:36px;border-radius:4px;background:linear-gradient(120deg,#0b1220,#0475c2)"></div>`}
            </a>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:15px;display:flex;align-items:center;gap:8px">
                <a href="/group/${esc(g.slug)}" style="color:var(--text)">${esc(g.name)}</a>
                ${g.isMember ? '<span style="font-size:11px;font-weight:normal;opacity:0.75">(Joined)</span>' : ''}
              </div>
              <div class="dim" style="font-size:13px">${esc(g.category || 'General')} · ${g.memberCount} member${g.memberCount === 1 ? '' : 's'}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span class="mute-badge" style="padding:3px 10px;border-radius:12px;font-size:12px;font-weight:500;background:${isMuted ? 'rgba(235,72,77,0.2)' : 'rgba(4,117,194,0.15)'};color:${isMuted ? 'var(--danger)' : 'var(--blue-hover)'}">
                ${isMuted ? 'Muted' : 'Active'}
              </span>
              <button class="btn small ${isMuted ? '' : 'outline'}" style="min-width:85px" data-mute-btn>
                ${isMuted ? `${icons.bell} Unmute` : `${icons.bellSlash} Mute`}
              </button>
            </div>
          </div>
        `);
        const muteBtn = $('[data-mute-btn]', item);
        const badge = $('.mute-badge', item);
        muteBtn.onclick = async () => {
          try {
            const res = await api(`/groups/${g.slug}/mute`, { method: 'POST' });
            await refreshMe();
            const nowMuted = res.muted;
            if (nowMuted) {
              if (!mutedList.includes(g.id)) mutedList.push(g.id);
            } else {
              const idx = mutedList.indexOf(g.id);
              if (idx >= 0) mutedList.splice(idx, 1);
            }
            badge.textContent = nowMuted ? 'Muted' : 'Active';
            badge.style.background = nowMuted ? 'rgba(235,72,77,0.2)' : 'rgba(4,117,194,0.15)';
            badge.style.color = nowMuted ? 'var(--danger)' : 'var(--blue-hover)';
            muteBtn.className = `btn small ${nowMuted ? '' : 'outline'}`;
            muteBtn.innerHTML = nowMuted ? `${icons.bell} Unmute` : `${icons.bellSlash} Mute`;
            toast(nowMuted ? `Muted notifications for ${g.name}` : `Unmuted notifications for ${g.name}`);
          } catch (err) {
            toastError(err);
          }
        };
        listEl.appendChild(item);
      });
    } catch (e) {
      listEl.innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
    }
  };

  loadGroupsList();

  $('#pw', main).onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/me/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      e.target.reset();
      $('.form-error', e.target).textContent = '';
      toast('Password updated');
    } catch (err) {
      $('.form-error', e.target).textContent = err.message;
    }
  };

  $('#del', main).onclick = () => {
    const m = modal({
      title: 'Delete account',
      body: `<div class="modal-body"><p class="muted" style="margin:0">Enter your password to confirm.</p><input class="input" type="password" id="dp" /><div class="form-error"></div></div>
             <div class="modal-foot"><button class="btn outline" data-close>Cancel</button><button class="btn danger" id="dc">Delete forever</button></div>`,
    });
    $('[data-close]', m.root).onclick = m.close;
    $('#dc', m.root).onclick = async () => {
      try {
        await api('/me', { method: 'DELETE', body: { password: $('#dp', m.root).value } });
        m.close();
        await refreshMe();
        navigate('/');
        toast('Your account was deleted.');
      } catch (e) {
        $('.form-error', m.root).textContent = e.message;
      }
    };
  };

  $('#lo', main).onclick = async () => {
    await logout();
    navigate('/');
  };
}

export function notificationSettingsPage() {
  return settingsPage();
}

export function notFoundPage() {
  errorPage({ status: 404, message: "The page you're looking for doesn't exist." });
}
