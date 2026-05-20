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

// FCM SDK에 백그라운드 메시지 핸들러 등록
// notification 필드가 있으면 FCM이 자동으로 알림 표시하므로 여기서는 아무것도 안 함
// (핸들러를 등록해야 FCM SDK가 push 이벤트를 올바르게 처리함)
messaging.onBackgroundMessage(payload => {
  // FCM이 notification 필드로 이미 알림을 표시함 - 추가 showNotification 불필요
  console.log('[SW] FCM background message received');
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

const CACHE = 'msde-v9';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
