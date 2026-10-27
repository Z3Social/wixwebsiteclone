// Z3 Social server: REST API + realtime (SSE) + static SPA hosting.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const store = require('./db');

const RESET = process.argv.includes('--reset') || process.argv.includes('--reset-only');
store.load({ reset: RESET });
if (process.argv.includes('--reset-only')) {
  console.log('Database reset to seed content.');
  process.exit(0);
}
const db = () => store.db;

// Backfill groupId on comments if missing so comments are independent posts
db().comments.forEach((c) => {
  if (!c.groupId) {
    const p = db().posts.find((x) => x.id === c.postId);
    if (p) c.groupId = p.groupId;
  }
});

const IS_Z3_UI = process.argv.includes('--z3-ui') || process.env.UI_MODE === 'z3-ui';
const PORT = Number(process.env.PORT) || (IS_Z3_UI ? 3036 : 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const Z3_DIST_DIR = path.join(__dirname, '..', '..', 'dist');
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => { console.log(`[HTTP] ${req.method} ${req.url}`); next(); });
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// CORS middleware
app.use((req, res, next) => {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', (req.headers && req.headers.origin) || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------------------------------------------------------------- helpers
const now = () => new Date().toISOString();
const SESSION_COOKIE = 'z3sid';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db().sessions[token] = { userId, createdAt: Date.now() };
  store.save();
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
  );
}

function clearSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) delete db().sessions[token];
  store.save();
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

app.use((req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = bearerToken || parseCookies(req)[SESSION_COOKIE];
  const s = token && db().sessions[token];
  if (s && Date.now() - s.createdAt < SESSION_TTL_MS) {
    req.user = db().users.find((u) => u.id === s.userId) || null;
  } else {
    req.user = null;
  }
  next();
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
const wrap = (fn) => (req, res, next) => {
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === 'function') r.catch(next);
  } catch (e) {
    next(e);
  }
};
const requireUser = (req) => req.user || fail(401, 'Please log in to continue.');

const userById = (id) => db().users.find((u) => u.id === id);
const userByName = (name) => {
  const clean = String(name || '').trim().toLowerCase().replace(/^@/, '').replace(/@(z3\.social|localhost(:\d+)?)$/i, '');
  return db().users.find((u) =>
    u.username.toLowerCase() === clean ||
    (u.email && u.email.toLowerCase() === clean) ||
    (u.email && u.email.toLowerCase() === String(name || '').toLowerCase()) ||
    (clean === 'ivan' && (u.username === 'ivanalbrieu' || u.username === 'ivanwolfdog')) ||
    (clean === 'ivanwolfdog' && u.username === 'ivanalbrieu')
  );
};
const groupBySlug = (slug) => db().groups.find((g) => g.slug === slug);
const groupById = (id) => db().groups.find((g) => g.id === id);
const isOwner = (u) => !!u && u.role === 'owner';
const memberOf = (g, u) => !!u && g.members.some((m) => m.userId === u.id);
const groupAdmin = (g, u) => isOwner(u) || (!!u && g.members.some((m) => m.userId === u.id && m.role === 'admin'));
const canViewGroup = (g, u) => (g.privacy !== 'hidden' && g.visible !== false) || memberOf(g, u) || isOwner(u);
const canViewPosts = (g, u) => g.privacy === 'public' || memberOf(g, u) || isOwner(u);

function slugify(s) {
  const base = String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'group';
  let slug = base;
  let i = 2;
  while (groupBySlug(slug)) slug = `${base}-${i++}`;
  return slug;
}

function cleanText(s, max = 10000) {
  return String(s == null ? '' : s).slice(0, max);
}

function publicUser(u, viewer) {
  if (!u) return { id: null, username: 'deleted', displayName: 'Deleted member', avatar: '' };
  const out = {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar || '',
    role: u.role,
  };
  if (viewer !== undefined) {
    const priv = u.settings && u.settings.privacy === 'private';
    const self = viewer && viewer.id === u.id;
    out.isPrivate = priv && !self && !isOwner(viewer);
    out.followers = db().follows.filter((f) => f.following === u.id).length;
    out.following = db().follows.filter((f) => f.follower === u.id).length;
    out.isFollowing = !!viewer && db().follows.some((f) => f.follower === viewer.id && f.following === u.id);
    out.isSelf = !!self;
    if (!out.isPrivate) {
      out.bio = u.bio || '';
      out.cover = u.cover || '';
      out.createdAt = u.createdAt;
    }
  }
  return out;
}

function selfUser(u) {
  if (!u) return null;
  return {
    ...publicUser(u, u),
    email: u.email,
    settings: u.settings || {},
    unreadNotifications: db().notifications.filter((n) => n.userId === u.id && !n.read).length,
    unreadMessages: db().messages.filter((m) => m.to === u.id && !m.read).length,
  };
}

function serializeGroup(g, viewer) {
  const membership = viewer && g.members.find((m) => m.userId === viewer.id);
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    category: g.category || 'General',
    description: g.description,
    cover: g.cover,
    privacy: g.privacy,
    visible: g.visible !== false,
    hasFiles: !!g.hasFiles,
    createdAt: g.createdAt,
    createdBy: publicUser(userById(g.createdBy)),
    memberCount: g.members.length,
    lastActivity: g.lastActivity || g.createdAt,
    pinnedPostId: g.pinnedPostId || null,
    isMember: !!membership,
    role: membership ? membership.role : null,
    isAdmin: groupAdmin(g, viewer),
    requested: !!viewer && (g.requests || []).some((r) => r.userId === viewer.id),
    canViewPosts: canViewPosts(g, viewer),
    requestCount: groupAdmin(g, viewer) ? (g.requests || []).length : undefined,
    isMuted: !!(viewer && viewer.settings && Array.isArray(viewer.settings.mutedGroups) && viewer.settings.mutedGroups.includes(g.id)),
  };
}

function reactionSummary(reactions, viewer) {
  return Object.entries(reactions || {})
    .filter(([, ids]) => ids.length)
    .map(([emoji, ids]) => ({ emoji, count: ids.length, mine: !!viewer && ids.includes(viewer.id) }))
    .sort((a, b) => b.count - a.count);
}

const KLIPY_APP_KEY = process.env.KLIPY_APP_KEY || 'pmpZyPifwSulBfELHCbpaOllUfgsjqt9yeImc2XWIcHSWjnAUBw9oueRf4kD5r25';
const klipyCache = new Map();

// Seed known slugs so they are instantly ready offline
klipyCache.set('steve-minecraft-steve-2', {
  slug: 'steve-minecraft-steve-2',
  title: 'Steve Minecraft Steve',
  url: 'https://static.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/37/ce/U1VVU1T8AVwmm2pj.gif',
  gif: 'https://static.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/37/ce/U1VVU1T8AVwmm2pj.gif',
  webp: 'https://static.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/37/ce/gOSCbkmb3OHG.webp',
  preview: 'https://static.klipy.com/ii/4493325008d34b7bf8cd6813cd5c1619/37/ce/1eru8gHOKqn99RFTrvJE.gif',
});

function formatKlipyItem(item) {
  if (!item) return null;
  const file = item.file || {};
  const gifUrl = file.hd?.gif?.url || file.md?.gif?.url || file.sm?.gif?.url || file.xs?.gif?.url;
  const webpUrl = file.hd?.webp?.url || file.md?.webp?.url || file.sm?.webp?.url || file.xs?.webp?.url;
  const previewUrl = file.sm?.webp?.url || file.xs?.webp?.url || file.sm?.gif?.url || gifUrl || webpUrl;
  const chosenUrl = gifUrl || webpUrl;
  if (!chosenUrl) return null;
  return {
    id: item.id || item.uuid,
    slug: item.slug,
    title: item.title || item.description || '',
    url: chosenUrl,
    gif: gifUrl,
    webp: webpUrl,
    preview: previewUrl,
    originalUrl: `https://klipy.com/gifs/${item.slug}`,
  };
}

function extractKlipySlug(urlOrSlug) {
  if (!urlOrSlug) return null;
  const str = String(urlOrSlug).trim();
  const m = /(?:https?:\/\/)?(?:www\.)?klipy\.com\/gifs\/([a-zA-Z0-9_-]+)/i.exec(str);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{3,80}$/.test(str) && str.includes('-')) return str;
  return null;
}

