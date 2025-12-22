(function dashboardTabs(){
  const tabs = Array.from(document.querySelectorAll(".dash-tab"));
  const panels = Array.from(document.querySelectorAll(".dash-panel"));
  if (!tabs.length || !panels.length) return;

  function activate(targetId, { pushHash = true } = {}) {
    tabs.forEach(btn => {
      const on = btn.dataset.target === targetId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    panels.forEach(p => {
      const on = p.id === targetId;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });

    if (pushHash) {
      const url = new URL(location.href);
      url.hash = `dash=${encodeURIComponent(targetId)}`;
      history.replaceState(null, "", url.toString());
    }

    try { localStorage.setItem("yxl_dash", targetId); } catch(e) {}
  }

  tabs.forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.target)));

  const hash = (location.hash || "").replace("#", "");
  const hashTarget = hash.startsWith("dash=") ? decodeURIComponent(hash.slice(5)) : null;

  let initial = hashTarget;
  if (!initial) {
    try { initial = localStorage.getItem("yxl_dash"); } catch(e) {}
  }
  if (!initial || !document.getElementById(initial)) initial = tabs[0].dataset.target;

  activate(initial, { pushHash: true });
})();
/* ====== 데이터(예시) : 여길 너 데이터로 교체하면 끝 ====== */
const YXL_DATA = {
  total: [
    { name: "은우♥", balloons: 120000 },
    { name: "리윤_♥", balloons: 98000 },
    { name: "후잉♥", balloons: 76000 },
    { name: "하랑짱♥", balloons: 64000 },
    { name: "쩔밍♡", balloons: 52000 },
  ],

  seasons: {
    "시즌 1": [
      { name: "은우♥", balloons: 42000 },
      { name: "리윤_♥", balloons: 39000 },
      { name: "후잉♥", balloons: 21000 },
    ],
    "시즌 2": [
      { name: "하랑짱♥", balloons: 36000 },
      { name: "쩔밍♡", balloons: 34000 },
      { name: "리윤_♥", balloons: 18000 },
    ],
  },

  synergy: [
    { rank: 1, grade: "부장", streamer: "은우♥", balloons: 50000 },
    { rank: 2, grade: "차장", streamer: "리윤_♥", balloons: 42000 },
    { rank: 3, grade: "대리", streamer: "후잉♥", balloons: 32000 },
    { rank: 4, grade: "사원", streamer: "하랑짱♥", balloons: 21000 },
  ],
};
/* ========================================================== */

function numFmt(n){
  return (n ?? 0).toLocaleString("ko-KR");
}

function normalize(str){
  return (str ?? "").toString().trim().toLowerCase();
}

function withRank(rows){
  // balloons 내림차순으로 순위 산정
  const sorted = [...rows].sort((a,b) => (b.balloons ?? 0) - (a.balloons ?? 0));
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

function rankBadge(rank){
  if (rank === 1) return `<span class="rank-badge rank-1"><span class="medal">🥇</span>#1</span>`;
  if (rank === 2) return `<span class="rank-badge rank-2"><span class="medal">🥈</span>#2</span>`;
  if (rank === 3) return `<span class="rank-badge rank-3"><span class="medal">🥉</span>#3</span>`;
  return `<span class="rank-badge">#${rank}</span>`;
}

/* ====== 누적 테이블(검색 포함) ====== */
function renderTotalTable(){
  const tbody = document.querySelector("#totalTable tbody");
  const q = normalize(document.getElementById("totalSearch")?.value);

  const ranked = withRank(YXL_DATA.total);
  const filtered = q ? ranked.filter(r => normalize(r.name).includes(q)) : ranked;

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>${rankBadge(r.rank)}</td>
      <td>${r.name}</td>
      <td class="num">${numFmt(r.balloons)}</td>
    </tr>
  `).join("");

  if (!filtered.length){
    tbody.innerHTML = `<tr><td colspan="3" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
  }
}

