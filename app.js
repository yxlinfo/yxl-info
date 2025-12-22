/* =========================
   탭 전환 (대시보드 버튼)
========================= */
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

/* =========================
   유틸/데이터 (예시)
   -> 여기만 너 데이터로 교체하면 끝
========================= */
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

function numFmt(n){ return (n ?? 0).toLocaleString("ko-KR"); }
function normalize(str){ return (str ?? "").toString().trim().toLowerCase(); }

function withRank(rows){
  const sorted = [...rows].sort((a,b) => (b.balloons ?? 0) - (a.balloons ?? 0));
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

function rankBadge(rank){
  if (rank === 1) return `<span class="rank-badge rank-1"><span class="medal">🥇</span>#1</span>`;
  if (rank === 2) return `<span class="rank-badge rank-2"><span class="medal">🥈</span>#2</span>`;
  if (rank === 3) return `<span class="rank-badge rank-3"><span class="medal">🥉</span>#3</span>`;
  return `<span class="rank-badge">#${rank}</span>`;
}

/* =========================
   누적 (검색 + TOP 배지)
========================= */
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

/* =========================
   시즌별 (드롭다운 + 검색)
========================= */
function initSeasonSelect(){
  const select = document.getElementById("seasonSelect");
  if (!select) return;

  const seasons = Object.keys(YXL_DATA.seasons);
  select.innerHTML = seasons.map(s => `<option value="${s}">${s}</option>`).join("");

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

/* =========================
   시너지 (컬럼 클릭 정렬)
========================= */
const synergyState = { key: "rank", dir: "asc" };

function compareBy(key, dir){
  return (a,b) => {
    const av = a[key];
    const bv = b[key];
    const aNum = typeof av === "number" ? av : Number.NaN;
    const bNum = typeof bv === "number" ? bv : Number.NaN;

    let r = 0;
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) r = aNum - bNum;
    else r = normalize(av).localeCompare(normalize(bv), "ko");

    return dir === "asc" ? r : -r;
  };
}

function renderSynergyTable(){
  const table = document.getElementById("synergyTable");
  const tbody = table.querySelector("tbody");
  const { key, dir } = synergyState;

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

      // 기본 오름차순 요구 충족: 새 컬럼 클릭 시 asc
      if (synergyState.key !== key) {
        synergyState.key = key;
        synergyState.dir = "asc";
      } else {
        // 같은 컬럼 연속 클릭 시 asc/desc 토글 (원치 않으면 이 줄 제거)
        synergyState.dir = (synergyState.dir === "asc") ? "desc" : "asc";
      }
      renderSynergyTable();
    });
  });
}

/* =========================
   헤더 유틸(링크복사/업데이트표시)
========================= */
(function headerUtils(){
  const copyBtn = document.getElementById("copyBtn");
  const updatedAt = document.getElementById("updatedAt");

  if (updatedAt){
    const now = new Date();
    updatedAt.textContent = now.toLocaleString("ko-KR");
  }

  copyBtn?.addEventListener("click", async () => {
    try{
      await navigator.clipboard.writeText(location.href);
      copyBtn.textContent = "복사됨!";
      setTimeout(() => (copyBtn.textContent = "링크 복사"), 900);
    }catch(e){
      alert("복사 실패! 주소창에서 직접 복사해주세요.");
    }
  });
})();

/* =========================
   BGM (첫 방문 클릭 필요 + 저장 후 다음 방문 자동재생 '시도')
========================= */
(function bgmPlayer(){
  const audio = document.getElementById("bgm");
  const btn = document.getElementById("bgmToggle");
  if (!audio || !btn) return;

  const KEY = "yxl_bgm_on";
  audio.volume = 0.25; // 원하는 볼륨 (0.0~1.0)

  function setUI(isOn){
    btn.classList.toggle("is-on", isOn);
    btn.textContent = isOn ? "BGM 정지" : "BGM 재생";
    btn.setAttribute("aria-pressed", isOn ? "true" : "false");
  }

  async function tryPlay(){
    try{
      await audio.play();                 // 자동재생 정책에 의해 실패할 수 있음
      localStorage.setItem(KEY, "1");
      setUI(true);
    }catch(e){
      // 자동재생 실패 시: UI OFF (사용자가 버튼 눌러야 함)
      setUI(false);
    }
  }

  function stop(){
    audio.pause();
    audio.currentTime = 0;
    localStorage.setItem(KEY, "0");
    setUI(false);
  }

  // 버튼 토글 (첫 방문은 반드시 사용자가 눌러야 재생)
  btn.addEventListener("click", () => {
    if (audio.paused) tryPlay();
    else stop();
  });

  // 다음 방문부터: 이전에 켜둔 적 있으면 자동재생 '시도'
  const savedOn = localStorage.getItem(KEY) === "1";
  setUI(false);
  if (savedOn) tryPlay();

  // 탭 복귀 시: 켜짐 저장돼 있으면 다시 시도
  document.addEventListener("visibilitychange", () => {
    const shouldOn = localStorage.getItem(KEY) === "1";
    if (!document.hidden && shouldOn && audio.paused) tryPlay();
  });
})();

/* =========================
   초기 바인딩/렌더
========================= */
function bindYxlDashFeatures(){
  document.getElementById("totalSearch")?.addEventListener("input", renderTotalTable);

  initSeasonSelect();
  document.getElementById("seasonSelect")?.addEventListener("change", renderSeasonTable);
  document.getElementById("seasonSearch")?.addEventListener("input", renderSeasonTable);

  initSynergySort();

  renderTotalTable();
  renderSeasonTable();
  renderSynergyTable();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindYxlDashFeatures);
} else {
  bindYxlDashFeatures();
}