async function resolveKlipyGif(slug) {
  if (!slug) return null;
  if (klipyCache.has(slug)) return klipyCache.get(slug);

  try {
    const res = await fetch(`https://api.klipy.com/api/v1/${KLIPY_APP_KEY}/gifs/${encodeURIComponent(slug)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data) return null;

    const file = data.file || {};
    const gifUrl = file.hd?.gif?.url || file.md?.gif?.url || file.sm?.gif?.url || file.xs?.gif?.url;
    const webpUrl = file.hd?.webp?.url || file.md?.webp?.url || file.sm?.webp?.url;
    const mp4Url = file.hd?.mp4?.url || file.md?.mp4?.url || file.sm?.mp4?.url;
    const previewUrl = file.sm?.gif?.url || file.md?.gif?.url || gifUrl;

    const resolved = {
      slug: data.slug || slug,
      title: data.title || '',
      url: gifUrl || webpUrl || mp4Url,
      gif: gifUrl,
      webp: webpUrl,
      mp4: mp4Url,
      preview: previewUrl,
    };
    klipyCache.set(slug, resolved);
    return resolved;
  } catch (err) {
    return null;
  }
}

function formatMediaItem(m) {
  if (!m || typeof m !== 'object') return m;
  let type = m.type || 'image';
  let url = m.url || '';
  const slug = extractKlipySlug(url) || m.slug;
  if (slug || type === 'gif' || (typeof url === 'string' && url.includes('klipy.com'))) {
    type = 'gif';
    if (slug) {
      const cached = klipyCache.get(slug);
      url = cached?.url || m.resolvedUrl || (url.startsWith('http') && !url.includes('klipy.com/gifs/') ? url : `/api/klipy/media/${slug}`);
      return {
        ...m,
        type: 'gif',
        slug,
        originalUrl: m.originalUrl || m.url,
        url,
      };
    }
  }
  return m;
}

function serializePost(p, viewer) {
  const g = groupById(p.groupId);
  const author = userById(p.authorId);
  const isDel = !!p.deleted;
  return {
    id: p.id,
    groupId: p.groupId,
    group: g ? { slug: g.slug, name: g.name, isMember: memberOf(g, viewer), privacy: g.privacy } : null,
    author: isDel ? { id: p.authorId, displayName: 'Author', username: 'author', avatar: null } : publicUser(author),
    authorIsAdmin: !isDel && !!g && !!author && groupAdmin(g, author),
    text: isDel ? '' : p.text,
    deleted: isDel,
    deletedText: isDel ? 'This post was deleted by the author.' : null,
    media: isDel ? [] : (p.media || []).map(formatMediaItem),
    poll: isDel ? null : (p.poll
      ? {
          question: p.poll.question,
          options: p.poll.options.map((o) => ({
            id: o.id,
            text: o.text,
            votes: o.votes.length,
            mine: !!viewer && o.votes.includes(viewer.id),
          })),
          totalVotes: p.poll.options.reduce((n, o) => n + o.votes.length, 0),
        }
      : null),
    createdAt: p.createdAt,
    editedAt: isDel ? null : (p.editedAt || null),
    reactions: isDel ? {} : reactionSummary(p.reactions, viewer),
    commentCount: db().comments.filter((c) => c.postId === p.id && !c.deleted).length,
    pinned: !isDel && !!g && g.pinnedPostId === p.id,
    pinnedCommentId: isDel ? null : (p.pinnedCommentId || null),
    canEdit: !isDel && !!viewer && viewer.id === p.authorId,
    canDelete: !isDel && !!viewer && (viewer.id === p.authorId || (g && groupAdmin(g, viewer))),
    canPin: !isDel && !!g && groupAdmin(g, viewer),
  };
}

function serializeComment(c, viewer) {
  const p = db().posts.find((x) => x.id === c.postId);
  const g = groupById(c.groupId || (p && p.groupId));
  const isDel = !!c.deleted;
  return {
    id: c.id,
    groupId: g ? g.id : (c.groupId || null),
    postId: c.postId,
    parentId: c.parentId || null,
    author: isDel ? { id: c.authorId, displayName: 'Author', username: 'author', avatar: null } : publicUser(userById(c.authorId)),
    text: isDel ? '' : (c.text || ''),
    deleted: isDel,
    deletedText: isDel ? 'This comment was deleted by the author.' : null,
    media: isDel ? [] : (c.media || []).map(formatMediaItem),
    poll: isDel ? null : (c.poll
      ? {
          question: c.poll.question,
          options: c.poll.options.map((o) => ({
            id: o.id,
            text: o.text,
            votes: o.votes.length,
            mine: !!viewer && o.votes.includes(viewer.id),
          })),
          totalVotes: c.poll.options.reduce((n, o) => n + o.votes.length, 0),
        }
      : null),
    createdAt: c.createdAt,
    editedAt: isDel ? null : (c.editedAt || null),
    reactions: isDel ? {} : reactionSummary(c.reactions, viewer),
    pinned: !isDel && !!p && p.pinnedCommentId === c.id,
    canPin: !isDel && !!viewer && (!!p && viewer.id === p.authorId || isOwner(viewer) || (g && groupAdmin(g, viewer))),
    canPinAsPost: !isDel && !!viewer && (isOwner(viewer) || (g && groupAdmin(g, viewer))),
    canEdit: !isDel && !!viewer && (viewer.id === c.authorId || isOwner(viewer) || (g && groupAdmin(g, viewer))),
    canDelete: !isDel && !!viewer && (viewer.id === c.authorId || isOwner(viewer) || (g && groupAdmin(g, viewer))),
  };
}

function serializeCommentAsFeedPost(c, viewer) {
  const p = db().posts.find((x) => x.id === c.postId);
  const g = groupById(c.groupId || (p && p.groupId));
  const author = userById(c.authorId) || { id: c.authorId, displayName: 'Unknown', username: 'unknown' };
  const parentAuthor = (p && !p.deleted) ? userById(p.authorId) : null;
  const replies = db().comments.filter((x) => x.parentId === c.id && !x.deleted);
  const isDel = !!c.deleted;

  let replyToAuthor = null;
  if (c.parentId) {
    const parentComment = db().comments.find((x) => x.id === c.parentId);
    if (parentComment && !parentComment.deleted) {
      replyToAuthor = userById(parentComment.authorId);
    }
  }

  const parentSnippet = (!p || p.deleted) ? 'This post was deleted by the author.' : (p.text || '').replace(/\s+/g, ' ').slice(0, 100);

  return {
    id: c.id,
    isComment: true,
    postId: c.postId,
    parentId: c.parentId || null,
    groupId: g ? g.id : null,
    group: g ? { slug: g.slug, name: g.name, isMember: memberOf(g, viewer), privacy: g.privacy } : null,
    author: isDel ? { id: c.authorId, displayName: 'Author', username: 'author', avatar: null } : publicUser(author),
    authorIsAdmin: !isDel && !!g && !!author && groupAdmin(g, author),
    text: isDel ? '' : (c.text || ''),
    deleted: isDel,
    deletedText: isDel ? 'This comment was deleted by the author.' : null,
    media: isDel ? [] : (c.media || []).map(formatMediaItem),
    poll: isDel ? null : (c.poll
      ? {
          question: c.poll.question,
          options: c.poll.options.map((o) => ({
            id: o.id,
            text: o.text,
            votes: o.votes.length,
            mine: !!viewer && o.votes.includes(viewer.id),
          })),
          totalVotes: c.poll.options.reduce((n, o) => n + o.votes.length, 0),
        }
      : null),
    createdAt: c.createdAt,
    editedAt: isDel ? null : (c.editedAt || null),
    reactions: isDel ? {} : reactionSummary(c.reactions, viewer),
    commentCount: replies.length,
    pinned: !isDel && !!p && p.pinnedCommentId === c.id,
    pinnedCommentId: null,
    canEdit: !isDel && !!viewer && (viewer.id === c.authorId || isOwner(viewer) || (g && groupAdmin(g, viewer))),
    canDelete: !isDel && !!viewer && (viewer.id === c.authorId || isOwner(viewer) || (g && groupAdmin(g, viewer))),
    canPin: !isDel && !!viewer && (!!p && viewer.id === p.authorId || isOwner(viewer) || (g && groupAdmin(g, viewer))),
    canPinAsPost: !isDel && !!viewer && (isOwner(viewer) || (g && groupAdmin(g, viewer))),
    parentPost: {
      id: c.postId,
      snippet: parentSnippet,
      isDeleted: !p || !!p.deleted,
      author: parentAuthor ? publicUser(parentAuthor) : null,
    },
    replyToAuthor: replyToAuthor ? publicUser(replyToAuthor) : (parentAuthor ? publicUser(parentAuthor) : null),
  };
}

// ---------------------------------------------------------------- realtime (SSE)
const streams = new Map(); // userId -> Set<res>

function push(userId, event, data) {
  const set = streams.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(payload);
}

function notify(userId, actorId, type, text, link, meta = {}) {
  if (!userId || userId === actorId) return;
  const u = userById(userId);
  if (!u) return;
  const s = u.settings || {};
  let gid = meta.groupId;
  if (!gid && link) {
    const m = link.match(/\/group\/([^/?#]+)/);
    if (m) {
      const grp = db().groups.find((x) => x.slug === m[1] || x.id === m[1]);
      if (grp) gid = grp.id;
    }
  }
  if (gid && Array.isArray(s.mutedGroups) && s.mutedGroups.includes(gid)) {
    return; // Muted group notifications (Twitter Communities style)
  }
  const pref = {
    comment: 'notifyComments',
    reply: 'notifyReplies',
    reaction: 'notifyReactions',
    follow: 'notifyFollows',
    group: 'notifyGroups',
    post: 'notifyGroupPosts',
  }[type];
  if (pref && s[pref] === false) return;
  const n = { id: store.uid(), userId, actorId, type, text, link, read: false, createdAt: now(), groupId: gid || null };
  db().notifications.push(n);
  store.save();
  push(userId, 'notification', { ...n, actor: publicUser(userById(actorId)) });
}

app.get('/api/events', (req, res) => {
  const u = requireUserSoft(req, res);
  if (!u) return;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write(`event: hello\ndata: {}\n\n`);
  if (!streams.has(u.id)) streams.set(u.id, new Set());
  streams.get(u.id).add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    const set = streams.get(u.id);
    if (set) {
      set.delete(res);
      if (!set.size) streams.delete(u.id);
    }
  });
});

function requireUserSoft(req, res) {
  if (!req.user) {
    res.status(401).json({ error: 'Not logged in' });
    return null;
  }
  return req.user;
}

// ---------------------------------------------------------------- auth
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/i;

app.get('/api/me', (req, res) => res.json({ user: selfUser(req.user), site: db().site }));

app.post(
  '/api/auth/signup',
  wrap((req, res) => {
    const email = cleanText(req.body.email, 200).trim().toLowerCase();
    const password = String(req.body.password || '');
    let username = cleanText(req.body.username, 30).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Enter a valid email address.');
    if (password.length < 6) fail(400, 'Password must be at least 6 characters.');
    if (!username) username = email.split('@')[0].replace(/[^a-z0-9._-]/gi, '');
    if (!USERNAME_RE.test(username)) fail(400, 'Username must be 3-30 letters, numbers, dots, dashes or underscores.');
    if (db().users.some((u) => u.email === email)) fail(409, 'An account with this email already exists.');
    if (userByName(username)) fail(409, 'This username is taken.');
    const { salt, hash } = store.hashPassword(password);
    const u = {
      id: store.uid(),
      username,
      displayName: cleanText(req.body.displayName, 60).trim() || username,
      email,
      salt,
      passHash: hash,
      avatar: '',
      cover: '',
      bio: '',
      role: 'member',
      createdAt: now(),
      settings: { privacy: 'public', notifyComments: true, notifyReactions: true, notifyFollows: true, notifyGroups: true },
    };
    db().users.push(u);
    store.save();
    setSession(res, u.id);
    res.json({ user: selfUser(u) });
  })
);

app.post(
  '/api/auth/login',
  wrap((req, res) => {
    const login = cleanText(req.body.login, 200).trim().toLowerCase();
    const u = db().users.find((x) => x.email === login || x.username.toLowerCase() === login);
    if (!u || !store.verifyPassword(req.body.password || '', u)) fail(401, 'Wrong email or password.');
    setSession(res, u.id);
    res.json({ user: selfUser(u) });
  })
);

app.post('/api/auth/logout', (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- account
app.patch(
  '/api/me',
  wrap((req, res) => {
    const u = requireUser(req);
    const b = req.body;
    if (b.username !== undefined && b.username !== u.username) {
      if (!USERNAME_RE.test(b.username)) fail(400, 'Username must be 3-30 letters, numbers, dots, dashes or underscores.');
      const other = userByName(b.username);
      if (other && other.id !== u.id) fail(409, 'This username is taken.');
      u.username = b.username;
    }
    if (b.email !== undefined && b.email !== u.email) {
      const email = String(b.email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, 'Enter a valid email address.');
      if (db().users.some((x) => x.email === email && x.id !== u.id)) fail(409, 'Email already in use.');
      u.email = email;
    }
    if (b.displayName !== undefined) u.displayName = cleanText(b.displayName, 60).trim() || u.username;
    if (b.bio !== undefined) u.bio = cleanText(b.bio, 1000);
    if (b.avatar !== undefined) u.avatar = cleanText(b.avatar, 500);
    if (b.cover !== undefined) u.cover = cleanText(b.cover, 500);
    if (b.settings && typeof b.settings === 'object') {
      u.settings = u.settings || {};
      for (const k of ['notifyComments', 'notifyReplies', 'notifyReactions', 'notifyFollows', 'notifyGroups', 'notifyGroupPosts']) {
        if (k in b.settings) u.settings[k] = !!b.settings[k];
      }
      if (Array.isArray(b.settings.mutedGroups)) {
        u.settings.mutedGroups = b.settings.mutedGroups.map(String);
      }
      if (b.settings.privacy === 'public' || b.settings.privacy === 'private') u.settings.privacy = b.settings.privacy;
    }
    store.save();
    res.json({ user: selfUser(u) });
  })
);

app.post(
  '/api/me/password',
  wrap((req, res) => {
    const u = requireUser(req);
    if (!store.verifyPassword(req.body.current || '', u)) fail(400, 'Current password is incorrect.');
    if (String(req.body.next || '').length < 6) fail(400, 'New password must be at least 6 characters.');
    const { salt, hash } = store.hashPassword(req.body.next);
    u.salt = salt;
    u.passHash = hash;
    store.save();
    res.json({ ok: true });
  })
);

app.delete(
  '/api/me',
  wrap((req, res) => {
    const u = requireUser(req);
    if (isOwner(u) && db().users.filter(isOwner).length === 1) fail(400, 'The site owner account cannot be deleted.');
    if (!store.verifyPassword(req.body.password || '', u)) fail(400, 'Password is incorrect.');
    const d = db();
    d.users = d.users.filter((x) => x.id !== u.id);
    d.groups.forEach((g) => {
      g.members = g.members.filter((m) => m.userId !== u.id);
      g.requests = (g.requests || []).filter((r) => r.userId !== u.id);
    });
    d.follows = d.follows.filter((f) => f.follower !== u.id && f.following !== u.id);
    d.notifications = d.notifications.filter((n) => n.userId !== u.id);
    for (const t of Object.keys(d.sessions)) if (d.sessions[t].userId === u.id) delete d.sessions[t];
    store.save();
    clearSession(req, res);
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- uploads
const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'text/plain': 'txt',
};

app.post(
  '/api/upload',
  wrap((req, res) => {
    requireUser(req);
    const m = /^data:([\w.+/-]+);base64,(.+)$/s.exec(String(req.body.dataUrl || ''));
    if (!m) fail(400, 'Invalid upload.');
    const mime = m[1];
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 20 * 1024 * 1024) fail(413, 'File is too large (max 20 MB).');
    const origExt = path.extname(String(req.body.name || '')).slice(1).toLowerCase().replace(/[^a-z0-9]/g, '');
    const ext = MIME_EXT[mime] || origExt || 'bin';
    const file = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
    const type = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';
    res.json({ url: `/uploads/${file}`, type, size: buf.length, mime });
  })
);

// ---------------------------------------------------------------- groups
app.get(
  '/api/groups',
  wrap((req, res) => {
    const u = req.user;
    const q = String(req.query.q || '').toLowerCase();
    const sort = String(req.query.sort || 'activity');
    const category = String(req.query.category || '').toLowerCase();
    let list = db().groups.filter((g) => canViewGroup(g, u));
    if (category && category !== 'all') {
      list = list.filter((g) => (g.category || 'General').toLowerCase() === category);
    }
    if (q) list = list.filter((g) => g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q));
    const sorters = {
      activity: (a, b) => (b.lastActivity || b.createdAt).localeCompare(a.lastActivity || a.createdAt),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      name: (a, b) => a.name.localeCompare(b.name),
      members: (a, b) => b.members.length - a.members.length,
    };
    list.sort(sorters[sort] || sorters.activity);
    const allCategories = Array.from(new Set(db().groups.filter((g) => canViewGroup(g, u)).map((g) => g.category || 'General'))).sort();
    res.json({
      groups: list.map((g) => serializeGroup(g, u)),
      canCreate: !!u,
      categories: allCategories,
    });
  })
);

app.post(
  '/api/groups',
  wrap((req, res) => {
    const u = requireUser(req);
    const name = cleanText(req.body.name, 80).trim();
    if (!name) fail(400, 'Give your group a name.');
    const priv = ['public', 'private', 'hidden'].includes(req.body.privacy) ? req.body.privacy : 'public';
    const g = {
      id: store.uid(),
      slug: slugify(name),
      name,
      category: cleanText(req.body.category, 50).trim() || 'General',
      description: cleanText(req.body.description, 2000).trim() || 'Welcome to the group! You can connect with other members, get updates and share videos.',
      cover: cleanText(req.body.cover, 500),
      privacy: priv,
      visible: priv !== 'hidden',
      hasFiles: !!req.body.hasFiles,
      createdAt: now(),
      createdBy: u.id,
      members: [{ userId: u.id, role: 'admin', joinedAt: now() }],
      requests: [],
      pinnedPostId: null,
      lastActivity: now(),
    };
    db().groups.push(g);
    const welcome = {
      id: store.uid(),
      groupId: g.id,
      authorId: u.id,
      text: `Welcome to our group **${name}**! A space for us to connect and share with each other. Start by posting your thoughts, sharing media, or creating a poll.`,
      media: [],
      poll: null,
      createdAt: now(),
      reactions: {},
    };
    db().posts.push(welcome);
    store.save();
    res.json({ group: serializeGroup(g, u) });
  })
);

function loadGroup(req, { posts = false } = {}) {
  const g = groupBySlug(req.params.slug);
  if (!g || !canViewGroup(g, req.user)) fail(404, 'Group not found.');
  if (posts && !canViewPosts(g, req.user)) fail(403, 'This group is private. Join to see its content.');
  return g;
}

app.get(
  '/api/groups/:slug',
  wrap((req, res) => {
    const g = loadGroup(req);
    const since = Date.now() - 30 * 24 * 3600 * 1000;
    const stats = {
      newPosts: db().posts.filter((p) => p.groupId === g.id && Date.parse(p.createdAt) > since).length,
      newMembers: g.members.filter((m) => Date.parse(m.joinedAt) > since).length,
    };
    res.json({ group: serializeGroup(g, req.user), stats });
  })
);

app.patch(
  '/api/groups/:slug',
  wrap((req, res) => {
    const g = loadGroup(req);
    if (!groupAdmin(g, req.user)) fail(403, 'Only group admins can edit this group.');
    const b = req.body;
    if (b.name !== undefined) {
      const name = cleanText(b.name, 80).trim();
      if (!name) fail(400, 'Group name cannot be empty.');
      g.name = name;
    }
    if (b.category !== undefined) g.category = cleanText(b.category, 50).trim() || 'General';
    if (b.description !== undefined) g.description = cleanText(b.description, 2000);
    if (b.cover !== undefined) g.cover = cleanText(b.cover, 500);
    if (['public', 'private', 'hidden'].includes(b.privacy)) {
      g.privacy = b.privacy;
      g.visible = b.privacy !== 'hidden';
    }
    if (b.visible !== undefined && b.privacy !== 'hidden') g.visible = !!b.visible;
    if (b.hasFiles !== undefined) g.hasFiles = !!b.hasFiles;
    if (g.privacy === 'public' && g.requests && g.requests.length) {
      g.requests.forEach((r) => g.members.push({ userId: r.userId, role: 'member', joinedAt: now() }));
      g.requests = [];
    }
    store.save();
    res.json({ group: serializeGroup(g, req.user) });
  })
);

app.delete(
  '/api/groups/:slug',
  wrap((req, res) => {
    const g = loadGroup(req);
    if (!groupAdmin(g, req.user)) fail(403, 'Only group admins can delete this group.');
    const d = db();
    const postIds = new Set(d.posts.filter((p) => p.groupId === g.id).map((p) => p.id));
    d.comments = d.comments.filter((c) => !postIds.has(c.postId));
    d.posts = d.posts.filter((p) => p.groupId !== g.id);
    d.files = d.files.filter((f) => f.groupId !== g.id);
    d.groups = d.groups.filter((x) => x.id !== g.id);
    store.save();
    res.json({ ok: true });
  })
);

app.post(
  '/api/groups/:slug/join',
  wrap((req, res) => {
    const u = requireUser(req);
    const g = loadGroup(req);
    if (!memberOf(g, u)) {
      if (g.privacy === 'private' && !isOwner(u)) {
        g.requests = g.requests || [];
        if (!g.requests.some((r) => r.userId === u.id)) {
          g.requests.push({ userId: u.id, requestedAt: now() });
          g.members
            .filter((m) => m.role === 'admin')
            .forEach((m) => notify(m.userId, u.id, 'group', `requested to join ${g.name}`, `/group/${g.slug}/members`));
        }
      } else {
        g.members.push({ userId: u.id, role: 'member', joinedAt: now() });
        g.lastActivity = now();
        g.members
          .filter((m) => m.role === 'admin')
          .forEach((m) => notify(m.userId, u.id, 'group', `joined ${g.name}`, `/group/${g.slug}/members`));
      }
      store.save();
    }
    res.json({ group: serializeGroup(g, u) });
  })
);

app.post(
  '/api/groups/:slug/leave',
  wrap((req, res) => {
    const u = requireUser(req);
    const g = loadGroup(req);
    const admins = g.members.filter((m) => m.role === 'admin');
    if (admins.length === 1 && admins[0].userId === u.id && g.members.length > 1)
      fail(400, 'Make another member an admin before leaving.');
    g.members = g.members.filter((m) => m.userId !== u.id);
    g.requests = (g.requests || []).filter((r) => r.userId !== u.id);
    store.save();
    res.json({ group: serializeGroup(g, u) });
  })
);

app.post(
  '/api/groups/:slug/mute',
  wrap((req, res) => {
    const u = requireUser(req);
    const g = loadGroup(req);
    u.settings = u.settings || {};
    u.settings.mutedGroups = Array.isArray(u.settings.mutedGroups) ? u.settings.mutedGroups : [];
    const idx = u.settings.mutedGroups.indexOf(g.id);
    let muted = false;
    if (idx >= 0) {
      u.settings.mutedGroups.splice(idx, 1);
      muted = false;
    } else {
      u.settings.mutedGroups.push(g.id);
      muted = true;
    }
    store.save();
    res.json({ muted, isMuted: muted, group: serializeGroup(g, u), user: selfUser(u) });
  })
);

app.get(
  '/api/groups/:slug/members',
  wrap((req, res) => {
    const g = loadGroup(req);
    const q = String(req.query.q || '').toLowerCase();
    let members = g.members
      .map((m) => ({ ...publicUser(userById(m.userId), req.user), groupRole: m.role, joinedAt: m.joinedAt }))
      .filter((m) => m.id);
    if (q) members = members.filter((m) => m.displayName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q));
    members.sort((a, b) => (a.groupRole === b.groupRole ? a.joinedAt.localeCompare(b.joinedAt) : a.groupRole === 'admin' ? -1 : 1));
    const requests = groupAdmin(g, req.user)
      ? (g.requests || []).map((r) => ({ ...publicUser(userById(r.userId)), requestedAt: r.requestedAt })).filter((r) => r.id)
      : [];
    res.json({ members, requests });
  })
);

app.post(
  '/api/groups/:slug/members/:userId',
  wrap((req, res) => {
    const g = loadGroup(req);
    if (!groupAdmin(g, req.user)) fail(403, 'Only group admins can manage members.');
    const { action } = req.body;
    const target = userById(req.params.userId) || fail(404, 'Member not found.');
    const m = g.members.find((x) => x.userId === target.id);
    if (action === 'approve' || action === 'decline') {
      g.requests = (g.requests || []).filter((r) => r.userId !== target.id);
      if (action === 'approve' && !m) {
        g.members.push({ userId: target.id, role: 'member', joinedAt: now() });
        notify(target.id, req.user.id, 'group', `approved your request to join ${g.name}`, `/group/${g.slug}`);
      }
    } else if (!m) {
      fail(404, 'Not a member of this group.');
    } else if (action === 'makeAdmin') {
      m.role = 'admin';
      notify(target.id, req.user.id, 'group', `made you an admin of ${g.name}`, `/group/${g.slug}`);
    } else if (action === 'removeAdmin') {
      if (g.members.filter((x) => x.role === 'admin').length === 1) fail(400, 'A group needs at least one admin.');
      m.role = 'member';
    } else if (action === 'remove') {
      if (m.role === 'admin' && g.members.filter((x) => x.role === 'admin').length === 1) fail(400, 'A group needs at least one admin.');
      g.members = g.members.filter((x) => x.userId !== target.id);
    } else fail(400, 'Unknown action.');
    store.save();
    res.json({ ok: true });
  })
);

app.get(
  '/api/groups/:slug/media',
  wrap((req, res) => {
    const g = loadGroup(req, { posts: true });
    const media = db()
      .posts.filter((p) => p.groupId === g.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .flatMap((p) =>
        (p.media || [])
          .filter((m) => m.type === 'image' || m.type === 'video' || m.type === 'gif')
          .map((m) => ({ ...formatMediaItem(m), postId: p.id }))
      );
    res.json({ media });
  })
);

app.get(
  '/api/groups/:slug/files',
  wrap((req, res) => {
    const g = loadGroup(req, { posts: true });
    const files = db()
      .files.filter((f) => f.groupId === g.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((f) => ({
        ...f,
        uploader: publicUser(userById(f.uploaderId)),
        canDelete: !!req.user && (req.user.id === f.uploaderId || groupAdmin(g, req.user)),
      }));
    res.json({ files });
  })
);

app.post(
  '/api/groups/:slug/files',
  wrap((req, res) => {
    const u = requireUser(req);
    const g = loadGroup(req, { posts: true });
    if (!memberOf(g, u) && !isOwner(u)) fail(403, 'Join the group to upload files.');
    const f = {
      id: store.uid(),
      groupId: g.id,
      uploaderId: u.id,
      name: cleanText(req.body.name, 200) || 'file',
      url: cleanText(req.body.url, 500),
      size: Number(req.body.size) || 0,
      createdAt: now(),
    };
    if (!f.url.startsWith('/uploads/')) fail(400, 'Invalid file.');
    db().files.push(f);
    g.lastActivity = now();
    store.save();
    res.json({ file: f });
  })
);

app.delete(
  '/api/groups/:slug/files/:id',
  wrap((req, res) => {
    const u = requireUser(req);
    const g = loadGroup(req);
    const f = db().files.find((x) => x.id === req.params.id && x.groupId === g.id) || fail(404, 'File not found.');
    if (f.uploaderId !== u.id && !groupAdmin(g, u)) fail(403, 'Not allowed.');
    db().files = db().files.filter((x) => x.id !== f.id);
    store.save();
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- posts
function visiblePosts(viewer) {
  const ok = new Set(db().groups.filter((g) => canViewGroup(g, viewer) && canViewPosts(g, viewer)).map((g) => g.id));
  return db().posts.filter((p) => ok.has(p.groupId) && !p.deleted);
}

function visibleComments(viewer) {
  const ok = new Set(db().groups.filter((g) => canViewGroup(g, viewer) && canViewPosts(g, viewer)).map((g) => g.id));
  const postMap = new Map(db().posts.map((p) => [p.id, p]));
  return db().comments.filter((c) => {
    if (c.deleted) return false;
    const p = postMap.get(c.postId);
    const gid = c.groupId || (p && p.groupId);
    return gid && ok.has(gid);
  });
}

app.get(
  '/api/feed',
  wrap((req, res) => {
    const u = req.user;
    let posts = visiblePosts(u).map((p) => ({ ...p, _kind: 'post' }));
    let comments = visibleComments(u).map((c) => ({ ...c, _kind: 'comment' }));
    let combined = [...posts, ...comments];

    if (req.query.mine === '1' && u) {
      const mine = new Set(db().groups.filter((g) => memberOf(g, u)).map((g) => g.id));
      combined = combined.filter((item) => {
        if (item._kind === 'post') return mine.has(item.groupId);
        const p = db().posts.find((x) => x.id === item.postId);
        const gid = item.groupId || (p && p.groupId);
        return gid && mine.has(gid);
      });
    } else if (req.query.suggested === '1') {
      const mine = u ? new Set(db().groups.filter((g) => memberOf(g, u)).map((g) => g.id)) : new Set();
      combined = combined.filter((item) => {
        if (item._kind === 'post') return !mine.has(item.groupId);
        const p = db().posts.find((x) => x.id === item.postId);
        const gid = item.groupId || (p && p.groupId);
        return gid && !mine.has(gid);
      });
    }
    if (req.query.author) {
      const a = userByName(req.query.author);
      combined = a ? combined.filter((item) => item.authorId === a.id) : [];
    } else if (u && Array.isArray(u.settings?.mutedGroups) && u.settings.mutedGroups.length) {
      // Twitter Communities parity: muted communities' posts don't appear in the Home timeline
      const muted = new Set(u.settings.mutedGroups);
      combined = combined.filter((item) => {
        const gid = item.groupId || (db().posts.find((x) => x.id === item.postId)?.groupId);
        return !gid || !muted.has(gid);
      });
    }
    combined.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = combined.slice(0, 100).map((item) => {
      if (item._kind === 'post') return serializePost(item, u);
      return serializeCommentAsFeedPost(item, u);
    });
    res.json({ posts: items });
  })
);

app.get(
  '/api/groups/:slug/posts',
  wrap((req, res) => {
    const g = loadGroup(req, { posts: true });
    const q = String(req.query.q || '').toLowerCase();
    let posts = db().posts.filter((p) => p.groupId === g.id && !p.deleted);
    if (q) posts = posts.filter((p) => p.text.toLowerCase().includes(q));
    posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ posts: posts.map((p) => serializePost(p, req.user)) });
  })
);

app.get(
  '/api/klipy/search',
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ ok: true, gifs: [] });
    }

    try {
      const url = `https://api.klipy.com/api/v1/${KLIPY_APP_KEY}/gifs/search?q=${encodeURIComponent(q)}&per_page=24&content_filter=medium`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (response.ok) {
        const json = await response.json();
        const rawList = json?.data?.data || json?.data || [];
        const gifs = rawList.map(formatKlipyItem).filter(Boolean);
        gifs.forEach((g) => {
          if (g.slug) klipyCache.set(g.slug, g);
        });
        return res.json({ ok: true, gifs });
      }
    } catch (err) {}

    res.json({ ok: true, gifs: [] });
  })
);

