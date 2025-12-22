const DATA = {
  site: {
    title: "YXL 정보 허브",
    sub: "규정 · 시너지표 · 변경이력 한방 정리",
    updatedAt: "2025-12-22" // 여기 날짜만 바꿔도 상단 업데이트가 바뀜
  },

  pinned: [
    { title: "공지: 집계 기준", desc: "KST 00:00~23:59 / 누락 데이터 0 처리 / 수정은 변경이력에 기록", tag: "공지" }
  ],

  info: {
    oneLine: "YXL은 커뮤니티에서 사용하는 시너지/점수/규정 정보를 한 페이지로 정리한 정보 허브.",
    keywords: ["시너지표", "점수", "규정", "집계", "타임라인", "출처"],
    long: "여기에 너희 YXL 설명을 넣으면 됨. (무슨 컨텐츠인지, 점수는 무엇인지, 기준은 무엇인지, 페이지 목적 등)"
  },

  rules: [
    { q: "집계 시간 기준은?", a: "기본 KST 00:00~23:59. 날짜 변경 기준도 KST로 통일." },
    { q: "누락/오류 데이터는?", a: "누락은 0 처리. 오류 정정 시 변경이력에 날짜/사유 기록." },
    { q: "동률 처리/정렬 규칙은?", a: "점수 내림차순 → 상승분 → 이름. 필요하면 규칙을 여기서 고정." }
  ],

  // 시너지표 데이터(예시). 멤버 12명으로 바꿔 넣어.
  synergy: [
    { name: "멤버1", role: "멤버", score: 1200, delta: +50, note: "메모" },
    { name: "멤버2", role: "멤버", score: 1100, delta: -10, note: "" },
    { name: "멤버3", role: "멤버", score: 980,  delta: 0,   note: "" },
    { name: "멤버4", role: "멤버", score: 930,  delta: +12, note: "" },
    { name: "멤버5", role: "멤버", score: 900,  delta: +5,  note: "" },
    { name: "멤버6", role: "멤버", score: 870,  delta: -3,  note: "" },
    { name: "멤버7", role: "멤버", score: 860,  delta: +0,  note: "" },
    { name: "멤버8", role: "멤버", score: 830,  delta: +20, note: "" },
    { name: "멤버9", role: "멤버", score: 800,  delta: +2,  note: "" },
    { name: "멤버10", role: "멤버", score: 780, delta: -8,  note: "" },
    { name: "멤버11", role: "멤버", score: 740, delta: +9,  note: "" },
    { name: "멤버12", role: "멤버", score: 700, delta: +1,  note: "" }
  ],

  timeline: [
    { date: "2025-12-22", title: "시너지표 템플릿 배포", desc: "정보/규정/시너지표/변경이력/링크 구성으로 정리" },
    { date: "2025-12-21", title: "집계 기준 문구 확정", desc: "누락 0 처리 / 시간대 KST / 수정 로그 고정" }
  ],

  links: [
    { title: "대시보드", desc: "점수표/랭킹", url: "#synergy", tag: "dashboard" },
    { title: "규정", desc: "집계 기준/룰", url: "#rules", tag: "rules" },
    { title: "커뮤니티", desc: "출처/스레드", url: "https://ygosu.com", tag: "source" }
  ]
};

const $ = (s) => document.querySelector(s);

function setText(sel, v){ const el = $(sel); if(el) el.textContent = v; }
function chip(t){ const s=document.createElement("span"); s.className="chip"; s.textContent=t; return s; }

