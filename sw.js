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

// FCM 백그라운드 메시지 핸들러
// notification 필드가 있으면 FCM SDK가 자동으로 알림을 표시함
// 여기서 showNotification을 추가로 호출하면 중복됨 → 호출 안 함
messaging.onBackgroundMessage(payload => {
  console.log('[SW] background message:', payload?.notification?.title);
  // FCM이 notification 필드로 알림을 자동 표시 → 아무것도 안 해도 됨
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

const CACHE = 'msde-v10';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
