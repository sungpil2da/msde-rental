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

// 중복 알림 방지: FCM SDK가 처리했으면 플래그 설정
let fcmHandled = false;

// 안드로이드/데스크톱: FCM SDK가 백그라운드 메시지 처리
messaging.onBackgroundMessage(payload => {
  fcmHandled = true;
  // 짧은 시간 후 플래그 리셋
  setTimeout(() => { fcmHandled = false; }, 3000);

  const { title, body } = payload.notification || {};
  return self.registration.showNotification(title || 'MSDE 대여시스템', {
    body: body || '새 알림이 있어요!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: 'https://msderental.netlify.app' }
  });
});

// iOS: FCM SDK가 처리 못한 경우 push 이벤트 직접 처리
self.addEventListener('push', e => {
  if (fcmHandled) return; // FCM SDK가 이미 처리했으면 스킵

  let title = 'MSDE 대여시스템';
  let body = '새 알림이 있어요!';
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
      const existing = list.find(c => c.url.startsWith(target));
      if (existing) return existing.focus();
      return clients.openWindow(target);
    })
  );
});

const CACHE = 'msde-v7';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
