import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
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
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ---------- Firebase setup ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const recordsCol = collection(db, "records");

// ---------- Local state ----------
let allRecords = [];      // everything currently in Firestore, kept in sync live
let isAdmin = false;
let activeCategory = "activities";

// ---------- DOM refs ----------
const adminNavBtn = document.getElementById("adminNavBtn");
const loginModal = document.getElementById("loginModal");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

const recordModal = document.getElementById("recordModal");
const recordForm = document.getElementById("recordForm");
const recordModalTitle = document.getElementById("recordModalTitle");
const recordError = document.getElementById("recordError");
const recordSubmitBtn = document.getElementById("recordSubmitBtn");
const currentFileNote = document.getElementById("currentFileNote");

const toastEl = document.getElementById("toast");

// ================================================================
// Toast
// ================================================================
let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("active");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("active"), 2800);
}

// ================================================================
// Modal helpers
// ================================================================
function openModal(el) {
  el.classList.add("active");
}
function closeModal(el) {
  el.classList.remove("active");
}
document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    closeModal(document.getElementById(btn.dataset.closeModal));
  });
});
[loginModal, recordModal].forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal(loginModal);
    closeModal(recordModal);
  }
});

// ================================================================
// Auth
// ================================================================
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
    loginError.textContent = "Couldn't log in — check your email and password.";
    loginError.classList.add("active");
  }
});

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  adminNavBtn.textContent = isAdmin ? "Log out" : "Admin";
  adminNavBtn.classList.toggle("is-logged-in", isAdmin);
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.style.display = isAdmin ? "" : "none";
  });
  renderActiveTab();
});

// ================================================================
// Tabs
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
// Live data sync
// ================================================================
onSnapshot(
  recordsCol,
  (snapshot) => {
    allRecords = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAllTabs();
  },
  (err) => {
    console.error("Failed to load records:", err);
    document.querySelectorAll(".record-list").forEach((list) => {
      list.innerHTML = `<p class="empty-state">Couldn't load items. Check your Firebase config and Firestore rules.</p>`;
    });
  }
);

function renderAllTabs() {
  ["activities", "short-quiz", "long-quiz"].forEach(renderCategory);
}
function renderActiveTab() {
  renderCategory(activeCategory);
}

function renderCategory(category) {
  const list = document.querySelector(`.record-list[data-list="${category}"]`);
  if (!list) return;

  const items = allRecords
    .filter((r) => r.category === category)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (items.length === 0) {
    list.innerHTML = `<p class="empty-state">Nothing here yet${isAdmin ? " — use \u201cAdd\u201d above to create the first entry." : "."}</p>`;
    return;
  }

  list.innerHTML = items.map((item) => {
    const titleHtml = item.fileURL
      ? `<a class="record-title" href="${escapeAttr(item.fileURL)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>`
      : `<span class="record-title">${escapeHtml(item.title)}</span>`;

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

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

// ================================================================
// Add / edit record
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
    handleDelete(deleteId);
  }
});

function openRecordModal(record) {
  recordError.classList.remove("active");
  recordForm.reset();
  document.getElementById("recordId").value = record.id || "";
  document.getElementById("recordCategory").value = record.category;
  document.getElementById("recordExistingFileURL").value = record.fileURL || "";
  document.getElementById("recordExistingFilePath").value = record.filePath || "";
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
    const existingFilePath = document.getElementById("recordExistingFilePath").value;

    let fileURL = existingFileURL || null;
    let filePath = existingFilePath || null;
    let fileName = null;

    const file = fileInput.files[0];
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `uploads/${category}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      fileURL = await getDownloadURL(storageRef);
      filePath = path;
      fileName = file.name;

      // Clean up the old file once the new one is safely uploaded
      if (id && existingFilePath) {
        deleteObject(ref(storage, existingFilePath)).catch(() => {});
      }
    } else if (id) {
      // keep existing file's display name if we didn't touch it
      const existing = allRecords.find((r) => r.id === id);
      fileName = existing ? existing.fileName : null;
    }

    const payload = { category, title, description, date, fileURL, filePath, fileName };

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

async function handleDelete(id) {
  const record = allRecords.find((r) => r.id === id);
  if (!record) return;
  const sure = confirm(`Delete "${record.title}"? This can't be undone.`);
  if (!sure) return;

  try {
    await deleteDoc(doc(db, "records", id));
    if (record.filePath) {
      deleteObject(ref(storage, record.filePath)).catch(() => {});
    }
    showToast("Item deleted.");
  } catch (err) {
    console.error(err);
    showToast("Couldn't delete this item.");
  }
}
