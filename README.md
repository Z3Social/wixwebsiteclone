# Z3 Social — Wix Website Clone

This is a full, self-hosted clone of your Wix website [http://ivanalbrieu.wixsite.com/zze3](http://ivanalbrieu.wixsite.com/zze3).

On Wix, the functionality came from three core apps:
1. **Wix Groups** (`Wix Groups`)
2. **Wix Members Area** (`Wix Members Area`)
3. **Wix Chat / Business Solutions** (`Wix Chat`)

This repository recreates all 3 apps and their complete functionality from scratch without any proprietary Wix dependencies or subscriptions.

---

## 🗄️ Database & Content (`data/db.json`)

All your groups and initial community posts have been preserved as the database:

- **Groups**:
  - `Z3 Central` (with pinned post & group info)
  - `Ivan Music` (with files section enabled)
- **Posts**:
  - Original discussions, dates, and media (such as `ookie.jpg`, Z3 banners, and covers).
- **Users**:
  - `ivan` (Site owner / Administrator)

---

## 🚀 Running the Site

Ensure you have [Node.js](https://nodejs.org/) installed, then run:

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### Default Admin Account:
- **Username / Email**: `ivan` or `admin@z3.social`
- **Password**: `z3admin` (configurable in [server/seed.js](file:///d:/dev/ZЗ%20Social/wixwebsiteclone/server/seed.js) or via environment variable `ADMIN_PASSWORD`)
