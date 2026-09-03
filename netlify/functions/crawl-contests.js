/**
 * Netlify Function: crawl-contests
 * 공모전 / 경진대회 / 대외활동 / 교육 정보 수집 → Firebase 저장
 * 카테고리 + 분야(field) + MSDE 관련도 + 대학생 참가가능 여부 자동 분류
 *
 * 수동 호출: /.netlify/functions/crawl-contests?secret=msde2026push
 * 올콘 진단: /.netlify/functions/crawl-contests?secret=msde2026push&debug=allcon
 * 자동 실행: netlify.toml 의 [functions."crawl-contests"] schedule
 *
 * 외부 npm 의존성 없음 (정규식 파싱)
 */

const FIREBASE_URL = 'https://msde-piano-rental-default-rtdb.asia-southeast1.firebasedatabase.app';
const SECRET = 'msde2026push';

// 의존성 없는 크롤러 (Netlify Functions 배포용 로직 프로토타입)
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const H = { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" };
// 일부 사이트는 일반 요청을 거부하므로 브라우저에 가까운 헤더 사용
const HFULL = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Referer": "https://www.all-con.co.kr/",
};

const strip = (s) => String(s || "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, " ").trim();

const abs = (href, base) => { try { return new URL(href, base).href; } catch { return ""; } };

// "26-10-18" / "2026.10.18" → ms
function toMs(s) {
  if (!s) return 0;
  let m = String(s).match(/(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return 0;
  let y = +m[1]; if (y < 100) y += 2000;
  return new Date(y, +m[2] - 1, +m[3], 23, 59, 59).getTime();
}
// 기간 문자열에서 종료일 추출 (마지막 날짜)
function endFromPeriod(p) {
  const all = String(p || "").match(/\d{2,4}[.\-/]\d{1,2}[.\-/]\d{1,2}/g);
  return all && all.length ? toMs(all[all.length - 1]) : 0;
}

// ─── 1) 서울과기대 게시판 (페이지네이션 지원) ───
// 페이징 파라미터는 page / size (nowpage 는 동작하지 않음)
function parseSeoultechRows(html, url, source, category) {
  const out = [];
  const rows = html.split(/<tr class="body_tr">/).slice(1);
  for (const row of rows) {
    const a = row.match(/<td[^>]*class="tit dn2"[^>]*>\s*<a[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;                                  // 상단 고정 요약글 등은 구조가 달라 제외
    const title = strip(a[2]);
    if (!title) continue;
    out.push({
      source, category, title,
      org:  strip((row.match(/<td class="dn4"[^>]*>([\s\S]*?)<\/td>/) || [])[1]),
      date: strip((row.match(/<td class="dn5"[^>]*>([\s\S]*?)<\/td>/) || [])[1]),
      period: "", dday: "", endAt: 0, link: abs(a[1], url),
    });
  }
  return out;
}

async function seoultech(baseUrl, source, category, filterKeywords, pages = 3) {
  const all = [];
  const seen = new Set();
  for (let pg = 1; pg <= pages; pg++) {
    const url = `${baseUrl}?page=${pg}&size=15`;
    let html;
    try { html = await (await fetch(url, { headers: H })).text(); }
    catch (e) { break; }
    const rows = parseSeoultechRows(html, url, source, category);
    if (rows.length === 0) break;
    let added = 0;
    for (const r of rows) {
      const key = r.title + "|" + r.date;
      if (seen.has(key)) continue;                     // 페이지 간 중복(고정 공지) 제거
      seen.add(key); all.push(r); added++;
    }
    if (added === 0) break;                            // 새 항목이 없으면 마지막 페이지
  }
  // 등록일이 너무 오래된 건 제외 (마감 정보가 없어 무한 누적되는 것 방지)
  const cutoff = Date.now() - SEOULTECH_MAX_AGE;
  const fresh = all.filter(i => { const t = toMs(i.date); return !t || t >= cutoff; });

  if (!filterKeywords) return fresh;
  return fresh.filter(i => KEYWORDS.some(k => i.title.includes(k))
                        && !EXCLUDE.some(k => i.title.includes(k)))
              .map(i => ({ ...i, category: guessCategory(i.title) }));
}

// 과기대 게시판은 마감일이 없어 등록 후 60일까지만 수집
const SEOULTECH_MAX_AGE = 90 * 24 * 3600 * 1000;

const KEYWORDS = ["공모","경진","해커톤","아이디어톤","챌린지","콘테스트","대외활동",
                  "서포터즈","경연","대회","공모전","contest","challenge","hackathon",
                  "참여자 모집","참가자 모집","참가팀","모집","봉사활동","특강","프로젝트",
                  "인턴","멘토링","프로그램","학생자문단","창업",
                  "교육","강의","강좌","아카데미","세미나","워크숍","워크샵","캠프",
                  "부트캠프","실습","연수","양성과정","클래스","튜터링","자격증"];
// 명백히 공모/활동이 아닌 것은 제외
const EXCLUDE = ["수강신청","수강 신청","시험접수","시험 접수","교과목","의무교육","지침",
                 "면제","장학생 선발","아르바이트","증명","등록금","휴학","복학","졸업",
                 "국제교육원","교육원/","학점","재수강","계절학기","성적","등록 안내"];
const ACT_KEYWORDS = ["대외활동","서포터즈","봉사","앰버서더","체험","캠프","인턴",
                      "멘토링","프로그램","자문단","특강","설명회","수강생"];
const guessCategory = (t) => ACT_KEYWORDS.some(k => t.includes(k)) ? "대외활동" : "공모전";
// (실제 최종 분류는 refineCategory 에서 교육/해커톤 우선순위로 다시 결정됨)

// ─── 경진대회 판별 (공모전 계열 안에서 갈라냄) ───
const COMPETE = ["경진대회","경진","챌린지","challenge",
  "경연","올림피아드","컴피티션","competition","대회","분석대회","스피치","토론",
  "캐글","kaggle","skillthon"];

// 해커톤 계열은 소스와 무관하게 항상 "공모전"으로 분류
const HACKATHON = ["해커톤","hackathon","아이디어톤","해커 톤","hack-a-thon","hackerthon"];

// 교육 카테고리: 배우는 것이 주목적인 프로그램 (소스 무관)
const EDU = ["장비교육","교육과정","교육 과정","직무교육","안전교육","기초교육","실무교육",
             "강의","강좌","아카데미","세미나","워크숍","워크샵","특강","부트캠프",
             "캠프","수강생","실습","연수","양성과정","양성 과정","클래스","튜터링",
             "자격증","교실","스쿨","단기과정","온라인 과정","이러닝","교육생",
             "스터디","국비지원","취득반","전문가 과정","전문가과정","공개강연","강연",
             "인력 양성","인재 양성","직무교육","부트캠프"];

// ─── 분야 분류 (구체적인 것 먼저) ───
const FIELDS = [
  ["AI·데이터", ["ai","인공지능","데이터","빅데이터","머신러닝","딥러닝","알고리즘",
                 "캐글","kaggle","분석","llm","생성형","gpt","dx","디지털전환","ax"]],
  ["IT·SW",    ["소프트웨어","sw","앱","어플","웹","프로그래밍","코딩","개발","해킹","보안",
                 "블록체인","메타버스","클라우드","it","정보통신","ict","플랫폼","서비스기획",
                 "정보보호","네트워크","시스템"]],
  ["공학·제조", ["로봇","기계","반도체","제조","스마트팩토리","팩토리","자동차","모빌리티",
                 "드론","우주","항공기","항공우주","전자공학","전자제품","반도체공정",
                 "전기공학","건축설계","건축물","토목","화학공학","신소재","소재부품",
                 "원자력","조선","공정","설비","계측","품질관리",
                 "공학","stem","엔지니어","특허","발명","과학기술","제조업","기전",
                 "레이저","3d프린터","3d 프린터","cnc","선반","밀링","금형","용접",
                 "전자부품","전자회로","임베디드","기구설계","설계 경진","cad","cam"]],
  ["디자인",    ["디자인","ui","ux","패키지","캐릭터","웹툰","일러스트","포스터","브랜딩",
                 "굿즈","키비주얼","엠블럼","로고","전람회","공예","건축물"]],
  ["영상·사진", ["영상","ucc","숏폼","쇼츠","사진","영화","다큐","릴스","콘텐츠 제작",
                 "홍보영상","브이로그","애니메이션","모션","포토","촬영","콘텐츠"]],
  ["문학·수기", ["문학","백일장","수기","에세이","독후감","글쓰기","논문","시나리오","소설",
                 "웹소설","시집","작문","리포트","보고서","신문","작품"]],
  ["예술·공연", ["미술","사생","음악","무용","공연","캘리그라피","그림","서예","합창","연극",
                 "요리","레시피","푸드","공예"]],
  ["외국어·발표", ["스피치","프레젠테이션","발표","영어","외국어","통역","번역","토익","opic",
                  "토론","글로벌"]],
  ["환경·에너지", ["환경","기후","탄소","친환경","재생에너지","에너지","탄소중립","생태",
                   "업사이클","리사이클","자원순환","녹색","산림","해양","신재생","기후변화"]],
  ["창업",      ["창업","스타트업","비즈니스모델","사업화","인큐베이","액셀러레이","벤처",
                 "govtech","기업가"]],
  ["취업·커리어", ["취업","채용","커리어","직무","인턴","면접","자기소개서","자소서","진로",
                  "잡페어","취업콘서트","설명회","해외취업","일자리","멘토링","직업"]],
  ["서포터즈·홍보", ["서포터즈","앰버서더","앰배서더","홍보대사","프렌즈","리포터","기자단",
                    "크리에이터","인플루언서","모니터링단","체험단","홍보"]],
  ["아이디어·기획", ["아이디어","기획","정책","제안","마케팅","광고","네이밍","슬로건","캠페인",
                    "브랜드"]],
  ["봉사·사회", ["봉사","나눔","기부","사회공헌","자원활동","돌봄","장애","복지","인권",
                 "안전","건강","의료","보건"]],
  ["교육·학습", ["스터디","교육","강연","세미나","워크숍","워크샵","특강","아카데미","캠프",
                 "수강생","연수","자격","시험"]],
];

// 기관명이 분야를 오염시키는 것을 막음
// 예) 인천국제공항공사 → "항공", (재)기후변화재단 → "기후" 로 잘못 매칭되던 문제
function cleanForField(v) {
  return String(v || "")
    .replace(/[가-힣A-Za-z]*(공항공사|공사|재단|진흥원|공단|협회|학회|박물관|미술관|센터|위원회|조합|연합회|은행|대학교|대학)/g, " ")
    .replace(/\(재\)|\(사\)|\(주\)|\(유\)|\(청\)/g, " ")
    .toLowerCase();
}

// 짧은 영문 약어는 부분일치 오탐이 커서 단어 경계로만 매칭
// 예) "Medical Camp"의 cam, "Academy"의 cad, "AI"의 ai 등
const WORDY = /^[a-z0-9]{1,4}$/;
function hasKeyword(text, k) {
  if (WORDY.test(k)) {
    return new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(k);
}

function classifyField(title, org, category) {
  const tTitle = cleanForField(title);
  // 1차: 제목만으로 판단 (신뢰도 가장 높음)
  for (const [name, kws] of FIELDS) {
    if (kws.some(k => hasKeyword(tTitle, k))) return name;
  }
  // 2차: 제목으로 못 정하면 기관명까지 포함
  const tBoth = tTitle + " " + cleanForField(org);
  for (const [name, kws] of FIELDS) {
    if (kws.some(k => hasKeyword(tBoth, k))) return name;
  }
  return "기타";
}

// ── 강한 포함 신호: 이게 있으면 무조건 관련 있음으로 판정 ──
const STRONG = [
  "ai","인공지능","데이터","빅데이터","머신러닝","딥러닝","알고리즘","llm","생성형","gpt",
  "소프트웨어","sw","프로그래밍","코딩","개발","앱","웹","보안","블록체인","클라우드","ict","it",
  "메타버스","디지털","dx","ax","플랫폼","시스템","네트워크",
  "공학","엔지니어","기계","로봇","반도체","제조","스마트팩토리","공정","설계","cad","자동화",
  "자동차","모빌리티","드론","항공","우주","조선","전기","전자","소재","에너지","원자력",
  "탄소","기후","환경","특허","발명","과학","기술","측정","품질","산업",
  "디자인","ui","ux","제품","패키지","브랜딩",
  "창업","스타트업","비즈니스","사업화","벤처",
  "영어","외국어","토익","opic","스피치","프레젠테이션","통역","번역",
  "취업","채용","인턴","커리어","직무","진로",
  "아이디어","기획","정책","마케팅","광고","영상","ucc","숏폼","사진",
  "해커톤","아이디어톤","분석","금융","통계","수학","물리","화학",
  "교육","강의","실습","장비","레이저","3d프린터","세미나","워크숍","아카데미","특강",
];

// 약한 신호: 단독으로는 관련 판정 근거가 되지만, BLOCK 단어와 겹치면 무력화
const WEAK = ["글로벌","콘텐츠","홍보","경영","산업","기술","과학","문화상품","제품"];

// ── 명확히 무관한 분야 ──
const BLOCK = [
  // 음식·요리
  "요리","레시피","조리","제과","제빵","바리스타","커피","김치","전통주","막걸리","와인",
  "칵테일","푸드스타일","한식","양식","중식","일식","떡공예","음식",
  // 음악·공연·예술
  "트롯","트로트","가요","성악","판소리","국악","합창","무용","댄스","발레","연극","뮤지컬",
  "오케스트라","작곡","악기","피아노","보컬","힙합","랩배틀","랩경연",
  "사생대회","서예","캘리그라피","한국화","동양화","서양화","조각전","도예","자수",
  // 문예
  "백일장","독후감","시화","시조","수필","동시","동화","시집","소설공모","글짓기",
  // 스포츠·레저
  "풋살","축구","야구","농구","배구","마라톤","골프","등산","낚시","볼링","태권도","검도",
  "e스포츠","당구","수영",
  // 기타 생활
  "뷰티","미용","네일","헤어","메이크업","패션모델","반려동물","반려견","애견","원예","분재",
  "영농","축산","낙농","어업","임업","종교","신앙","선교","불교","기독교","천주교",
  "관광가이드","여행에세이","한복","다도",
];

function isRelevant(title, org, field) {
  // [기관명] 같은 접두 태그와 "OO박물관/재단" 등 기관 표기는 제외 판정에서 무시
  const cleanTitle = String(title)
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[가-힣]*(박물관|미술관|재단|공단|진흥원|협회|학회|공사|센터)/g, " ");
  const t = (cleanTitle + " " + (org||"")).toLowerCase();
  const blocked = BLOCK.some(k => t.includes(k));
  if (STRONG.some(k => t.includes(k))) return true;   // 공학/AI/디자인/영어 등 확실한 신호 → 유지
  if (blocked) return false;                          // 명확히 무관 → 제외
  if (WEAK.some(k => t.includes(k))) return true;     // 약한 신호 (BLOCK 없을 때만 유효)
  return true;                                        // 애매하면 유지 (과도한 제외 방지)
}

// ── 대학생 참가 가능 여부 (제목 기준, 보수적 판정) ──
// 주의: 한국 청소년기본법상 "청소년"은 9~24세로 대학생을 포함하므로
//       "청소년" 단독은 제외 근거로 쓰지 않는다.
const UNIV_OK = ["대학생","대학원생","대학(원)생","대학부","대학","일반부","성인","청년",
                 "누구나","전국민","전 국민","제한없음","제한 없음","연령무관","전연령"];
// 초·중·고 전용임이 명확한 표기만 제외
const SCHOOL_ONLY = ["초등","중학생","고등학생","초·중","초중","중·고","중고생","고교생",
                     "초등부","중등부","고등부","학생부","유아","어린이","미취학","주니어",
                     "청소년부","초·중·고","초중고","특성화고","마이스터고","중등부문",
                     "초등부문","고등부문","전국청소년","청소년무대","청소년행복"];

function isUnivEligible(title, org) {
  const t = (title + " " + (org||"")).toLowerCase();
  if (UNIV_OK.some(k => t.includes(k))) return true;      // 대학생 명시 → 통과
  if (SCHOOL_ONLY.some(k => t.includes(k))) return false; // 초·중·고 전용 명시 → 제외
  return true;                                            // 불명확하면 통과 (놓치는 것 방지)
}

function refineCategory(item) {
  const t = item.title.toLowerCase();
  // 해커톤/아이디어톤은 출처(대외활동 페이지 포함)와 무관하게 공모전으로
  if (HACKATHON.some(k => t.includes(k))) return "공모전";
  // 교육 성격이 명확하면 출처와 무관하게 교육으로
  if (EDU.some(k => t.includes(k))) return "교육";
  if (item.category === "대외활동") return "대외활동";
  // 나머지 공모전 계열 → 경진대회 여부 판단
  return COMPETE.some(k => t.includes(k)) ? "경진대회" : "공모전";
}

// ─── 2) 링커리어 (__NEXT_DATA__ JSON) ───
async function linkareer(pages = 4) {
  const out = [], seen = new Set();
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.__typename === "Activity" && o.title && o.id && !seen.has(o.id)) {
      seen.add(o.id);
      const end = Number(o.recruitCloseAt) || 0;
      out.push({
        source: "링커리어", category: "공모전", title: String(o.title).replace(/\s+/g," ").trim(),
        org: o.organizationName || "", date: "",
        period: end ? new Date(end).toISOString().slice(0,10) + " 마감" : "",
        dday: "", endAt: end, link: `https://linkareer.com/activity/${o.id}`,
      });
    }
    Object.values(o).forEach(walk);
  };
  for (let pg = 1; pg <= pages; pg++) {
    try {
      const url = pg === 1 ? "https://linkareer.com/list/contest"
                           : `https://linkareer.com/list/contest?page=${pg}`;
      const html = await (await fetch(url, { headers: H })).text();
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) break;
      const before = out.length;
      walk(JSON.parse(m[1]));
      if (out.length === before) break;     // 새 항목이 없으면 중단
    } catch { break; }
  }
  return out;
}

// ─── 3) 씽유 (내부 AJAX) ───
async function thinkyou(kind) {
  const path = kind === "contest" ? "contest" : "extact";
  const ref  = kind === "contest" ? "contest" : "extAct";
  const body = new URLSearchParams({ page:"1", pagesize:"120", serstatus:"", serdivision:"",
    serfield:"", sertarget:"", serprizeMoney:"", seritem:"0", searchstr:"" });
  const r = await fetch(`https://thinkyou.co.kr/${path}/ajax_contestList.asp`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/x-www-form-urlencoded",
               "Referer": `https://thinkyou.co.kr/${ref}/` },
    body });
  const html = await r.text();
  const out = [];
  const blocks = html.split(/<div class="tr[ "]/).slice(1);
  for (const b of blocks) {
    const title = strip((b.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1]);
    if (!title) continue;
    const org = strip((b.match(/<dd>([\s\S]*?)<\/dd>/) || [])[1]).replace(/^주최\s*:\s*/, "");
    const etcs = [...b.matchAll(/<div class="etc">([\s\S]*?)<\/div>/g)].map(x => strip(x[1]));
    const period = etcs[0] || "";
    const dday = (strip((b.match(/<div class="statNew">([\s\S]*?)<\/div>/) || [])[1]).match(/D-\d+/) || [""])[0];
    // 씽유는 href 따옴표가 비정규(href=/contest/123/...)인 경우가 있어 두 패턴 모두 처리
    const href = (b.match(/<a[^>]*href="([^"]+)"/) || [])[1]
              || (b.match(/<a[^>]*href=([^\s>"']+)/) || [])[1]
              || "";
    out.push({ source: "씽유", category: kind === "contest" ? "공모전" : "대외활동",
               title, org, date: "", period, dday,
               endAt: endFromPeriod(period), link: abs(href, "https://thinkyou.co.kr/") });
  }
  return out;
}

// ─── 4) BDAI ───
// ─── 5) 올콘 (all-con.co.kr) ───
// 주의: 이 사이트는 자동 접근을 제한하고 있어 환경에 따라 503이 날 수 있음.
//       실패해도 다른 소스에 영향이 없도록 예외를 그대로 던져 allSettled 가 처리하게 함.
function allconUrl(t) {
  return `https://www.all-con.co.kr/list/contest/${t}/1`
       + `?sortname=cl_order&sortorder=asc&stx=&sfl=&t=${t}&ct=&sc=&tg=`;
}

async function allcon(t) {  // t=1 공모전, t=2 대외활동
  const url = allconUrl(t);
  const r = await fetch(url, { headers: HFULL });
  if (!r.ok) throw new Error(`HTTP ${r.status} (봇 차단 가능)`);
  const html = await r.text();
  const out = [];
  const seen = new Set();

  // 상세 링크(숫자 id 포함)를 기준으로 항목 추출 — 여러 경로 패턴 대응
  const re = /<a[^>]*href=["']?((?:https?:\/\/[^"'\s>]*)?\/(?:detail|view|contest|list\/contest)\/[^"'\s>]*?\d[^"'\s>]*)["']?[^>]*>([\s\S]{0,400}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const inner = strip(m[2]);
    if (!inner || inner.length < 6) continue;
    if (/^(더보기|다음|이전|목록|\d+)$/.test(inner)) continue;

    // 링크 텍스트에서 기간/제목 분리
    const period = (inner.match(/\d{2,4}[.\-/]\d{1,2}[.\-/]\d{1,2}\s*[~\-]\s*\d{2,4}[.\-/]\d{1,2}[.\-/]\d{1,2}/) || [""])[0];
    let title = inner.replace(period, "").replace(/\(?\s*D-\d+\s*\)?/g, "")
                     .replace(/\s+/g, " ").trim();
    if (!title || title.length < 6) continue;
    const key = title.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      source: "올콘",
      category: t === 1 ? "공모전" : "대외활동",
      title, org: "",
      date: "", period,
      dday: (inner.match(/D-\d+/) || [""])[0],
      endAt: endFromPeriod(period),
      link: abs(href, url),
    });
  }
  if (out.length === 0) throw new Error("항목 0건 (구조 변경 또는 차단)");
  return out;
}

async function bdai() {
  const url = "https://www.bdai.co.kr/lectures/contest/";
  const html = await (await fetch(url, { headers: H })).text();
  const out = [];
  const blocks = html.split(/<a\s+href="([^"]+)"\s+class="con-card"/).slice(1);
  for (let i = 0; i < blocks.length; i += 2) {
    const href = blocks[i], b = blocks[i + 1] || "";
    const title = strip((b.match(/<h2 class="con-card-title">([\s\S]*?)<\/h2>/) || [])[1]);
    if (!title) continue;
    const org = strip((b.match(/<p class="con-card-host">([\s\S]*?)<\/p>/) || [])[1]);
    const meta = strip((b.match(/<div class="con-card-meta">([\s\S]*?)<\/div>/) || [])[1]);
    const badges = [...b.matchAll(/<span class="con-badge[^"]*">([\s\S]*?)<\/span>/g)].map(x => strip(x[1]));
    const closed  = badges.some(x => /마감|종료/.test(x));
    const ongoing = badges.some(x => /진행중|참가신청|모집/.test(x));
    // 기간에 날짜가 2개 이상일 때만 종료일로 인정 (단일 날짜는 등록일이라 신뢰 못함)
    const dates = (meta.match(/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/g) || []);
    const periodTxt = dates.length >= 2 ? `${dates[0]} ~ ${dates[dates.length-1]}` : dates[0] || "";
    let endAt = 0;
    if (closed) endAt = 1;                                  // 배지가 마감 → 마감
    else if (ongoing) endAt = 0;                            // 배지가 진행중 → 마감 아님
    else if (dates.length >= 2) endAt = toMs(dates[dates.length-1]);
    out.push({ source: "BDAI", category: "공모전", title, org, date: dates[0] || "",
               period: periodTxt, dday: "", endAt, link: abs(href, url) });
  }
  return out;
}

// ─── 중복 제거 ───
function normTitle(t) {
  return String(t)
    .replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ")
    .replace(/서울과학기술대학교|서울과기대|과기대/g, " ")
    .replace(/[「」『』<>《》]/g, " ")
    .replace(/제\s*\d+\s*[회차]/g, " ")
    .replace(/\d{4}\s*년?도?/g, " ")
    .replace(/공모전|경진대회|아이디어톤|해커톤|공모|대회|모집|안내|개최|공고|참여|참가/g, " ")
    .replace(/[^\uAC00-\uD7A3a-zA-Z0-9]/g, "")
    .toLowerCase();
}
const RANK = { "과기대 공모/외부행사":0, "과기대 공지사항":1,
               "링커리어":2, "씽유":3, "올콘":4, "BDAI":5 };

function dedupe(items) {
  const map = new Map(); let dropped = 0;
  for (const it of items) {
    // 카테고리를 키에 넣지 않음 — 같은 공고가 공모전/대외활동 양쪽에 등록된 경우도 1건으로 합침
    const key = normTitle(it.title);
    if (!normTitle(it.title)) continue;
    const prev = map.get(key);
    if (!prev) { map.set(key, it); continue; }
    dropped++;
    const keep = (RANK[it.source] ?? 9) < (RANK[prev.source] ?? 9) ? it : prev;
    const other = keep === it ? prev : it;
    // 마감일/기간 등 빠진 정보는 상대편에서 채움
    if (!keep.endAt && other.endAt) { keep.endAt = other.endAt; keep.period = keep.period || other.period; }
    if (!keep.org && other.org) keep.org = other.org;
    map.set(key, keep);
  }
  return { list: [...map.values()], dropped };
}

// ─── 실행 ───
async function runCrawl() {
  const tasks = [
    ["과기대 공모/외부행사", () => seoultech("https://www.seoultech.ac.kr/service/board/rec","과기대 공모/외부행사","공모전",false,4)],
    ["과기대 공지사항",      () => seoultech("https://www.seoultech.ac.kr/service/info/notice","과기대 공지사항","공모전",true,4)],
    ["링커리어",             linkareer],
    ["씽유 공모전",          () => thinkyou("contest")],
    ["씽유 대외활동",        () => thinkyou("extAct")],
    ["BDAI",                 bdai],
    ["올콘 공모전",          () => allcon(1)],
    ["올콘 대외활동",        () => allcon(2)],
  ];
  const settled = await Promise.allSettled(tasks.map(([, fn]) => fn()));
  let all = []; const report = [];
  settled.forEach((r, i) => {
    const name = tasks[i][0];
    if (r.status === "fulfilled") { report.push(`${name}: ${r.value.length}건`); all = all.concat(r.value); }
    else report.push(`${name}: 실패(${r.reason?.message || "?"})`);
  });
  const { list, dropped } = dedupe(all);
  const now = Date.now();
  list.forEach(i => {
    i.closed   = !!(i.endAt && i.endAt < now);
    i.category = refineCategory(i);                       // 공모전 / 경진대회 / 대외활동
    i.field    = classifyField(i.title, i.org, i.category); // 분야
    i.relevant = isRelevant(i.title, i.org, i.field)        // MSDE 관련 여부
              && isUnivEligible(i.title, i.org);            // 대학생 참가 가능 여부
  });
  // 진행중 우선(마감 임박순) → 마감된 건 뒤로
  list.sort((a, b) => {
    if (a.closed !== b.closed) return a.closed ? 1 : -1;
    if (!a.closed) return (a.endAt || 9e15) - (b.endAt || 9e15);
    return (b.endAt || 0) - (a.endAt || 0);
  });
  return { items: list, report, dropped, total: all.length };
}

// ─── 올콘 접근 진단용 ───
// Netlify(AWS) IP 에서 올콘이 열리는지, 열리면 HTML 구조가 어떤지 확인
async function debugAllcon() {
  const results = [];
  for (const t of [1, 2]) {
    const url = allconUrl(t);
    const entry = { target: t === 1 ? '공모전' : '대외활동', url };
    try {
      const r = await fetch(url, { headers: HFULL });
      entry.status = r.status;
      entry.contentType = r.headers.get('content-type') || '';
      const html = await r.text();
      entry.length = html.length;
      // 상세 링크 후보 패턴 수집 (파서 작성용)
      const hrefs = [...html.matchAll(/<a[^>]*href=["']?([^"'\s>]+)["']?/gi)]
        .map(m => m[1]).filter(h => /\d/.test(h));
      const prefix = {};
      hrefs.forEach(h => {
        const k = (h.match(/^(?:https?:\/\/[^/]+)?(\/[a-zA-Z_-]+)/) || [])[1];
        if (k) prefix[k] = (prefix[k] || 0) + 1;
      });
      entry.linkPrefixes = Object.entries(prefix).sort((a, b) => b[1] - a[1]).slice(0, 10);
      entry.htmlSample = html.slice(0, 1500);
      try { entry.parsed = (await allcon(t)).length; }
      catch (e) { entry.parsed = 'fail: ' + String(e.message); }
    } catch (e) {
      entry.error = String(e.message);
    }
    results.push(entry);
  }
  return results;
}

exports.handler = async (event) => {
  const isScheduled = !event || !event.queryStringParameters;
  const qs = (event && event.queryStringParameters) || {};
  const secret = isScheduled ? SECRET : (qs.secret || '');
  if (secret !== SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  // 진단 모드
  if (qs.debug === 'allcon') {
    const d = await debugAllcon();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(d, null, 2),
    };
  }

  try {
    const res = await runCrawl();
    const payload = {
      items: res.items, updatedAt: Date.now(),
      report: res.report, total: res.total, dropped: res.dropped,
    };
    const fb = await fetch(`${FIREBASE_URL}/contests.json`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!fb.ok) throw new Error('firebase write failed: ' + fb.status);
    const rel = res.items.filter(i => i.relevant).length;
    console.log('[crawl-contests]', res.report.join(' | '),
                `→ ${res.items.length}건 저장 (관련 ${rel} / 제외 ${res.items.length - rel})`);
    return {
      statusCode: 200, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, saved: res.items.length, relevant: rel,
                             total: res.total, dropped: res.dropped, report: res.report }),
    };
  } catch (e) {
    console.error('[crawl-contests] error:', e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
