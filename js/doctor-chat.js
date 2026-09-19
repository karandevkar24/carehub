// =====================================================
// CAREGIVER HUB – Doctor Chat Module (Feature 2)
// Firestore real-time messaging between caregiver and doctor
//
// Data model:
//   chats/{chatId}
//     participants:    [uid, doctorPlaceId]
//     doctorId:        string  (place_id or local fallback)
//     doctorName:      string
//     doctorPhone:     string
//     caregiverId:     string  (uid)
//     createdAt:       timestamp
//     lastMessage:     string
//     lastMessageAt:   timestamp
//
//     messages/{msgId}
//       senderId:      string
//       text:          string
//       timestamp:     serverTimestamp
//       read:          boolean
//       status:        'sent' | 'failed' | 'queued'
// =====================================================

import {
  getFirestore, doc, setDoc, getDoc, addDoc, updateDoc,
  collection, query, orderBy, limit, onSnapshot, serverTimestamp,
  where, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { app } from './firebase.js';

const db = getFirestore(app);

// ── Offline message queue (persisted in sessionStorage) ───
const QUEUE_KEY = 'careHub_msgQueue';

function loadQueue() {
  try { return JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}
function saveQueue(q) {
  sessionStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}
function addToQueue(chatId, text, tempId) {
  const q = loadQueue();
  q.push({ chatId, text, tempId, queuedAt: Date.now() });
  saveQueue(q);
}
function removeFromQueue(tempId) {
  const q = loadQueue().filter(m => m.tempId !== tempId);
  saveQueue(q);
}

// ── Chat ID generation ─────────────────────────────────────
function makeChatId(uid, doctorId) {
  // Stable, order-independent ID
  const parts = [uid, doctorId].sort();
  // Replace chars that Firestore doesn't allow in document IDs
  return parts.join('__').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Open an existing chat or create a new one (idempotent).
 * Also creates a lightweight doctorProfiles record on first message.
 * @param {{ uid: string }} user
 * @param {{ placeId?: string, id?: string, name: string, phone?: string, specialization?: string, emoji?: string }} doctor
 * @returns {Promise<string>} chatId
 */
export async function openOrCreateChat(user, doctor) {
  if (!user?.uid) throw new Error('Not authenticated');
  const doctorId = doctor.placeId || doctor.id || `local_${doctor.name.replace(/\s/g, '_')}`;

  const chatId = makeChatId(user.uid, doctorId);
  const chatRef = doc(db, 'chats', chatId);
  const snap = await getDoc(chatRef);

  if (!snap.exists()) {
    // Create chat doc
    await setDoc(chatRef, {
      participants:  [user.uid, doctorId],
      doctorId,
      doctorName:    doctor.name,
      doctorPhone:   doctor.phone || '',
      doctorEmoji:   doctor.emoji || '⚕️',
      doctorSpec:    doctor.specialization || '',
      caregiverId:   user.uid,
      caregiverName: user.name || user.email || 'Caregiver',
      createdAt:     serverTimestamp(),
      lastMessage:   '',
      lastMessageAt: serverTimestamp(),
    });

    // Create / update doctor profile record (lightweight inbox stub)
    const profileRef = doc(db, 'doctorProfiles', doctorId.replace(/[^a-zA-Z0-9_-]/g, '_'));
    const profSnap = await getDoc(profileRef);
    if (!profSnap.exists()) {
      await setDoc(profileRef, {
        doctorId,
        name:         doctor.name,
        phone:        doctor.phone || '',
        specialization: doctor.specialization || '',
        emoji:        doctor.emoji || '⚕️',
        source:       doctor.placeId ? 'google_places' : 'local',
        createdAt:    serverTimestamp(),
      });
    }
  }

  return chatId;
}

/**
 * Send a message to a chat. Handles offline queuing + failed-send state.
 * @param {string} chatId
 * @param {string} uid
 * @param {string} text
 * @param {Function} onStatusChange  – called with (tempId, 'sent'|'failed'|'queued')
 * @returns {Promise<string>} tempId
 */
export async function sendMessage(chatId, uid, text, onStatusChange) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  if (trimmed.length > 2000) throw new Error('Message too long (max 2000 characters)');

  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Offline → queue
  if (!navigator.onLine) {
    addToQueue(chatId, trimmed, tempId);
    onStatusChange?.(tempId, 'queued');
    return tempId;
  }

  onStatusChange?.(tempId, 'sending');

  try {
    const msgsRef = collection(db, 'chats', chatId, 'messages');
    await addDoc(msgsRef, {
      senderId:  uid,
      text:      trimmed,
      timestamp: serverTimestamp(),
      read:      false,
      status:    'sent',
      tempId,
    });

    // Update chat meta
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage:   trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed,
      lastMessageAt: serverTimestamp(),
    });

    onStatusChange?.(tempId, 'sent');
  } catch (err) {
    console.error('[Chat] sendMessage failed:', err);
    // Preserve message in queue for retry
    addToQueue(chatId, trimmed, tempId);
    onStatusChange?.(tempId, 'failed');
    throw err;
  }

  return tempId;
}

