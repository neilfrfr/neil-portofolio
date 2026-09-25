# Neil Francis Espinosa — Portfolio

A multi-page personal portfolio with a live, editable directory of Activities, Short Quizzes, and Long Quizzes, plus a projects section that's ready for real case studies. Anyone can browse and open files; only you (logged in) can add, edit, or delete entries.

**Stack:** plain HTML/CSS/JS (no framework, no build step) + Firebase (Auth + Firestore) + Cloudinary (file uploads) + GitHub Pages. Every piece here has a free tier that does **not** require a credit card.

---

## What changed in this redesign

- **Visual redesign** — dark, editorial visual direction with Space Grotesk / Inter / JetBrains Mono, a restrained lime accent, and real motion only where it earns its place.
- **Multi-page structure** — `index.html`, `about.html`, `projects.html`, `experience.html`, `documents.html`, sharing one nav, one footer, and one stylesheet.
- **In-site document viewer** — clicking a document title now opens a modal instead of navigating away: PDFs render in an iframe, images render inline, DOC/DOCX show a clear "preview unavailable" fallback with Download and Open-in-new-tab actions. Every file keeps both of those actions regardless of type.
- **A new `projects` Firestore collection**, wired up the same way `records` already was (Cloudinary image upload optional, admin-only add/edit/delete, live sync). It starts empty — nothing is pre-populated — so `projects.html` and the homepage's featured section show a designed empty state until you add real projects.
- **Shared UI logic split out** into `site.js` (mobile nav, scroll reveal, modal open/close, toasts — no Firebase) so `app.js` stays focused on Firebase/Cloudinary/data.

Nothing about your existing `records` collection, its fields, your Firebase project, or your Cloudinary config changed. Your existing Activities/Short Quizzes/Long Quizzes data will show up exactly as before.

---

## 1. Firebase project (login + data)

Your Firebase config is already filled in for you in `firebase-config.js` (project `neil-portfolio-a1a16`). If you ever need to re-copy it: **Project Settings > General > Your apps > SDK setup and configuration** — skip `storageBucket` and `measurementId`, since this project doesn't use Firebase Storage or Analytics.

## 2. Authentication (unchanged)

Already set up if it was working before: **Email/Password** sign-in, plus your admin account under **Build > Authentication > Users**. `ADMIN_EMAILS` in `app.js` still lists the same authorized addresses.

## 3. Firestore — add a rule for the new `projects` collection

Your existing `records` collection and its rule keep working as-is. **You need to add one more rule block** so the new `projects` collection can be read and written. Go to **Firestore Database > Rules** and use:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /records/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /projects/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Anyone can view; only a signed-in user (you) can add/edit/delete. Click **Publish**. Until you add this block, saving a project from the admin UI will fail with a permissions error — reads will also silently return nothing.

## 4. Cloudinary (unchanged)

Same cloud name and unsigned upload preset as before, in `cloudinary-config.js`. The same preset is now reused for optional project cover images, so no new preset is required — just make sure its **Allowed formats** includes `jpg,jpeg,png,webp` (it already needs to, for document images).

## 5. Your profile photo

Add your own photo at:

```
assets/profile.jpg
```

The homepage hero looks for it automatically. Until it exists, the hero shows a clean initials placeholder instead of a broken image — the page won't break either way.

## 6. Project cover images (optional)

When you add a project through the admin **+ Add project** form, you can attach a cover image — it uploads to Cloudinary exactly like document files do. It's optional; projects without one just render without a thumbnail.

## 7. Test it locally

This still uses ES module imports, so open it through a local server rather than double-clicking the file:

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000`, click **Admin** in the nav, log in, and try adding a document or a project.

## 8. Deploy to GitHub Pages

1. Push all files to your repository root: `index.html`, `about.html`, `projects.html`, `experience.html`, `documents.html`, `style.css`, `site.js`, `app.js`, `firebase-config.js`, `cloudinary-config.js`, and the `assets/` folder.
2. In the repo, go to **Settings > Pages**.
3. Under **Source**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
4. After a minute, GitHub gives you a live URL like `https://neilfrfr.github.io/neil-portofolio/`.

---

## How it works day-to-day

- **Visitors** browse Home, About, Projects, Experience, and Documents freely. Clicking a document opens it in the in-page viewer (PDF/image inline, DOC/DOCX with a download fallback); Download and Open-in-new-tab are always available.
- **You** click **Admin**, log in, and admin-only controls appear: **+ Add** buttons on Documents and Projects, plus edit (✎) and delete (🗑) icons on each existing item.
- Editing a document or project without choosing a new file/image keeps the existing one attached.
- Changes show up instantly for anyone viewing the site (live Firestore listeners), no refresh needed.
- With zero projects and/or zero documents, the site still looks finished — the empty states are part of the design, not a placeholder.

## Known limitations

- Cloudinary's free plan blocks public delivery of PDFs by default. If PDF previews show an error, go to **Cloudinary Settings > Security** and enable **"Allow delivery of PDF and ZIP files"** (this is unchanged from before).
- Replacing a file or image leaves the old one in your Cloudinary library rather than deleting it, since deleting from the browser needs a signed request. Fine for a personal portfolio's volume; clean up manually in the Cloudinary Media Library if it ever bothers you.
- DOC/DOCX files can't be rendered natively in a browser — the viewer is honest about that and offers Download / Open in new tab instead of pretending to preview them.
- Experience currently shows only your verified education entry. No jobs, internships, or leadership roles are listed because none exist in the data yet — add them as real content when they happen rather than as placeholders.

## Extending it later

- **Add a document category**: duplicate a tab + tab-content block in `documents.html`, add its button/category value, and add its empty-state copy to `EMPTY_COPY` in `app.js`.
- **Add project fields**: extend the form in `projects.html` and the `payload` object in the project submit handler in `app.js`.
- **Add more pages**: copy the nav/footer/modals block from an existing page so the shared behavior in `site.js`/`app.js` keeps working.
