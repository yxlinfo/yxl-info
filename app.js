
document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Config
  ========================= */
  const FILE_MAIN = "YXL_통합.xlsx";
  const FILE_SYNERGY = "시너지표.xlsx";
  const AUTO_REFRESH_MS = 3 * 60 * 60 * 1000; // 3시간

  const state = {
    main: {
      total: [],
      integrated: [],
      seasons: new Map(), // sheetName -> { headers, rows }
      seasonSheetNames: [],
    },
    synergy: {
      rows: [],
      updatedAt: null,
    },
    // sorting state
    synergySort: { key: "순위", dir: "asc" },
    integratedSort: { key: null, dir: "asc" },
    seasonSort: { key: null, dir: "asc" },
  };

  /* =========================
     Utilities
  ========================= */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const numFmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return (n ?? "").toString();
    return x.toLocaleString("ko-KR");
  };

  const normalize = (s) =>
    (s ?? "")
      .toString()
      .replace(/[♥♡]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  function compareBy(key, dir = "asc") {
    return (a, b) => {
      const av = a?.[key] ?? "";
      const bv = b?.[key] ?? "";
      const aNum = Number(av);
      const bNum = Number(bv);
      let r = 0;

      if (Number.isFinite(aNum) && Number.isFinite(bNum)) r = aNum - bNum;
      else r = normalize(av).localeCompare(normalize(bv), "ko");

      return dir === "asc" ? r : -r;
    };
  }

  async function fetchArrayBuffer(url) {
    // 캐시 회피(엑셀 갱신 반영)
    const bust = url.includes("?") ? "&" : "?";
    const res = await fetch(url + bust + "v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`파일 불러오기 실패: ${url} (${res.status})`);
    return await res.arrayBuffer();
  }

  function sheetToTable(wb, sheetName) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return { headers: [], rows: [] };

    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!grid.length) return { headers: [], rows: [] };

    const headers = grid[0].map((h) => (h ?? "").toString().trim());
    const rows = grid
      .slice(1)
      .filter((r) => r.some((v) => (v ?? "").toString().trim() !== ""))
      .map((r) => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
        return obj;
      });

    return { headers, rows };
  }

  function setUpdatedAt(dt) {
    const el = $("#updatedAt");
    if (!el) return;
    if (!dt) {
      el.textContent = new Date().toLocaleString("ko-KR");
      return;
    }
    const d = dt instanceof Date ? dt : new Date(dt);
    el.textContent = d.toLocaleString("ko-KR");
  }

  /* =========================
     Tabs
  ========================= */
  function setActiveTab(targetId) {
    const tabs = $$(".dash-tab");
    const panels = $$(".dash-panel");

    tabs.forEach((t) => {
      const isOn = t.dataset.target === targetId;
      t.classList.toggle("is-active", isOn);
      t.setAttribute("aria-selected", isOn ? "true" : "false");
    });
    panels.forEach((p) => {
      const isOn = p.id === targetId;
      p.hidden = !isOn;
      p.classList.toggle("is-active", isOn);
    });

    localStorage.setItem("yxl_active_tab", targetId);
  }

  function initTabs() {
    const tabs = $$(".dash-tab");
    tabs.forEach((t) => {
      t.addEventListener("click", () => setActiveTab(t.dataset.target));
    });

    const saved = localStorage.getItem("yxl_active_tab");
    // 시너지표를 기본으로(요청사항)
    setActiveTab(saved || "dash-synergy");
  }

  /* =========================
     Render: Total (Sheet 1)
  ========================= */
  function renderTotal() {
    const table = $("#totalTable");
    if (!table) return;
    const tbody = table.querySelector("tbody");
    const q = normalize($("#totalSearch")?.value);

    let rows = [...state.main.total];
    if (q) rows = rows.filter((r) => normalize(r["스트리머"]).includes(q));

    tbody.innerHTML = rows
      .map((r) => {
        const rank = r["순위"];
        const name = r["스트리머"];
        const total = r["누적기여도"];
        const delta = r["변동사항"];
        return `
          <tr>
            <td>${rank ?? ""}</td>
            <td>${name ?? ""}</td>
            <td class="num">${numFmt(total)}</td>
            <td class="num">${delta ?? ""}</td>
          </tr>
        `;
      })
      .join("");
  }

  /* =========================
     Render: Integrated (Sheet 2)
  ========================= */
  function renderIntegrated() {
    const table = $("#integratedTable");
    if (!table) return;
    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");
    const q = normalize($("#integratedSearch")?.value);

    const headers = state.main.integratedHeaders || [];
    let rows = [...state.main.integrated];

    if (q) {
      const streamerKey = headers.find((h) => normalize(h) === "스트리머");
      if (streamerKey) rows = rows.filter((r) => normalize(r[streamerKey]).includes(q));
    }

    // sort
    if (state.integratedSort.key) {
      rows.sort(compareBy(state.integratedSort.key, state.integratedSort.dir));
    }

    thead.innerHTML = `
      <tr>
        ${headers
          .map((h) => {
            const isActive = state.integratedSort.key === h;
            const ind = isActive ? (state.integratedSort.dir === "asc" ? " ▲" : " ▼") : "";
            return `<th data-key="${h}">${h}${ind}</th>`;
          })
          .join("")}
      </tr>
    `;

    tbody.innerHTML = rows
      .map((r) => {
        return `<tr>${headers
          .map((h) => {
            const v = r[h];
            const isNum = typeof v === "number" || (v !== "" && !Number.isNaN(Number(v)));
            return `<td${isNum ? ' class="num"' : ""}>${isNum ? numFmt(v) : (v ?? "")}</td>`;
          })
          .join("")}</tr>`;
      })
      .join("");

    // header sort handlers
    thead.querySelectorAll("th[data-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.dataset.key;
        if (state.integratedSort.key !== k) {
          state.integratedSort.key = k;
          state.integratedSort.dir = "asc";
        } else {
          state.integratedSort.dir = state.integratedSort.dir === "asc" ? "desc" : "asc";
        }
        renderIntegrated();
      });
    });
  }

  /* =========================
     Render: Season (Sheets 3~12)
  ========================= */
  function initSeasonSelect() {
    const sel = $("#seasonSelect");
    if (!sel) return;

    sel.innerHTML = state.main.seasonSheetNames
      .map((n) => `<option value="${n}">${n}</option>`)
      .join("");

    const saved = localStorage.getItem("yxl_season_sheet");
    if (saved && state.main.seasonSheetNames.includes(saved)) sel.value = saved;

    sel.addEventListener("change", () => {
      localStorage.setItem("yxl_season_sheet", sel.value);
      renderSeason();
    });
  }

  function renderSeason() {
    const table = $("#seasonTable");
    if (!table) return;
    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");
    const sel = $("#seasonSelect");
    const q = normalize($("#seasonSearch")?.value);

    const sheetName = sel?.value || state.main.seasonSheetNames[0];
    if (!sheetName) return;

    const sheet = state.main.seasons.get(sheetName);
    if (!sheet) return;

    const headers = sheet.headers;
    let rows = [...sheet.rows];

    // filter: streamer column if present
    if (q) {
      const nameKey = headers.find((h) => normalize(h) === "스트리머" || normalize(h) === "비제이명" || normalize(h) === "멤버");
      if (nameKey) rows = rows.filter((r) => normalize(r[nameKey]).includes(q));
    }

    // sort
    if (state.seasonSort.key) rows.sort(compareBy(state.seasonSort.key, state.seasonSort.dir));

    thead.innerHTML = `
      <tr>
        ${headers
          .map((h) => {
            const isActive = state.seasonSort.key === h;
            const ind = isActive ? (state.seasonSort.dir === "asc" ? " ▲" : " ▼") : "";
            return `<th data-key="${h}">${h}${ind}</th>`;
          })
          .join("")}
      </tr>
    `;

    tbody.innerHTML = rows
      .map((r) => {
        return `<tr>${headers
          .map((h) => {
            const v = r[h];
            const isNum = v !== "" && !Number.isNaN(Number(v));
            return `<td${isNum ? ' class="num"' : ""}>${isNum ? numFmt(v) : (v ?? "")}</td>`;
          })
          .join("")}</tr>`;
      })
      .join("");

    // header sort handlers
    thead.querySelectorAll("th[data-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.dataset.key;
        if (state.seasonSort.key !== k) {
          state.seasonSort.key = k;
          state.seasonSort.dir = "asc";
        } else {
          state.seasonSort.dir = state.seasonSort.dir === "asc" ? "desc" : "asc";
        }
        renderSeason();
      });
    });
  }

  /* =========================
     Render: Synergy (시너지표.xlsx / 쿼리2)
  ========================= */
  function computeSynergyDelta(rows) {
    const key = "yxl_synergy_prev_ranks";
    const prev = JSON.parse(localStorage.getItem(key) || "{}");
    const now = {};

    const out = rows.map((r) => {
      const name = r["비제이명"] ?? "";
      const rank = Number(r["순위"]);
      now[name] = rank;

      const prevRank = prev[name];
      let deltaText = "NEW";
      if (prevRank !== undefined && prevRank !== null && prevRank !== "") {
        const d = Number(prevRank) - rank;
        if (d > 0) deltaText = `▲${d}`;
        else if (d < 0) deltaText = `▼${Math.abs(d)}`;
        else deltaText = "—";
      }
      return { ...r, "변동": deltaText };
    });

    localStorage.setItem(key, JSON.stringify(now));
    return out;
  }

  function renderSynergy() {
    const table = $("#synergyTable");
    if (!table) return;

    const tbody = table.querySelector("tbody");
    const thead = table.querySelector("thead");
    const { key, dir } = state.synergySort;

    // sort indicator (thead rebuild)
    const headers = [
      { key: "순위", label: "순위", right: false },
      { key: "비제이명", label: "스트리머", right: false },
      { key: "월별 누적별풍선", label: "누적별풍선", right: true },
      { key: "변동", label: "변동사항", right: true },
    ];
    thead.innerHTML = `
      <tr>
        ${headers
          .map((h) => {
            const isActive = h.key === key;
            const ind = isActive ? (dir === "asc" ? " ▲" : " ▼") : "";
            return `<th data-key="${h.key}"${h.right ? ' style="text-align:right;"' : ""}>${h.label}${ind}</th>`;
          })
          .join("")}
      </tr>
    `;

    let rows = [...state.synergy.rows].sort(compareBy(key, dir));

    tbody.innerHTML = rows
      .map((r) => {
        const rank = r["순위"];
        const name = r["비제이명"];
        const balloons = r["월별 누적별풍선"];
        const delta = r["변동"];
        return `
          <tr>
            <td>${rank ?? ""}</td>
            <td>
              <span class="soop-name" data-streamer="${String(name ?? "")}">${name ?? ""}</span>
            </td>
            <td class="num">${numFmt(balloons)}</td>
            <td class="num">${delta ?? ""}</td>
          </tr>
        `;
      })
      .join("");

    // header sort handlers
    thead.querySelectorAll("th[data-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.dataset.key;
        if (state.synergySort.key !== k) {
          state.synergySort.key = k;
          state.synergySort.dir = "asc";
        } else {
          state.synergySort.dir = state.synergySort.dir === "asc" ? "desc" : "asc";
        }
        renderSynergy();

      });
    });

    renderSynergyMeta();

  }

 
  /* =========================
     Load Excel & Init
  ========================= */
  async function loadMainExcel() {
    const ab = await fetchArrayBuffer(FILE_MAIN);
    const wb = XLSX.read(ab, { type: "array" });
    const names = wb.SheetNames;

    // Sheet 1: 누적기여도
    const t1 = sheetToTable(wb, names[0]);
    state.main.total = t1.rows;

    // Sheet 2: S1~S10 YXL_기여도
    const t2 = sheetToTable(wb, names[1]);
    state.main.integratedHeaders = t2.headers;
    state.main.integrated = t2.rows;

    // Sheets 3~12: 시즌별
    state.main.seasonSheetNames = names.slice(2, 12);
    state.main.seasons.clear();
    state.main.seasonSheetNames.forEach((sn) => {
      state.main.seasons.set(sn, sheetToTable(wb, sn));
    });
  }

  async function loadSynergyExcel() {
    const ab = await fetchArrayBuffer(FILE_SYNERGY);
    const wb = XLSX.read(ab, { type: "array" });
    const sn = wb.SheetNames[0]; // 쿼리2
    const t = sheetToTable(wb, sn);

    // updatedAt: take first non-empty '새로고침시간'
    const upd = t.rows.find((r) => r["새로고침시간"])?.["새로고침시간"];
    // XLSX may parse dates as numbers; use XLSX.SSF.parse_date_code
    let dt = null;
    if (upd) {
      if (typeof upd === "number" && XLSX.SSF) {
        const p = XLSX.SSF.parse_date_code(upd);
        if (p) dt = new Date(p.y, p.m - 1, p.d, p.H, p.M, p.S);
      } else {
        dt = new Date(upd);
      }
    }

    state.synergy.updatedAt = dt || new Date();
    state.synergy.rows = computeSynergyDelta(
      t.rows.map((r) => ({
        "순위": r["순위"],
        "비제이명": r["비제이명"],
        "월별 누적별풍선": r["월별 누적별풍선"],
        "새로고침시간": r["새로고침시간"],
      }))
    );

    setUpdatedAt(state.synergy.updatedAt);
  }

  async function loadAll() {
    try {
      await Promise.all([loadMainExcel(), loadSynergyExcel()]);
      initSeasonSelect();

      renderTotal();
      renderIntegrated();
      renderSeason();
      renderSynergy();
    } catch (e) {
      console.error(e);
      alert("데이터 로딩 중 오류가 발생했습니다.\n\n" + (e?.message || e));
    }
  }

  function initSearchInputs() {
    $("#totalSearch")?.addEventListener("input", renderTotal);
    $("#integratedSearch")?.addEventListener("input", renderIntegrated);
    $("#seasonSearch")?.addEventListener("input", renderSeason);
  }

  /* =========================
     Auto refresh (3 hours)
  ========================= */
  function startAutoRefresh() {
    setInterval(() => {
      loadAll();
    }, AUTO_REFRESH_MS);
  }
