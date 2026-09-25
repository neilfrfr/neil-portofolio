import { firebaseConfig } from "./firebase-config.js";
import { cloudinaryConfig } from "./cloudinary-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Firebase setup (Auth + Firestore only — no Storage, no billing needed) ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const recordsCol = collection(db, "records");
const projectsCol = collection(db, "projects");

// ---------- Shared UI helpers from site.js ----------
const { showToast, openModal, closeModal } = window.Site || {
  showToast: () => {},
  openModal: (el) => el && el.classList.add("active"),
  closeModal: (el) => el && el.classList.remove("active")
};

// ---------- Local state ----------
let allRecords = [];      // everything currently in the "records" collection, kept in sync live
let allProjects = [];     // everything currently in the "projects" collection, kept in sync live
let isAdmin = false;
let activeCategory = "activities";

// ---------- DOM refs that exist on every page (nav + login modal) ----------
const adminNavBtn = document.getElementById("adminNavBtn");
const loginModal = document.getElementById("loginModal");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const googleLoginBtn = document.getElementById("googleLoginBtn");

// Only these addresses are allowed to act as admin. This is a convenience
// check for a clear error message — the real enforcement is in your
// Firestore security rules (see README), since a client-side check alone
// can't stop someone from writing to the database directly.
const ADMIN_EMAILS = ["neilfrancis736@gmail.com", "neilfrancis.espinosa@cvsu.edu.ph"];

// ---------- Documents page refs (documents.html only) ----------
const recordModal = document.getElementById("recordModal");
const recordForm = document.getElementById("recordForm");
const recordModalTitle = document.getElementById("recordModalTitle");
const recordError = document.getElementById("recordError");
const recordSubmitBtn = document.getElementById("recordSubmitBtn");
const currentFileNote = document.getElementById("currentFileNote");

const viewerModal = document.getElementById("viewerModal");
const viewerTitle = document.getElementById("viewerTitle");
const viewerMeta = document.getElementById("viewerMeta");
const viewerBody = document.getElementById("viewerBody");
const viewerDownloadBtn = document.getElementById("viewerDownloadBtn");
const viewerOpenBtn = document.getElementById("viewerOpenBtn");

// ---------- Projects page refs (projects.html only) ----------
const projectModal = document.getElementById("projectModal");
const projectForm = document.getElementById("projectForm");
const projectModalTitle = document.getElementById("projectModalTitle");
const projectError = document.getElementById("projectError");
const projectSubmitBtn = document.getElementById("projectSubmitBtn");
const currentProjectImageNote = document.getElementById("currentProjectImageNote");
const caseStudyList = document.getElementById("caseStudyList");
const projectsEmptyState = document.getElementById("projectsEmptyState");
const addProjectBtns = document.querySelectorAll(".add-project-btn");

// ---------- Home page refs (index.html only) ----------
const featuredProjectsGrid = document.getElementById("featuredProjectsGrid");
const featuredEmptyState = document.getElementById("featuredEmptyState");

const toastEl = document.getElementById("toast");

// ================================================================
// Auth
// ================================================================
if (adminNavBtn) {
  adminNavBtn.addEventListener("click", async () => {
    if (isAdmin) {
      const sure = confirm("Log out of admin mode?");
      if (sure) {
        await signOut(auth);
        showToast("Logged out.");
      }
    } else {
      loginError.classList.remove("active");
      loginForm.reset();
      openModal(loginModal);
    }
  });
}

if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    loginError.classList.remove("active");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (!ADMIN_EMAILS.includes(result.user.email)) {
        await signOut(auth);
        loginError.textContent = "That Google account isn't authorized for admin access.";
        loginError.classList.add("active");
        return;
      }
      closeModal(loginModal);
      showToast("Logged in as admin.");
    } catch (err) {
      console.error("Google login failed:", err.code, err.message);
      if (err.code !== "auth/popup-closed-by-user") {
        loginError.textContent = "Couldn't sign in with Google.";
        loginError.classList.add("active");
      }
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.remove("active");
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      closeModal(loginModal);
      showToast("Logged in as admin.");
    } catch (err) {
      console.error("Email/password login failed:", err.code, err.message);
      loginError.textContent = "Couldn't log in — check your email and password.";
      loginError.classList.add("active");
    }
  });
}

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  if (adminNavBtn) {
    adminNavBtn.textContent = isAdmin ? "Log out" : "Admin";
    adminNavBtn.classList.toggle("is-logged-in", isAdmin);
  }
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.style.display = isAdmin ? "" : "none";
  });
  renderActiveTab();
  renderProjects();
});

