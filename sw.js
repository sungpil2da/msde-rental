importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCBnt83_rya4Y_qs68_yAcdrhaezNhW9Ks",
  authDomain: "betmsde-4443e.firebaseapp.com",
  projectId: "betmsde-4443e",
  storageBucket: "betmsde-4443e.firebasestorage.app",
  messagingSenderId: "340466602931",
  appId: "1:340466602931:web:44c6423863aee0d75f31c6"
});

const messaging = firebase.messaging();

// ── 안드로이드 / 데스크톱: FCM 백그라운드 메시지 ──────────
// FCM SDK가 push 이벤트를 내부적으로 처리하고 여기서 알림을 표시
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'MSDE 대여시스템';
  const body  = payload.notification?.body  || '새 알림이 있어요!';
  return self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: 'https://msderental.netlify.app' }
  });
});

// ── iOS: VAPID Web Push ────────────────────────────────────
// iOS에서는 FCM SDK가 동작하지 않으므로 push 이벤트를 직접 처리
// FCM 메시지는 messaging.onBackgroundMessage에서 이미 처리되므로
// 여기서는 VAPID(iOS) 메시지만 처리
self.addEventListener('push', e => {
  // FCM SDK가 처리하는 메시지는 여기 도달하지 않음
  // iOS VAPID 메시지만 여기서 처리됨
  let title = 'MSDE 대여시스템';
  let body  = '새 알림이 있어요!';
  try {
    if (e.data) {
      const d = e.data.json();
      title = d.notification?.title || d.title || title;
      body  = d.notification?.body  || d.body  || body;
    }
  } catch(_) {
    try { body = e.data?.text() || body; } catch(_) {}
  }
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: 'https://msderental.netlify.app' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const target = 'https://msderental.netlify.app';
      const found = list.find(c => c.url.startsWith(target));
      if (found) return found.focus();
      return clients.openWindow(target);
    })
  );
});

const CACHE = 'msde-v11';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