app.get(
  '/api/klipy/trending',
  wrap(async (req, res) => {
    try {
      const url = `https://api.klipy.com/api/v1/${KLIPY_APP_KEY}/gifs/trending?per_page=24&content_filter=medium`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (response.ok) {
        const json = await response.json();
        const rawList = json?.data?.data || json?.data || [];
        const gifs = rawList.map(formatKlipyItem).filter(Boolean);
        gifs.forEach((g) => {
          if (g.slug) klipyCache.set(g.slug, g);
        });
        return res.json({ ok: true, gifs });
      }
    } catch (err) {}

    res.json({ ok: true, gifs: [] });
  })
);

app.get(
  '/api/klipy/resolve',
  wrap(async (req, res) => {
    const raw = String(req.query.url || req.query.slug || '').trim();
    const slug = extractKlipySlug(raw);
    if (!slug) {
      if (/^https?:\/\/.+\.(?:gif|webp|png|jpe?g|mp4)(?:\?.*)?$/i.test(raw) || raw.includes('static.klipy.com')) {
        return res.json({ ok: true, url: raw, title: 'GIF' });
      }
      return res.status(400).json({ ok: false, error: 'Please enter a valid KLIPY link (e.g. https://klipy.com/gifs/steve-minecraft-steve-2) or direct image URL.' });
    }

    const resolved = await resolveKlipyGif(slug);
    if (resolved && resolved.url) {
      return res.json({ ok: true, ...resolved });
    }
    // Return proxy fallback
    res.json({
      ok: true,
      slug,
      url: `/api/klipy/media/${slug}`,
      preview: `/api/klipy/media/${slug}`,
      title: slug.replace(/-/g, ' '),
    });
  })
);

