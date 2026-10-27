// App bootstrap: header, routing, auth state.
import { state, $, el, esc, icons, avatar, profileUrl, onAuthChange, refreshMe, openAuth, logout, closeOnOutside } from './js/core.js';
import { route, setNotFound, start, navigate, render } from './js/router.js';
import * as P from './js/pages.js';
import { initChat } from './js/chat.js';

route('/', P.homePage);
route('/groups', P.groupsPage);
route('/group/:slug', (p) => P.groupPage({ slug: p.slug, tab: 'discussion' }));
route('/group/:slug/discussion', (p) => P.groupPage({ slug: p.slug, tab: 'discussion' }));
route('/group/:slug/media', (p) => P.groupPage({ slug: p.slug, tab: 'media' }));
route('/group/:slug/files', (p) => P.groupPage({ slug: p.slug, tab: 'files' }));
route('/group/:slug/members', (p) => P.groupPage({ slug: p.slug, tab: 'members' }));
route('/group/:slug/about', (p) => P.groupPage({ slug: p.slug, tab: 'about' }));
route('/group/:slug/discussion/:id', P.postPage);
route('/members', P.membersPage);
route('/profile/:username/profile', P.profilePage);
route('/profile/:username', P.profilePage);
route('/account/my-account', P.myAccountPage);
route('/account/notifications', P.notificationsPage);
route('/account/notification-settings', P.notificationSettingsPage);
route('/account/settings', P.settingsPage);
setNotFound(P.notFoundPage);

// ---------------------------------------------------------------- header
const moreBtn = $('#nav-more-btn');
const moreMenu = $('#nav-more-menu');
moreBtn.onclick = () => {
  moreMenu.hidden = !moreMenu.hidden;
  moreBtn.setAttribute('aria-expanded', String(!moreMenu.hidden));
  if (!moreMenu.hidden) closeOnOutside(moreMenu, moreBtn);
};
moreMenu.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  moreMenu.hidden = true;
  if (a.hasAttribute('data-auth') && !state.user) {
    e.preventDefault();
    openAuth();
  }
});
$('#nav-profile').onclick = (e) => {
  e.preventDefault();
  state.user ? navigate(profileUrl(state.user)) : openAuth();
};

function renderHeaderUser(u) {
  const box = $('#header-user');
  if (!u) {
    box.innerHTML = `<button class="login-btn" id="login-btn">${icons.user}<span>Log In</span></button>`;
    $('#login-btn').onclick = () => openAuth();
    return;
  }
  box.innerHTML = `
    <a class="icon-btn" href="/account/notifications" aria-label="Notifications">${icons.bell}${u.unreadNotifications ? `<span class="badge-count">${u.unreadNotifications}</span>` : ''}</a>
    <div style="position:relative">
      <button class="user-chip" id="user-chip" aria-haspopup="true">${avatar(u, 'xs')}<span>${esc(u.displayName)}</span>${icons.chevron.replace('<svg', '<svg width="14" height="14"')}</button>
      <div class="dropdown right" id="user-menu" hidden>
        <a href="${profileUrl(u)}" data-link>Profile</a>
        <a href="/account/my-account">My Account</a>
        <a href="/account/notifications">Notifications${u.unreadNotifications ? ` (${u.unreadNotifications})` : ''}</a>
        <a href="/account/settings">Settings</a>
        <hr /><button id="logout-btn" class="danger">Log Out</button>
      </div>
    </div>`;
  const chip = $('#user-chip');
  const menu = $('#user-menu');
  chip.onclick = () => {
    menu.hidden = !menu.hidden;
    if (!menu.hidden) closeOnOutside(menu, chip);
  };
  menu.addEventListener('click', (e) => e.target.closest('a') && (menu.hidden = true));
  $('#logout-btn').onclick = async () => {
    menu.hidden = true;
    await logout();
    if (location.pathname.startsWith('/account')) navigate('/');
  };
}

// Re-render the current page when the logged-in user changes (login / logout), not on every badge update.
let lastUserId;
onAuthChange((u) => {
  renderHeaderUser(u);
  const id = u ? u.id : null;
  if (lastUserId !== undefined && id !== lastUserId) render();
  lastUserId = id;
});

initChat();
refreshMe()
  .catch(() => {})
  .finally(start);