// ================================================================
// Escaping helpers
// ================================================================
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

// ================================================================
// File type detection (for the document viewer)
// ================================================================
function detectFileType(fileName, url) {
  const source = (fileName || url || "").split(/[?#]/)[0].toLowerCase();
  const ext = source.includes(".") ? source.split(".").pop() : "";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (["doc", "docx"].includes(ext)) return "doc";
  return "unknown";
}

const CATEGORY_LABELS = {
  activities: "Activity",
  "short-quiz": "Short Quiz",
  "long-quiz": "Long Quiz"
};

// ================================================================
// Tabs (documents.html)
// ================================================================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeCategory = btn.dataset.category;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    document.querySelector(`.tab-content[data-category="${activeCategory}"]`).classList.add("active");
  });
});

// ================================================================
// Live data sync — records (documents.html)
// ================================================================
if (document.querySelector(".record-list")) {
  onSnapshot(
    recordsCol,
    (snapshot) => {
      allRecords = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAllTabs();
    },
    (err) => {
      console.error("Failed to load records:", err);
      document.querySelectorAll(".record-list").forEach((list) => {
        list.innerHTML = `<p class="empty-state compact">Couldn't load items. Check your Firebase config and Firestore rules.</p>`;
      });
    }
  );
}

function renderAllTabs() {
  ["activities", "short-quiz", "long-quiz"].forEach(renderCategory);
}
function renderActiveTab() {
  renderCategory(activeCategory);
}

const EMPTY_COPY = {
  activities: "No activities yet. Uploaded activities will appear here.",
  "short-quiz": "No short quizzes yet. Your uploaded quizzes will appear here.",
  "long-quiz": "No long quizzes yet. Your uploaded quizzes will appear here."
};

function renderCategory(category) {
  const list = document.querySelector(`.record-list[data-list="${category}"]`);
  if (!list) return;

  const items = allRecords
    .filter((r) => r.category === category)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state compact"><p style="margin-bottom:0;">${EMPTY_COPY[category] || "Nothing here yet."}</p></div>`;
    return;
  }

  list.innerHTML = items.map((item) => {
    const titleHtml = item.fileURL
      ? `<button type="button" class="record-title-btn" data-view-id="${item.id}">${escapeHtml(item.title)}</button>`
      : `<span class="record-title-plain">${escapeHtml(item.title)}</span>`;

    const descHtml = item.description
      ? `<div class="record-desc">${escapeHtml(item.description)}</div>`
      : "";

    const dateHtml = item.date
      ? `<span class="record-date">${escapeHtml(item.date)}</span>`
      : "";

    const adminActions = isAdmin
      ? `<div class="record-actions">
           <button class="icon-btn" type="button" title="Edit" data-edit-id="${item.id}">✎</button>
           <button class="icon-btn danger" type="button" title="Delete" data-delete-id="${item.id}">🗑</button>
         </div>`
      : "";

    return `
      <div class="record-card">
        <div class="record-main">
          <span class="record-icon">${item.fileURL ? "📄" : "📝"}</span>
          <div>
            ${titleHtml}
            ${descHtml}
            ${dateHtml}
          </div>
        </div>
        ${adminActions}
      </div>`;
  }).join("");
}

// ================================================================
// Document viewer
// ================================================================
function openViewer(record) {
  if (!viewerModal || !record || !record.fileURL) return;

  viewerTitle.textContent = record.title || "Untitled";
  viewerMeta.textContent = `${CATEGORY_LABELS[record.category] || "Document"}${record.date ? " · " + record.date : ""}`;
  viewerDownloadBtn.href = record.fileURL;
  viewerDownloadBtn.setAttribute("download", record.fileName || "");
  viewerOpenBtn.href = record.fileURL;

  const type = detectFileType(record.fileName, record.fileURL);
  const url = escapeAttr(record.fileURL);
  const title = escapeAttr(record.title || "Document");

  if (type === "pdf") {
    viewerBody.innerHTML = `<iframe src="${url}" title="${title}" loading="lazy"></iframe>`;
  } else if (type === "image") {
    viewerBody.innerHTML = `<img src="${url}" alt="${title}">`;
  } else {
    viewerBody.innerHTML = `
      <div class="viewer-fallback">
        <p>Preview isn't available for this file type. Use the buttons below to download it or open it in a new tab.</p>
      </div>`;
  }

  openModal(viewerModal);
}