app.get(
  '/api/klipy/media/:slug',
  wrap(async (req, res) => {
    const slug = req.params.slug;
    const resolved = await resolveKlipyGif(slug);
    if (resolved && resolved.url) {
      return res.redirect(302, resolved.url);
    }
    res.status(404).send('GIF not found');
  })
);

async function sanitizeMedia(media) {
  const list = Array.isArray(media) ? media : [];
  const out = [];
  for (const m of list.slice(0, 10)) {
    if (!m || typeof m.url !== 'string') continue;
    let type = ['image', 'video', 'audio', 'youtube', 'gif'].includes(m.type) ? m.type : 'image';
    let url = m.url;
    let extra = {};

    const slug = extractKlipySlug(url) || (m.slug ? extractKlipySlug(m.slug) : null);
    if (slug || type === 'gif' || (typeof url === 'string' && url.includes('klipy.com'))) {
      type = 'gif';
      if (slug) {
        extra.slug = slug;
        extra.originalUrl = url;
        const resolved = await resolveKlipyGif(slug);
        if (resolved && resolved.url) {
          url = resolved.url;
          extra.resolvedUrl = resolved.url;
          extra.title = resolved.title;
        } else {
          url = `/api/klipy/media/${slug}`;
        }
      }
    } else if (type === 'youtube') {
      extra.youtubeId = m.youtubeId || extractYouTubeId(url);
    }
    out.push({ type, url, ...extra });
  }
  return out;
}

