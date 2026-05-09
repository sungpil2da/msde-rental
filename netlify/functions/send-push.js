const FIREBASE_URL = 'https://betmsde-4443e-default-rtdb.asia-southeast1.firebasedatabase.app';
const PROJECT_ID   = 'betmsde-4443e';
const SA_EMAIL     = 'firebase-adminsdk-fbsvc@betmsde-4443e.iam.gserviceaccount.com';
const TOKEN_URI    = 'https://oauth2.googleapis.com/token';
const PRIVATE_KEY  = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD1jvl+EOk3pfNF\npJvyRgrthnojKaNdQyCW0cCeCJflYg1+4JNLA9kJpnGnZO2Ufdqy8ASabCBhdOvQ\nMRyI9r67H5DVIL6apy9oIRerCfrp6UOcakCydQgSwQbAB+gJ2jx1qgTg9HPc48TH\nRX6A3KTY3823+N8aF8HZVtligaPFQ1mbwvGodcPXbAV90ELutSHRhA1xM8L2eAXo\nG1Q/rHzspL5UoMD7MTM9u9Qsxr2ylNPlieIRGrH+6WeUMMt4frrbVY3pVV8XlA71\nz1FGXtxaSR7V3wrbRTpV0cLhuWFPE+CajRaIphpj0mNHrpEivwpFbQV2PEM+tKxu\nYaY8DV65AgMBAAECggEAGonC43G67rFv5uspEmgo9q4lpYayudnPHBWbokit99Oe\nv0NQj9cg3ebf2hYxie6HE/cWHEVKw5WSBaxFF/VIvCrnaW0yRD8Ew9VtvCWmOSDl\nVnJyPwcgYfx7+QVxuZzdE19WSySIIAt6oQmc6BrQcwLO9g6+t9Bw+gblk/yMQT11\nreKEF82Zgq0UKkF5BcT5hkF90326bO7x5oEHhe9iad1Z3FyjrvZuCUDM91lRwREG\nh/QC+p+Qcir49GqDQJA5Pgje1Tmg2weXwBnoDSS9DTM4+HXQ7XzxMs4GXghHV8CG\nP40hjPoUzCMTaPTgHBE1eRWWBrUX2egGLiCyXsFk4QKBgQD/hjUlbjFnRGQNri/v\nwFK5DhcJfSZq12HVeJa8zHLNq9C5NO8e7QLv1pOLXBXREHfnMwP8AZdppUWx1+dV\nOIx64uFhQXw928ELUGn/6pLnNdgR86JDPXLkgx652plU5ODnqOvOog7x5vstM6fI\nIGFWxGt98IgKN1gx1bcoqeQ/KQKBgQD2BARVVDPZuPhgpzP9p8ZPYcE11TgdY+/a\n9N/T1teKZTBOU3q6eeLd278IpRdH5r/pwuwCI8Uif7PFhDXiPurEGq2hXubRBiuO\nquSe/EHaTrq5WRZMoAEG2SJMf3Ps7qLWrS1mJkWNhU/gdemh7jHyfhpwECr9hsYd\nt+0TwGplEQKBgBubu5hMvKfEuu7DeEh2RjnabODIleMLXHW9LsQ9btYMD2RDdOap\ngxy42X5AN9c76UiguXh8D4kJo2sgwczybDNG2kUw1ySz3rrDOIC/LpoutibSZSDQ\nvd400JgSJ2kFxcsh9ECCQA0hANiUcTdtUDcYx+h2maxI6I2R4tVQ7elpAoGBAKnY\nsB0xGvMPzvr7tNtEv5cCiF/gKvOvkWL7eKRKSVjU73rEC5E+oTBGjCctw1rypkB/\nQG1hwLJGtBiDZKgkg/SL7p/gYz6gIeZHebuBsP1FKYjZRpn0RYEy24kw3RoQzv+j\nZBqIBbDk/vaasYgIaRdflGUV5HhQWeselmDykQHhAoGBANj9hqVk+2mKCpTb3OEt\nl5keC2kg1sxhWIiHQDkrGIv4EfJeOT+Hl+r6c5EHwnsnEsoxtNl6SoDAVWpgoXKx\nDE2xTu78n4a9y3z677pp8yeJ3HZmIthUHERtPwHrnS897eRkBqEUeZhC4dtvYDaA\nxTyuYRieUs3qICzTfLcRviWo\n-----END PRIVATE KEY-----\n";

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: SA_EMAIL, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: TOKEN_URI, iat: now, exp: now + 3600 };
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const crypto = require('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const jwt = `${signingInput}.${sign.sign(PRIVATE_KEY, 'base64url')}`;
  const res = await fetch(TOKEN_URI, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
  return (await res.json()).access_token;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const { title, body, secret, targetUser } = JSON.parse(event.body || '{}');
  if (secret !== 'msde2026push') return { statusCode: 403, body: 'Forbidden' };

  const res = await fetch(`${FIREBASE_URL}/fcm_tokens.json`);
  const data = await res.json();
  if (!data) return { statusCode: 200, body: JSON.stringify({ sent: 0, msg: 'no tokens' }) };

  const entries = targetUser
    ? Object.entries(data).filter(([k]) => k === encodeURIComponent(targetUser) || k === targetUser)
    : Object.entries(data);

  if (!entries.length) return { statusCode: 200, body: JSON.stringify({ sent: 0, msg: 'no matching tokens' }) };

  const accessToken = await getAccessToken();
  let sent = 0, failed = 0;

  await Promise.allSettled(entries.map(async ([key, token]) => {
    try {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: {
          token,
          notification: { title, body },
          webpush: { notification: { title, body, icon: '/icon-192.png', badge: '/icon-192.png' }, fcm_options: { link: 'https://msderental.netlify.app' } }
        }})
      });
      const result = await r.json();
      console.log('FCM result:', JSON.stringify(result));
      if (result.error) { failed++; if ([404,'NOT_FOUND'].includes(result.error.code||result.error.status)) await fetch(`${FIREBASE_URL}/fcm_tokens/${key}.json`,{method:'DELETE'}); }
      else sent++;
    } catch(e) { failed++; console.error('FCM error:', e.message); }
  }));

  return { statusCode: 200, body: JSON.stringify({ sent, failed }) };
};