document.addEventListener("click", (e) => {
  const viewId = e.target.dataset.viewId;
  if (viewId) {
    const record = allRecords.find((r) => r.id === viewId);
    if (record) openViewer(record);
  }
});

// ================================================================
// Cloudinary upload (unsigned, no backend, no billing card)
// Shared by documents and project images.
// ================================================================
async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);

  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.message || "Upload failed");
  }
  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}

// ================================================================
// Add / edit record (documents.html)
// ================================================================
document.querySelectorAll(".add-record-btn").forEach((btn) => {
  btn.addEventListener("click", () => openRecordModal({ category: btn.dataset.category }));
});

document.addEventListener("click", (e) => {
  const editId = e.target.dataset.editId;
  const deleteId = e.target.dataset.deleteId;
  if (editId) {
    const record = allRecords.find((r) => r.id === editId);
    if (record) openRecordModal(record);
  }
  if (deleteId) {
    handleDeleteRecord(deleteId);
  }
});

function openRecordModal(record) {
  if (!recordModal) return;
  recordError.classList.remove("active");
  recordForm.reset();
  document.getElementById("recordId").value = record.id || "";
  document.getElementById("recordCategory").value = record.category;
  document.getElementById("recordExistingFileURL").value = record.fileURL || "";
  document.getElementById("recordExistingFilePath").value = record.publicId || "";
  document.getElementById("recordTitle").value = record.title || "";
  document.getElementById("recordDesc").value = record.description || "";
  document.getElementById("recordDate").value = record.date || "";

  const isEdit = !!record.id;
  recordModalTitle.textContent = isEdit ? "Edit item" : "Add item";
  recordSubmitBtn.textContent = isEdit ? "Save changes" : "Save item";
  currentFileNote.textContent = isEdit && record.fileName
    ? `Current file: ${record.fileName} (choose a new file only if you want to replace it)`
    : "";

  openModal(recordModal);
}

if (recordForm) {
  recordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    recordError.classList.remove("active");
    recordSubmitBtn.disabled = true;
    recordSubmitBtn.textContent = "Saving…";

    try {
      const id = document.getElementById("recordId").value;
      const category = document.getElementById("recordCategory").value;
      const title = document.getElementById("recordTitle").value.trim();
      const description = document.getElementById("recordDesc").value.trim();
      const date = document.getElementById("recordDate").value;
      const fileInput = document.getElementById("recordFile");
      const existingFileURL = document.getElementById("recordExistingFileURL").value;
      const existingPublicId = document.getElementById("recordExistingFilePath").value;

      let fileURL = existingFileURL || null;
      let publicId = existingPublicId || null;
      let fileName = null;

      const file = fileInput.files[0];
      if (file) {
        recordSubmitBtn.textContent = "Uploading file…";
        const uploaded = await uploadToCloudinary(file);
        fileURL = uploaded.url;
        publicId = uploaded.publicId;
        fileName = file.name;
        recordSubmitBtn.textContent = "Saving…";
        // Note: the previous file (if any) is left in Cloudinary rather than
        // deleted, since safely deleting Cloudinary assets from the browser
        // needs a signed request. Free tier storage is generous enough that
        // this is fine for a personal portfolio's worth of quizzes.
      } else if (id) {
        const existing = allRecords.find((r) => r.id === id);
        fileName = existing ? existing.fileName : null;
      }

      const payload = { category, title, description, date, fileURL, publicId, fileName };

      if (id) {
        await updateDoc(doc(db, "records", id), payload);
        showToast("Item updated.");
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(recordsCol, payload);
        showToast("Item added.");
      }

      closeModal(recordModal);
    } catch (err) {
      console.error(err);
      recordError.textContent = "Couldn't save this item. Please try again.";
      recordError.classList.add("active");
    } finally {
      recordSubmitBtn.disabled = false;
    }
  });
}