function extractYouTubeId(url) {
  const m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i.exec(url);
  return m ? m[1] : '';
}

function sanitizePoll(poll) {
  if (!poll || !Array.isArray(poll.options)) return null;
  const options = poll.options.map((t) => cleanText(t, 200).trim()).filter(Boolean).slice(0, 10);
  if (options.length < 2) fail(400, 'A poll needs at least two options.');
  return {
    question: cleanText(poll.question, 300).trim(),
    options: options.map((text) => ({ id: store.uid(), text, votes: [] })),
  };
}

app.post(
  '/api/groups/:slug/posts',
  wrap(async (req, res) => {
    const u = requireUser(req);
    const g = loadGroup(req, { posts: true });
    if (!memberOf(g, u) && !isOwner(u)) {
      if (g.privacy === 'public') {
        g.members.push({ userId: u.id, role: 'member', joinedAt: now() });
        g.lastActivity = now();
      } else {
        fail(403, 'Join the group to post.');
      }
    }
    const text = cleanText(req.body.text, 10000).trim();
    let media = await sanitizeMedia(req.body.media);
    const poll = sanitizePoll(req.body.poll);

    // Auto-detect KLIPY GIF or YouTube link if media is empty
    if (!media.length && text) {
      const klipySlug = extractKlipySlug(text);
      if (klipySlug) {
        const resolved = await resolveKlipyGif(klipySlug);
        media.push({
          type: 'gif',
          url: resolved?.url || `/api/klipy/media/${klipySlug}`,
          slug: klipySlug,
          originalUrl: text.match(/(?:https?:\/\/)?(?:www\.)?klipy\.com\/gifs\/[a-zA-Z0-9_-]+/i)?.[0] || text,
          title: resolved?.title || '',
        });
      } else {
        const ytId = extractYouTubeId(text);
        if (ytId) {
          media.push({
            type: 'youtube',
            url: text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]+/i)?.[0] || text,
            youtubeId: ytId,
          });
        }
      }
    }

    if (!text && !media.length && !poll) fail(400, 'Write something before posting.');
    const p = { id: store.uid(), groupId: g.id, authorId: u.id, text, media, poll, createdAt: now(), reactions: {} };
    db().posts.push(p);
    g.lastActivity = p.createdAt;
    (g.members || []).forEach((m) => {
      if (m.userId !== u.id) {
        notify(m.userId, u.id, 'post', `posted in ${g.name}`, `/group/${g.slug}/discussion/${p.id}`, { groupId: g.id });
      }
    });
    store.save();
    res.json({ post: serializePost(p, u) });
  })
);

function loadPostOrComment(req) {
  const p = db().posts.find((x) => x.id === req.params.id);
  if (p) {
    const g = groupById(p.groupId);
    if (!g || !canViewGroup(g, req.user) || !canViewPosts(g, req.user)) fail(404, 'Post not found.');
    return { item: p, post: p, group: g, isComment: false };
  }
  const c = db().comments.find((x) => x.id === req.params.id);
  if (c) {
    const parentP = db().posts.find((x) => x.id === c.postId);
    const g = parentP && groupById(parentP.groupId);
    if (!g || !canViewGroup(g, req.user) || !canViewPosts(g, req.user)) fail(404, 'Comment not found.');
    return { item: c, comment: c, post: parentP, group: g, isComment: true };
  }
  fail(404, 'Not found.');
}

function loadPost(req) {
  const { post, group } = loadPostOrComment(req);
  return { p: post, g: group };
}

app.get(
  '/api/posts/:id',
  wrap((req, res) => {
    const { isComment, item, post, group } = loadPostOrComment(req);
    if (isComment) {
      return res.json({ post: serializeCommentAsFeedPost(item, req.user), group: serializeGroup(group, req.user) });
    }
    res.json({ post: serializePost(post, req.user), group: serializeGroup(group, req.user) });
  })
);

app.patch(
  '/api/posts/:id',
  wrap(async (req, res) => {
    const u = requireUser(req);
    const { isComment, item, post, group } = loadPostOrComment(req);
    if (item.authorId !== u.id && !groupAdmin(group, u) && !isOwner(u)) {
      fail(403, 'You can only edit your own content.');
    }
    if (req.body.text !== undefined) item.text = cleanText(req.body.text, 10000).trim();
    if (req.body.media !== undefined) {
      item.media = await sanitizeMedia(req.body.media);
      if (!item.media.length && item.text) {
        const klipySlug = extractKlipySlug(item.text);
        if (klipySlug) {
          const resolved = await resolveKlipyGif(klipySlug);
          item.media.push({
            type: 'gif',
            url: resolved?.url || `/api/klipy/media/${klipySlug}`,
            slug: klipySlug,
            originalUrl: item.text.match(/(?:https?:\/\/)?(?:www\.)?klipy\.com\/gifs\/[a-zA-Z0-9_-]+/i)?.[0] || item.text,
            title: resolved?.title || '',
          });
        }
      }
    }
    if (req.body.poll !== undefined) {
      item.poll = req.body.poll ? sanitizePoll(req.body.poll) : null;
    }
    if (!item.text && !(item.media && item.media.length) && !item.poll) {
      fail(400, 'Write something or attach media before saving.');
    }
    item.editedAt = now();
    store.save();
    if (isComment) {
      return res.json({ post: serializeCommentAsFeedPost(item, u), comment: serializeComment(item, u) });
    }
    res.json({ post: serializePost(item, u) });
  })
);

app.delete(
  '/api/posts/:id',
  wrap((req, res) => {
    const u = requireUser(req);
    const { isComment, item, post, group } = loadPostOrComment(req);
    if (item.authorId !== u.id && !groupAdmin(group, u) && !isOwner(u)) fail(403, 'Not allowed.');
    if (isComment) {
      if (post && post.pinnedCommentId === item.id) post.pinnedCommentId = null;
      const hasReplies = db().comments.some((x) => x.parentId === item.id && !x.deleted);
      if (hasReplies) {
        item.deleted = true;
        item.deletedAt = now();
        item.text = '';
        item.media = [];
        item.poll = null;
        item.reactions = {};
        store.save();
        return res.json({ ok: true, deleted: true, post: serializeCommentAsFeedPost(item, u), comment: serializeComment(item, u) });
      }
      db().comments = db().comments.filter((x) => x.id !== item.id);
      store.save();
      return res.json({ ok: true, deleted: false });
    } else {
      if (group.pinnedPostId === item.id) group.pinnedPostId = null;
      // Comments stay! Do NOT delete comments when deleting a post (like Twitter)
      const hasComments = db().comments.some((c) => c.postId === item.id && !c.deleted);
      if (hasComments) {
        item.deleted = true;
        item.deletedAt = now();
        item.text = '';
        item.media = [];
        item.poll = null;
        item.reactions = {};
        store.save();
        return res.json({ ok: true, deleted: true, post: serializePost(item, u) });
      } else {
        db().posts = db().posts.filter((x) => x.id !== item.id);
        store.save();
        return res.json({ ok: true, deleted: false });
      }
    }
  })
);

app.post(
  '/api/posts/:id/pin',
  wrap((req, res) => {
    const u = requireUser(req);
    const { isComment, item, post, group } = loadPostOrComment(req);
    if (isComment) {
      if (post.authorId !== u.id && !isOwner(u) && !groupAdmin(group, u)) {
        fail(403, 'Only the post author or group admins can pin comments.');
      }
      post.pinnedCommentId = post.pinnedCommentId === item.id ? null : item.id;
      store.save();
      return res.json({ post: serializeCommentAsFeedPost(item, u), comment: serializeComment(item, u), pinned: post.pinnedCommentId === item.id });
    }
    if (!groupAdmin(group, u)) fail(403, 'Only group admins can pin posts.');
    group.pinnedPostId = group.pinnedPostId === item.id ? null : item.id;
    store.save();
    res.json({ post: serializePost(item, u) });
  })
);

function toggleReaction(target, user, emoji) {
  if (!emoji || typeof emoji !== 'string') {
    fail(400, 'Invalid reaction.');
  }
  const cleanEmoji = emoji.trim();
  if (!cleanEmoji || cleanEmoji.length > 50) fail(400, 'Invalid reaction.');

  target.reactions = target.reactions || {};
  target.reactions[cleanEmoji] = target.reactions[cleanEmoji] || [];

  const had = target.reactions[cleanEmoji].includes(user.id);
  if (had) {
    // Remove this reaction
    target.reactions[cleanEmoji] = target.reactions[cleanEmoji].filter((id) => id !== user.id);
    if (!target.reactions[cleanEmoji].length) delete target.reactions[cleanEmoji];
    return false;
  } else {
    // Add this reaction (preserves all other reactions, so you can like + add emojis at the same time)
    target.reactions[cleanEmoji].push(user.id);
    return true;
  }
}

