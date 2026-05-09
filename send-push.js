const webpush = require('web-push');

const VAPID_PUBLIC  = 'BNWk-vlWQV0P4StKFZj4HsaKv_tb42CUq0_WEguYggeMdplSlwEf-l47gbTltqE73b-u-0z4FLRM1pKJZ_0SHBY';
const VAPID_PRIVATE = 'XzRaGLRGtP7W_T1j9r0y5m8S5kuGbxUESU-teNURMf4';
const FIREBASE_URL  = 'https://betmsde-4443e-default-rtdb.asia-southeast1.firebasedatabase.app';

webpush.setVapidDetails('mailto:sungpil2da@naver.com', VAPID_PUBLIC, VAPID_PRIVATE);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { title, body, secret, targetUser } = JSON.parse(event.body || '{}');
  if (secret !== 'msde2026push') return { statusCode: 403, body: 'Forbidden' };

  const res = await fetch(`${FIREBASE_URL}/push_subscriptions.json`);
  const data = await res.json();
  if (!data) return { statusCode: 200, body: JSON.stringify({ sent: 0 }) };

  // targetUser 있으면 해당 유저에게만, 없으면 전체 전송
  const entries = targetUser
    ? Object.entries(data).filter(([k]) => k === encodeURIComponent(targetUser) || k === targetUser)
    : Object.entries(data);

  let sent = 0, failed = 0;
  await Promise.allSettled(entries.map(async ([key, sub]) => {
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title, body }));
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 410) {
        await fetch(`${FIREBASE_URL}/push_subscriptions/${key}.json`, { method: 'DELETE' });
      }
    }
  }));

  return { statusCode: 200, body: JSON.stringify({ sent, failed }) };
};
