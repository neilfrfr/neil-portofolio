// ================================================================
// site.js — shared UI behavior (no Firebase). Loaded on every page,
// before app.js, as a plain (non-module) script.
// ================================================================
(function () {
  "use strict";

  // ---------- Mobile navigation ----------
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      navToggle.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
    });
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        navToggle.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ---------- Scroll reveal ----------
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("active"));
  }

  // ---------- Toast ----------
  const toastEl = document.getElementById("toast");
  let toastTimer = null;
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("active");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("active"), 2800);
  }

  // ---------- Generic modal open/close (login, record, project, viewer) ----------
  function openModal(el) {
    if (!el) return;
    el.classList.add("active");
    document.body.classList.add("modal-open");
  }
  function closeModal(el) {
    if (!el) return;
    el.classList.remove("active");
    if (!document.querySelector(".modal-overlay.active")) {
      document.body.classList.remove("modal-open");
    }
  }
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal(document.getElementById(btn.dataset.closeModal));
    });
  });
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.active").forEach(closeModal);
    }
  });

  // Exposed for app.js (loaded after this file)
  window.Site = { showToast, openModal, closeModal };

  // ---------- Graceful fallback for optional images (profile photo, project shots) ----------
  window.handleAssetFallback = function (img, initials) {
    const frame = img.closest("[data-fallback-frame]");
    img.remove();
    if (frame) {
      frame.classList.add("no-image");
      const span = document.createElement("span");
      span.className = "portrait-fallback";
      span.textContent = initials || "";
      frame.appendChild(span);
    }
  };
})();
