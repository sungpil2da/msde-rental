const FIREBASE_URL = 'https://betmsde-4443e-default-rtdb.asia-southeast1.firebasedatabase.app';
const PROJECT_ID   = 'betmsde-4443e';
const SA_EMAIL     = 'firebase-adminsdk-fbsvc@betmsde-4443e.iam.gserviceaccount.com';
const TOKEN_URI    = 'https://oauth2.googleapis.com/token';
const PRIVATE_KEY  = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD1jvl+EOk3pfNF\npJvyRgrthnojKaNdQyCW0cCeCJflYg1+4JNLA9kJpnGnZO2Ufdqy8ASabCBhdOvQ\nMRyI9r67H5DVIL6apy9oIRerCfrp6UOcakCydQgSwQbAB+gJ2jx1qgTg9HPc48TH\nRX6A3KTY3823+N8aF8HZVtligaPFQ1mbwvGodcPXbAV90ELutSHRhA1xM8L2eAXo\nG1Q/rHzspL5UoMD7MTM9u9Qsxr2ylNPlieIRGrH+6WeUMMt4frrbVY3pVV8XlA71\nz1FGXtxaSR7V3wrbRTpV0cLhuWFPE+CajRaIphpj0mNHrpEivwpFbQV2PEM+tKxu\nYaY8DV65AgMBAAECggEAGonC43G67rFv5uspEmgo9q4lpYayudnPHBWbokit99Oe\nv0NQj9cg3ebf2hYxie6HE/cWHEVKw5WSBaxFF/VIvCrnaW0yRD8Ew9VtvCWmOSDl\nVnJyPwcgYfx7+QVxuZzdE19WSySIIAt6oQmc6BrQcwLO9g6+t9Bw+gblk/yMQT11\nreKEF82Zgq0UKkF5BcT5hkF90326bO7x5oEHhe9iad1Z3FyjrvZuCUDM91lRwREG\nh/QC+p+Qcir49GqDQJA5Pgje1Tmg2weXwBnoDSS9DTM4+HXQ7XzxMs4GXghHV8CG\nP40hjPoUzCMTaPTgHBE1eRWWBrUX2egGLiCyXsFk4QKBgQD/hjUlbjFnRGQNri/v\nwFK5DhcJfSZq12HVeJa8zHLNq9C5NO8e7QLv1pOLXBXREHfnMwP8AZdppUWx1+dV\nOIx64uFhQXw928ELUGn/6pLnNdgR86JDPXLkgx652plU5ODnqOvOog7x5vstM6fI\nIGFWxGt98IgKN1gx1bcoqeQ/KQKBgQD2BARVVDPZuPhgpzP9p8ZPYcE11TgdY+/a\n9N/T1teKZTBOU3q6eeLd278IpRdH5r/pwuwCI8Uif7PFhDXiPurEGq2hXubRBiuO\nquSe/EHaTrq5WRZMoAEG2SJMf3Ps7qLWrS1mJkWNhU/gdemh7jHyfhpwECr9hsYd\nt+0TwGplEQKBgBubu5hMvKfEuu7DeEh2RjnabODIleMLXHW9LsQ9btYMD2RDdOap\ngxy42X5AN9c76UiguXh8D4kJo2sgwczybDNG2kUw1ySz3rrDOIC/LpoutibSZSDQ\nvd400JgSJ2kFxcsh9ECCQA0hANiUcTdtUDcYx+h2maxI6I2R4tVQ7elpAoGBAKnY\nsB0xGvMPzvr7tNtEv5cCiF/gKvOvkWL7eKRKSVjU73rEC5E+oTBGjCctw1rypkB/\nQG1hwLJGtBiDZKgkg/SL7p/gYz6gIeZHebuBsP1FKYjZRpn0RYEy24kw3RoQzv+j\nZBqIBbDk/vaasYgIaRdflGUV5HhQWeselmDykQHhAoGBANj9hqVk+2mKCpTb3OEt\nl5keC2kg1sxhWIiHQDkrGIv4EfJeOT+Hl+r6c5EHwnsnEsoxtNl6SoDAVWpgoXKx\nDE2xTu78n4a9y3z677pp8yeJ3HZmIthUHERtPwHrnS897eRkBqEUeZhC4dtvYDaA\nxTyuYRieUs3qICzTfLcRviWo\n-----END PRIVATE KEY-----\n";