/* ====== 시즌 테이블(드롭다운 + 검색) ====== */
function initSeasonSelect(){
  const select = document.getElementById("seasonSelect");
  if (!select) return;

  const seasons = Object.keys(YXL_DATA.seasons);
  select.innerHTML = seasons.map(s => `<option value="${s}">${s}</option>`).join("");

  // 마지막 선택 기억
  try{
    const saved = localStorage.getItem("yxl_season");
    if (saved && seasons.includes(saved)) select.value = saved;
  }catch(e){}
}

function renderSeasonTable(){
  const select = document.getElementById("seasonSelect");
  const tbody = document.querySelector("#seasonTable tbody");
  const q = normalize(document.getElementById("seasonSearch")?.value);

  const seasonKey = select?.value;
  const rows = YXL_DATA.seasons[seasonKey] ?? [];

  // 시즌 선택 기억
  try{ localStorage.setItem("yxl_season", seasonKey); }catch(e){}

  const ranked = withRank(rows);
  const filtered = q ? ranked.filter(r => normalize(r.name).includes(q)) : ranked;

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>${rankBadge(r.rank)}</td>
      <td>${r.name}</td>
      <td class="num">${numFmt(r.balloons)}</td>
    </tr>
  `).join("");

  if (!filtered.length){
    tbody.innerHTML = `<tr><td colspan="3" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
  }
}

/* ====== 시너지 테이블(오름차순 정렬) ====== */
const synergyState = {
  key: "rank",
  dir: "asc", // asc / desc (기본은 asc)
};

function compareBy(key, dir){
  return (a,b) => {
    const av = a[key];
    const bv = b[key];

    // 숫자 / 문자열 모두 처리
    const aNum = typeof av === "number" ? av : Number.NaN;
    const bNum = typeof bv === "number" ? bv : Number.NaN;

    let r = 0;
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
      r = aNum - bNum;
    } else {
      r = normalize(av).localeCompare(normalize(bv), "ko");
    }

    return dir === "asc" ? r : -r;
  };
}

function renderSynergyTable(){
  const table = document.getElementById("synergyTable");
  const tbody = table.querySelector("tbody");
  const { key, dir } = synergyState;

  // 정렬 표시(헤더에 ▲▼)
  table.querySelectorAll("thead th").forEach(th => {
    const k = th.dataset.key;
    const old = th.querySelector(".sort-ind");
    if (old) old.remove();

    if (k === key){
      const ind = document.createElement("span");
      ind.className = "sort-ind";
      ind.textContent = dir === "asc" ? "▲" : "▼";
      th.appendChild(ind);
    }
  });

  const rows = [...YXL_DATA.synergy].sort(compareBy(key, dir));

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${rankBadge(r.rank)}</td>
      <td>${r.grade}</td>
      <td>${r.streamer}</td>
      <td class="num">${numFmt(r.balloons)}</td>
    </tr>
  `).join("");
}

function initSynergySort(){
  const table = document.getElementById("synergyTable");
  if (!table) return;

  table.querySelectorAll("thead th[data-key]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;

      // “오름차순 정렬” 요구에 맞춰: 클릭 시 기본은 asc
      if (synergyState.key !== key) {
        synergyState.key = key;
        synergyState.dir = "asc";
      } else {
        // 같은 컬럼 계속 클릭하면 asc/desc 토글 (원치 않으면 이 줄을 지워도 됨)
        synergyState.dir = (synergyState.dir === "asc") ? "desc" : "asc";
      }
      renderSynergyTable();
    });
  });
}

/* ====== 이벤트 바인딩 ====== */
function bindYxlDashFeatures(){
  // 누적 검색
  const totalSearch = document.getElementById("totalSearch");
  totalSearch?.addEventListener("input", renderTotalTable);

  // 시즌 선택 + 검색
  initSeasonSelect();
  const seasonSelect = document.getElementById("seasonSelect");
  const seasonSearch = document.getElementById("seasonSearch");
  seasonSelect?.addEventListener("change", renderSeasonTable);
  seasonSearch?.addEventListener("input", renderSeasonTable);

  // 시너지 정렬
  initSynergySort();

  // 초기 렌더
  renderTotalTable();
  renderSeasonTable();
  renderSynergyTable();
}

// DOM 준비되면 실행
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindYxlDashFeatures);
} else {
  bindYxlDashFeatures();
}