app.post(
  '/api/posts/:id/react',
  wrap((req, res) => {
    const u = requireUser(req);
    const { isComment, item, post, group } = loadPostOrComment(req);
    const added = toggleReaction(item, u, req.body.emoji);
    if (added) {
      const link = `/group/${group.slug}/discussion/${post.id}`;
      notify(item.authorId, u.id, 'reaction', `reacted ${req.body.emoji} to your ${isComment ? 'comment' : 'post'} in ${group.name}`, link);
    }
    store.save();
    if (isComment) {
      return res.json({ post: serializeCommentAsFeedPost(item, u), comment: serializeComment(item, u) });
    }
    res.json({ post: serializePost(item, u) });
  })
);

app.post(
  '/api/posts/:id/vote',
  wrap((req, res) => {
    const u = requireUser(req);
    const { isComment, item, post, group } = loadPostOrComment(req);
    if (!item.poll) fail(400, 'This has no poll.');
    if (!memberOf(group, u) && !isOwner(u)) fail(403, 'Join the group to vote.');
    const opt = item.poll.options.find((o) => o.id === req.body.optionId) || fail(404, 'Option not found.');
    const had = opt.votes.includes(u.id);
    item.poll.options.forEach((o) => (o.votes = o.votes.filter((id) => id !== u.id)));
    if (!had) opt.votes.push(u.id);
    store.save();
    if (isComment) {
      return res.json({ post: serializeCommentAsFeedPost(item, u), comment: serializeComment(item, u) });
    }
    res.json({ post: serializePost(item, u) });
  })
);