const VAPID_PUBLIC  = 'BFR6cLQKBHSaFAHeEBrvDYu-Oc-mykF3UUT1Ism-c4DII9yTegFTBekytVYdgm4S20Ek5CDCTuJEGaMI0PF4Mzc';
const VAPID_PRIVATE = 'XzRaGLRGtP7W_T1j9r0y5m8S5kuGbxUESU-teNURMf4';

const crypto = require('crypto');

// ── 유틸 ──────────────────────────────────────────────────
function b64url(v) {
  return (Buffer.isBuffer(v) ? v : Buffer.from(v))
    .toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function fromB64url(s) {
  const p = '='.repeat((4 - s.length % 4) % 4);
  return Buffer.from((s + p).replace(/-/g,'+').replace(/_/g,'/'), 'base64');
}

// ── FCM Access Token (Google OAuth2) ─────────────────────
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sigInput = `${encode({alg:'RS256',typ:'JWT'})}.${encode({
    iss:SA_EMAIL, scope:'https://www.googleapis.com/auth/firebase.messaging',
    aud:TOKEN_URI, iat:now, exp:now+3600
  })}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(sigInput);
  const jwt = `${sigInput}.${sign.sign(PRIVATE_KEY,'base64url')}`;
  const res = await fetch(TOKEN_URI, {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  return (await res.json()).access_token;
}

// ── VAPID JWT (Apple Web Push 호환, 내장 crypto 사용) ────
function makeVapidJwt(audience) {
  // PKCS8 DER 포맷으로 EC private key 생성
  const privBuf = fromB64url(VAPID_PRIVATE);
  const der = Buffer.concat([
    Buffer.from('308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420','hex'),
    privBuf
  ]);
  const privKey = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });

  const now = Math.floor(Date.now() / 1000);
  const hdr = b64url(JSON.stringify({typ:'JWT', alg:'ES256'}));
  const pld = b64url(JSON.stringify({aud: audience, exp: now + 43200, sub: 'https://msderental.netlify.app'}));
  const input = hdr + '.' + pld;
  const sig = crypto.sign('SHA256', Buffer.from(input), {key: privKey, dsaEncoding: 'ieee-p1363'});
  return input + '.' + b64url(sig);
}

// ── VAPID 암호화 (AES-128-GCM, RFC 8291) ─────────────────
async function encryptVapidPayload(payload, sub) {
  const plaintext = Buffer.from(JSON.stringify(payload));
  const subPubKey = fromB64url(sub.keys.p256dh);
  const subAuth   = fromB64url(sub.keys.auth);

  // 서버 EC 키 쌍 생성
  const serverKey = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const serverPubDer = serverKey.publicKey.export({ type: 'spki', format: 'der' });
  const serverPubRaw = serverPubDer.slice(-65); // 마지막 65바이트가 raw public key

  // ECDH
  const subKeyObj = crypto.createPublicKey({ key: Buffer.concat([
    Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200','hex'), subPubKey
  ]), format: 'der', type: 'spki' });
  const sharedSecret = crypto.diffieHellman({ privateKey: serverKey.privateKey, publicKey: subKeyObj });

  // HKDF
  function hkdf(salt, ikm, info, len) {
    const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
    const T = crypto.createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest();
    return T.slice(0, len);
  }

  const salt = crypto.randomBytes(16);
  const prk  = hkdf(subAuth, sharedSecret, Buffer.concat([
    Buffer.from('WebPush: info\x00'), subPubKey, serverPubRaw
  ]), 32);
  const cek  = hkdf(salt, prk, Buffer.from('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = hkdf(salt, prk, Buffer.from('Content-Encoding: nonce\x00'), 12);

  // AES-128-GCM 암호화
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  // padding: 2바이트 길이 + plaintext + \x02
  const padded = Buffer.concat([plaintext, Buffer.from([2])]);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);

  // RFC 8291 헤더: salt(16) + rs(4=4096) + keyidlen(1) + serverPubRaw(65)
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  const header = Buffer.concat([salt, rs, Buffer.from([65]), serverPubRaw]);

  return { body: Buffer.concat([header, encrypted]), salt };
}

// ── 메인 핸들러 ───────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const { title, body, secret, targetUser } = JSON.parse(event.body || '{}');
  if (secret !== 'msde2026push') return { statusCode: 403, body: 'Forbidden' };

  const [fcmData, vapidData] = await Promise.all([
    fetch(`${FIREBASE_URL}/fcm_tokens.json`).then(r=>r.json()),
    fetch(`${FIREBASE_URL}/push_subscriptions.json`).then(r=>r.json()),
  ]);

  const filterEntries = (data) => {
    if (!data) return [];
    return targetUser
      ? Object.entries(data).filter(([k]) => k === encodeURIComponent(targetUser) || k === targetUser)
      : Object.entries(data);
  };

  let sent = 0, failed = 0;

  // ── FCM (안드로이드 / 데스크톱) ──────────────────────────
  const fcmEntries = filterEntries(fcmData);
  if (fcmEntries.length > 0) {
    const accessToken = await getAccessToken();
    const tokenList = [];
    for (const [key, val] of fcmEntries) {
      const tokens = Array.isArray(val) ? val : (typeof val === 'string' ? [val] : []);
      for (const token of tokens) {
        if (typeof token === 'string' && token.length > 10) tokenList.push({ key, token });
      }
    }
    await Promise.allSettled(tokenList.map(async ({ key, token }) => {
      try {
        const r = await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              webpush: {
                fcm_options: { link: 'https://msderental.netlify.app' }
              }
            }
          })
        });
        const result = await r.json();
        console.log('FCM result:', JSON.stringify(result));
        if (result.error) {
          failed++;
          const errCode = result.error.code || result.error.status || '';
          if (['404',404,'NOT_FOUND','UNREGISTERED'].includes(errCode)) {
            await fetch(`${FIREBASE_URL}/fcm_tokens/${key}.json`, { method:'DELETE' });
          }
        } else { sent++; }
      } catch(e) { console.error('FCM error:', e); failed++; }
    }));
  }

  // ── VAPID Web Push (iOS fallback) ──────────────────────
  const vapidEntries = filterEntries(vapidData);
  if (vapidEntries.length > 0) {
    const webpush = require('web-push');
    webpush.setVapidDetails('mailto:sungpil2da@naver.com', VAPID_PUBLIC, VAPID_PRIVATE);

    const subList = [];
    for (const [key, val] of vapidEntries) {
      const subs = Array.isArray(val) ? val : (val?.endpoint ? [val] : []);
      for (const sub of subs) {
        if (sub?.endpoint) subList.push({ key, sub });
      }
    }

    await Promise.allSettled(subList.map(async ({ key, sub }) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify({ title, body }));
        sent++;
      } catch(e) {
        console.error('VAPID error:', e.statusCode, e.body);
        failed++;
        if (e.statusCode === 410 || e.statusCode === 404) {
          await fetch(`${FIREBASE_URL}/push_subscriptions/${key}.json`, { method:'DELETE' });
        }
      }
    }));
  }

  console.log(`send-push: sent=${sent} failed=${failed}`);
  return { statusCode: 200, body: JSON.stringify({ sent, failed }) };
};
