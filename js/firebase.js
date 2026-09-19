// =====================================================
// CAREGIVER HUB - Firebase Initialization
// =====================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCVJZ9m7nD0M2UF4oNC3afH6IZcdEv_UHs',
  authDomain: 'carehub-70809.firebaseapp.com',
  projectId: 'carehub-70809',
  storageBucket: 'carehub-70809.firebasestorage.app',
  messagingSenderId: '45546956895',
  appId: '1:45546956895:web:508f81dc6b7aef243d53ea',
  measurementId: 'G-QT69571Y6B'
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Session cache key for instant auth on page load
const SESSION_KEY = 'careHub_firebase_user';

function _cacheUser(user, profile) {
  if (!user) { sessionStorage.removeItem(SESSION_KEY); return; }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    uid:         user.uid,
    name:        profile?.name        || user.displayName || user.email,
    email:       user.email,
    role:        profile?.role        || 'Caregiver',
    patientName: profile?.patientName || '',
    phone:       profile?.phone       || '',
    _cachedAt:   Date.now(),
  }));
}

// Keep cache in sync automatically
onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    const snap = await getDoc(doc(db, 'users', firebaseUser.uid)).catch(() => null);
    _cacheUser(firebaseUser, snap?.exists() ? snap.data() : null);
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
});

export async function registerUser(name, email, password, role = 'Caregiver', extra = {}) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  const profile = { name, email: email.toLowerCase(), role,
    patientName: extra.patientName || '', phone: extra.phone || '',
    createdAt: serverTimestamp() };
  await setDoc(doc(db, 'users', cred.user.uid), profile);
  _cacheUser(cred.user, profile);
  return cred;
}

export async function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('careHub_user');
  return signOut(auth);
}

export function getCachedUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u && u._cachedAt && Date.now() - u._cachedAt < 3600000) return u;
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  } catch (_) { return null; }
}

export async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? { uid: user.uid, ...snap.data() } : null;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function saveScore(game, data) {
  const user = auth.currentUser;
  if (!user) return;
  await addDoc(collection(db, 'users', user.uid, 'scores'), { game, ...data, playedAt: serverTimestamp() });
}

export async function updateUserProfile(fields) {
  const user = auth.currentUser;
  if (!user) return;
  await updateDoc(doc(db, 'users', user.uid), fields);
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  _cacheUser(user, snap?.exists() ? snap.data() : null);
}

export { app, auth, db, serverTimestamp };