// ---------------------------------------------------------------- comments
app.get(
  '/api/posts/:id/comments',
  wrap((req, res) => {
    const { isComment, item, post, group } = loadPostOrComment(req);
    if (isComment) {
      const replies = db()
        .comments.filter((c) => c.parentId === item.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((c) => serializeComment(c, req.user));
      return res.json({ comments: replies, allComments: replies, totalCount: replies.length });
    }
    const all = db()
      .comments.filter((c) => c.postId === post.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => serializeComment(c, req.user));

    // Nest into threads: top-level comments contain their replies array
    let topLevel = all.filter((c) => !c.parentId);
    topLevel.forEach((parent) => {
      parent.replies = all.filter((c) => c.parentId === parent.id);
    });

    if (post.pinnedCommentId) {
      const pinned = topLevel.find((c) => c.id === post.pinnedCommentId);
      if (pinned) {
        topLevel = [pinned, ...topLevel.filter((c) => c.id !== post.pinnedCommentId)];
      }
    }

    res.json({ comments: topLevel, allComments: all, totalCount: all.length, pinnedCommentId: post.pinnedCommentId || null });
  })
);

app.post(
  '/api/posts/:id/comments',
  wrap(async (req, res) => {
    const u = requireUser(req);
    const { isComment, item, post, group } = loadPostOrComment(req);
    if (!memberOf(group, u) && !isOwner(u)) {
      if (group.privacy === 'public') {
        group.members.push({ userId: u.id, role: 'member', joinedAt: now() });
        group.lastActivity = now();
      } else {
        fail(403, 'Join the group to comment.');
      }
    }
    const text = cleanText(req.body.text, 5000).trim();
    let media = await sanitizeMedia(req.body.media);
    const poll = sanitizePoll(req.body.poll);
    const parentId = isComment ? item.id : (req.body.parentId || null);
    if (!text && !media.length && !poll) fail(400, 'Write a comment, attach media, or add a poll first.');

    const c = {
      id: store.uid(),
      groupId: group.id,
      postId: post.id,
      parentId,
      authorId: u.id,
      text,
      media,
      poll,
      createdAt: now(),
      reactions: {},
    };
    db().comments.push(c);
    group.lastActivity = c.createdAt;

    if (parentId) {
      const parentComment = db().comments.find((x) => x.id === parentId);
      if (parentComment && parentComment.authorId !== u.id) {
        notify(parentComment.authorId, u.id, 'reply', `replied to your comment in ${group.name}`, `/group/${group.slug}/discussion/${post.id}`);
      }
    } else {
      if (post.authorId !== u.id) {
        notify(post.authorId, u.id, 'comment', `commented on your post in ${group.name}`, `/group/${group.slug}/discussion/${post.id}`);
      }
    }

    store.save();
    res.json({ comment: serializeComment(c, u) });
  })
);

function loadComment(req) {
  const commentId = req.params.id;
  const c = db().comments.find((x) => x.id === commentId) || fail(404, 'Comment not found.');
  const p = db().posts.find((x) => x.id === c.postId);
  const g = groupById((p && p.groupId) || c.groupId) || fail(404, 'Group not found.');
  return { c, p, g };
}

app.patch(
  '/api/comments/:id',
  wrap(async (req, res) => {
    const u = requireUser(req);
    const { c, g } = loadComment(req);
    if (c.authorId !== u.id && !isOwner(u) && !groupAdmin(g, u)) fail(403, 'Not allowed.');
    if (req.body.text !== undefined) c.text = cleanText(req.body.text, 5000).trim();
    if (req.body.media !== undefined) c.media = await sanitizeMedia(req.body.media);
    if (req.body.poll !== undefined) c.poll = req.body.poll ? sanitizePoll(req.body.poll) : null;
    if (!c.text && (!c.media || !c.media.length) && !c.poll) fail(400, 'Comment cannot be empty.');
    c.editedAt = now();
    store.save();
    res.json({ comment: serializeComment(c, u) });
  })
);

app.delete(
  '/api/comments/:id',
  wrap((req, res) => {
    const u = requireUser(req);
    const { c, p, g } = loadComment(req);
    if (c.authorId !== u.id && !groupAdmin(g, u) && !isOwner(u)) fail(403, 'Not allowed.');
    if (p && p.pinnedCommentId === c.id) p.pinnedCommentId = null;
    const hasReplies = db().comments.some((x) => x.parentId === c.id && !x.deleted);
    if (hasReplies) {
      c.deleted = true;
      c.deletedAt = now();
      c.text = '';
      c.media = [];
      c.poll = null;
      c.reactions = {};
      store.save();
      return res.json({ ok: true, deleted: true, comment: serializeComment(c, u) });
    }
    db().comments = db().comments.filter((x) => x.id !== c.id);
    store.save();
    res.json({ ok: true, deleted: false });
  })
);

app.post(
  '/api/comments/:id/pin',
  wrap((req, res) => {
    const u = requireUser(req);
    const { c, p, g } = loadComment(req);
    if (p.authorId !== u.id && !isOwner(u) && !groupAdmin(g, u)) {
      fail(403, 'Only the post author or group admins can pin comments.');
    }
    p.pinnedCommentId = p.pinnedCommentId === c.id ? null : c.id;
    store.save();
    res.json({ comment: serializeComment(c, u), post: serializePost(p, u), pinned: p.pinnedCommentId === c.id });
  })
);

app.post(
  '/api/comments/:id/pin-as-post',
  wrap((req, res) => {
    const u = requireUser(req);
    const { c, p, g } = loadComment(req);
    if (!isOwner(u) && !groupAdmin(g, u)) {
      fail(403, 'Only group admins can pin comments as group posts.');
    }
    const newPost = {
      id: store.uid(),
      groupId: g.id,
      authorId: c.authorId,
      text: c.text,
      media: c.media || [],
      poll: c.poll ? JSON.parse(JSON.stringify(c.poll)) : null,
      createdAt: now(),
      reactions: {},
    };
    db().posts.push(newPost);
    g.pinnedPostId = newPost.id;
    g.lastActivity = newPost.createdAt;
    store.save();
    res.json({ post: serializePost(newPost, u), group: serializeGroup(g, u) });
  })
);

app.post(
  '/api/comments/:id/react',
  wrap((req, res) => {
    const u = requireUser(req);
    const { c, p, g } = loadComment(req);
    const added = toggleReaction(c, u, req.body.emoji);
    if (added) notify(c.authorId, u.id, 'reaction', `reacted ${req.body.emoji} to your comment`, `/group/${g.slug}/discussion/${p.id}`);
    store.save();
    res.json({ comment: serializeComment(c, u) });
  })
);

app.post(
  '/api/comments/:id/vote',
  wrap((req, res) => {
    const u = requireUser(req);
    const { c, g } = loadComment(req);
    if (!c.poll) fail(400, 'This comment has no poll.');
    if (!memberOf(g, u) && !isOwner(u)) fail(403, 'Join the group to vote.');
    const opt = c.poll.options.find((o) => o.id === req.body.optionId) || fail(404, 'Option not found.');
    const had = opt.votes.includes(u.id);
    c.poll.options.forEach((o) => (o.votes = o.votes.filter((id) => id !== u.id)));
    if (!had) opt.votes.push(u.id);
    store.save();
    res.json({ comment: serializeComment(c, u) });
  })
);

// ---------------------------------------------------------------- members & profiles
app.get(
  '/api/members',
  wrap((req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    let users = db().users;
    if (q) users = users.filter((u) => u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
    res.json({
      members: users
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((u) => publicUser(u, req.user)),
    });
  })
);

app.get(
  '/api/users/:username',
  wrap((req, res) => {
    const u = userByName(req.params.username) || fail(404, 'Member not found.');
    const profile = publicUser(u, req.user);
    const groups = profile.isPrivate
      ? []
      : db()
          .groups.filter((g) => memberOf(g, u) && canViewGroup(g, req.user))
          .map((g) => serializeGroup(g, req.user));
    res.json({ user: profile, groups });
  })
);

app.get(
  '/api/users/:username/follows',
  wrap((req, res) => {
    const u = userByName(req.params.username) || fail(404, 'Member not found.');
    const followers = db().follows.filter((f) => f.following === u.id).map((f) => publicUser(userById(f.follower), req.user));
    const following = db().follows.filter((f) => f.follower === u.id).map((f) => publicUser(userById(f.following), req.user));
    res.json({ followers: followers.filter((x) => x.id), following: following.filter((x) => x.id) });
  })
);

app.post(
  '/api/users/:username/follow',
  wrap((req, res) => {
    const me = requireUser(req);
    const u = userByName(req.params.username) || fail(404, 'Member not found.');
    if (u.id === me.id) fail(400, "You can't follow yourself.");
    const i = db().follows.findIndex((f) => f.follower === me.id && f.following === u.id);
    if (i >= 0) db().follows.splice(i, 1);
    else {
      db().follows.push({ follower: me.id, following: u.id, createdAt: now() });
      notify(u.id, me.id, 'follow', 'started following you', `/profile/${me.username}/profile`);
    }
    store.save();
    res.json({ user: publicUser(u, me) });
  })
);

// ---------------------------------------------------------------- notifications
app.get(
  '/api/notifications',
  wrap((req, res) => {
    const u = requireUser(req);
    const list = db()
      .notifications.filter((n) => n.userId === u.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200)
      .map((n) => ({ ...n, actor: publicUser(userById(n.actorId)) }));
    res.json({ notifications: list });
  })
);

app.post(
  '/api/notifications/read',
  wrap((req, res) => {
    const u = requireUser(req);
    const ids = Array.isArray(req.body.ids) ? new Set(req.body.ids) : null;
    db().notifications.forEach((n) => {
      if (n.userId === u.id && (!ids || ids.has(n.id))) n.read = true;
    });
    store.save();
    res.json({ ok: true });
  })
);

app.delete(
  '/api/notifications',
  wrap((req, res) => {
    const u = requireUser(req);
    db().notifications = db().notifications.filter((n) => n.userId !== u.id);
    store.save();
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- direct messages
app.get(
  '/api/messages',
  wrap((req, res) => {
    const u = requireUser(req);
    const convos = new Map();
    for (const m of db().messages) {
      if (m.from !== u.id && m.to !== u.id) continue;
      const other = m.from === u.id ? m.to : m.from;
      const c = convos.get(other) || { last: null, unread: 0 };
      if (!c.last || m.createdAt > c.last.createdAt) c.last = m;
      if (m.to === u.id && !m.read) c.unread++;
      convos.set(other, c);
    }
    const list = [...convos.entries()]
      .map(([id, c]) => ({ user: publicUser(userById(id)), last: c.last, unread: c.unread }))
      .filter((c) => c.user.id)
      .sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt));
    res.json({ conversations: list });
  })
);

app.get(
  '/api/messages/:username',
  wrap((req, res) => {
    const u = requireUser(req);
    const other = userByName(req.params.username) || fail(404, 'Member not found.');
    const thread = db().messages.filter(
      (m) => (m.from === u.id && m.to === other.id) || (m.from === other.id && m.to === u.id)
    );
    let changed = false;
    thread.forEach((m) => {
      if (m.to === u.id && !m.read) {
        m.read = true;
        changed = true;
      }
    });
    if (changed) store.save();
    res.json({ user: publicUser(other), messages: thread.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
  })
);

app.post(
  '/api/messages/:username',
  wrap((req, res) => {
    const u = requireUser(req);
    const other = userByName(req.params.username) || fail(404, 'Member not found.');
    if (other.id === u.id) fail(400, "You can't message yourself.");
    const text = cleanText(req.body.text, 4000).trim();
    if (!text) fail(400, 'Message is empty.');
    const m = { id: store.uid(), from: u.id, to: other.id, text, createdAt: now(), read: false };
    db().messages.push(m);
    store.save();
    push(other.id, 'message', { message: m, from: publicUser(u) });
    push(u.id, 'message', { message: m, from: publicUser(u) });
    res.json({ message: m });
  })
);

// ---------------------------------------------------------------- site settings (owner)
app.patch(
  '/api/site',
  wrap((req, res) => {
    const u = requireUser(req);
    if (!isOwner(u)) fail(403, 'Only the site owner can change site settings.');
    if (req.body.allowMemberGroupCreation !== undefined) db().site.allowMemberGroupCreation = !!req.body.allowMemberGroupCreation;
    store.save();
    res.json({ site: db().site });
  })
);

// ---------------------------------------------------------------- Mastodon / Pleroma / Z3-UI Compatibility API
const escapeHtml = (str) =>
  String(str || '').replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));

function userToAccount(u) {
  if (!u) return null;
  const noteHtml = u.bio ? `<p>${escapeHtml(u.bio).replace(/\n/g, '<br/>')}</p>` : '';
  const followersCount = (db().followers || []).filter((f) => f.targetId === u.id).length;
  const followingCount = (db().followers || []).filter((f) => f.userId === u.id).length;
  const statusesCount = (db().posts || []).filter((p) => p.authorId === u.id).length;

  return {
    id: u.id,
    username: u.username,
    acct: u.username,
    display_name: u.displayName || u.username,
    locked: false,
    bot: false,
    discoverable: true,
    group: false,
    created_at: u.createdAt || '2023-01-01T00:00:00.000Z',
    note: noteHtml,
    url: `http://localhost:3036/users/${u.username}`,
    avatar: u.avatar || '/media/logo.png',
    avatar_static: u.avatar || '/media/logo.png',
    header: u.cover || '/media/z3-central-cover.jpg',
    header_static: u.cover || '/media/z3-central-cover.jpg',
    followers_count: followersCount,
    following_count: followingCount,
    statuses_count: statusesCount,
    last_status_at: u.createdAt ? u.createdAt.slice(0, 10) : '2026-10-26',
    emojis: [],
    fields: []
  };
}

function postToStatus(p, currentUserId) {
  const author = userById(p.authorId) || { id: p.authorId, username: 'user', displayName: 'User' };
  const favCount = Object.keys(p.reactions || {}).reduce((sum, r) => sum + (p.reactions[r] || []).length, 0);
  const replies = (db().comments || []).filter((c) => c.postId === p.id).length;
  const isFaved = !!currentUserId && Object.values(p.reactions || {}).some((arr) => arr.includes(currentUserId));

  const media_attachments = (p.media || []).map((m, idx) => ({
    id: `${p.id}_m${idx}`,
    type: m.type === 'video' ? 'video' : 'image',
    url: m.url,
    preview_url: m.url,
    remote_url: null,
    text_url: null,
    meta: {
      original: { width: 1200, height: 800, size: '1200x800', aspect: 1.5 },
      small: { width: 400, height: 300, size: '400x300', aspect: 1.33 }
    },
    description: m.caption || ''
  }));

  const htmlContent = `<p>${escapeHtml(p.text || '').replace(/\n/g, '<br/>')}</p>`;
  const grp = p.groupId ? groupById(p.groupId) : null;

  return {
    id: p.id,
    created_at: p.createdAt,
    in_reply_to_id: null,
    in_reply_to_account_id: null,
    sensitive: false,
    spoiler_text: '',
    visibility: 'public',
    language: 'en',
    uri: `https://z3.social/statuses/${p.id}`,
    url: `/statuses/${p.id}`,
    replies_count: replies,
    reblogs_count: 0,
    favourites_count: favCount,
    favourited: isFaved,
    reblogged: false,
    muted: false,
    bookmarked: false,
    pinned: !!p.pinned,
    content: htmlContent,
    reblog: null,
    application: {
      name: 'ZЗ Social',
      website: 'https://z3.social'
    },
    account: userToAccount(author),
    media_attachments,
    mentions: [],
    tags: [],
    emojis: [],
    card: null,
    poll: null,
    group: grp
      ? {
          id: grp.id,
          name: grp.slug || grp.id,
          preferredUsername: grp.name,
          display_name: grp.name,
          avatar: grp.coverImage || '/media/logo.png',
          header: grp.coverImage || '/media/z3-central-cover.jpg'
        }
      : null
  };
}

// Soapbox instance config
app.get('/instance/soapbox.json', (req, res) => {
  const customFile = path.join(Z3_DIST_DIR, 'instance', 'soapbox.json');
  if (fs.existsSync(customFile)) return res.sendFile(customFile);
  res.json({
    instanceName: 'ZЗ Social',
    siteTitle: 'ZЗ Social',
    logo: '/media/logo.png',
    brandColor: '#0475c2',
    defaultSettings: { autoPlayGif: true, themeMode: 'dark' },
    copyright: '©2026 by ZЗ Social (z3.social).'
  });
});

// NodeInfo protocol
const getNodeInfo = (req, res) => {
  res.json({
    version: '2.1',
    software: {
      name: 'akkoma',
      version: '3.10.4-0-g1234567-z3',
      repository: 'https://github.com/Z3Social/Z3-UI'
    },
    protocols: ['activitypub'],
    services: { inbound: [], outbound: [] },
    openRegistrations: true,
    usage: {
      users: { total: db().users.length },
      localPosts: db().posts.length
    },
    metadata: {
      nodeName: 'ZЗ Social',
      nodeDescription: 'Radically decentralized social network'
    }
  });
};
app.get('/.well-known/nodeinfo', (req, res) => {
  const host = req.get('host') || 'localhost:3036';
  res.json({
    links: [
      { rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0', href: `${req.protocol}://${host}/nodeinfo/2.0` },
      { rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1', href: `${req.protocol}://${host}/nodeinfo/2.1.json` }
    ]
  });
});
app.get('/nodeinfo/2.0', getNodeInfo);
app.get('/nodeinfo/2.1.json', getNodeInfo);

// Instance metadata
app.get('/api/v1/instance', (req, res) => {
  const host = req.get('host') || 'localhost:3036';
  const owner = db().users.find((u) => u.role === 'owner') || db().users[0];
  res.json({
    uri: 'z3.social',
    title: 'ZЗ Social',
    short_description: 'Radically decentralized social network',
    description: 'ZЗ Social is a next-generation decentralized social network built on a distinct community architecture.',
    email: 'admin@z3.social',
    version: '2.7.2 (compatible; Akkoma 3.10.4-0-g1234567-z3)',
    languages: ['en'],
    registrations: true,
    approval_required: false,
    invites_enabled: false,
    configuration: {
      statuses: { max_characters: 5000, max_media_attachments: 4 },
      media_attachments: {
        supported_mime_types: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
        image_size_limit: 10485760,
        video_size_limit: 41943040
      },
      polls: { max_options: 4, max_characters_per_option: 50, min_expiration: 300, max_expiration: 2629746 }
    },
    urls: {
      streaming_api: `ws://${host}`
    },
    stats: {
      user_count: db().users.length,
      status_count: db().posts.length,
      domain_count: 0
    },
    thumbnail: '/media/logo.png',
    contact_account: userToAccount(owner),
    rules: [
      { id: '1', text: 'Be respectful to community members.' },
      { id: '2', text: 'Decentralized, open discourse without arbitrary shadowbanning.' }
    ],
    pleroma: {
      metadata: {
        features: ['groups', 'chats', 'polls', 'pleroma_api', 'media_proxy', 'profile_directory'],
        federation: { enabled: false }
      }
    }
  });
});

app.get('/api/v1/instance/rules', (req, res) => {
  res.json([
    { id: '1', text: 'Be respectful to community members.' },
    { id: '2', text: 'Decentralized, open discourse without arbitrary shadowbanning.' }
  ]);
});

app.get('/api/pleroma/frontend_configurations', (req, res) => {
  res.json({
    soapbox: {
      brandColor: '#0475c2',
      logo: '/media/logo.png'
    }
  });
});

app.get('/api/v1/custom_emojis', (req, res) => res.json([]));
app.get('/api/v1/announcements', (req, res) => res.json([]));

// OAuth & Apps
app.post('/api/v1/apps', (req, res) => {
  res.json({
    id: '1',
    name: req.body.client_name || 'ZЗ Social',
    website: req.body.website || 'https://z3.social',
    redirect_uri: req.body.redirect_uris || 'urn:ietf:wg:oauth:2.0:oob',
    client_id: 'z3_app_' + crypto.randomBytes(8).toString('hex'),
    client_secret: 'z3_sec_' + crypto.randomBytes(16).toString('hex'),
    vapid_key: ''
  });
});

app.post(
  '/oauth/token',
  wrap((req, res) => {
    const rawLogin = cleanText(req.body.username || req.body.login, 200).trim().toLowerCase().replace(/^@/, '');
    const cleanHandle = rawLogin.replace(/@(z3\.social|localhost(:\d+)?)$/i, '');
    const u = db().users.find((x) =>
      x.email.toLowerCase() === rawLogin ||
      x.email.toLowerCase() === cleanHandle ||
      x.username.toLowerCase() === rawLogin ||
      x.username.toLowerCase() === cleanHandle ||
      (cleanHandle === 'ivan' && (x.username === 'ivanalbrieu' || x.username === 'ivanwolfdog')) ||
      (cleanHandle === 'ivanwolfdog' && x.username === 'ivanalbrieu')
    );
    if (!u || !store.verifyPassword(req.body.password || '', u)) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'The provided credentials are invalid.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    db().sessions[token] = { userId: u.id, createdAt: Date.now() };
    store.save();
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`);
    res.json({
      access_token: token,
      token_type: 'Bearer',
      scope: 'read write follow push',
      created_at: Math.floor(Date.now() / 1000)
    });
  })
);

app.post('/oauth/revoke', (req, res) => {
  const token = req.body.token;
  if (token && db().sessions[token]) {
    delete db().sessions[token];
    store.save();
  }
  res.json({});
});

// Accounts
app.get('/api/v1/accounts/verify_credentials', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'The access token is invalid' });
  const acc = userToAccount(req.user);
  res.json({
    ...acc,
    source: {
      privacy: 'public',
      sensitive: false,
      language: 'en',
      note: req.user.bio || '',
      fields: []
    }
  });
});

app.get('/api/v1/accounts/relationships', (req, res) => {
  const ids = Array.isArray(req.query.id) ? req.query.id : [req.query.id];
  const result = ids.filter(Boolean).map((id) => ({
    id,
    following: false,
    showing_reblogs: true,
    notifying: false,
    followed_by: false,
    blocking: false,
    blocked_by: false,
    muting: false,
    muting_notifications: false,
    requested: false,
    domain_blocking: false,
    endorsed: false,
    note: ''
  }));
  res.json(result);
});

app.get('/api/v1/accounts/lookup', (req, res) => {
  const acct = String(req.query.acct || '').trim().toLowerCase();
  const u = userByName(acct) || userById(acct);
  if (!u) return res.status(404).json({ error: 'Record not found' });
  res.json(userToAccount(u));
});

app.get('/api/v1/accounts/:id', (req, res) => {
  const u = userById(req.params.id) || userByName(req.params.id);
  if (!u) return res.status(404).json({ error: 'Record not found' });
  res.json(userToAccount(u));
});

app.get('/api/v1/accounts/:id/statuses', (req, res) => {
  const u = userById(req.params.id) || userByName(req.params.id);
  if (!u) return res.json([]);
  const posts = db().posts.filter((p) => p.authorId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(posts.map((p) => postToStatus(p, req.user ? req.user.id : null)));
});

// Timelines
app.get('/api/v1/timelines/public', (req, res) => {
  const posts = db().posts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(posts.map((p) => postToStatus(p, req.user ? req.user.id : null)));
});

app.get('/api/v1/timelines/home', (req, res) => {
  const posts = db().posts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(posts.map((p) => postToStatus(p, req.user ? req.user.id : null)));
});

app.get('/api/v1/timelines/group/:id', (req, res) => {
  const posts = db().posts.filter((p) => p.groupId === req.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(posts.map((p) => postToStatus(p, req.user ? req.user.id : null)));
});

// Groups
app.get('/api/v1/groups', (req, res) => {
  const groups = (db().groups || []).map((g) => ({
    id: g.id,
    name: g.slug || g.id,
    preferredUsername: g.name,
    display_name: g.name,
    summary: `<p>${escapeHtml(g.description || '')}</p>`,
    note: `<p>${escapeHtml(g.description || '')}</p>`,
    avatar: g.coverImage || '/media/logo.png',
    header: g.coverImage || '/media/z3-central-cover.jpg',
    banner: g.coverImage || '/media/z3-central-cover.jpg',
    members_count: (g.members || []).length,
    is_member: req.user ? g.members.some((m) => m.userId === req.user.id) : false
  }));
  res.json(groups);
});

app.get('/api/v1/groups/:id', (req, res) => {
  const g = groupById(req.params.id) || groupBySlug(req.params.id);
  if (!g) return res.status(404).json({ error: 'Group not found' });
  res.json({
    id: g.id,
    name: g.slug || g.id,
    preferredUsername: g.name,
    display_name: g.name,
    summary: `<p>${escapeHtml(g.description || '')}</p>`,
    note: `<p>${escapeHtml(g.description || '')}</p>`,
    avatar: g.coverImage || '/media/logo.png',
    header: g.coverImage || '/media/z3-central-cover.jpg',
    banner: g.coverImage || '/media/z3-central-cover.jpg',
    members_count: (g.members || []).length,
    is_member: req.user ? g.members.some((m) => m.userId === req.user.id) : false
  });
});

// Statuses CRUD
app.post(
  '/api/v1/statuses',
  wrap((req, res) => {
    const u = requireUser(req);
    const text = cleanText(req.body.status || req.body.content || '', 5000);
    if (!text) fail(400, 'Post cannot be empty.');
    const p = {
      id: crypto.randomUUID(),
      groupId: req.body.group_id || null,
      authorId: u.id,
      text,
      media: [],
      poll: null,
      createdAt: now(),
      pinned: false,
      reactions: {}
    };
    db().posts.push(p);
    store.save();
    res.json(postToStatus(p, u.id));
  })
);

app.get('/api/v1/statuses/:id', (req, res) => {
  const p = db().posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Record not found' });
  res.json(postToStatus(p, req.user ? req.user.id : null));
});

app.get('/api/v1/statuses/:id/context', (req, res) => {
  const p = db().posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Record not found' });
  const comments = (db().comments || []).filter((c) => c.postId === p.id);
  const descendants = comments.map((c) => ({
    id: c.id,
    created_at: c.createdAt,
    in_reply_to_id: p.id,
    in_reply_to_account_id: p.authorId,
    sensitive: false,
    spoiler_text: '',
    visibility: 'public',
    language: 'en',
    uri: `https://z3.social/statuses/${c.id}`,
    url: `/statuses/${c.id}`,
    replies_count: 0,
    reblogs_count: 0,
    favourites_count: Object.keys(c.reactions || {}).reduce((s, r) => s + (c.reactions[r] || []).length, 0),
    favourited: false,
    reblogged: false,
    content: `<p>${escapeHtml(c.text || '').replace(/\n/g, '<br/>')}</p>`,
    account: userToAccount(userById(c.authorId) || { id: c.authorId, username: 'user' }),
    media_attachments: [],
    mentions: [],
    tags: [],
    emojis: []
  }));
  res.json({ ancestors: [], descendants });
});

app.post(
  '/api/v1/statuses/:id/favourite',
  wrap((req, res) => {
    const u = requireUser(req);
    const p = db().posts.find((x) => x.id === req.params.id);
    if (!p) fail(404, 'Post not found');
    if (!p.reactions['👍']) p.reactions['👍'] = [];
    if (!p.reactions['👍'].includes(u.id)) p.reactions['👍'].push(u.id);
    store.save();
    res.json(postToStatus(p, u.id));
  })
);

app.post(
  '/api/v1/statuses/:id/unfavourite',
  wrap((req, res) => {
    const u = requireUser(req);
    const p = db().posts.find((x) => x.id === req.params.id);
    if (!p) fail(404, 'Post not found');
    if (p.reactions['👍']) p.reactions['👍'] = p.reactions['👍'].filter((id) => id !== u.id);
    store.save();
    res.json(postToStatus(p, u.id));
  })
);

// Notifications, Directory, Bookmarks, Preferences
app.get('/api/v1/notifications', (req, res) => res.json([]));
app.get('/api/v1/conversations', (req, res) => res.json([]));
app.get('/api/v1/bookmarks', (req, res) => res.json([]));
app.get('/api/v1/favourites', (req, res) => {
  if (!req.user) return res.json([]);
  const favs = db().posts.filter((p) => Object.values(p.reactions || {}).some((arr) => arr.includes(req.user.id)));
  res.json(favs.map((p) => postToStatus(p, req.user.id)));
});
app.get('/api/v1/mutes', (req, res) => res.json([]));
app.get('/api/v1/blocks', (req, res) => res.json([]));
app.get('/api/v1/filters', (req, res) => res.json([]));
app.get('/api/v1/markers', (req, res) => res.json({}));
app.get('/api/v1/directory', (req, res) => {
  res.json(db().users.map(userToAccount));
});
app.get('/api/v1/preferences', (req, res) => {
  res.json({
    'posting:default:visibility': 'public',
    'posting:default:sensitive': false,
    'posting:default:language': 'en',
    'reading:expand:spoilers': true,
    'reading:expand:media': 'default'
  });
});

// ---------------------------------------------------------------- static + SPA fallback
app.get('/favicon.png', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'media', 'logo.png')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'media', 'logo.png')));
app.use('/media', express.static(path.join(PUBLIC_DIR, 'media')));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

if (IS_Z3_UI) {
  console.log(`[Z3 Social] Mode: Z3-UI. Serving dist from ${Z3_DIST_DIR}`);
  app.use(express.static(Z3_DIST_DIR, { index: false }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(Z3_DIST_DIR, 'index.html'));
  });
} else {
  console.log(`[Z3 Social] Mode: Wix Clone. Serving from ${PUBLIC_DIR}`);
  app.use(express.static(PUBLIC_DIR, { index: false }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Upload is too large.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

process.on('SIGINT', () => {
  store.saveNow();
  process.exit(0);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Z3 Social running at http://localhost:${PORT}`);
  });
}

module.exports = { app };
