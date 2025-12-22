document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     예시 데이터(원하는 데이터로 교체)
  ========================= */
  const YXL_DATA = {
    total: [
      { name: "", balloons:  },
      { name: "", balloons:  },
      { name: "", balloons:  },
      { name: "", balloons:  },
      { name: "", balloons:  },
    ],
    seasons: {
      "시즌 1": [
        { name: "", balloons:  },
        { name: "", balloons:  },
        { name: "", balloons:  },
      ],
      "시즌 2": [
        { name: "", balloons:  },
        { name: "", balloons:  },
        { name: "", balloons:  },
      ],
    },
    synergy: [
      { rank: 1, grade: "", streamer: "", balloons:  },
      { rank: 2, grade: "", streamer: "", balloons:  },
      { rank: 3, grade: "", streamer: "", balloons:  },
      { rank: 4, grade: "", streamer: "", balloons:  },
    ],
  };

  /* =========================
     유틸
  ========================= */
  const numFmt = (n) => (n ?? 0).toLocaleString("ko-KR");
  const normalize = (s) => (s ?? "").toString().trim().toLowerCase();

  
  const TOTAL_PREV_KEY = "yxl_total_prev_ranks";

  const loadPrevTotalRanks = () => {
    try {
      const raw = localStorage.getItem(TOTAL_PREV_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  };

  const saveTotalRanks = (rankedRows) => {
    try {
      const map = {};
      rankedRows.forEach((r) => { map[r.name] = r.rank; });
      localStorage.setItem(TOTAL_PREV_KEY, JSON.stringify(map));
    } catch (e) {}
  };

  const formatDelta = (delta) => {
    if (delta == null) return `<span class="delta new">—</span>`;
    if (delta > 0) return `<span class="delta up" title="상승 ${delta}계단">▲${delta}</span>`;
    if (delta < 0) return `<span class="delta down" title="하락 ${Math.abs(delta)}계단">▼${Math.abs(delta)}</span>`;
    return `<span class="delta same" title="변동 없음">—</span>`;
  };

  const totalPrevMap = loadPrevTotalRanks();


  // (선택) 누적기여도 데이터를 외부 JSON으로 분리해 가져오기
  async function loadTotalFromJSON(url = "data/total.json") {
    try {
      const res = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length) {
        // rows: [{name, balloons}]
        YXL_DATA.total = rows
          .map((r) => ({ name: r.name, balloons: Number(r.balloons ?? 0) }))
          .filter((r) => r.name);
      }
    } catch (e) {
      // 실패 시 기존 하드코딩 데이터 유지
    }
  }

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

    const prevMap = totalPrevMap;
    const ranked = withRank(YXL_DATA.total);
    const filtered = q ? ranked.filter((r) => normalize(r.name).includes(q)) : ranked;

    tbody.innerHTML = filtered.map((r) => {
      const prevRank = prevMap?.[r.name];
      const delta = (typeof prevRank === "number") ? (prevRank - r.rank) : null; // +면 상승
      return `
        <tr>
          <td>${rankBadge(r.rank)}</td>
          <td>${r.name}</td>
          <td class="num">${numFmt(r.balloons)}</td>
          <td class="num">${formatDelta(delta)}</td>
        </tr>
      `;
    }).join("");
  }

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
  (async () => {
    // GitHub Pages에서 Excel 데이터를 쓰고 싶으면: data/total.json 업데이트만 하면 됨
    await loadTotalFromJSON("data/total.json");
    renderTotalTable();
    // 다음 새로고침/업데이트에서 변동사항 계산을 위해 현재 순위를 저장
    saveTotalRanks(withRank(YXL_DATA.total));

    renderSeasonTable();
    renderSynergyTable();
  })();

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

});
