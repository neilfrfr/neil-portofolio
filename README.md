# Neil Espinosa — Academic Portfolio

A static portfolio site with a live, editable directory of Activities, Short Quizzes, and Long Quizzes. Anyone can view and open the files; only you (logged in) can add, edit, or delete entries.

**Stack:** plain HTML/CSS/JS + Firebase (Auth + Firestore, for login and data) + Cloudinary (for file uploads) + GitHub Pages. Every piece here has a free tier that does **not** require a credit card.

---

## 1. Firebase project (login + data)

Your Firebase config is already filled in for you in `firebase-config.js` (project `neil-portfolio-a1a16`). If you ever need to re-copy it: **Project Settings > General > Your apps > SDK setup and configuration** — just skip the `storageBucket` and `measurementId` fields, since this project doesn't use Firebase Storage or Analytics.

## 2. Turn on Authentication (so only you can edit)

1. In the Firebase console: **Build > Authentication > Get started**.
2. Under **Sign-in method**, enable **Email/Password**.
3. Go to the **Users** tab and click **Add user**. Enter the email and password you'll use to log into your own site as admin. There's no public sign-up page — this is the only account that will ever exist.

## 3. Turn on Firestore (stores your titles, dates, descriptions)

1. **Build > Firestore Database > Create database**. Choose **Start in production mode**, pick any nearby region.
2. Go to the **Rules** tab and replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /records/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Anyone can view the directory; only a signed-in user (you) can add/edit/delete. Click **Publish**.

## 4. Create a Cloudinary account (file uploads — no card needed)

Cloudinary's free plan (25 credits/month ≈ 25GB of storage or bandwidth) doesn't ask for a credit card, and it lets your browser upload files directly without a backend server.

1. Go to [cloudinary.com](https://cloudinary.com) and sign up (email, Google, or GitHub — no card).
2. On your Console **Dashboard**, copy your **Cloud name**.
3. Go to **Settings (gear icon) > Upload > Upload presets > Add upload preset**.
   - Set **Signing Mode** to **Unsigned** (this is what lets the browser upload without exposing any secret key).
   - Optionally, under **Folder**, type `portfolio-uploads` to keep things tidy.
   - Under **Allowed formats**, restrict to `pdf,doc,docx,jpg,jpeg,png,webp` so only expected file types can be uploaded.
   - Save, and copy the **preset name**.
4. Open `cloudinary-config.js` in this project and paste in your cloud name and preset name.
5. **Important for PDFs:** Cloudinary's free plan blocks public *delivery* of PDF files by default (an anti-abuse measure) — uploads still work, but the link would show an error until you turn this on. Go to **Settings > Security**, find **"PDF and ZIP files delivery"**, and enable **Allow delivery of PDF and ZIP files**. Save. (DOC/DOCX files aren't affected by this restriction and work immediately.)

These two config values are meant to be public in client-side code — the unsigned preset's restrictions (folder, file types) are what keeps it safe, not secrecy.

> **Note:** when you replace a file on an existing item, the old file is left in your Cloudinary media library rather than deleted (deleting Cloudinary assets from the browser needs a signed request, which would mean exposing a secret key). For a personal portfolio's worth of files this is well within the free tier — if it ever bothers you, you can delete unused files manually from the Cloudinary Media Library.

## 5. Test it locally

Because this uses ES module imports, open it through a local server rather than double-clicking the file (browsers block module imports from `file://`):

```bash
# from inside the portfolio folder
python3 -m http.server 8000
```

Visit `http://localhost:8000`, click **Admin** in the nav, log in with the account from step 2, and try adding an item.

## 6. Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `portfolio`).
2. Push these files to the repository root: `index.html`, `style.css`, `app.js`, `firebase-config.js`, `cloudinary-config.js`.
3. In the repo, go to **Settings > Pages**.
4. Under **Source**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
5. After a minute, GitHub gives you a live URL like `https://yourusername.github.io/portfolio/`.

## How it works day-to-day

- **Visitors** see the site normally and can click any item with a file icon to open the PDF/image in a new tab.
- **You** click **Admin** in the top nav, log in, and every tab gets an **+ Add** button plus edit (✎) and delete (🗑) icons on each item.
- Editing an item without choosing a new file keeps the existing file attached; choosing a new file uploads and swaps in the new one.
- Changes show up instantly for anyone viewing the site (it uses a live database connection), no page refresh needed.

## Extending it later

- Add more categories by duplicating a tab block in `index.html` and adding its button/category value.
- Add fields (e.g. a grade or subject) by adding an input in the modal form and including it in the `payload` object in `app.js`.