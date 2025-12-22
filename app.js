/* =========================
   탭 전환
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
      p.hidden = !on;
      p.classList.toggle("is-active", on);
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
   데이터(예시) - 너 데이터로 교체
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
   누적
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
   시즌별
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
   시너지 정렬
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
   헤더 유틸
========================= */
(function headerUtils(){
  const copyBtn = document.getElementById("copyBtn");
  const updatedAt = document.getElementById("updatedAt");

  if (updatedAt){
    updatedAt.textContent = new Date().toLocaleString("ko-KR");
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
   ✅ Gate + BGM + 하트 파티클
========================= */
(function gateAndBgmWithHearts(){
  const KEY = "yxl_bgm_on";

  const gate = document.getElementById("gate");
  const gateBtn = document.getElementById("gateBtn");
  const gateMsg = document.getElementById("gateMsg");
  const particleLayer = document.getElementById("gateParticles");

  const audio = document.getElementById("bgm");
  const headerToggle = document.getElementById("bgmToggle");

  if (!gate || !gateBtn || !audio || !particleLayer) return;

  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.25;

  let floatTimer = null;

  function setHeaderUI(isOn){
    if (!headerToggle) return;
    headerToggle.classList.toggle("is-on", isOn);
    headerToggle.textContent = isOn ? "BGM 정지" : "BGM 재생";
    headerToggle.setAttribute("aria-pressed", isOn ? "true" : "false");
  }

  function showGate(){
    gate.classList.remove("is-hidden");
    gate.setAttribute("aria-hidden", "false");
    startFloatingHearts();
  }

  function hideGate(){
    gate.classList.add("is-hidden");
    gate.setAttribute("aria-hidden", "true");
    stopFloatingHearts();
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
      if (userInitiated && gateMsg){
        gateMsg.textContent = "재생이 차단됐어요. 한 번 더 눌러보거나 브라우저 설정/확장프로그램을 확인해주세요.";
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

  /* ---- 파티클 생성 ---- */
  function makeHeart(x, y, opts = {}){
    const el = document.createElement("div");
    el.className = "heart";

    const size = opts.size ?? (12 + Math.random() * 16);
    const dur = opts.dur ?? (900 + Math.random() * 700);

    // 시작/끝 위치(상승 + 퍼짐)
    const dx = (Math.random() - 0.5) * (opts.spread ?? 220);
    const dy = -(opts.rise ?? (160 + Math.random() * 240));

    el.style.setProperty("--size", `${size}px`);
    el.style.setProperty("--dur", `${dur}ms`);

    el.style.setProperty("--x0", `${x}px`);
    el.style.setProperty("--y0", `${y}px`);
    el.style.setProperty("--x1", `${x + dx}px`);
    el.style.setProperty("--y1", `${y + dy}px`);

    el.style.setProperty("--s0", `${0.85 + Math.random() * 0.35}`);
    el.style.setProperty("--s1", `${1.2 + Math.random() * 0.8}`);

    el.style.setProperty("--r0", `${(Math.random() - 0.5) * 20}deg`);
    el.style.setProperty("--r1", `${(Math.random() - 0.5) * 80}deg`);

    particleLayer.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  function makeSpark(x, y){
    const el = document.createElement("div");
    el.className = "spark";

    const dx = (Math.random() - 0.5) * 90;
    const dy = (Math.random() - 0.5) * 90;

    el.style.setProperty("--sx0", `${x}px`);
    el.style.setProperty("--sy0", `${y}px`);
    el.style.setProperty("--sx1", `${x + dx}px`);
    el.style.setProperty("--sy1", `${y + dy}px`);

    particleLayer.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  f
