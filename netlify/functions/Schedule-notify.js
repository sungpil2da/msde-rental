/**
 * Netlify Scheduled Function: schedule-notify
 * 매 정시마다 실행 → 1시간 후 팀플 일정 있는 유저에게 사전 알림 발송
 *
 * cron: "0 * * * *"  (매 시간 정각, UTC 기준)
 */

const FIREBASE_URL = 'https://msde-piano-rental-default-rtdb.asia-southeast1.firebasedatabase.app';
const PUSH_SECRET  = 'msde2026push';
// 배포된 Netlify 도메인 (send-push function 호출용)
const PUSH_URL     = 'https://msderental.netlify.app/.netlify/functions/send-push';

const WEEK_DAYS_KO = ['일','월','화','수','목','금','토']; // JS getDay() 기준

// KST(UTC+9) 기준으로 현재 요일/시간 계산
function getKSTInfo(offsetHours = 0) {
  const now = new Date(Date.now() + (9 + offsetHours) * 3600 * 1000);
  const dayKo = WEEK_DAYS_KO[now.getUTCDay()];
  const hour  = now.getUTCHours(); // 이미 KST offset 적용됨
  return { dayKo, hour };
}

// 이번 주 월요일 KST 날짜 문자열 (my_schedules 키)
function getThisWeekMonday() {
  const now = new Date(Date.now() + 9 * 3600 * 1000); // KST
  const dow = now.getUTCDay(); // 0=일
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() + diffToMon);
  const y = mon.getUTCFullYear();
  const m = String(mon.getUTCMonth() + 1).padStart(2, '0');
  const d = String(mon.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

exports.handler = async () => {
  try {
    // 1시간 후 KST 시각
    const { dayKo, hour: targetHour } = getKSTInfo(1);
    const weekKey = `week_${getThisWeekMonday()}`;
    const slotKey = `${dayKo}_${targetHour}`;

    console.log(`[schedule-notify] 체크 슬롯: ${slotKey} (${weekKey})`);

    // 모든 유저의 my_schedules 조회
    const usersRes = await fetch(`${FIREBASE_URL}/my_schedules.json?shallow=true`);
    const usersData = await usersRes.json();
    if (!usersData) return { statusCode: 200, body: 'no users' };

    const userNames = Object.keys(usersData);
    const notifyTargets = []; // [{name, title}]

    await Promise.all(userNames.map(async (name) => {
      try {
        const res = await fetch(`${FIREBASE_URL}/my_schedules/${encodeURIComponent(name)}/${weekKey}/${encodeURIComponent(slotKey)}.json`);
        const slot = await res.json();
        // 팀플 일정만 (memo에 '팀플' 포함 or title에 '팀플' 포함)
        if (slot && slot.title && (slot.memo?.includes('팀플') || slot.title.includes('팀플'))) {
          notifyTargets.push({ name, title: slot.title });
        }
      } catch(e) {}
    }));

    console.log(`[schedule-notify] 알림 대상: ${notifyTargets.length}명`);

    // 각 대상에게 push 발송
    await Promise.allSettled(notifyTargets.map(({ name, title }) =>
      fetch(PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: PUSH_SECRET,
          targetUser: name,
          title: `⏰ 팀플 1시간 전!`,
          body: `${dayKo}요일 ${String(targetHour).padStart(2,'0')}:00 - ${title}`,
        })
      })
    ));

    return {
      statusCode: 200,
      body: JSON.stringify({ checked: slotKey, notified: notifyTargets.length })
    };
  } catch (e) {
    console.error('[schedule-notify] error:', e);
    return { statusCode: 500, body: String(e) };
  }
};