async function handleDeleteRecord(id) {
  const record = allRecords.find((r) => r.id === id);
  if (!record) return;
  const sure = confirm(`Delete "${record.title}"? This can't be undone.`);
  if (!sure) return;

  try {
    await deleteDoc(doc(db, "records", id));
    showToast("Item deleted.");
  } catch (err) {
    console.error(err);
    showToast("Couldn't delete this item.");
  }
}

// ================================================================
// Live data sync — projects (index.html + projects.html)
// ================================================================
const needsProjects = !!(featuredProjectsGrid || caseStudyList);
if (needsProjects) {
  onSnapshot(
    projectsCol,
    (snapshot) => {
      allProjects = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderProjects();
    },
    (err) => {
      console.error("Failed to load projects:", err);
      if (caseStudyList) {
        caseStudyList.innerHTML = `<p class="empty-state compact">Couldn't load projects. Check your Firebase config and Firestore rules.</p>`;
      }
    }
  );
}

function renderProjects() {
  const sorted = [...allProjects].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (featuredProjectsGrid) {
    const featured = sorted.slice(0, 3);
    if (featured.length === 0) {
      featuredProjectsGrid.style.display = "none";
      if (featuredEmptyState) featuredEmptyState.style.display = "";
    } else {
      featuredProjectsGrid.style.display = "";
      if (featuredEmptyState) featuredEmptyState.style.display = "none";
      featuredProjectsGrid.innerHTML = featured.map(renderFeaturedCard).join("");
    }
  }

  if (caseStudyList) {
    if (sorted.length === 0) {
      caseStudyList.style.display = "none";
      if (projectsEmptyState) projectsEmptyState.style.display = "";
    } else {
      caseStudyList.style.display = "";
      if (projectsEmptyState) projectsEmptyState.style.display = "none";
      caseStudyList.innerHTML = sorted.map(renderCaseStudy).join("");
    }
  }
}

function techList(project) {
  return Array.isArray(project.technologies) ? project.technologies : [];
}

function renderFeaturedCard(project) {
  const techs = techList(project).slice(0, 4)
    .map((t) => `<span class="tech-chip">${escapeHtml(t)}</span>`).join("");
  return `
    <div class="project-preview-card">
      ${project.status ? `<span class="status">${escapeHtml(project.status)}</span>` : ""}
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.description || "")}</p>
      <div class="tech-row">${techs}</div>
    </div>`;
}

function renderCaseStudy(project, index) {
  const techs = techList(project)
    .map((t) => `<span class="tech-chip">${escapeHtml(t)}</span>`).join("");

  const links = [
    project.link ? `<a class="btn btn-ghost btn-small" href="${escapeAttr(project.link)}" target="_blank" rel="noreferrer">View live</a>` : "",
    project.repoLink ? `<a class="btn btn-ghost btn-small" href="${escapeAttr(project.repoLink)}" target="_blank" rel="noreferrer">Repository</a>` : ""
  ].join("");

  const thumb = project.imageURL
    ? `<div class="case-thumb"><img src="${escapeAttr(project.imageURL)}" alt="${escapeAttr(project.title)} preview"></div>`
    : "";

  const adminActions = isAdmin
    ? `<div class="case-actions">
         <button class="icon-btn" type="button" title="Edit" data-edit-project-id="${project.id}">✎</button>
         <button class="icon-btn danger" type="button" title="Delete" data-delete-project-id="${project.id}">🗑</button>
       </div>`
    : "";

  return `
    <article class="case-study">
      <div class="case-index">${String(index + 1).padStart(2, "0")}</div>
      <div class="case-body">
        <div class="status-row">
          ${project.status ? `<span class="status-pill ${project.status.toLowerCase().includes("progress") ? "live" : ""}">${escapeHtml(project.status)}</span>` : ""}
          ${project.category ? `<span class="status-pill">${escapeHtml(project.category)}</span>` : ""}
          ${project.date ? `<span class="status-pill">${escapeHtml(project.date)}</span>` : ""}
        </div>
        <h3>${escapeHtml(project.title)}</h3>
        <p class="case-desc">${escapeHtml(project.description || "")}</p>
        <div class="tech-row">${techs}</div>
        <div class="case-links">${links}</div>
        ${thumb}
        ${adminActions}
      </div>
    </article>`;
}

