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

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'MSDE 대여시스템', {
    body: body || '새 알림이 있어요!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: 'https://msderental.netlify.app' }
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('https://msderental.netlify.app');
    })
  );
});

// 캐시 버전 업 → 강제 업데이트
const CACHE = 'msde-v4';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
