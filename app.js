document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     YXL Dashboard
     - Excel 기반 데이터 로드 (YXL_통합.xlsx)
       1) 누적기여도 (1번째 시트)
       2) 시즌통합랭킹 (2번째 시트: S1~S10 YXL_기여도)
       3) 시즌별 기여도 (3~12번째 시트)
  ========================================================= */

  /* =========================
     유틸
  ========================= */
  const numFmt = (n) => (Number.isFinite(n) ? n : 0).toLocaleString("ko-KR");
  const normalize = (s) => (s ?? "").toString().trim().toLowerCase();

  const toNumber = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const t = String(v).replace(/,/g, "").trim();
    if (!t) return 0;
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  };

  const rankBadge = (rank) => {
    const r = Number(rank) || 0;
    if (r === 1) return `<span class="rank-badge rank-1"><span class="medal">🥇</span>#1</span>`;
    if (r === 2) return `<span class="rank-badge rank-2"><span class="medal">🥈</span>#2</span>`;
    if (r === 3) return `<span class="rank-badge rank-3"><span class="medal">🥉</span>#3</span>`;
    return `<span class="rank-badge">#${r || "—"}</span>`;
  };

  const pickKeyByPrefix = (obj, prefix) => {
    const keys = Object.keys(obj || {});
    return keys.find((k) => String(k).startsWith(prefix));
  };

  const withSortIndicator = (table, key, dir) => {
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
  };

  const compareBy = (key, dir) => {
    return (a, b) => {
      const av = a?.[key];
      const bv = b?.[key];

      const aNum = typeof av === "number" ? av : Number.NaN;
      const bNum = typeof bv === "number" ? bv : Number.NaN;

      let r = 0;
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) r = aNum - bNum;
      else r = normalize(av).localeCompare(normalize(bv), "ko");

      return dir === "asc" ? r : -r;
    };
  };

  /* =========================
     데이터 저장소
  ========================= */
  const DATA = {
    total: [],           // [{rank, streamer, total, deltaText}]
    combined: [],        // [{season, rank, grade, streamer, pre, r1..r5, total}]
    seasons: {},         // { "S1": [...], ... }
    synergy: [
      // 기존 유지 (원하면 엑셀/JSON으로 교체 가능)
      { rank: 1, grade: "부장", streamer: "은우♥", balloons: 50000 },
      { rank: 2, grade: "차장", streamer: "리윤_♥", balloons: 42000 },
      { rank: 3, grade: "대리", streamer: "후잉♥", balloons: 32000 },
      { rank: 4, grade: "사원", streamer: "하랑짱♥", balloons: 21000 },
    ],
  };

  /* =========================
     변동사항(누적) - 로컬 저장 (선택)
  ========================= */
  const TOTAL_PREV_KEY = "yxl_total_prev_ranks";

  const loadPrevTotalRanks = () => {
    try {
      const raw = localStorage.getItem(TOTAL_PREV_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const saveTotalRanks = (rows) => {
    try {
      const map = {};
      rows.forEach((r) => { if (r?.streamer) map[r.streamer] = Number(r.rank) || 0; });
      localStorage.setItem(TOTAL_PREV_KEY, JSON.stringify(map));
    } catch {}
  };

  const formatDeltaFromPrevRank = (prevRank, currRank) => {
    if (typeof prevRank !== "number" || !Number.isFinite(prevRank)) return `<span class="delta new">—</span>`;
    const delta = prevRank - currRank; // +면 상승
    if (delta > 0) return `<span class="delta up" title="상승 ${delta}계단">▲${delta}</span>`;
    if (delta < 0) return `<span class="delta down" title="하락 ${Math.abs(delta)}계단">▼${Math.abs(delta)}</span>`;
    return `<span class="delta same" title="변동 없음">—</span>`;
  };

  const formatDeltaFromText = (v) => {
    const t = (v ?? "").toString().trim();
    if (!t) return "";
    // 엑셀 변동사항을 그대로 표시하되, ▲/▼만 살짝 스타일을 입힘
    const mUp = t.match(/^\s*\+?(\d+)\s*$/);
    const mDown = t.match(/^\s*-(\d+)\s*$/);
    if (t.includes("▲")) return `<span class="delta up">${t}</span>`;
    if (t.includes("▼")) return `<span class="delta down">${t}</span>`;
    if (mUp) return `<span class="delta up">▲${mUp[1]}</span>`;
    if (mDown) return `<span class="delta down">▼${mDown[1]}</span>`;
    return `<span class="delta same">${t}</span>`;
  };

  /* =========================
     헤더
  ========================= */
  const updatedAt = document.getElementById("updatedAt");
  if (updatedAt) updatedAt.textContent = new Date().toLocaleString("ko-KR");

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

  tabs.forEach((btn) => btn.addEventListener("click", () => activatePanel(btn.dataset.target)));

  let initial = readHashDash();
  if (!initial) {
    try { initial = localStorage.getItem("yxl_dash"); } catch {}
  }
  if (!initial || !document.getElementById(initial)) initial = tabs[0]?.dataset.target || "dash-total";
  activatePanel(initial, { pushHash: true });

  window.addEventListener("hashchange", () => {
    const id = readHashDash();
    if (id && document.getElementById(id)) activatePanel(id, { pushHash: false });
  });

  /* =========================
     Excel 로드 + 파싱
  ========================= */
  async function loadWorkbook(url = "YXL_통합.xlsx") {
    if (!window.XLSX) throw new Error("XLSX 라이브러리가 로드되지 않았습니다.");
    const res = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`엑셀 파일 로드 실패: HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return window.XLSX.read(buf, { type: "array" });
  }

  function sheetToRows(wb, sheetName) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    return window.XLSX.utils.sheet_to_json(ws, { defval: "" });
  }

  function parseTotal(rows) {
    // 1번째 시트: ['순위','스트리머','누적기여도','변동사항']
    const prevMap = loadPrevTotalRanks();
    const parsed = rows
      .map((r) => {
        const rank = toNumber(r["순위"]);
        const streamer = (r["스트리머"] ?? "").toString().trim();
        const total = toNumber(r["누적기여도"]);
        const deltaText = (r["변동사항"] ?? "").toString().trim();
        if (!streamer) return null;
        return { rank, streamer, total, deltaText, _prevRank: prevMap[streamer] };
      })
      .filter(Boolean)
      // 혹시 엑셀 정렬이 깨졌으면 안전하게 순위 오름차순 정렬
      .sort((a, b) => (a.rank || 9999) - (b.rank || 9999));

    return parsed;
  }

  function parseCombined(rows) {
    // 2번째 시트: ['시즌','순위','직급','스트리머','직급전','1회차'..'5회차','합산기여도']
    return rows
      .map((r) => {
        const season = (r["시즌"] ?? "").toString().trim();
        const rank = toNumber(r["순위"]);
        const grade = (r["직급"] ?? "").toString().trim();
        const streamer = (r["스트리머"] ?? "").toString().trim();
        if (!season || !streamer) return null;
        return {
          season,
          rank,
          grade,
          streamer,
          pre: toNumber(r["직급전"]),
          r1: toNumber(r["1회차"]),
          r2: toNumber(r["2회차"]),
          r3: toNumber(r["3회차"]),
          r4: toNumber(r["4회차"]),
          r5: toNumber(r["5회차"]),
          total: toNumber(r["합산기여도"]),
        };
      })
      .filter(Boolean);
  }

  function parseSeasonSheet(rows) {
    // 시즌1은 컬럼명이 (11.5) 같은 날짜가 붙어있어서 prefix로 찾는다.
    return rows
      .map((r) => {
        const rank = toNumber(r["순위"]);
        const grade = (r["직급"] ?? "").toString().trim();
        const streamer = (r["스트리머"] ?? "").toString().trim();
        if (!streamer) return null;

        const kPre = pickKeyByPrefix(r, "직급전") || "직급전";
        const k1 = pickKeyByPrefix(r, "1회차") || "1회차";
        const k2 = pickKeyByPrefix(r, "2회차") || "2회차";
        const k3 = pickKeyByPrefix(r, "3회차") || "3회차";
        const k4 = pickKeyByPrefix(r, "4회차") || "4회차";
        const k5 = pickKeyByPrefix(r, "5회차") || "5회차";
        const kTot = pickKeyByPrefix(r, "합산기여도") || "합산기여도";

        return {
          rank,
          grade,
          streamer,
          pre: toNumber(r[kPre]),
          r1: toNumber(r[k1]),
          r2: toNumber(r[k2]),
          r3: toNumber(r[k3]),
          r4: toNumber(r[k4]),
          r5: toNumber(r[k5]),
          total: toNumber(r[kTot]),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.rank || 9999) - (b.rank || 9999));
  }

  function buildSeasonMap(wb) {
    const map = {};
    const sheetNames = wb.SheetNames || [];
    sheetNames.forEach((name) => {
      // 3~12번째 시트: 시즌별 기여도
      const m = String(name).match(/시즌\s*(\d+)/);
      if (!m) return;
      const seasonNum = Number(m[1]);
      if (!Number.isFinite(seasonNum)) return;
      const key = `S${seasonNum}`;
      const rows = sheetToRows(wb, name);
      map[key] = parseSeasonSheet(rows);
    });

    // 정렬된 키로 다시 구성
    const ordered = {};
    Object.keys(map)
      .sort((a, b) => Number(a.replace("S", "")) - Number(b.replace("S", "")))
      .forEach((k) => { ordered[k] = map[k]; });

    return ordered;
  }

  /* =========================
     렌더: 누적
  ========================= */
  function renderTotalTable() {
    const tbody = document.querySelector("#totalTable tbody");
    const q = normalize(document.getElementById("totalSearch")?.value);
    if (!tbody) return;

    const filtered = q ? DATA.total.filter((r) => normalize(r.streamer).includes(q)) : DATA.total;

    tbody.innerHTML = filtered.map((r) => {
      const fromText = formatDeltaFromText(r.deltaText);
      const fromPrev = formatDeltaFromPrevRank(r._prevRank, r.rank);
      const deltaHtml = fromText || fromPrev;

      return `
        <tr>
          <td>${rankBadge(r.rank)}</td>
          <td>${r.streamer}</td>
          <td class="num">${numFmt(r.total)}</td>
          <td class="num">${deltaHtml}</td>
        </tr>
      `;
    }).join("");

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
    }
  }

  document.getElementById("totalSearch")?.addEventListener("input", renderTotalTable);

  /* =========================
     렌더: 시즌통합랭킹
     - 시즌 선택 박스 없이 "전체 시즌"을 한 번에 표시
  ========================= */
  const combinedState = { key: "season", dir: "asc" };

  function renderCombinedTable() {
    const table = document.getElementById("combinedTable");
    const tbody = table?.querySelector("tbody");
    const q = normalize(document.getElementById("combinedSearch")?.value);
    if (!table || !tbody) return;

    let rows = DATA.combined;
    if (q) rows = rows.filter((r) => normalize(r.streamer).includes(q));

    // 정렬
    rows = [...rows].sort(compareBy(combinedState.key, combinedState.dir));
    withSortIndicator(table, combinedState.key, combinedState.dir);

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${r.season}</td>
        <td>${rankBadge(r.rank)}</td>
        <td>${r.grade}</td>
        <td>${r.streamer}</td>
        <td class="num">${numFmt(r.pre)}</td>
        <td class="num">${numFmt(r.r1)}</td>
        <td class="num">${numFmt(r.r2)}</td>
        <td class="num">${numFmt(r.r3)}</td>
        <td class="num">${numFmt(r.r4)}</td>
        <td class="num">${numFmt(r.r5)}</td>
        <td class="num">${numFmt(r.total)}</td>
      </tr>
    `).join("");

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
    }
  }

  document.getElementById("combinedSearch")?.addEventListener("input", renderCombinedTable);

  document.getElementById("combinedTable")?.querySelectorAll("thead th[data-key]")?.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (!key) return;
      if (combinedState.key !== key) {
        combinedState.key = key;
        combinedState.dir = (key === "season" || key === "rank" || key === "grade" || key === "streamer") ? "asc" : "desc";
      } else {
        combinedState.dir = combinedState.dir === "asc" ? "desc" : "asc";
      }
      renderCombinedTable();
    });
  });

  /* =========================
     렌더: 시즌별
  ========================= */
  const seasonState = { key: "rank", dir: "asc" };

  function initSeasonSelect() {
    const select = document.getElementById("seasonSelect");
    if (!select) return;

    const keys = Object.keys(DATA.seasons);
    select.innerHTML = keys.map((k) => `<option value="${k}">${k}</option>`).join("");

    try {
      const saved = localStorage.getItem("yxl_season");
      if (saved && keys.includes(saved)) select.value = saved;
    } catch {}
  }

  function renderSeasonTable() {
    const table = document.getElementById("seasonTable");
    const tbody = table?.querySelector("tbody");
    const select = document.getElementById("seasonSelect");
    const q = normalize(document.getElementById("seasonSearch")?.value);
    if (!table || !tbody || !select) return;

    const seasonKey = select.value;
    try { localStorage.setItem("yxl_season", seasonKey); } catch {}

    let rows = DATA.seasons[seasonKey] ?? [];
    if (q) rows = rows.filter((r) => normalize(r.streamer).includes(q));

    rows = [...rows].sort(compareBy(seasonState.key, seasonState.dir));
    withSortIndicator(table, seasonState.key, seasonState.dir);

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${rankBadge(r.rank)}</td>
        <td>${r.grade}</td>
        <td>${r.streamer}</td>
        <td class="num">${numFmt(r.pre)}</td>
        <td class="num">${numFmt(r.r1)}</td>
        <td class="num">${numFmt(r.r2)}</td>
        <td class="num">${numFmt(r.r3)}</td>
        <td class="num">${numFmt(r.r4)}</td>
        <td class="num">${numFmt(r.r5)}</td>
        <td class="num">${numFmt(r.total)}</td>
      </tr>
    `).join("");

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
    }
  }

  document.getElementById("seasonSelect")?.addEventListener("change", renderSeasonTable);
  document.getElementById("seasonSearch")?.addEventListener("input", renderSeasonTable);

  document.getElementById("seasonTable")?.querySelectorAll("thead th[data-key]")?.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (!key) return;
      if (seasonState.key !== key) {
        seasonState.key = key;
        seasonState.dir = "asc";
      } else {
        seasonState.dir = seasonState.dir === "asc" ? "desc" : "asc";
      }
      renderSeasonTable();
    });
  });

  /* =========================
     시너지 정렬 (기존)
  ========================= */
  const synergyState = { key: "rank", dir: "asc" };

  function renderSynergyTable() {
    const table = document.getElementById("synergyTable");
    if (!table) return;

    const tbody = table.querySelector("tbody");
    const { key, dir } = synergyState;

    withSortIndicator(table, key, dir);

    const rows = [...DATA.synergy].sort(compareBy(key, dir));
    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${rankBadge(r.rank)}</td>
        <td>${r.grade}</td>
        <td>${r.streamer}</td>
        <td class="num">${numFmt(toNumber(r.balloons))}</td>
      </tr>
    `).join("");
  }

  document.getElementById("synergyTable")?.querySelectorAll("thead th[data-key]")?.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (!key) return;
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
     🎄 Garland Random Twinkle (per-bulb)
  ========================= */
  (function initGarlandTwinkle(){
    const bulbs = Array.from(document.querySelectorAll(".garland .bulb"));
    if (!bulbs.length) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      bulbs.forEach(b => {
        b.style.setProperty("--o", "0.95");
        b.style.setProperty("--s", "1.0");
        b.style.setProperty("--blur", "18px");
      });
      return;
    }

    function schedule(bulb){
      const tick = () => {
        let o = 0.25 + Math.random() * 0.85;
        let s = 0.85 + Math.random() * 0.55;
        let blur = 10 + Math.random() * 26;

        if (Math.random() < 0.12) {
          o *= 0.15;
          s *= 0.92;
          blur *= 0.55;
        }

        bulb.style.setProperty("--o", o.toFixed(2));
        bulb.style.setProperty("--s", s.toFixed(2));
        bulb.style.setProperty("--blur", `${Math.round(blur)}px`);

        const next = 90 + Math.random() * 900;
        setTimeout(tick, next);
      };
      setTimeout(tick, Math.random() * 800);
    }

    bulbs.forEach(schedule);
  })();

  /* =========================
     최초 로딩: Excel -> 렌더
  ========================= */
  (async () => {
    // 로딩 플레이스홀더
    const setLoading = (sel, colspan) => {
      const tbody = document.querySelector(`${sel} tbody`);
      if (!tbody) return;
      tbody.innerHTML = `<tr><td colspan="${colspan}" style="color:rgba(255,255,255,.55); padding:16px;">데이터 불러오는 중...</td></tr>`;
    };
    setLoading("#totalTable", 4);
    setLoading("#combinedTable", 11);
    setLoading("#seasonTable", 10);

    try {
      const wb = await loadWorkbook("YXL_통합.xlsx");

      // 1) 누적
      const totalRows = sheetToRows(wb, "누적기여도");
      DATA.total = parseTotal(totalRows);

      // 2) 시즌통합랭킹
      const combinedRows = sheetToRows(wb, "S1~S10 YXL_기여도");
      DATA.combined = parseCombined(combinedRows);

      // 3) 시즌별
      DATA.seasons = buildSeasonMap(wb);

      // UI 초기화
      initSeasonSelect();

      // 최초 렌더
      renderTotalTable();
      renderCombinedTable();
      renderSeasonTable();
      renderSynergyTable();

      // 다음 업데이트에서 변동사항 계산을 위해 현재 순위 저장
      saveTotalRanks(DATA.total);

    } catch (e) {
      console.error(e);
      const msg = (e && e.message) ? e.message : "데이터 로드 실패";
      // 사용자에게도 표시
      const tbody1 = document.querySelector("#totalTable tbody");
      if (tbody1) tbody1.innerHTML = `<tr><td colspan="4" style="color:rgba(255,170,170,.9); padding:16px;">${msg}<br/>엑셀 파일(YXL_통합.xlsx)이 리포지토리 루트에 있는지 확인해줘.</td></tr>`;
      const tbody2 = document.querySelector("#combinedTable tbody");
      if (tbody2) tbody2.innerHTML = `<tr><td colspan="11" style="color:rgba(255,170,170,.9); padding:16px;">${msg}</td></tr>`;
      const tbody3 = document.querySelector("#seasonTable tbody");
      if (tbody3) tbody3.innerHTML = `<tr><td colspan="10" style="color:rgba(255,170,170,.9); padding:16px;">${msg}</td></tr>`;
      // 시너지도 표시
      renderSynergyTable();
    }
  })();
});