// ================================================================
// Add / edit project (projects.html)
// ================================================================
addProjectBtns.forEach((btn) => {
  btn.addEventListener("click", () => openProjectModal({}));
});

document.addEventListener("click", (e) => {
  const editId = e.target.dataset.editProjectId;
  const deleteId = e.target.dataset.deleteProjectId;
  if (editId) {
    const project = allProjects.find((p) => p.id === editId);
    if (project) openProjectModal(project);
  }
  if (deleteId) {
    handleDeleteProject(deleteId);
  }
});

function openProjectModal(project) {
  if (!projectModal) return;
  projectError.classList.remove("active");
  projectForm.reset();
  document.getElementById("projectId").value = project.id || "";
  document.getElementById("projectExistingImageURL").value = project.imageURL || "";
  document.getElementById("projectExistingImagePublicId").value = project.imagePublicId || "";
  document.getElementById("projectTitle").value = project.title || "";
  document.getElementById("projectDescription").value = project.description || "";
  document.getElementById("projectTech").value = techList(project).join(", ");
  document.getElementById("projectCategory").value = project.category || "";
  document.getElementById("projectStatus").value = project.status || "In progress";
  document.getElementById("projectDate").value = project.date || "";
  document.getElementById("projectLink").value = project.link || "";
  document.getElementById("projectRepoLink").value = project.repoLink || "";

  const isEdit = !!project.id;
  projectModalTitle.textContent = isEdit ? "Edit project" : "Add project";
  projectSubmitBtn.textContent = isEdit ? "Save changes" : "Save project";
  currentProjectImageNote.textContent = isEdit && project.imageURL
    ? "An image is already attached (choose a new one only to replace it)."
    : "";

  openModal(projectModal);
}

if (projectForm) {
  projectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    projectError.classList.remove("active");
    projectSubmitBtn.disabled = true;
    projectSubmitBtn.textContent = "Saving…";

    try {
      const id = document.getElementById("projectId").value;
      const title = document.getElementById("projectTitle").value.trim();
      const description = document.getElementById("projectDescription").value.trim();
      const technologies = document.getElementById("projectTech").value
        .split(",").map((t) => t.trim()).filter(Boolean);
      const category = document.getElementById("projectCategory").value.trim();
      const status = document.getElementById("projectStatus").value;
      const date = document.getElementById("projectDate").value;
      const link = document.getElementById("projectLink").value.trim();
      const repoLink = document.getElementById("projectRepoLink").value.trim();
      const imageInput = document.getElementById("projectImage");
      const existingImageURL = document.getElementById("projectExistingImageURL").value;
      const existingImagePublicId = document.getElementById("projectExistingImagePublicId").value;

      let imageURL = existingImageURL || null;
      let imagePublicId = existingImagePublicId || null;

      const file = imageInput.files[0];
      if (file) {
        projectSubmitBtn.textContent = "Uploading image…";
        const uploaded = await uploadToCloudinary(file);
        imageURL = uploaded.url;
        imagePublicId = uploaded.publicId;
        projectSubmitBtn.textContent = "Saving…";
      }

      const payload = { title, description, technologies, category, status, date, link, repoLink, imageURL, imagePublicId };

      if (id) {
        await updateDoc(doc(db, "projects", id), payload);
        showToast("Project updated.");
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(projectsCol, payload);
        showToast("Project added.");
      }

      closeModal(projectModal);
    } catch (err) {
      console.error(err);
      projectError.textContent = "Couldn't save this project. Please try again.";
      projectError.classList.add("active");
    } finally {
      projectSubmitBtn.disabled = false;
    }
  });
}

async function handleDeleteProject(id) {
  const project = allProjects.find((p) => p.id === id);
  if (!project) return;
  const sure = confirm(`Delete "${project.title}"? This can't be undone.`);
  if (!sure) return;

  try {
    await deleteDoc(doc(db, "projects", id));
    showToast("Project deleted.");
  } catch (err) {
    console.error(err);
    showToast("Couldn't delete this project.");
  }
}