/* =========================
   Gate + BGM Dashboard (3 tracks)
========================= */
(function gateAndBgm() {
  const KEY_ON = "yxl_bgm_on";
  const KEY_SEL = "yxl_bgm_selected";

  const gate = document.getElementById("gate");
  const gateBtn = document.getElementById("gateBtn");
  const gateMsg = document.getElementById("gateMsg");

  const a1 = document.getElementById("bgm");
  const a2 = document.getElementById("bgm2");
  const a3 = document.getElementById("bgm3");

  const btnPlay = document.getElementById("bgmPlay");
  const btnPrev = document.getElementById("bgmPrev");
  const btnNext = document.getElementById("bgmNext");
  const sel = document.getElementById("bgmSelect");


  const ALWAYS_GATE = true;

  const tracks = [
    { key: "bgm", el: a1 },
    { key: "bgm2", el: a2 },
    { key: "bgm3", el: a3 },
  ].filter(t => t.el);

  const map = Object.fromEntries(tracks.map(t => [t.key, t.el]));

  function showGate(show) {
    if (!gate) return;
    gate.classList.toggle("is-hidden", !show);
    gate.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function gateVisible() {
    return gate && !gate.classList.contains("is-hidden");
  }

  function stopAll({ reset = false } = {}) {
    tracks.forEach(({ el }) => {
      el.pause();
      if (reset) {
        try { el.currentTime = 0; } catch (e) {}
      }
    });
  }

  function getSelectedKey() {
    const saved = localStorage.getItem(KEY_SEL);
    if (saved && map[saved]) return saved;
    return tracks[0]?.key || "bgm";
  }

  function setSelectedKey(k) {
    if (!map[k]) k = tracks[0]?.key || "bgm";
    localStorage.setItem(KEY_SEL, k);
    if (sel) sel.value = k;
  }

  function setPlayUI(on) {
    if (!btnPlay) return;
    btnPlay.setAttribute("aria-pressed", on ? "true" : "false");
    btnPlay.textContent = on ? "⏸︎ Pause" : "▶︎ Play";
  }

  async function playSelected({ reset = true } = {}) {
    const k = getSelectedKey();
    const audio = map[k];
    if (!audio) return;

    stopAll({ reset: false });
    if (reset) {
      try { audio.currentTime = 0; } catch (e) {}
    }
    const p = audio.play();
    if (p && typeof p.catch === "function") await p.catch(() => {});
  }

  async function setOn(on) {
    localStorage.setItem(KEY_ON, on ? "1" : "0");
    setPlayUI(on);
    if (on) await playSelected({ reset: false });
    else stopAll({ reset: false });
  }

  function moveTrack(dir) {
    const cur = getSelectedKey();
    const idx = tracks.findIndex(t => t.key === cur);
    if (idx < 0) return;

    const nextIdx = (idx + dir + tracks.length) % tracks.length;
    setSelectedKey(tracks[nextIdx].key);
  }

  function enter() {
    localStorage.setItem("yxl_gate_ok", "1");
    showGate(false);
    setOn(true);
  }

  // 초기 게이트 표시
  const allowed = localStorage.getItem("yxl_gate_ok") === "1";
  showGate(ALWAYS_GATE ? true : !allowed);
  if (gateMsg) gateMsg.textContent = "입장하려면 버튼을 눌러주세요.";

  // 선택/표시 초기화
  setSelectedKey(getSelectedKey());

  // UI만 복원(자동재생 X)
  const isOn = localStorage.getItem(KEY_ON) === "1";
  setPlayUI(isOn);

  // 게이트 버튼
  gateBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    enter();
  });

  // 배경 클릭도 입장
  gate?.addEventListener("click", (e) => {
    if (e.target === gate || e.target.classList?.contains("gate-sparkles") || e.target.id === "gateParticles") {
      enter();
    }
  });

  // 재생/일시정지
  btnPlay?.addEventListener("click", async () => {
    if (gateVisible()) return enter();
    const on = localStorage.getItem(KEY_ON) === "1";
    await setOn(!on);
  });

  // 이전/다음(스킵)
  btnPrev?.addEventListener("click", async () => {
    if (gateVisible()) return enter();
    moveTrack(-1);
    const on = localStorage.getItem(KEY_ON) === "1";
    if (on) await playSelected({ reset: true });
  });

  btnNext?.addEventListener("click", async () => {
    if (gateVisible()) return enter();
    moveTrack(+1);
    const on = localStorage.getItem(KEY_ON) === "1";
    if (on) await playSelected({ reset: true });
  });

  // 셀렉트 변경
  sel?.addEventListener("change", async () => {
    if (gateVisible()) return;
    setSelectedKey(sel.value);
    const on = localStorage.getItem(KEY_ON) === "1";
    if (on) await playSelected({ reset: true });
  });
})();

  /* =========================
     Init
  ========================= */
  initTabs();
  initSearchInputs();
  loadAll();
  startAutoRefresh();
});
