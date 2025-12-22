document.addEventListener("DOMContentLoaded", () => {
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

  /* =========================
     공용 유틸
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
     탭 전환 (누적/시즌/시너지)
  ========================= */
  const tabs = Array.from(document.querySelectorAll(".dash-tab"));
  const panels = Array.from(document.querySelectorAll(".dash-panel"));

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

    try { localStorage.setItem("yxl_dash", targetId); } catch (e) {}

    if (pushHash) {
      const url = new URL(location.href);
      url.hash = `dash=${encodeURIComponent(targetId)}`;
      history.replaceState(null, "", url.toString());
    }
  }

  tabs.forEach((btn) => btn.addEventListener("click", () => activatePanel(btn.dataset.target)));

  // 초기 탭 결정: hash > localStorage > 첫 탭
  const hash = (location.hash || "").replace("#", "");
  const hashTarget = hash.startsWith("dash=") ? decodeURIComponent(hash.slice(5)) : null;
  let initial = hashTarget;

  if (!initial) {
    try { initial = localStorage.getItem("yxl_dash"); } catch (e) {}
  }
  if (!initial || !document.getElementById(initial)) initial = tabs[0]?.dataset.target;

  if (initial) activatePanel(initial, { pushHash: true });

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
    } catch (e) {}
  }

  function renderSeasonTable() {
    const select = document.getElementById("seasonSelect");
    const tbody = document.querySelector("#seasonTable tbody");
    const q = normalize(document.getElementById("seasonSearch")?.value);
    if (!select || !tbody) return;

    const seasonKey = select.value;
    const rows = YXL_DATA.seasons[seasonKey] ?? [];

    try { localStorage.setItem("yxl_season", seasonKey); } catch (e) {}

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
     시너지 정렬(헤더 클릭)
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
     헤더 유틸(링크 복사/업데이트)
  ========================= */
  const copyBtn = document.getElementById("copyBtn");
  const updatedAt = document.getElementById("updatedAt");
  if (updatedAt) updatedAt.textContent = new Date().toLocaleString("ko-KR");

  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      copyBtn.textContent = "복사됨!";
      setTimeout(() => (copyBtn.textContent = "링크 복사"), 900);
    } catch (e) {
      alert("복사 실패! 주소창에서 직접 복사해주세요.");
    }
  });

  /* =========================
     ✅ 게이트(스플래시) + BGM + 하트/반짝
     - 클릭하면 무조건 입장(게이트 숨김) + BGM 재생 시도
  ========================= */
  (function gateAndBgmWithHearts() {
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
      } catch (e) {
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

    // ✅ 클릭하면 “무조건 입장” + BGM 재생 시도
    gateBtn.addEventListener("click", (e) => {
      if (gateMsg) gateMsg.textContent = "";
      burstAtClientPoint(e.clientX, e.clientY);
      setTimeout(() => hideGate(), 150);
      tryPlay({ userInitiated: true });
    });

    // 헤더 토글
    if (headerToggle) {
      headerToggle.addEventListener("click", async () => {
        if (audio.paused) {
          await tryPlay({ userInitiated: true });
        } else {
          stop();
        }
      });
    }

    // 다음 방문 자동재생 시도
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
});
// ✅ 탭 전환 보험 코드 (맨 아래에 추가)
(function tabSwitchFix(){
  const tabWrap = document.querySelector(".dash-tabs");
  const tabs = tabWrap ? Array.from(tabWrap.querySelectorAll(".dash-tab")) : [];
  const panels = Array.from(document.querySelectorAll(".dash-panel"));

  if (!tabs.length || !panels.length) return;

  function activateById(id){
    tabs.forEach(t => t.classList.toggle("is-active", t.dataset.target === id));
    panels.forEach(p => {
      const on = p.id === id;
      p.hidden = !on;
      p.classList.toggle("is-active", on);
    });
  }

  tabs.forEach((t) => {
    t.addEventListener("click", (e) => {
      e.preventDefault();
      const id = t.dataset.target;
      if (id) activateById(id);
    });
  });
})();
