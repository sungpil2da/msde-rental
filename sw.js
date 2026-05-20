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

// data-only 메시지 → FCM SDK는 자동 알림 표시 안 함
// onBackgroundMessage에서 직접 showNotification
messaging.onBackgroundMessage(payload => {
  const title = payload.data?.title || payload.notification?.title || 'MSDE 대여시스템';
  const body  = payload.data?.body  || payload.notification?.body  || '새 알림이 있어요!';
  return self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: 'https://msderental.netlify.app' }
  });
});

// iOS PWA: FCM SDK onBackgroundMessage가 동작하지 않을 때 push 이벤트로 fallback
self.addEventListener('push', e => {
  // FCM data-only 메시지인지 확인
  let title = 'MSDE 대여시스템';
  let body = '새 알림이 있어요!';
  let isFcmDataOnly = false;

  try {
    if (e.data) {
      const d = e.data.json();
      // FCM data-only: { data: { title, body } }
      if (d.data?.title) {
        title = d.data.title;
        body  = d.data.body || body;
        isFcmDataOnly = true;
      }
      // 일반 notification 페이로드
      else if (d.notification?.title) {
        title = d.notification.title;
        body  = d.notification.body || body;
      }
      else if (d.title) {
        title = d.title;
        body  = d.body || body;
      }
    }
  } catch(_) {
    try { body = e.data?.text() || body; } catch(_) {}
  }

  // FCM SDK(안드로이드)는 onBackgroundMessage에서 처리하므로
  // iOS에서만 push 이벤트가 별도로 처리됨
  // 단, data-only이면서 FCM이 처리 못한 경우(iOS)에만 showNotification
  e.waitUntil(
    self.registration.getNotifications().then(existing => {
      // 0.5초 이내 같은 제목 알림이 이미 있으면 중복 → 스킵
      const isDuplicate = existing.some(n => n.title === title);
      if (isDuplicate) return;
      return self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: 'https://msderental.netlify.app' }
      });
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const target = 'https://msderental.netlify.app';
      const existing = list.find(c => c.url.startsWith(target));
      if (existing) return existing.focus();
      return clients.openWindow(target);
    })
  );
});

const CACHE = 'msde-v8';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