/**
 * Retry a queued / failed message.
 */
export async function retryMessage(chatId, uid, tempId, onStatusChange) {
  const queue = loadQueue();
  const item = queue.find(m => m.tempId === tempId);
  if (!item) return;

  removeFromQueue(tempId);
  try {
    await sendMessage(chatId, uid, item.text, onStatusChange);
  } catch (_) {
    addToQueue(chatId, item.text, tempId);
  }
}

/**
 * Flush offline queue when connectivity is restored.
 * Call this on window 'online' event.
 */
export async function flushMessageQueue(uid, onFlushed) {
  const queue = loadQueue();
  if (!queue.length) return;

  for (const item of queue) {
    try {
      removeFromQueue(item.tempId);
      await sendMessage(item.chatId, uid, item.text, (id, status) => {
        onFlushed?.(item.chatId, id, status);
      });
    } catch (_) {
      // Re-queued inside sendMessage on failure
    }
  }
}

/**
 * Subscribe to real-time messages in a chat.
 * Returns unsubscribe function. Times out to error state if no data in 6s.
 * @param {string} chatId
 * @param {Function} onMessages  – (messages: Array) => void
 * @param {Function} onError     – (err: Error) => void
 * @returns {Function} unsubscribe
 */
export function subscribeToMessages(chatId, onMessages, onError) {
  const msgsRef = collection(db, 'chats', chatId, 'messages');
  const q = query(msgsRef, orderBy('timestamp', 'asc'), limit(200));

  let gotData = false;
  const timeout = setTimeout(() => {
    if (!gotData) onError?.(new Error('Messages took too long to load'));
  }, 6000);

  const unsub = onSnapshot(
    q,
    (snap) => {
      clearTimeout(timeout);
      gotData = true;
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      onMessages(msgs);
    },
    (err) => {
      clearTimeout(timeout);
      console.error('[Chat] onSnapshot error:', err);
      onError?.(err);
    }
  );

  return () => {
    clearTimeout(timeout);
    unsub();
  };
}

/**
 * Mark all unread messages (not from current user) as read.
 */
export async function markMessagesRead(chatId, uid) {
  try {
    const msgsRef = collection(db, 'chats', chatId, 'messages');
    const q = query(msgsRef, where('read', '==', false), where('senderId', '!=', uid));
    const snap = await getDocs(q);
    const updates = snap.docs.map(d => updateDoc(d.ref, { read: true }));
    await Promise.all(updates);
  } catch (_) {
    // Non-critical — silently fail
  }
}

/**
 * Get all chats for a user (for a future "my conversations" page).
 */
export async function getUserChats(uid) {
  const chatsRef = collection(db, 'chats');
  const q = query(chatsRef, where('caregiverId', '==', uid), orderBy('lastMessageAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export { loadQueue };
