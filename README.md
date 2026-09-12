# Neil Espinosa — Academic Portfolio

A static portfolio site with a live, editable directory of Activities, Short Quizzes, and Long Quizzes. Anyone can view and open the files; only you (logged in) can add, edit, or delete entries.

**Stack:** plain HTML/CSS/JS + Firebase (Auth, Firestore, Storage) + GitHub Pages. No server to run — everything runs on Firebase's free "Spark" tier.

---

## 1. Create your Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**. Name it anything (e.g. `neil-portfolio`). You can skip Google Analytics.
2. Click the **web icon (`</>`)** on the project overview page to register a web app. Give it a nickname — no need to set up Firebase Hosting.
3. Firebase shows you a `firebaseConfig` object. Copy it.
4. Open `firebase-config.js` in this project and paste your values in, replacing the placeholders.

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

Anyone can view the directory, but only a signed-in user (you) can add/edit/delete. Click **Publish**.

## 4. Turn on Storage (stores your uploaded PDFs/images)

1. **Build > Storage > Get started**. Accept the default settings.
2. Go to the **Rules** tab and replace the contents with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Click **Publish**.

> **On the billing prompt:** Firebase Storage now requires linking a billing account (the "Blaze" pay-as-you-go plan) even to use it within the free quota — Google added this as a spam-prevention measure. You won't be charged unless you go past the free quota (5GB storage, 1GB/day downloads — very hard to hit with quiz files for a single portfolio). If you want a safety net, set a **budget alert** in Google Cloud Console under Billing so you'd be notified long before anything could cost money.

## 5. Test it locally

Because this uses ES module imports, open it through a local server rather than double-clicking the file (browsers block module imports from `file://`):

```bash
# from inside the portfolio folder
python3 -m http.server 8000
```

Visit `http://localhost:8000`, click **Admin** in the nav, log in with the account from step 2, and try adding an item.

## 6. Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `portfolio`).
2. Push these files to the repository root: `index.html`, `style.css`, `app.js`, `firebase-config.js`.
3. In the repo, go to **Settings > Pages**.
4. Under **Source**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
5. After a minute, GitHub gives you a live URL like `https://yourusername.github.io/portfolio/`.

Your `firebase-config.js` values (API key, project ID, etc.) are safe to be public in a client-side app like this — Firebase's actual security comes from the Firestore/Storage rules you set above, not from hiding these values.

## How it works day-to-day

- **Visitors** see the site normally and can click any item with a file icon to open the PDF/image in a new tab.
- **You** click **Admin** in the top nav, log in, and every tab gets an **+ Add** button plus edit (✎) and delete (🗑) icons on each item.
- Editing an item without choosing a new file keeps the existing file attached; choosing a new file replaces it.
- Changes show up instantly for anyone viewing the site (it uses a live database connection), no page refresh needed.

## Extending it later

- Add more categories by duplicating a tab block in `index.html` and adding its button/category value.
- Add fields (e.g. a grade or subject) by adding an input in the modal form and including it in the `payload` object in `app.js`.