function renderPinned(){
  const wrap = $("#pinArea");
  wrap.innerHTML = "";
  DATA.pinned.forEach(p => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3>${p.tag} · ${p.title}</h3><p class="muted">${p.desc}</p>`;
    wrap.appendChild(card);
  });
}

function renderInfo(){
  setText("#siteTitle", DATA.site.title);
  setText("#siteSub", DATA.site.sub);
  setText("#updatedAt", DATA.site.updatedAt);

  setText("#oneLine", DATA.info.oneLine);
  setText("#infoLong", DATA.info.long);

  const kw = $("#keywords");
  kw.innerHTML = "";
  DATA.info.keywords.forEach(k => kw.appendChild(chip(k)));
}

function renderRules(){
  const wrap = $("#rulesAcc");
  wrap.innerHTML = "";
  DATA.rules.forEach((r, i) => {
    const acc = document.createElement("div");
    acc.className = "acc";
    const bodyId = `accBody${i}`;
    acc.innerHTML = `
      <button type="button" aria-controls="${bodyId}">
        <span>${r.q}</span><span>${i===0 ? "−" : "+"}</span>
      </button>
      <div class="body" id="${bodyId}" ${i===0 ? "" : "hidden"}>${r.a}</div>
    `;
    const btn = acc.querySelector("button");
    const body = acc.querySelector(".body");
    btn.addEventListener("click", () => {
      const isHidden = body.hidden;
      [...wrap.querySelectorAll(".body")].forEach(b => {
        b.hidden = true;
        b.parentElement.querySelector("button span:last-child").textContent = "+";
      });
      body.hidden = !isHidden;
      btn.querySelector("span:last-child").textContent = body.hidden ? "+" : "−";
    });
    wrap.appendChild(acc);
  });
}

function initRoleSelect(){
  const roles = [...new Set(DATA.synergy.map(x => x.role))].sort();
  const sel = $("#roleSynergy");
  roles.forEach(r => {
    const o=document.createElement("option");
    o.value=r; o.textContent=r;
    sel.appendChild(o);
  });
}

function renderSynergy(){
  const q = $("#qSynergy").value.trim().toLowerCase();
  const role = $("#roleSynergy").value;
  const sort = $("#sortSynergy").value;

  let rows = DATA.synergy
    .filter(x => role === "all" ? true : x.role === role)
    .filter(x => !q ? true : (x.name + " " + (x.note||"")).toLowerCase().includes(q));

  rows.sort((a,b) => {
    if(sort === "scoreDesc") return b.score - a.score;
    if(sort === "scoreAsc") return a.score - b.score;
    if(sort === "deltaDesc") return (b.delta||0) - (a.delta||0);
    if(sort === "nameAsc") return a.name.localeCompare(b.name, "ko");
    return 0;
  });

  const tb = $("#synergyBody");
  tb.innerHTML = "";

  rows.forEach((x, idx) => {
    const tr = document.createElement("tr");
    const d = x.delta ?? 0;
    const deltaClass = d > 0 ? "up" : d < 0 ? "down" : "";
    const deltaText = d > 0 ? `+${d}` : `${d}`;

    tr.innerHTML = `
      <td class="rank">${idx+1}</td>
      <td><b>${x.name}</b></td>
      <td>${x.role}</td>
      <td>${Number(x.score).toLocaleString()}</td>
      <td class="delta ${deltaClass}">${deltaText}</td>
      <td class="muted">${x.note || ""}</td>
    `;
    tb.appendChild(tr);
  });
}

function renderTimeline(){
  const wrap = $("#timelineList");
  wrap.innerHTML = "";
  DATA.timeline
    .slice()
    .sort((a,b) => a.date < b.date ? 1 : -1)
    .forEach(t => {
      const row = document.createElement("div");
      row.className = "tl";
      row.innerHTML = `
        <div class="tl-date">${t.date}</div>
        <div>
          <h4>${t.title}</h4>
          <p>${t.desc}</p>
        </div>
      `;
      wrap.appendChild(row);
    });
}

function renderLinks(){
  const wrap = $("#linkCards");
  wrap.innerHTML = "";
  DATA.links.forEach(l => {
    const a = document.createElement("a");
    a.className = "card";
    a.href = l.url;
    a.target = l.url.startsWith("#") ? "_self" : "_blank";
    a.rel = "noopener noreferrer";
    a.innerHTML = `
      <h3>${l.title}</h3>
      <p class="muted">${l.desc}</p>
      <div class="chips"><span class="chip">${l.tag}</span></div>
    `;
    wrap.appendChild(a);
  });
}

function wire(){
  $("#qSynergy").addEventListener("input", renderSynergy);
  $("#roleSynergy").addEventListener("change", renderSynergy);
  $("#sortSynergy").addEventListener("change", renderSynergy);

  $("#copyBtn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); alert("링크 복사 완료"); }
    catch { prompt("복사 실패. 직접 복사:", location.href); }
  });

  setText("#year", String(new Date().getFullYear()));
}

function boot(){
  renderPinned();
  renderInfo();
  renderRules();
  initRoleSelect();
  renderSynergy();
  renderTimeline();
  renderLinks();
  wire();
}
boot();
