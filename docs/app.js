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
      integratedHeaders: [],
      integratedAll: [], // cleaned rows (UI columns only)
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

  /* =========================
     Custom Select (드롭다운 UI 통일)
  ========================= */
  const _cselect = new Map();
  let _cselectGlobalWired = false;

  function setupCustomSelect(nativeId) {
    // 이미 세팅되어 있으면 옵션만 다시 빌드
    if (_cselect.has(nativeId)) {
      rebuildCustomSelect(nativeId);
      return;
    }
    const select = document.getElementById(nativeId);
    if (!select) return;
    const wrap = select.closest(".cselect");
    if (!wrap) return;

    const btn = wrap.querySelector(".cselect-btn");
    const label = wrap.querySelector(".cselect-label");
    const menu = wrap.querySelector(".cselect-menu");
    if (!btn || !label || !menu) return;

    const close = () => {
      wrap.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    };
    const open = () => {
      wrap.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
    };
    const toggle = () => (wrap.classList.contains("is-open") ? close() : open());

    const rebuild = () => {
      const opts = Array.from(select.options);
      const cur = select.value;

      const curOpt = opts.find((o) => o.value === cur) || opts[0];
      label.textContent = curOpt ? curOpt.textContent : "선택";

      menu.innerHTML = "";
      opts.forEach((o) => {
        const item = document.createElement("div");
        item.className = "cselect-option";
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", o.value === cur ? "true" : "false");
        item.textContent = o.textContent;
        item.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (select.value !== o.value) {
            select.value = o.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
          rebuild();
          close();
        });
        menu.appendChild(item);
      });
    };

    // 버튼 동작
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // 다른 셀렉트가 열려있으면 닫기
      _cselect.forEach((inst, k) => {
        if (k !== nativeId) inst.close();
      });
      toggle();
    });

    // native select 값이 바뀌면 라벨/메뉴 동기화
    select.addEventListener("change", () => {
      if (wrap.classList.contains("is-open")) close();
      rebuild();
    });

    // 전역: 바깥 클릭/ESC 닫기
    if (!_cselectGlobalWired) {
      _cselectGlobalWired = true;
      document.addEventListener("click", (ev) => {
        _cselect.forEach((inst) => {
          if (inst.wrap && !inst.wrap.contains(ev.target)) inst.close();
        });
      });
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          _cselect.forEach((inst) => inst.close());
        }
      });
    }

    const inst = { wrap, select, btn, menu, label, rebuild, open, close };
    _cselect.set(nativeId, inst);
    rebuild();
  }

  function rebuildCustomSelect(nativeId) {
    const inst = _cselect.get(nativeId);
    if (inst && inst.rebuild) inst.rebuild();
  }


  const toNumber = (v) => {
    if (typeof v === "number") return v;
    const s = (v ?? "").toString().replace(/,/g, "").trim();
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const scoreNumber = (v) => {
    const n = toNumber(v);
    return Number.isFinite(n) ? n : 0;
  };

  const normalizeRoleLabel = (role) => {
    const raw = (role ?? "").toString().trim();
    // 흔한 오타 교정: '웨아터' -> '웨이터'
    if (normalize(raw) === "웨아터") return "웨이터";
    return raw;
  };


  // 시즌통합랭킹: 플레이어/비플레이어 구분
  const INTEGRATED_KEEP = ["순위", "시즌", "직급", "스트리머", "합산기여도"];
  const INTEGRATED_BAN_RANKS = new Set(["대표", "이사", "웨이터", "웨아터", "참가자", "총장대행", "신분"].map(normalize));
  const INTEGRATED_VIEW_KEY = "yxl_integrated_view"; // 'player' | 'bplayer'

  function getIntegratedView() {
    const v = localStorage.getItem(INTEGRATED_VIEW_KEY);
    return v === "bplayer" ? "bplayer" : "player";
  }


  const INTEGRATED_TEAMLEAD_BPLAYER_EXCEPT = new Set(["섭이", "차돈"].map(normalize));

  function integratedIsBPlayer(row) {
    const role = normalize(normalizeRoleLabel(row?.["직급"]));
    const name = normalize(row?.["스트리머"]);
    const teamLeadException = role === "팀장" && INTEGRATED_TEAMLEAD_BPLAYER_EXCEPT.has(name);
    return INTEGRATED_BAN_RANKS.has(role) || teamLeadException;
  }


  function compareBy(key, dir = "asc") {
    return (a, b) => {
      const av = key === "순위" && a?._calcRank != null ? a._calcRank : (a?.[key] ?? "");
      const bv = key === "순위" && b?._calcRank != null ? b._calcRank : (b?.[key] ?? "");
      const aNum = toNumber(av);
      const bNum = toNumber(bv);
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
    const view = getIntegratedView();
    const sumKey = "합산기여도";

    // 1) 플레이어/비플레이어 분리 (팀장은 기본 플레이어, 단 섭이/차돈(팀장)은 비플레이어)
    let base = [...state.main.integratedAll];
    base = base.map((r) => ({ ...r, "직급": normalizeRoleLabel(r["직급"]) }));

    let ranked = base.filter((r) => {
      const isB = integratedIsBPlayer(r);
      return view === "bplayer" ? isB : !isB;
    });

    // 2) 합산기여도 내림차순으로 정렬 후, 순위 재부여
    ranked = ranked
      .map((r) => ({ ...r, _score: scoreNumber(r[sumKey]) }))
      .sort((a, b) => {
        const d = b._score - a._score;
        if (d !== 0) return d;
        return normalize(a["스트리머"]).localeCompare(normalize(b["스트리머"]), "ko");
      });
    ranked.forEach((r, i) => {
      r._calcRank = i + 1;
    });

    let rows = ranked;
if (q) {
      const streamerKey = headers.find((h) => normalize(h) === "스트리머");
      if (streamerKey) rows = rows.filter((r) => normalize(r[streamerKey]).includes(q));
    }

    // sort
    if (state.integratedSort.key) {
      rows.sort(compareBy(state.integratedSort.key, state.integratedSort.dir));
    } else {
      rows.sort((a, b) => (Number(a._calcRank) || 0) - (Number(b._calcRank) || 0));
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
        const rankNum = Number(r._calcRank ?? r["순위"] ?? 0);
        const top = rankNum === 1 ? 1 : rankNum === 2 ? 2 : rankNum === 3 ? 3 : 0;
        const trClass = top ? ` class="top${top}"` : "";
        return `<tr${trClass}>${headers
          .map((h) => {
            const keyNorm = normalize(h);
            const v = r[h];

            // ✅ 순위: 왼쪽정렬 + 1~3등 배지
            if (keyNorm === "순위") {
              const rn = Number(r._calcRank ?? v ?? 0);
              const t = rn === 1 ? 1 : rn === 2 ? 2 : rn === 3 ? 3 : 0;
              const rankHtml = t
                ? `<span class="rank-badge rank-${t}"><span class="medal">${t === 1 ? "🥇" : t === 2 ? "🥈" : "🥉"}</span><span class="rank-num">${rn}</span></span>`
                : `${v ?? ""}`;
              return `<td class="rankcell">${rankHtml}</td>`;
            }

            // 스트리머: 강조(span)
            if (keyNorm === "스트리머") {
              return `<td><span class="soop-name">${v ?? ""}</span></td>`;
            }

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
      .map((n, i) => `<option value="${n}">YXL 시즌${i + 1}</option>`)
      .join("");

    const saved = localStorage.getItem("yxl_season_sheet");
    if (saved && state.main.seasonSheetNames.includes(saved)) sel.value = saved;

    // change handler 1회만 바인딩(자동 리프레시에서 중복 방지)
    if (!sel.dataset.bound) {
      sel.addEventListener("change", () => {
        localStorage.setItem("yxl_season_sheet", sel.value);
        renderSeason();
      });
      sel.dataset.bound = "1";
    }

    // 커스텀 드롭다운 동기화
    setupCustomSelect("seasonSelect");
    rebuildCustomSelect("seasonSelect");
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

    // ✅ 합산기여도 기준 순위 재구성(내림차순)
    const sumKey = headers.find((h) => normalize(h) === "합산기여도") || headers.find((h) => normalize(h) === "누적기여도");
    if (sumKey) {
      const rankedAll = rows
        .map((r) => ({ ...r, _score: scoreNumber(r[sumKey]) }))
        .sort((a, b) => {
          const d = b._score - a._score;
          if (d !== 0) return d;
          // 동일 점수면 이름으로 안정 정렬
          const nk = headers.find((h) => normalize(h) === "스트리머" || normalize(h) === "비제이명" || normalize(h) === "멤버");
          const an = nk ? a[nk] : a["스트리머"];
          const bn = nk ? b[nk] : b["스트리머"];
          return normalize(an).localeCompare(normalize(bn), "ko");
        });
      rankedAll.forEach((r, i) => (r._calcRank = i + 1));
      rows = rankedAll;
    }

    const rankKey = headers.find((h) => normalize(h) === "순위");

    // 표시 순서 보정: 순위 / 직급 / 스트리머 우선 (시즌 2~6 등 컬럼 순서가 뒤섞여도 UI는 통일)
    const roleKey = headers.find((h) => normalize(h) === "직급");
    const nameKeyForOrder = headers.find(
      (h) =>
        normalize(h) === "스트리머" ||
        normalize(h) === "비제이명" ||
        normalize(h) === "멤버"
    );

    let displayHeaders = headers;
    if (rankKey && roleKey && nameKeyForOrder) {
      const rest = headers.filter(
        (h) => h !== rankKey && h !== roleKey && h !== nameKeyForOrder
      );
      displayHeaders = [rankKey, roleKey, nameKeyForOrder, ...rest];
    }

    // filter: streamer column if present
    if (q) {
      const nameKey = headers.find((h) => normalize(h) === "스트리머" || normalize(h) === "비제이명" || normalize(h) === "멤버");
      if (nameKey) rows = rows.filter((r) => normalize(r[nameKey]).includes(q));
    }

    // sort
    if (state.seasonSort.key) {
      rows.sort(compareBy(state.seasonSort.key, state.seasonSort.dir));
    } else if (rows.length && rows[0]?._calcRank != null) {
      rows.sort((a, b) => (Number(a._calcRank) || 0) - (Number(b._calcRank) || 0));
    }

    thead.innerHTML = `
      <tr>
        ${displayHeaders
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
        const rankNum = Number(r._calcRank ?? (rankKey ? r[rankKey] : 0) ?? 0);
        const top = rankNum === 1 ? 1 : rankNum === 2 ? 2 : rankNum === 3 ? 3 : 0;
        const trClass = top ? ` class="top${top}"` : "";

        return `<tr${trClass}>${displayHeaders
          .map((h) => {
            const keyNorm = normalize(h);
            const v = r[h];

            // ✅ 순위: 왼쪽정렬 + 1~3등 배지
            if (rankKey && h === rankKey) {
              const rn = Number(r._calcRank ?? v ?? 0);
              const t = rn === 1 ? 1 : rn === 2 ? 2 : rn === 3 ? 3 : 0;
              const rankHtml = t
                ? `<span class="rank-badge rank-${t}"><span class="medal">${t === 1 ? "🥇" : t === 2 ? "🥈" : "🥉"}</span><span class="rank-num">${rn}</span></span>`
                : `${v ?? ""}`;
              return `<td class="rankcell">${rankHtml}</td>`;
            }

            // 이름 컬럼은 span으로
            if (keyNorm === "스트리머" || keyNorm === "비제이명" || keyNorm === "멤버") {
              return `<td><span class="soop-name">${v ?? ""}</span></td>`;
            }

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

    // Sheet 2: 시즌통합랭킹
    const t2 = sheetToTable(wb, names[1]);
    state.main.integratedHeaders = INTEGRATED_KEEP;
    state.main.integratedAll = t2.rows.map((r) => {
      const o = {};
      INTEGRATED_KEEP.forEach((k) => (o[k] = r[k] ?? ""));
      o["직급"] = normalizeRoleLabel(o["직급"]);
      return o;
    });

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

  function initIntegratedToggle() {
    const wrap = document.getElementById("integratedViewToggle");
    if (!wrap) return;

    const btns = Array.from(wrap.querySelectorAll("button[data-view]"));
    if (!btns.length) return;

    const apply = (view, doRender = true) => {
      localStorage.setItem(INTEGRATED_VIEW_KEY, view);
      btns.forEach((b) => {
        const on = b.dataset.view === view;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (doRender) renderIntegrated();
    };

    // initial state (don't render yet - loadAll will render)
    apply(getIntegratedView(), false);

    wrap.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button[data-view]");
      if (!btn || !wrap.contains(btn)) return;
      e.preventDefault();
      apply(btn.dataset.view);
    });
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

    // ✅ 드롭다운 UI 통일(커스텀 셀렉트)
    setupCustomSelect("bgmSelect");

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
      rebuildCustomSelect("bgmSelect");
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
     YXL 주간 일정 (섹션: 🗓️ YXL 일정)
     - app.js 안에서 일정 데이터만 수정하면 전체 사용자에게 동일하게 반영됩니다.
  ========================= */
  const YXL_SCHEDULE = [
    { date: "2025-12-22", time: "17:00", type: "엑셀", title: "YXL S11 1회차" },
    { date: "2025-12-25", time: "17:00", type: "엑셀", title: "YXL S11 2회차" },
    { date: "2026-01-01", time: "17:00", type: "엑셀", title: "YXL S11 3회차" },
    { date: "2026-01-05", time: "17:00", type: "엑셀", title: "YXL S11 4회차" },
    { date: "2025-12-29", time: "", type: "이벤트", title: "Y그룹 골든어워즈" },
    // 예시) { date: "2025-12-24", time: "21:00", type: "합방", title: "합동 방송" },
    // 예시) { date: "2025-12-26", time: "",      type: "회의", title: "주간 회의" },
  ];

  // 한국 공휴일(표기용)
  // - 고정 공휴일(매년 동일): 01-01, 03-01, 05-05, 06-06, 08-15, 10-03, 10-09, 12-25
  // - 설/추석/부처님오신날/대체/선거일 등은 아래 Set에 연도별로 추가
  const KOREA_SPECIAL_HOLIDAYS = new Set([
    // ===== 2024 =====
    "2024-02-09", "2024-02-10", "2024-02-11", "2024-02-12", // 설날 연휴
    "2024-04-10", // 제22대 국회의원선거
    "2024-05-06", // 어린이날 대체공휴일
    "2024-05-15", // 부처님오신날
    "2024-09-16", "2024-09-17", "2024-09-18", // 추석 연휴

    // ===== 2025 =====
    "2025-01-27", // 임시공휴일(일회성)
    "2025-01-28", "2025-01-29", "2025-01-30", // 설날 연휴
    "2025-03-03", // 삼일절 대체공휴일
    "2025-05-06", // 어린이날/부처님오신날 대체공휴일
    "2025-06-03", // 대통령선거일
    "2025-10-05", "2025-10-06", "2025-10-07", // 추석 연휴
    "2025-10-08", // 추석 대체공휴일

    // ===== 2026 =====
    "2026-02-16", "2026-02-17", "2026-02-18", // 설날 연휴
    "2026-03-02", // 삼일절 대체공휴일
    "2026-05-24", // 부처님오신날
    "2026-05-25", // 부처님오신날 대체공휴일
    "2026-06-03", // 선거일
    "2026-08-17", // 광복절 대체공휴일
    "2026-09-24", "2026-09-25", "2026-09-26", // 추석 연휴
    "2026-10-05", // 개천절 대체공휴일
  ]);

  function isKoreanHoliday(ymd) {
    // 고정 공휴일
    const md = ymd.slice(5); // "MM-DD"
    if (
      md === "01-01" ||
      md === "03-01" ||
      md === "05-05" ||
      md === "06-06" ||
      md === "08-15" ||
      md === "10-03" ||
      md === "10-09" ||
      md === "12-25"
    ) {
      return true;
    }
    return KOREA_SPECIAL_HOLIDAYS.has(ymd);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // KST 기준으로 날짜(00:00)를 잡아 주간이 어긋나지 않게
  function kstDate00() {
    const s = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return new Date(`${s}T00:00:00`);
  }

  function toYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function startOfWeekMon(d) {
    const x = new Date(d);
    const day = x.getDay(); // 0 Sun ... 6 Sat
    const diff = day === 0 ? -6 : 1 - day; // Monday 기준
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function fmtRange(mon) {
    const sun = addDays(mon, 6);
    const a = `${mon.getFullYear()}.${String(mon.getMonth() + 1).padStart(2, "0")}.${String(mon.getDate()).padStart(2, "0")}`;
    const b = `${sun.getFullYear()}.${String(sun.getMonth() + 1).padStart(2, "0")}.${String(sun.getDate()).padStart(2, "0")}`;
    return `${a} ~ ${b}`;
  }

  function initYxlSchedule() {
    const grid = document.getElementById("schGrid");
    const rangeEl = document.getElementById("schRange");
    const detailEl = document.getElementById("schDetail");
    if (!grid || !rangeEl || !detailEl) return;

    const btnPrev = document.getElementById("schPrev");
    const btnNext = document.getElementById("schNext");
    const btnToday = document.getElementById("schToday");

    const DOW = ["월", "화", "수", "목", "금", "토", "일"];
    const today = kstDate00();
    let weekMon = startOfWeekMon(today);
    let activeYMD = toYMD(today);

    const eventsFor = (ymd) =>
      YXL_SCHEDULE
        .filter((e) => e.date === ymd)
        .slice()
        .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    // 색상 블록 분류(타입 기반)
    // - 생일: 빨간 블록
    // - 엑셀일정: 파란 블록
    // - 합방: 보라 블록
    // - 이벤트: 노란 블록
    const BDAY_EMOJI = "🍰"; // (필요시 배지에만 사용)

    const getTypeText = (e) => (e?.type ?? "").toString().trim();

    const eventKind = (e) => {
      const t = getTypeText(e);
      if (!t) return "other";
      if (t === "생일" || t.includes("생일")) return "birthday";
      if (t === "엑셀일정" || t === "엑셀" || t.includes("엑셀")) return "excel";
      if (t.includes("합방")) return "joint";
      if (t.includes("이벤트")) return "event";
      return "other";
    };

    const blockClass = (kind) => {
      switch (kind) {
        case "birthday": return "schBlock--birthday";
        case "excel":    return "schBlock--excel";
        case "joint":    return "schBlock--joint";
        case "event":    return "schBlock--event";
        default:         return "schBlock--etc";
      }
    };

    const isBirthday = (e) => eventKind(e) === "birthday";

    // 엑셀 일정(하이라이트/NEXT 강조용)
    const isExcelEvent = (e) => eventKind(e) === "excel";

    // 달력(주간 카드)에는 아래 4종만 블록으로 노출
    const isPinnedForCalendar = (_e) => true;
// ===== 다음 일정(전체 일정 기준) =====
// - 빈 공간으로 보이던 하이라이트 영역을 "가장 가까운 일정 1건" 안내 바(Bar)로 사용합니다.
// - 길게 늘어지는 리스트는 금지: 기본은 1건만 노출하고, 7일 이내 추가 일정은 +N개로 요약합니다.

function kstNow(){
  // Asia/Seoul 기준 현재 시각(Date)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const get = (t) => parts.find(p => p.type === t)?.value || "00";
  const y = get("year"), mo = get("month"), d = get("day");
  const h = get("hour"), mi = get("minute"), s = get("second");
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`);
}

function parseEventDateKST(e){
  const t = (e.time ?? "").toString().trim();
  const hhmm = t && /^\d{1,2}:\d{2}$/.test(t) ? t : "23:59";
  return new Date(`${e.date}T${hhmm}:00+09:00`);
}

function getUpcomingAll(){
  const now = kstNow();
  return YXL_SCHEDULE
    .slice()
    .filter(e => (e?.date ?? "").toString().trim().length === 10)
    .map(e => ({ ...e, __dt: parseEventDateKST(e) }))
    .filter(e => !Number.isNaN(e.__dt?.getTime?.()) && e.__dt.getTime() >= now.getTime())
    .sort((a,b) => a.__dt.getTime() - b.__dt.getTime());
}

// 가장 가까운 일정 날짜(YYYY-MM-DD) — 주간 카드에서 NEXT 강조용
const nextAny = getUpcomingAll()[0];
const nextYMD = nextAny ? nextAny.date : null;

function renderNextBar(){
  const box = document.getElementById("schHighlight");
  if (!box) return;

  const list = getUpcomingAll();
  if (!list.length){
    box.classList.add("is-empty");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("is-empty");

  const first = list[0];

  // 7일 이내 추가 일정 개수 요약(+N)
  const now = kstNow();
  const until = new Date(now.getTime() + 7 * 86400000);
  const moreN = Math.max(
    0,
    list.filter(e => e.__dt.getTime() < until.getTime()).length - 1
  );

  const dowMap = ["일","월","화","수","목","금","토"];
  const today00 = kstDate00();
  const d0 = new Date(`${first.date}T00:00:00+09:00`);
  const diff = Math.floor((d0.getTime() - today00.getTime()) / 86400000);
  const dtag = diff === 0 ? "D-Day" : (diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`);

  const mm = String(d0.getMonth()+1).padStart(2,"0");
  const dd = String(d0.getDate()).padStart(2,"0");
  const dow = dowMap[d0.getDay()];

  const t = (first.time ?? "").toString().trim();
  const timeText = t ? `${t} · ` : "";

  const kind = eventKind(first);
  const titleText = (first.title ?? "").toString();
  const typeText = getTypeText(first);
  const typeBadge = typeText ? ` · ${typeText}` : "";

  box.innerHTML = `
    <div class="schHighlight__label">다음 일정</div>
    <div class="schHighlight__items">
      <div class="schHlItem schBlock ${blockClass(kind)}" title="${escapeHtml(titleText)}">
        <span class="schHlD">${dtag}</span>
        <span class="schHlText">${escapeHtml(`${mm}.${dd} (${dow}) · ${timeText}${titleText}${typeBadge}`)}</span>
      </div>
      ${moreN ? `<span class="schHlMore">+${moreN}개</span>` : ""}
    </div>
  `;
}

// 타입 칩(라벨) 매핑: 일정 데이터에 type을 적으면 자동 표시됩니다.
    // 권장: "합방", "회의", "이벤트", "공지"
    function typeClass(type) {
      const t = (type ?? "").toString().trim();
      if (!t) return "";
      const k = t.toLowerCase();
      if (k.includes("합") || k.includes("collab")) return "t-joint";
      if (k.includes("회의") || k.includes("meeting")) return "t-meet";
      if (k.includes("이벤트") || k.includes("event")) return "t-event";
      if (k.includes("공지") || k.includes("notice")) return "t-notice";
      return "t-etc";
    }

    function renderDetail(ymd) {
      const ev = eventsFor(ymd);
      const d = new Date(`${ymd}T00:00:00`);
      const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const title = `${ymd.replaceAll("-", ".")} (${DOW[idx]})`;
      // 상세(아래 리스트)는 '달력에 표시되지 않은 일정'이 있거나, 일정이 2개 이상일 때만 노출합니다.
      // - 달력 카드(엑셀일정/생일)와 중복되어 화면이 답답해지는 걸 방지
      if (ev.length === 0 || (ev.length === 1 && isPinnedForCalendar(ev[0]))) {
        detailEl.classList.remove("is-show");
        detailEl.innerHTML = "";
        return;
      }

      detailEl.classList.add("is-show");
      detailEl.innerHTML =
        `<div class="schDetailTitle">${title}</div>` +
        ev
          .map((e) => {
            const kind = eventKind(e);
            const t = getTypeText(e);
            const showTag = kind === "other" && !!t;

            return `
              <div class="schDetailItem schBlock ${blockClass(kind)}">
                <span class="schBlockTime">${escapeHtml(e.time || "—")}</span>
                <span class="schBlockTitle" title="${escapeHtml(e.title || "")}">${escapeHtml(e.title || "")}</span>
                ${showTag ? `<span class="schBlockTag">${escapeHtml(t)}</span>` : ""}
              </div>
            `;
          })
          .join("");
    }

    function renderWeek() {
      rangeEl.textContent = fmtRange(weekMon);
      grid.innerHTML = "";

      for (let i = 0; i < 7; i++) {
        const d = addDays(weekMon, i);
        const ymd = toYMD(d);
        const dayEvents = eventsFor(ymd);
        const evCount = dayEvents.length;
        const hasBirthday = dayEvents.some(isBirthday);
        const shownEvents = dayEvents.filter(isPinnedForCalendar);
        const shownCount = shownEvents.length;
        const moreCount = Math.max(0, evCount - Math.min(shownCount, 2));

        // 토/일(주말) + 한국 공휴일(대체 포함) 강조
        const day = d.getDay(); // 0=일 ... 6=토
        const isWeekend = day === 0 || day === 6;
        const isHoliday = isKoreanHoliday(ymd);

        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");

        // ✅ 그리드 1칸 = (상단 헤더) + (일정 블록 카드)
        const col = document.createElement("div");
        col.className =
          "schCol" +
          (ymd === toYMD(today) ? " is-today" : "") +
          (ymd === activeYMD ? " is-active" : "") +
          (ymd === nextYMD ? " is-next" : "") +
          (isWeekend ? " is-weekend" : "") +
          (isHoliday ? " is-holiday" : "");

        // 일정 블록 카드(클릭 영역) — 안에는 일정만
        const card = document.createElement("div");
        card.className =
          "schDay" +
          (ymd === toYMD(today) ? " is-today" : "") +
          (ymd === activeYMD ? " is-active" : "") +
          (ymd === nextYMD ? " is-next" : "") +
          (isWeekend ? " is-weekend" : "") +
          (isHoliday ? " is-holiday" : "");

        col.innerHTML = `
          <div class="schHead">
            <div class="schHeadLeft">
              <span class="schDate">${mm}.${dd}</span>
              <span class="schDow">${DOW[i]}</span>
            </div>
            <div class="schRight">
              ${hasBirthday ? `<span class="schBdayBadge" aria-label="생일">${BDAY_EMOJI}</span>` : ""}
              ${
                evCount > 0
                  ? `<span class="schCount" aria-label="일정 ${evCount}개">${evCount}</span>`
                  : ""
              }
            </div>
          </div>
        `;

        card.innerHTML = `
          ${
            evCount > 0
              ? (Math.min(shownCount,2) > 0
                  ? `<div class="schPreview">
                  ${shownEvents
                    .slice(0, 2)
                    .map((e) => {
                      const kind = eventKind(e);
                      return `<div class="schBlock ${blockClass(kind)}">
                                <span class="schBlockTime">${escapeHtml(e.time || "—")}</span>
                                <span class="schBlockTitle" title="${escapeHtml(e.title || "")}">${escapeHtml(e.title || "")}</span>
                              </div>`;
                    })
                    .join("")}
                  ${moreCount > 0 ? `<div class="schPvMore">+${moreCount}개 더</div>` : ""}
                </div>`
                  : `<div class="schPreview"><div class="schPvMore">+${evCount}개</div></div>`
                )
              : `<div class="schDots" aria-hidden="true">
                  ${Array.from({ length: Math.min(evCount, 3) })
                    .map(() => `<span class="schDot"></span>`)
                    .join("")}
                </div>`
          }
        `;

        col.addEventListener("click", () => {
          activeYMD = ymd;
          renderWeek();
          renderDetail(activeYMD);
        });

        col.appendChild(card);
        grid.appendChild(col);
      }

      // 상단 '다음 일정' 바 갱신
      renderNextBar();

    }

    btnPrev?.addEventListener("click", () => {
      weekMon = addDays(weekMon, -7);
      activeYMD = toYMD(weekMon);
      renderWeek();
      renderDetail(activeYMD);
    });

    btnNext?.addEventListener("click", () => {
      weekMon = addDays(weekMon, 7);
      activeYMD = toYMD(weekMon);
      renderWeek();
      renderDetail(activeYMD);
    });

    btnToday?.addEventListener("click", () => {
      weekMon = startOfWeekMon(kstDate00());
      activeYMD = toYMD(kstDate00());
      renderWeek();
      renderDetail(activeYMD);
    });

    renderWeek();
    renderDetail(activeYMD);
  }


  /* =========================
     Init
  ========================= */
  initYxlDday();
  initHallOfFame();
  initYxlSchedule();
  initTabs();
  initSearchInputs();
  initIntegratedToggle();
  loadAll();
  startAutoRefresh();
});
