// =====================================================
// CAREGIVER HUB – Notification System & Web Audio Chime
// =====================================================

const NOTIF_STORAGE_KEY = 'careHub_notifications';

/** Play a gentle synthesized chime for notifications */
export function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, now); // A4
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.2); // E5

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (_) {}
}

/** Request browser notification permission */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission !== 'denied') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

/** Get stored notification history */
export function getStoredNotifications() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

/** Save notification to in-app history */
export function saveNotification(item) {
  const notifs = getStoredNotifications();
  const newNotif = {
    id: item.id || 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    title: item.title || 'CareHub Alert',
    body: item.body || '',
    type: item.type || 'reminder', // 'medication' | 'game' | 'milestone' | 'general'
    timestamp: Date.now(),
    read: false,
    link: item.link || null,
  };
  notifs.unshift(newNotif);
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifs.slice(0, 40)));
  updateNotificationCenterUI();
  return newNotif;
}

/** Trigger real notification (browser OS notification + in-app center + audio chime) */
export async function notify(title, options = {}) {
  const body = options.body || '';
  const type = options.type || 'general';

  // 1. In-App Notification Center
  const item = saveNotification({
    title,
    body,
    type,
    link: options.link || null,
  });

  // 2. Play sound
  if (!options.silent) {
    playChime();
  }

  // 3. Web Notification API (OS popup)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: options.icon || 'https://api.iconify.design/fluent-emoji:hospital.svg',
        badge: 'https://api.iconify.design/fluent-emoji:bell.svg',
        tag: options.tag || ('carehub_' + Date.now()),
        silent: true, // we play our own friendly chime
      });
      n.onclick = () => {
        window.focus();
        if (options.link) window.location.href = options.link;
        n.close();
      };
    } catch (e) {
      console.warn('Native notification failed:', e);
    }
  }

  return item;
}

/** Mark all notifications as read */
export function markAllNotificationsRead() {
  const notifs = getStoredNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifs));
  updateNotificationCenterUI();
}

/** Clear all notifications */
export function clearAllNotifications() {
  localStorage.removeItem(NOTIF_STORAGE_KEY);
  updateNotificationCenterUI();
}

/** Refresh notification bell count and dropdown content */
export function updateNotificationCenterUI() {
  const badge = document.getElementById('notif-badge');
  const listEl = document.getElementById('notif-items-list');
  const emptyEl = document.getElementById('notif-empty-state');
  const notifs = getStoredNotifications();
  const unread = notifs.filter(n => !n.read).length;

  if (badge) {
    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (listEl) {
    if (notifs.length === 0) {
      listEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      listEl.style.display = 'block';

      const typeIcons = {
        medication: { icon: 'fa-pills', color: '#f43f5e', bg: '#ffe4e6' },
        game:       { icon: 'fa-gamepad', color: '#6366f1', bg: '#e0e7ff' },
        milestone:  { icon: 'fa-trophy', color: '#f59e0b', bg: '#fef3c7' },
        general:    { icon: 'fa-bell', color: '#0891b2', bg: '#cffafe' },
      };

      listEl.innerHTML = notifs.slice(0, 15).map(n => {
        const theme = typeIcons[n.type] || typeIcons.general;
        const timeStr = formatNotifTime(n.timestamp);
        return `
          <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
            <div class="notif-icon-circle" style="background:${theme.bg};color:${theme.color};">
              <i class="fas ${theme.icon}"></i>
            </div>
            <div class="notif-text">
              <div class="notif-item-title">${escapeHtml(n.title)}</div>
              <div class="notif-item-body">${escapeHtml(n.body)}</div>
              <div class="notif-item-time">${timeStr}</div>
            </div>
            ${!n.read ? '<div class="unread-dot"></div>' : ''}
          </div>
        `;
      }).join('');
    }
  }
}

function formatNotifTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}
