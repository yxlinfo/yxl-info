document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     예시 데이터(원하는 데이터로 교체)
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

  /* =========================
     유틸
  ========================= */
  const numFmt = (n) => (n ?? 0).toLocaleString("ko-KR");
  const normalize = (s) => (s ?? "").toString().trim().toLowerCase();

  const withRank = (rows) => {
    const sorted = [...rows].sort((a, b) => (b.balloons ?? 0) - (a.balloons ?? 0));
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  };

  const rankBadge = (rank) => {
    if (rank === 1) return `<span class="rank-badge rank-1"><span class="medal">🥇</span>#1</span>`;
    if (rank === 2) return `<span class="rank-badge rank-2"><span class="medal">🥈</span>#2</span>`;
    if (rank === 3) return `<span class="rank-badge rank-3"><span class="medal">🥉</span>#3</span>`;
    return `<span class="rank-badge">#${rank}</span>`;
  };

  /* =========================
     헤더 유틸
  ========================= */
  const copyBtn = document.getElementById("copyBtn");
  const updatedAt = document.getElementById("updatedAt");
  if (updatedAt) updatedAt.textContent = new Date().toLocaleString("ko-KR");

  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      copyBtn.textContent = "복사됨!";
      setTimeout(() => (copyBtn.textContent = "링크 복사"), 900);
    } catch {
      alert("복사 실패! 주소창에서 직접 복사해주세요.");
    }
  });

  /* =========================
     탭 전환 (hash: #dash=dash-total)
  ========================= */
  const tabs = Array.from(document.querySelectorAll(".dash-tab"));
  const panels = Array.from(document.querySelectorAll(".dash-panel"));

  function readHashDash() {
    const h = (location.hash || "").replace("#", "");
    if (!h.startsWith("dash=")) return null;
    return decodeURIComponent(h.slice(5));
  }

  function setHashDash(id) {
    const url = new URL(location.href);
    url.hash = `dash=${encodeURIComponent(id)}`;
    history.replaceState(null, "", url.toString());
  }

  function activatePanel(targetId, { pushHash = true } = {}) {
    tabs.forEach((btn) => {
      const on = btn.dataset.target === targetId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    panels.forEach((p) => {
      const on = p.id === targetId;
      p.hidden = !on;
      p.classList.toggle("is-active", on);
    });

    try { localStorage.setItem("yxl_dash", targetId); } catch {}
    if (pushHash) setHashDash(targetId);
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => activatePanel(btn.dataset.target));
  });

  // 초기 탭: hash > localStorage > 첫 탭
  let initial = readHashDash();
  if (!initial) {
    try { initial = localStorage.getItem("yxl_dash"); } catch {}
  }
  if (!initial || !document.getElementById(initial)) {
    initial = tabs[0]?.dataset.target || "dash-total";
  }
  activatePanel(initial, { pushHash: true });

  window.addEventListener("hashchange", () => {
    const id = readHashDash();
    if (id && document.getElementById(id)) activatePanel(id, { pushHash: false });
  });

  /* =========================
     누적 렌더 + 검색
  ========================= */
  function renderTotalTable() {
    const tbody = document.querySelector("#totalTable tbody");
    const q = normalize(document.getElementById("totalSearch")?.value);
    if (!tbody) return;

    const ranked = withRank(YXL_DATA.total);
    const filtered = q ? ranked.filter((r) => normalize(r.name).includes(q)) : ranked;

    tbody.innerHTML = filtered.map((r) => `
      <tr>
        <td>${rankBadge(r.rank)}</td>
        <td>${r.name}</td>
        <td class="num">${numFmt(r.balloons)}</td>
      </tr>
    `).join("");

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
    }
  }
  document.getElementById("totalSearch")?.addEventListener("input", renderTotalTable);

  /* =========================
     시즌 렌더 + 드롭다운 + 검색
  ========================= */
  function initSeasonSelect() {
    const select = document.getElementById("seasonSelect");
    if (!select) return;

    const seasons = Object.keys(YXL_DATA.seasons);
    select.innerHTML = seasons.map((s) => `<option value="${s}">${s}</option>`).join("");

    try {
      const saved = localStorage.getItem("yxl_season");
      if (saved && seasons.includes(saved)) select.value = saved;
    } catch {}
  }

  function renderSeasonTable() {
    const select = document.getElementById("seasonSelect");
    const tbody = document.querySelector("#seasonTable tbody");
    const q = normalize(document.getElementById("seasonSearch")?.value);
    if (!select || !tbody) return;

    const seasonKey = select.value;
    const rows = YXL_DATA.seasons[seasonKey] ?? [];
    try { localStorage.setItem("yxl_season", seasonKey); } catch {}

    const ranked = withRank(rows);
    const filtered = q ? ranked.filter((r) => normalize(r.name).includes(q)) : ranked;

    tbody.innerHTML = filtered.map((r) => `
      <tr>
        <td>${rankBadge(r.rank)}</td>
        <td>${r.name}</td>
        <td class="num">${numFmt(r.balloons)}</td>
      </tr>
    `).join("");

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
    }
  }

  initSeasonSelect();
  document.getElementById("seasonSelect")?.addEventListener("change", renderSeasonTable);
  document.getElementById("seasonSearch")?.addEventListener("input", renderSeasonTable);

  /* =========================
     시너지 정렬 (헤더 클릭)
  ========================= */
  const synergyState = { key: "rank", dir: "asc" };

  function compareBy(key, dir) {
    return (a, b) => {
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

  function renderSynergyTable() {
    const table = document.getElementById("synergyTable");
    if (!table) return;

    const tbody = table.querySelector("tbody");
    const { key, dir } = synergyState;

    table.querySelectorAll("thead th").forEach((th) => {
      const old = th.querySelector(".sort-ind");
      if (old) old.remove();
      if (th.dataset.key === key) {
        const ind = document.createElement("span");
        ind.className = "sort-ind";
        ind.textContent = dir === "asc" ? "▲" : "▼";
        th.appendChild(ind);
      }
    });

    const rows = [...YXL_DATA.synergy].sort(compareBy(key, dir));
    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${rankBadge(r.rank)}</td>
        <td>${r.grade}</td>
        <td>${r.streamer}</td>
        <td class="num">${numFmt(r.balloons)}</td>
      </tr>
    `).join("");
  }

  const synergyTable = document.getElementById("synergyTable");
  synergyTable?.querySelectorAll("thead th[data-key]")?.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (synergyState.key !== key) {
        synergyState.key = key;
        synergyState.dir = "asc";
      } else {
        synergyState.dir = synergyState.dir === "asc" ? "desc" : "asc";
      }
      renderSynergyTable();
    });
  });

  /* =========================
     ✅ Gate + BGM (첫 방문 클릭 필요, 이후 자동시도)
  ========================= */
  (function gateAndBgm() {
    const KEY = "yxl_bgm_on";

    const gate = document.getElementById("gate");
    const gateBtn = document.getElementById("gateBtn");
    const gateMsg = document.getElementById("gateMsg");
    const particleLayer = document.getElementById("gateParticles");

    const audio = document.getElementById("bgm");
    const headerToggle = document.getElementById("bgmToggle");

    if (!gate || !gateBtn || !audio || !particleLayer) return;

    audio.volume = 0.25;

    let floatTimer = null;

    function setHeaderUI(isOn) {
      if (!headerToggle) return;
      headerToggle.classList.toggle("is-on", isOn);
      headerToggle.textContent = isOn ? "BGM 정지" : "BGM 재생";
      headerToggle.setAttribute("aria-pressed", isOn ? "true" : "false");
    }

    function showGate() {
      gate.classList.remove("is-hidden");
      gate.setAttribute("aria-hidden", "false");
      startFloatingHearts();
    }

    function hideGate() {
      gate.classList.add("is-hidden");
      gate.setAttribute("aria-hidden", "true");
      stopFloatingHearts();
    }

    async function tryPlay({ userInitiated = false } = {}) {
      try {
        if (audio.readyState < 2) audio.load();
        await audio.play();
        localStorage.setItem(KEY, "1");
        setHeaderUI(true);
        return true;
      } catch {
        localStorage.setItem(KEY, "0");
        setHeaderUI(false);
        if (userInitiated && gateMsg) {
          gateMsg.textContent = "BGM 재생이 차단됐어요. 입장 후 우측 상단 BGM 버튼으로 다시 시도해줘!";
        }
        return false;
      }
    }

    function stop() {
      audio.pause();
      audio.currentTime = 0;
      localStorage.setItem(KEY, "0");
      setHeaderUI(false);
    }

    // 파티클
    function makeHeart(x, y, opts = {}) {
      const el = document.createElement("div");
      el.className = "heart";

      const size = opts.size ?? (12 + Math.random() * 16);
      const dur = opts.dur ?? (900 + Math.random() * 700);
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

    function makeSpark(x, y) {
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

    function burstAtClientPoint(clientX, clientY) {
      const rect = gate.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const heartCount = 18 + Math.floor(Math.random() * 14);
      for (let i = 0; i < heartCount; i++) makeHeart(x, y, { spread: 280, rise: 220 });
      for (let i = 0; i < 16; i++) makeSpark(x, y);
    }

    function startFloatingHearts() {
      if (floatTimer) return;
      floatTimer = setInterval(() => {
        const rect = gate.getBoundingClientRect();
        const x = 40 + Math.random() * (rect.width - 80);
        const y = rect.height - (20 + Math.random() * 80);
        makeHeart(x, y, { spread: 120, rise: 260, dur: 1600 + Math.random() * 900, size: 10 + Math.random() * 10 });
      }, 220);
    }

    function stopFloatingHearts() {
      if (!floatTimer) return;
      clearInterval(floatTimer);
      floatTimer = null;
    }

    // ✅ 클릭하면 입장 + 재생 시도
    gateBtn.addEventListener("click", (e) => {
      if (gateMsg) gateMsg.textContent = "";
      burstAtClientPoint(e.clientX, e.clientY);
      setTimeout(() => hideGate(), 150);
      tryPlay({ userInitiated: true });
    });

    // 헤더 토글
    headerToggle?.addEventListener("click", async () => {
      if (audio.paused) await tryPlay({ userInitiated: true });
      else stop();
    });

    // 다음 방문 자동 재생 시도
    const savedOn = localStorage.getItem(KEY) === "1";
    if (savedOn) {
      hideGate();
      tryPlay({ userInitiated: false });
    } else {
      showGate();
      setHeaderUI(false);
    }
  })();

  /* =========================
     최초 렌더
  ========================= */
  renderTotalTable();
  renderSeasonTable();
  renderSynergyTable();
  /* =========================
   🎄 Garland Random Twinkle (per-bulb)
========================= */
(function initGarlandTwinkle(){
  const bulbs = Array.from(document.querySelectorAll(".garland .bulb"));
  if (!bulbs.length) return;

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduced) {
    // 모션 최소화: 고정 점등
    bulbs.forEach(b => {
      b.style.setProperty("--o", "0.95");
      b.style.setProperty("--s", "1.0");
      b.style.setProperty("--blur", "18px");
    });
    return;
  }

  function schedule(bulb){
    const tick = () => {
      // 기본 밝기/크기 랜덤
      let o = 0.25 + Math.random() * 0.85;     // opacity
      let s = 0.85 + Math.random() * 0.55;     // scale
      let blur = 10 + Math.random() * 26;      // glow size(px)

      // 가끔 “살짝 꺼졌다 켜짐” 느낌 (진짜 전구같이)
      if (Math.random() < 0.12) {
        o *= 0.15;
        s *= 0.92;
        blur *= 0.55;
      }

      bulb.style.setProperty("--o", o.toFixed(2));
      bulb.style.setProperty("--s", s.toFixed(2));
      bulb.style.setProperty("--blur", `${Math.round(blur)}px`);

      // 다음 깜빡임 간격도 랜덤(전구마다 다르게)
      const next = 90 + Math.random() * 900; // 90ms ~ 990ms
      setTimeout(tick, next);
    };

    // 전구마다 시작 타이밍도 랜덤
    setTimeout(tick, Math.random() * 800);
  }

  bulbs.forEach(schedule);
})();
/* =========================
   📅 Weekly Calendar (localStorage)
========================= */
/* =========================
   📅 Weekly Calendar (READ-ONLY from assets/events.json)
========================= */
(function weeklyCalendarReadOnly(){
  const grid = document.getElementById("weekGrid");
  if (!grid) return;

  const weekRange = document.getElementById("weekRange");
  const prevBtn = document.getElementById("prevWeek");
  const nextBtn = document.getElementById("nextWeek");
  const thisBtn = document.getElementById("thisWeek");

  const detail = document.getElementById("weekDetail");
  const detailDate = document.getElementById("detailDate");
  const detailTitle = document.getElementById("detailTitle");
  const detailMemo = document.getElementById("detailMemo");
  const closeBtn = document.getElementById("closeDetail");

  // ✅ 공유 일정 데이터(보기 전용)
  let EVENTS = {};

  // 로드
  async function loadEvents(){
    try{
      const res = await fetch("assets/events.json?v=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("events.json load failed");
      EVENTS = await res.json();
    }catch(e){
      EVENTS = {};
      console.warn(e);
    }
  }

  const now = new Date();
  const todayYMD = toYMD(now);

  function toYMD(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }

  function parseYMD(ymd){
    const [y,m,d] = ymd.split("-").map(Number);
    return new Date(y, m-1, d);
  }

  function startOfWeek(date){
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // Sun=0
    const diff = (day === 0 ? -6 : 1 - day); // 월요일 시작
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
  }

  function addDays(date, n){
    const d = new Date(date);
    d.setDate(d.getDate()+n);
    return d;
  }

  function formatRange(weekStart){
    const weekEnd = addDays(weekStart, 6);
    const s = weekStart.toLocaleDateString("ko-KR", { month:"long", day:"numeric" });
    const e = weekEnd.toLocaleDateString("ko-KR", { month:"long", day:"numeric" });
    return `${s} ~ ${e}`;
  }

  const DOW = ["월","화","수","목","금","토","일"];

  let base = startOfWeek(new Date());
  let selected = null;

  function render(){
    grid.innerHTML = "";
    if (weekRange) weekRange.textContent = formatRange(base);

    for(let i=0;i<7;i++){
      const d = addDays(base, i);
      const ymd = toYMD(d);
      const item = EVENTS[ymd];

      const card = document.createElement("div");
      card.className = "day-card";
      if (ymd === todayYMD) card.classList.add("is-today");
      if (item && (item.title || item.memo)) card.classList.add("has-event");

      const top = document.createElement("div");
      top.className = "day-top";
      top.innerHTML = `
        <div class="dow">${DOW[i]}</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="badge-dot"></span>
          <div class="dnum">${d.getDate()}</div>
        </div>
      `;

      const title = document.createElement("div");
      title.className = "event-title";
      title.textContent = item?.title ? item.title : "일정 없음";

      const memo = document.createElement("div");
      memo.className = "event-memo";
      memo.textContent = item?.memo ? item.memo : "—";

      card.appendChild(top);
      card.appendChild(title);
      card.appendChild(memo);

      card.addEventListener("click", () => openDetail(ymd));
      grid.appendChild(card);
    }
  }

  function openDetail(ymd){
    selected = ymd;
    const item = EVENTS[ymd] || { title:"", memo:"" };

    const d = parseYMD(ymd);
    const label = d.toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric", weekday:"short" });
    if (detailDate) detailDate.textContent = label;

    // 보기 전용: 입력칸 대신 값 표시(입력칸이 있어도 disabled 처리)
    if (detailTitle){
      detailTitle.value = item.title || "";
      detailTitle.disabled = true;
    }
    if (detailMemo){
      detailMemo.value = item.memo || "";
      detailMemo.disabled = true;
    }

    if (detail) detail.hidden = false;
    detail?.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }

  function closeDetail(){
    selected = null;
    if (detail) detail.hidden = true;
  }

  closeBtn?.addEventListener("click", closeDetail);

  prevBtn?.addEventListener("click", () => { base = addDays(base, -7); closeDetail(); render(); });
  nextBtn?.addEventListener("click", () => { base = addDays(base, 7); closeDetail(); render(); });
  thisBtn?.addEventListener("click", () => { base = startOfWeek(new Date()); closeDetail(); render(); });

  (async () => {
    await loadEvents();
    render();
  })();
})();


  function openDetail(ymd){
    selected = ymd;
    const data = loadAll();
    const item = data[ymd] || { title:"", memo:"" };

    const d = parseYMD(ymd);
    const label = d.toLocaleDateString("ko-KR", { year:"numeric", month:"long", day:"numeric", weekday:"short" });
    if (detailDate) detailDate.textContent = label;

    if (detailTitle) detailTitle.value = item.title || "";
    if (detailMemo) detailMemo.value = item.memo || "";

    if (detail) detail.hidden = false;
    detail?.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }

  function closeDetail(){
    selected = null;
    if (detail) detail.hidden = true;
  }

  saveBtn?.addEventListener("click", () => {
    if (!selected) return;
    const data = loadAll();

    data[selected] = {
      title: (detailTitle?.value || "").trim(),
      memo: (detailMemo?.value || "").trim(),
      updatedAt: Date.now(),
    };
    saveAll(data);
    render();
  });

  clearBtn?.addEventListener("click", () => {
    if (!selected) return;
    const data = loadAll();
    delete data[selected];
    saveAll(data);
    closeDetail();
    render();
  });

  closeBtn?.addEventListener("click", closeDetail);

  prevBtn?.addEventListener("click", () => { base = addDays(base, -7); closeDetail(); render(); });
  nextBtn?.addEventListener("click", () => { base = addDays(base, 7); closeDetail(); render(); });
  thisBtn?.addEventListener("click", () => { base = startOfWeek(new Date()); closeDetail(); render(); });

  render();
})();

});
