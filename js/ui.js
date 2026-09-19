// =====================================================
// CAREGIVER HUB - Shared UI Utilities
// =====================================================
import { onAuthChange, getCurrentUserProfile, logoutUser, getCachedUser } from './firebase.js';

/**
 * Get the current user session.
 * Priority: 1) Firebase session cache (instant) 2) Demo sessionStorage 3) Firebase auth wait
 * Redirects to login.html if no user found.
 */
export function getSession() {
  // --- Priority 1: Firebase session cache (instant, no network) ---
  const cached = getCachedUser();
  if (cached) return Promise.resolve(cached);

  // --- Priority 2: Client-side / Demo mode (sessionStorage or localStorage) ---
  try {
    const raw = sessionStorage.getItem('careHub_user') || localStorage.getItem('careHub_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u && (u.name || u.email)) return Promise.resolve(u);
    }
  } catch (_) {}

  // --- Priority 3: Wait for Firebase (first-ever visit after login) ---
  return new Promise((resolve) => {
    // Safety timeout - redirect to login if Firebase takes > 4s
    const timeout = setTimeout(() => {
      window.location.replace('login.html');
      resolve(null);
    }, 4000);

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      clearTimeout(timeout);
      unsubscribe();
      if (!firebaseUser) {
        window.location.replace('login.html');
        resolve(null);
        return;
      }
      const profile = await getCurrentUserProfile().catch(() => null);
      const user = {
        uid:         firebaseUser.uid,
        name:        profile?.name        || firebaseUser.displayName || firebaseUser.email,
        email:       firebaseUser.email,
        role:        profile?.role        || 'Caregiver',
        patientName: profile?.patientName || '',
        phone:       profile?.phone       || '',
      };
      resolve(user);
    });
  });
}

/** First-letter initials from a full name (max 2 chars) */
export function initials(name) {
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/** Perform full logout: clear all session & local auth states and redirect to login */
export async function performLogout() {
  try { await logoutUser(); } catch (_) {}
  sessionStorage.removeItem('careHub_user');
  localStorage.removeItem('careHub_user');
  sessionStorage.removeItem('careHub_firebase_user');
  window.location.replace('login.html');
}

/** Populate the shared page header with user data. */
export async function populateHeader(userOrPromise) {
  const user = (userOrPromise instanceof Promise) ? await userOrPromise : userOrPromise;
  if (!user) return;

  const avatarEl = document.getElementById('header-avatar');
  const nameEl   = document.getElementById('header-name');
  const logoutEl = document.getElementById('logout-btn');
  const headerLogoutBtn = document.getElementById('header-logout-btn');

  if (avatarEl) {
    if (user.photoURL) {
      avatarEl.innerHTML = `<img src="${user.photoURL}" alt="${user.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else {
      avatarEl.textContent = initials(user.name);
    }
  }
  if (nameEl)   nameEl.textContent   = user.name.split(' ')[0];

  if (logoutEl) {
    logoutEl.addEventListener('click', performLogout);
  }
  if (headerLogoutBtn) {
    headerLogoutBtn.addEventListener('click', performLogout);
  }
}

/** Show a toast notification */
export function showToast(msg, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const icons  = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warn: 'fa-exclamation-triangle' };
  const colors = { success: '#22c55e', error: '#f43f5e', warn: '#f59e0b' };
  const toast  = document.createElement('div');
  toast.style.cssText = `display:flex;align-items:center;gap:10px;padding:13px 18px;background:white;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.12);border-left:4px solid ${colors[type]};font-size:0.875rem;font-weight:500;color:#1e293b;max-width:320px;font-family:'Inter',sans-serif;`;
  toast.innerHTML = `<i class="fas ${icons[type]}" style="color:${colors[type]};font-size:15px;"></i><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = '0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, duration);
}