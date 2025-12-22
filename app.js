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

      if (synergyState.key !== key) {
        synergyState.key = key;
        synergyState.dir = "asc";
      } else {
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
   ✅ BGM Gate (오버레이 입장 방식)
   - 첫 방문(또는 꺼둔 상태): 오버레이 먼저
   - "음악 재생하고 입장하기" 클릭 시: 재생 성공하면 사이트 표시
   - 한 번 켜두면 다음 방문부터: 오버레이 없이 자동재생 '시도'
========================= */
(function bgmGateMode(){
  const KEY = "yxl_bgm_on";

  const gate = document.getElementById("bgmGate");
  const startBtn = document.getElementById("bgmStart");
  const msg = document.getElementById("bgmGateMsg");

  const app = document.getElementById("app");
  const audio = document.getElementById("bgm");

  const headerToggle = document.getElementById("bgmToggle");

  if (!gate || !startBtn || !app || !audio) return;

  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.25;

  function lockSite(){
    document.body.classList.add("is-locked");
    app.classList.add("is-locked");
    gate.classList.add("is-open");
    gate.setAttribute("aria-hidden", "false");
  }

  function unlockSite(){
    document.body.classList.remove("is-locked");
    app.classList.remove("is-locked");
    gate.classList.remove("is-open");
    gate.setAttribute("aria-hidden", "true");
  }

  function setHeaderUI(isOn){
    if (!headerToggle) return;
    headerToggle.classList.toggle("is-on", isOn);
    headerToggle.textContent = isOn ? "BGM 정지" : "BGM 재생";
    headerToggle.setAttribute("aria-pressed", isOn ? "true" : "false");
  }

  async function playSafe({ userInitiated = false } = {}){
    try{
      if (audio.readyState < 2) audio.load();
      await audio.play();
      localStorage.setItem(KEY, "1");
      setHeaderUI(true);
      return true;
    }catch(e){
      setHeaderUI(false);
      if (userInitiated && msg){
        msg.textContent = "재생이 차단됐어요. 다시 한 번 눌러보거나 브라우저 설정/확장프로그램을 확인해주세요.";
      }
      return false;
    }
  }

  function stop(){
    audio.pause();
    audio.currentTime = 0;
    localStorage.setItem(KEY, "0");
    setHeaderUI(false);
  }

  // 오버레이 버튼: 재생 성공하면 입장
  startBtn.addEventListener("click", async () => {
    if (msg) msg.textContent = "";
    const ok = await playSafe({ userInitiated: true });
    if (ok) unlockSite();
  });

  // 헤더 버튼도 연동(있을 때만)
  if (headerToggle){
    headerToggle.addEventListener("click", async () => {
      if (audio.paused){
        const ok = await playSafe({ userInitiated: true });
        if (ok) unlockSite();
      } else {
        stop();
        lockSite(); // 꺼버리면 다음 방문도 오버레이 뜨게
      }
    });
  }

  // 다음 방문: 켜짐 저장돼 있으면 오버레이 없이 바로 보여주고 재생 '시도'
  const savedOn = localStorage.getItem(KEY) === "1";
  if (savedOn){
    unlockSite();
    playSafe({ userInitiated: false });
  } else {
    lockSite();
  }

  // 탭 복귀 시 재시도
  document.addEventListener("visibilitychange", () => {
    const shouldOn = localStorage.getItem(KEY) === "1";
    if (!document.hidden && shouldOn && audio.paused) playSafe({ userInitiated: false });
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
