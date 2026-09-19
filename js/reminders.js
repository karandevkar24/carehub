// =====================================================
// CAREGIVER HUB – Daily Reminders (Medication & Games)
// =====================================================

import { auth, db } from './firebase.js';
import {
  collection, doc, getDocs, addDoc, updateDoc,
  deleteDoc, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { notify, requestNotificationPermission } from './notifications.js';

const LOCAL_REMINDERS_KEY = 'careHub_reminders';
let schedulerInterval = null;

const DEFAULT_REMINDERS = [
  {
    id: 'rem_default_1',
    type: 'medication',
    title: 'Morning Medication (Donepezil 5mg)',
    time: '09:00',
    schedule: 'daily',
    notes: 'Take with breakfast and a glass of water.',
    active: true,
  },
  {
    id: 'rem_default_2',
    type: 'game',
    title: 'Afternoon Brain Workout (Memory Match)',
    time: '14:30',
    schedule: 'daily',
    notes: '15 minutes of cognitive exercise to stimulate recall.',
    active: true,
  },
  {
    id: 'rem_default_3',
    type: 'medication',
    title: 'Evening Medication & Hydration',
    time: '20:00',
    schedule: 'daily',
    notes: 'Evening dose followed by a light chamomile tea or warm milk.',
    active: true,
  },
];

/** Fetch all reminders for current user */
export async function getReminders() {
  const user = auth.currentUser;
  if (user) {
    try {
      const q = query(collection(db, 'users', user.uid, 'reminders'), orderBy('time', 'asc'));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      if (list.length > 0) {
        localStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.warn('Firestore getReminders fallback to local:', e.message);
    }
  }

  // Fallback to local storage
  const stored = localStorage.getItem(LOCAL_REMINDERS_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch (_) {}
  }

  // Seed default reminders on first launch
  localStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify(DEFAULT_REMINDERS));
  return DEFAULT_REMINDERS;
}

/** Add a new reminder */
export async function addReminder(data) {
  const user = auth.currentUser;
  const newObj = {
    type: data.type || 'medication', // 'medication' | 'game' | 'custom'
    title: data.title.trim(),
    time: data.time, // "HH:MM"
    schedule: data.schedule || 'daily', // 'daily' | 'weekdays' | 'weekends'
    notes: data.notes?.trim() || '',
    active: true,
    createdAt: new Date().toISOString(),
  };

  let assignedId = 'rem_' + Date.now();

  if (user) {
    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'reminders'), {
        ...newObj,
        createdAt: serverTimestamp(),
      });
      assignedId = docRef.id;
    } catch (e) {
      console.warn('Firestore addDoc fallback:', e.message);
    }
  }

  // Update local
  const current = await getReminders();
  current.push({ id: assignedId, ...newObj });
  current.sort((a, b) => a.time.localeCompare(b.time));
  localStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify(current));

  return { id: assignedId, ...newObj };
}

/** Update an existing reminder */
export async function updateReminder(id, data) {
  const user = auth.currentUser;
  if (user && !id.startsWith('rem_')) {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'reminders', id), data);
    } catch (e) {
      console.warn('Firestore updateDoc failed:', e.message);
    }
  }

  const current = await getReminders();
  const idx = current.findIndex(r => r.id === id);
  if (idx !== -1) {
    current[idx] = { ...current[idx], ...data };
    current.sort((a, b) => a.time.localeCompare(b.time));
    localStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify(current));
  }
}

/** Delete a reminder */
export async function deleteReminder(id) {
  const user = auth.currentUser;
  if (user && !id.startsWith('rem_')) {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'reminders', id));
    } catch (e) {
      console.warn('Firestore deleteDoc failed:', e.message);
    }
  }

  const current = (await getReminders()).filter(r => r.id !== id);
  localStorage.setItem(LOCAL_REMINDERS_KEY, JSON.stringify(current));
}

/** Toggle reminder active state */
export async function toggleReminder(id, active) {
  return updateReminder(id, { active });
}

/** Check reminders every 15 seconds against local system time */
export function startReminderScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);

  // Request browser permission proactively
  requestNotificationPermission();

  const check = async () => {
    const reminders = await getReminders();
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMins = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMins}`;
    const dayOfWeek = now.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isWeekday = !isWeekend;
    const todayKey = now.toISOString().split('T')[0];

    for (const rem of reminders) {
      if (!rem.active) continue;

      // Check schedule match
      if (rem.schedule === 'weekdays' && !isWeekday) continue;
      if (rem.schedule === 'weekends' && !isWeekend) continue;

      if (rem.time === currentTimeStr) {
        const triggerKey = `careHub_triggered_${rem.id}_${todayKey}_${currentTimeStr}`;
        if (sessionStorage.getItem(triggerKey)) continue; // Already triggered this minute

        sessionStorage.setItem(triggerKey, 'true');

        const isMed = rem.type === 'medication';
        const title = isMed ? `💊 Medication Time: ${rem.title}` : `🧩 Brain Activity Time: ${rem.title}`;
        const body = rem.notes ? rem.notes : (isMed ? 'Time to administer patient medication.' : 'Time for cognitive exercise & games.');
        const link = isMed ? 'dashboard.html' : 'games.html';

        notify(title, {
          body,
          type: rem.type,
          link,
          tag: `rem_${rem.id}`,
        });
      }
    }
  };

  schedulerInterval = setInterval(check, 15000);
  check(); // initial run
}
