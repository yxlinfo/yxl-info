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

  function renderSynergyMeta() {
    const meta = $("#synergyMeta");
    if (!meta) return;

    let dt = state.synergy.updatedAt;
    if (!dt) {
      meta.textContent = "데이터 기준: --";
      return;
    }

    dt = dt instanceof Date ? dt : new Date(dt);
    meta.textContent = `데이터 기준: ${dt.toLocaleString("ko-KR")}`;
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

    const maxBalloon = Math.max(0, ...rows.map(r => Number(r["월별 누적별풍선"] ?? 0)));


    tbody.innerHTML = rows
      .map((r) => {
        const rank = r["순위"];
        const name = r["비제이명"];
        const balloonsNum = Number(r["월별 누적별풍선"] ?? 0);
        const pct = maxBalloon ? (balloonsNum / maxBalloon) * 100 : 0;
        const rankNum = Number(rank ?? 0);
        const top = rankNum === 1 ? 1 : (rankNum === 2 ? 2 : (rankNum === 3 ? 3 : 0));
        const trClass = top ? ` class="top${top}"` : "";
        const rankHtml = top
          ? `<span class="rank-badge rank-${top}"><span class="medal">${top===1?"🥇":top===2?"🥈":"🥉"}</span><span class="rank-num">${rankNum}</span></span>`
          : `${rank ?? ""}`;
        return `
          <tr${trClass}>
            <td class="rankcell">${rankHtml}</td>
            <td>
              <span class="soop-name" data-streamer="${String(name ?? "")}">${name ?? ""}</span>
            </td>
            <td class="num barcell">
              <span class="barbg"><span class="barfill" style="width:${pct.toFixed(2)}%"></span></span>
              <span class="bartext">${numFmt(balloonsNum)}</span>
            </td>
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
     - 재생/이전/다음/셀렉트 + (추가) 시간 게이지 + 볼륨 게이지
  ========================= */
  (function gateAndBgm() {
    const KEY_ON = "yxl_bgm_on";
    const KEY_SEL = "yxl_bgm_selected";
    const KEY_VOL = "yxl_bgm_volume"; // 0~1

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

    // ✅ gauges
    const seek = document.getElementById("bgmSeek");
    const time = document.getElementById("bgmTime");
    const vol = document.getElementById("bgmVol");

    // ✅ 원하면 false로 바꾸면 "처음 1회만 게이트"로 동작
    const ALWAYS_GATE = true;

    const tracks = [
      { key: "bgm", el: a1 },
      { key: "bgm2", el: a2 },
      { key: "bgm3", el: a3 },
    ].filter((t) => t.el);

    const map = Object.fromEntries(tracks.map((t) => [t.key, t.el]));

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
      syncGaugesToAudio(); // ✅ 선택 바뀌면 게이지 동기화
    }

    function setPlayUI(on) {
      if (!btnPlay) return;
      btnPlay.setAttribute("aria-pressed", on ? "true" : "false");
      btnPlay.textContent = on ? "⏸︎ Pause" : "▶︎ Play";
    }

    function getActiveAudio() {
      const k = getSelectedKey();
      return map[k] || tracks[0]?.el || null;
    }

    function fmtTime(sec) {
      const s = Math.max(0, Math.floor(Number(sec) || 0));
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      return `${mm}:${ss}`;
    }

    function applyVolume(v01) {
      const v = Math.min(1, Math.max(0, Number(v01)));
      tracks.forEach(({ el }) => { el.volume = v; });
      localStorage.setItem(KEY_VOL, String(v));
      if (vol) vol.value = String(Math.round(v * 100));
    }

    function getSavedVolume() {
      const saved = Number(localStorage.getItem(KEY_VOL));
      if (Number.isFinite(saved)) return Math.min(1, Math.max(0, saved));
      // 초기 볼륨: 30% (처음 방문/저장값 없을 때)
      return 0.3;
    }

    let seeking = false;

    function syncGaugesToAudio() {
      const audio = getActiveAudio();
      if (!audio) return;

      // duration이 아직 없으면(메타데이터 미로드) 기본값 유지
      const dur = Number(audio.duration);
      if (seek) {
        seek.min = "0";
        seek.max = Number.isFinite(dur) && dur > 0 ? String(dur) : "100";
        if (!seeking) {
          const ct = Number(audio.currentTime) || 0;
          seek.value = String(ct);
        }
      }

      if (time) {
        const ct = Number(audio.currentTime) || 0;
        const total = Number.isFinite(dur) && dur > 0 ? dur : 0;
        time.textContent = `${fmtTime(ct)} / ${fmtTime(total)}`;
      }
    }

    function hookAudioEvents() {
      // 각 트랙에 이벤트를 달되, "선택된 트랙"일 때만 갱신
      tracks.forEach(({ key, el }) => {
        const updateIfActive = () => {
          if (getSelectedKey() !== key) return;
          syncGaugesToAudio();
        };
        el.addEventListener("loadedmetadata", updateIfActive);
        el.addEventListener("timeupdate", updateIfActive);
        el.addEventListener("durationchange", updateIfActive);
        el.addEventListener("ended", updateIfActive);
      });
    }

    async function playSelected({ reset = true } = {}) {
      const audio = getActiveAudio();
      if (!audio) return;

      stopAll({ reset: false });
      if (reset) {
        try { audio.currentTime = 0; } catch (e) {}
      }
      // 볼륨은 항상 맞춰두기
      audio.volume = getSavedVolume();

      const p = audio.play();
      if (p && typeof p.catch === "function") await p.catch(() => {});
      syncGaugesToAudio();
    }

    async function setOn(on) {
      localStorage.setItem(KEY_ON, on ? "1" : "0");
      setPlayUI(on);
      if (on) await playSelected({ reset: false });
      else stopAll({ reset: false });
    }

    function moveTrack(dir) {
      const cur = getSelectedKey();
      const idx = tracks.findIndex((t) => t.key === cur);
      if (idx < 0) return;

      const nextIdx = (idx + dir + tracks.length) % tracks.length;
      setSelectedKey(tracks[nextIdx].key);
    }

    function enter() {
      // "입장"은 사용자 제스처 이벤트 안에서 실행되어야 재생이 확실함
      localStorage.setItem("yxl_gate_ok", "1");
      showGate(false);
      setOn(true);
    }

    /* ---------- 초기화 ---------- */
    const allowed = localStorage.getItem("yxl_gate_ok") === "1";
    showGate(ALWAYS_GATE ? true : !allowed);
    if (gateMsg) gateMsg.textContent = "입장하려면 버튼을 눌러주세요.";

    // 선택/표시 초기화
    setSelectedKey(getSelectedKey());

    // 볼륨 초기화(전체 트랙 동일)
    applyVolume(getSavedVolume());

    // UI만 복원(자동재생 X)
    const isOn = localStorage.getItem(KEY_ON) === "1";
    setPlayUI(isOn);

    // 오디오 이벤트 연결
    hookAudioEvents();
    syncGaugesToAudio();

    /* ---------- 게이트 ---------- */
    gateBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      enter();
    });

    gate?.addEventListener("click", (e) => {
      if (e.target === gate || e.target.classList?.contains("gate-sparkles") || e.target.id === "gateParticles") {
        enter();
      }
    });

    /* ---------- 컨트롤 ---------- */
    btnPlay?.addEventListener("click", async () => {
      if (gateVisible()) return enter();
      const on = localStorage.getItem(KEY_ON) === "1";
      await setOn(!on);
    });

    btnPrev?.addEventListener("click", async () => {
      if (gateVisible()) return enter();
      moveTrack(-1);
      const on = localStorage.getItem(KEY_ON) === "1";
      if (on) await playSelected({ reset: true });
      else syncGaugesToAudio();
    });

    btnNext?.addEventListener("click", async () => {
      if (gateVisible()) return enter();
      moveTrack(+1);
      const on = localStorage.getItem(KEY_ON) === "1";
      if (on) await playSelected({ reset: true });
      else syncGaugesToAudio();
    });

    sel?.addEventListener("change", async () => {
      if (gateVisible()) return;
      setSelectedKey(sel.value);
      const on = localStorage.getItem(KEY_ON) === "1";
      if (on) await playSelected({ reset: true });
      else syncGaugesToAudio();
    });

    /* ---------- 게이지: Seek ---------- */
    if (seek) {
      seek.addEventListener("pointerdown", () => { seeking = true; });
      seek.addEventListener("pointerup", () => { seeking = false; });

      // 드래그 중 표시 업데이트
      seek.addEventListener("input", () => {
        const audio = getActiveAudio();
        if (!audio) return;
        const v = Number(seek.value) || 0;
        const dur = Number(audio.duration);
        if (time) {
          const total = Number.isFinite(dur) && dur > 0 ? dur : 0;
          time.textContent = `${fmtTime(v)} / ${fmtTime(total)}`;
        }
      });

      // 드래그 끝나면 실제 이동
      seek.addEventListener("change", async () => {
        const audio = getActiveAudio();
        if (!audio) return;
        try { audio.currentTime = Number(seek.value) || 0; } catch (e) {}
        const on = localStorage.getItem(KEY_ON) === "1";
        if (on && audio.paused) {
          // 일부 브라우저에서 seek 후 재생 멈춤 방지
          const p = audio.play();
          if (p && typeof p.catch === "function") await p.catch(() => {});
        }
        syncGaugesToAudio();
      });
    }

    /* ---------- 게이지: Volume ---------- */
    vol?.addEventListener("input", () => {
      const v = (Number(vol.value) || 0) / 100;
      applyVolume(v);
    });
  })();


  /* =========================
     Hall of Fame (부장 명예의 전당)
     - 공백 → 1대 → ... → 10대 (1개씩 입장/정지/퇴장)
     - 10대 끝나면 잠깐 공백 후 1대로 재시작
  ========================= */
  function initHallOfFame() {
    const line = document.getElementById("hofLine");
    if (!line) return;

    const HOF = [
      { gen: "1대부장",  name: "류시아", cnt: "4,698,914개" },
      { gen: "2대부장",  name: "류시아", cnt: "3,070,017개" },
      { gen: "3대부장",  name: "류시아", cnt: "3,687,480개" },
      { gen: "4대부장",  name: "유누",   cnt: "2,750,614개" },
      { gen: "5대부장",  name: "유누",   cnt: "2,800,254개" },
      { gen: "6대부장",  name: "유누",   cnt: "2,358,342개" },
      { gen: "7대부장",  name: "루루",   cnt: "2,898,789개" },
      { gen: "8대부장",  name: "은우",   cnt: "3,102,272개" },
      { gen: "9대부장",  name: "은우",   cnt: "3,611,788개" },
      { gen: "10대부장", name: "지유",   cnt: "4,001,954개" },
      { gen: "회장님", name: "지유의냥강조" },
      { gen: "부회장님", name: "까스댄스댄스" },
      { gen: "3등", name: "바구." },
      { gen: "4등", name: "BIONANO_" },
      { gen: "5등", name: "벤카쉐" },
      { gen: "6등", name: "#woorinangni" },
      { gen: "7등", name: "놀러온더힐잉" },
      { gen: "8등", name: "zozo20" },
      { gen: "9등", name: "zexke4242" },
      { gen: "10등", name: "막시무스™" },
      { gen: "11등", name: "BBinnss" },
      { gen: "12등", name: "A-landland" },
      { gen: "13등", name: "66.큐브~*" },
      { gen: "14등", name: "00사용안함00" },
      { gen: "15등", name: "[롱]Me낼름" },
      { gen: "16등", name: "A-LANY@@" },
      { gen: "17등", name: "현자타임보성" },
      { gen: "18등", name: "lead-off" },
      { gen: "19등", name: "JS2" },
      { gen: "20등", name: "낭로우로우로" },
    ];

    // 모션 최소화 환경에서는 1대만 고정 표시
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const it = HOF[0];
      line.innerHTML = `
        <span class="hofGen">${it.gen}</span>
        <span class="hofName">${it.name}</span>
        ${it.cnt ? `<span class="hofCnt">(${it.cnt})</span>` : ""}
      `;
      line.style.opacity = "1";
      line.style.transform = "translateY(0)";
      return;
    }

    const FIRST_BLANK_MS = 1000; // 첫 공백
    const PER_ITEM_MS = 4500;    // 한 명 사이클(= CSS --hofDur)
    const GAP_MS = 150;          // 항목 사이 텀
    const END_BLANK_MS = 1000;   // 10대 끝 공백

    line.style.setProperty("--hofDur", `${PER_ITEM_MS}ms`);

    let i = 0;
    let timer = null;

    function setLine(item) {
      const cntHtml = item.cnt ? `<span class="hofCnt">(${item.cnt})</span>` : "";
      line.innerHTML = `
        <span class="hofGen">${item.gen}</span>
        <span class="hofName">${item.name}</span>
        ${cntHtml}
      `;
    }

    function resetToBlank() {
      line.classList.remove("is-anim");
      line.innerHTML = "";
      line.style.opacity = "0";
      line.style.transform = "translateY(120%)";
    }

    function playOnce(item) {
      setLine(item);

      line.classList.remove("is-anim");
      void line.offsetWidth; // reflow -> 애니메이션 리셋
      line.classList.add("is-anim");
    }

    function scheduleNext(delay) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, delay);
    }

    function tick() {
      playOnce(HOF[i]);

      const isLast = i === HOF.length - 1;
      i = (i + 1) % HOF.length;

      const nextDelay = PER_ITEM_MS + GAP_MS + (isLast ? END_BLANK_MS : 0);

      // 다음 시작 예약
      scheduleNext(nextDelay);

      // 사이클이 끝난 직후 공백으로 리셋
      setTimeout(() => {
        resetToBlank();
      }, PER_ITEM_MS);
    }

    // 시작: 공백 -> 1대부터
    resetToBlank();
    scheduleNext(FIRST_BLANK_MS);
  }


  /* =========================
     YXL 시작일 D+ 카운트 (로고 옆)
     - ♥Y X L _ 24.10.01 ~ ing ( d + N일 ) ♥
     - 시작일 포함(=diff+1) 기준
  ========================= */
  function initYxlDday() {
    const el = document.getElementById("yxlDday");
    if (!el) return;

    const START_Y = 2024;
    const START_M = 9;  // 0-indexed (10월)
    const START_D = 1;
    const START_DISPLAY = "24.10.01";

    function calcDays() {
      const now = new Date();
      // 로컬 날짜 기준(자정 고정)
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const start = new Date(START_Y, START_M, START_D);
      const diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
      const dplus = Math.max(0, diff + 1);

      el.textContent = `YXL · ${START_DISPLAY} ~ ing · D+${dplus}`;
    }

    calcDays();
    // 자정 넘김 대비(가볍게 10분마다 갱신)
    setInterval(calcDays, 10 * 60 * 1000);
  }


  /* =========================
     Init
  ========================= */
  initYxlDday();
  initHallOfFame();
  initTabs();
  initSearchInputs();
  loadAll();
  startAutoRefresh();
});
