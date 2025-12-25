// Global header normalizer (avoid ReferenceError across merged patches)
function normalizeHeader(s){
  return (s ?? '')
    .toString()
    .replace(/[♥♡]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9a-zA-Z가-힣]/g, '')
    .trim()
    .toLowerCase();
}

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


  // Local alias (uses global normalizeHeader if available)
  const normalizeHeaderSafe = (v) => {
    if (typeof normalizeHeader === "function") return normalizeHeader(v);
    return (v ?? "")
      .toString()
      .replace(/[♥♡]/g, "")
      .replace(/\s+/g, "")
      .replace(/[^0-9a-zA-Z가-힣]/g, "")
      .trim()
      .toLowerCase();
  };

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

    
    const isPortal = nativeId === "bgmSelect";

    // 포탈(가려짐 방지) 메뉴: BGM 셀렉트만 body에 띄움
    let portalEl = null;
    const ensurePortal = () => {
      if (!isPortal) return;
      portalEl = document.getElementById("cselectPortal");
      if (!portalEl) {
        portalEl = document.createElement("div");
        portalEl.id = "cselectPortal";
        portalEl.className = "cselect-portal";
        portalEl.style.display = "none";
        document.body.appendChild(portalEl);
      }
    };

    const closeLocal = () => {
      wrap.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    };
    const openLocal = () => {
      wrap.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
    };

    const onDocDown = (e) => {
      if (!portalEl) return;
      if (portalEl.contains(e.target) || wrap.contains(e.target)) return;
      closePortal();
    };

    const closePortal = () => {
      if (!portalEl) return;
      portalEl.style.display = "none";
      portalEl.innerHTML = "";
      btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("mousedown", onDocDown, true);
      window.removeEventListener("resize", closePortal);
      window.removeEventListener("scroll", closePortal, true);
    };

    const openPortal = () => {
      ensurePortal();
      if (!portalEl) return;

      // 옵션 렌더
      const opts = Array.from(select.options || []);
      portalEl.innerHTML =
        '<div class="cselect-portal-menu">' +
        opts
          .map((o) => {
            const v = escapeHtml(o.value);
            const t = escapeHtml(o.textContent || o.label || o.value || "");
            const sel = select.value === o.value ? " is-selected" : "";
            return `<button type="button" class="cselect-portal-item${sel}" data-value="${v}">${t}</button>`;
          })
          .join("") +
        "</div>";

      // 위치 계산(아래 공간 부족하면 위로)
      const rect = btn.getBoundingClientRect();
      const maxW = Math.min(420, window.innerWidth - 16);
      const width = Math.min(maxW, Math.max(rect.width, 260));
      let left = rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

      // 임시 표시 후 높이 계산
      portalEl.style.display = "block";
      portalEl.style.position = "fixed";
      portalEl.style.left = left + "px";
      portalEl.style.width = width + "px";
      portalEl.style.zIndex = 99999;

      const menuEl = portalEl.querySelector(".cselect-portal-menu");
      const availBelow = window.innerHeight - rect.bottom - 12;
      const availAbove = rect.top - 12;
      const maxH = Math.min(320, Math.max(140, Math.max(availBelow, availAbove) - 8));
      if (menuEl) menuEl.style.maxHeight = maxH + "px";

      // 아래/위 결정
      const shouldDropUp = availBelow < 180 && availAbove > availBelow;
      const top = shouldDropUp ? (rect.top - (portalEl.offsetHeight || 0) - 6) : (rect.bottom + 6);
      portalEl.style.top = Math.max(8, Math.min(top, window.innerHeight - (portalEl.offsetHeight || 0) - 8)) + "px";

      // 클릭 핸들
      portalEl.querySelectorAll(".cselect-portal-item").forEach((b) => {
        b.addEventListener("click", () => {
          const v = b.getAttribute("data-value") ?? "";
          select.value = v;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          closePortal();
        });
      });

      btn.setAttribute("aria-expanded", "true");
      setTimeout(() => document.addEventListener("mousedown", onDocDown, true), 0);
      window.addEventListener("resize", closePortal);
      window.addEventListener("scroll", closePortal, true);
    };

    const close = () => (isPortal ? closePortal() : closeLocal());
    const open = () => (isPortal ? openPortal() : openLocal());
    const toggle = () => {
      if (isPortal) {
        ensurePortal();
        const isOpen = portalEl && portalEl.style.display === "block";
        return isOpen ? closePortal() : openPortal();
      }
      return wrap.classList.contains("is-open") ? closeLocal() : openLocal();
    };

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
  // 헤더/라벨 비교용 정규화: 공백/괄호(날짜)/특수문자 제거 후 소문자
  const normalizeHeader = (s) =>
    (s ?? "")
      .toString()
      .replace(/\(.*?\)/g, "")
      .replace(/[^0-9a-zA-Z가-힣]/g, "")
      .toLowerCase();

  // row 객체에서 별칭(표기 흔들림 포함)으로 값 찾기
  const getAny = (row, aliases) => {
    if (!row) return "";
    // 1) 원본 키 직접 조회
    for (const k of aliases) {
      if (k in row) return row[k];
    }
    // 2) 정규화 키로 조회(캐시)
    if (!row.__nmap) {
      const m = {};
      Object.keys(row).forEach((k) => (m[normalizeHeaderSafe(k)] = row[k]));
      row.__nmap = m;
    }
    for (const k of aliases) {
      const nk = normalizeHeaderSafe(k);
      if (nk && nk in row.__nmap) return row.__nmap[nk];
    }
    return "";
  };

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

  // ✅ 파일 경로가 바뀌어도 자동으로 찾도록(./, ./data/, ./assets/)
  function buildCandidateUrls(fileOrUrl) {
    // 이미 절대 URL이면 그대로 시도
    try {
      const u = new URL(fileOrUrl);
      return [u.toString()];
    } catch (_) {}

    const base = new URL("./", location.href); // 현재 페이지의 디렉터리
    const file = String(fileOrUrl || "").replace(/^\.\//, "");

    const uniq = new Set();
    const push = (p) => { try { uniq.add(new URL(p, base).toString()); } catch (_) {} };

    push(file);
    // 흔한 배치 위치들
    if (!file.startsWith("data/"))   push("data/" + file);
    if (!file.startsWith("assets/")) push("assets/" + file);
    // GitHub Pages에서 docs/ 경로가 꼬일 때 대비(한 단계 위)
    push("../" + file);

    return Array.from(uniq);
  }

  async function fetchArrayBufferAny(candidates) {
    const urls = Array.isArray(candidates) ? candidates : buildCandidateUrls(candidates);
    let lastErr = null;
    for (const u of urls) {
      try {
        const ab = await fetchArrayBuffer(u);
        return { ab, url: u };
      } catch (e) {
        lastErr = e;
        console.warn("[fetch fail]", u, e);
      }
    }
    throw lastErr || new Error("파일을 불러오지 못했습니다.");
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

    /* ✅ 접속 시 항상 '시너지표'가 기본 페이지 */
    ["yxl_active_tab", "yxl_active_dash", "activeDash", "yxl_last_tab"].forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    // URL 해시(#...)로 특정 탭이 지정돼도 무조건 시너지표로 덮어씀
    if (location.hash) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; }
    }

    setActiveTab("dash-synergy");
}

  /* =========================
     Render: Total (Sheet 1)
  ========================= */
  function renderTotal() {
    const table = $("#totalTable");
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    const CURRENT_MEMBERS = new Set([
      "리윤","후잉","하랑짱","쩔밍","김유정","서니","율무","소다","강소지","나래","유나연"
    ].map(normalize));

    const q = normalize($("#totalSearch")?.value);

    const toNum = (v) => {
      const n = Number(String(v ?? "").replaceAll(",", "").trim());
      return Number.isFinite(n) ? n : 0;
    };

    let rows = Array.isArray(state.main.total) ? state.main.total.slice() : [];

    // 이름/값 키 유연 처리(시트 헤더가 조금 달라도 대응)
    const getName = (r) => r["스트리머"] ?? r["비제이명"] ?? r["멤버"] ?? r["이름"] ?? "";
    const getRank = (r, idx) => {
      const v = r["순위"] ?? r["랭킹"] ?? r["Rank"];
      const n = toNum(v);
      return n > 0 ? n : (idx + 1);
    };
    const getTotal = (r) => getAny(r, ["누적기여도","누적 기여도","누적기여도점수","누적 기여도 점수","누적점수","합산기여도","누적"]);
    const getDelta = (r) => getAny(r, ["변동","변동사항","등락","등락폭"]);
    const getTenure = (r) => getAny(r, ["근속일수","근속","D+일수","근속일","근속일자"]);

    // 검색
    if (q) rows = rows.filter((r) => normalize(getName(r)).includes(q));

    // 정렬: 순위 우선(숫자), 없으면 누적기여도 내림차순
    rows.sort((a, b) => {
      const ra = getRank(a, 0);
      const rb = getRank(b, 0);
      if (ra !== rb) return ra - rb;
      return toNum(getTotal(b)) - toNum(getTotal(a));
    });

    const medal = (rank) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "");
    const badge = (rank) =>
      rank <= 3
        ? `<span class="rank-badge rank-${rank}"><span class="medal">${medal(rank)}</span>${rank}</span>`
        : escapeHtml(String(rank));

    const fmtNum = (v) => {
      const n = toNum(v);
      return n ? n.toLocaleString("en-US") : (String(v ?? "").trim() || "-");
    };

    tbody.innerHTML = rows
      .map((r, idx) => {
        const rank = getRank(r, idx);
        const name = String(getName(r) ?? "").trim();
        const total = getTotal(r);
        const delta = String(getDelta(r) ?? "").trim() || "-";
        const tenure = String(getTenure(r) ?? "").trim() || "-";

        const isTop = rank <= 3;
        const isCurrent = CURRENT_MEMBERS.has(normalize(name));

        const trClass =
          (rank === 1 ? "top1" : rank === 2 ? "top2" : rank === 3 ? "top3" : "");

        return `
          <tr class="${trClass}">
            <td class="td-rank">${isTop ? badge(rank) : escapeHtml(String(rank))}</td>
            <td class="${isCurrent ? "is-current-member" : ""}">${escapeHtml(name)}</td>
            <td class="td-center">${escapeHtml(fmtNum(total))}</td>
            <td class="td-center">${escapeHtml(delta)}</td>
            <td class="td-center">${escapeHtml(tenure)}</td>
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
      const streamerKey = headers.find((h) => normalizeHeaderSafe(h) === "스트리머");
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
        const topRow = (rankNum >= 1 && rankNum <= 5) ? rankNum : 0;
        const top = (rankNum >= 1 && rankNum <= 3) ? rankNum : 0;
        const trClass = topRow ? ` class="top${topRow}"` : "";
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

    // ✅ 시즌별 기여도표: "플레이어"만 노출 (비플레이어는 제외)
    // - 팀장 기본은 플레이어, 단 스트리머가 '섭이','차돈'이면 비플레이어
    // - 직급 오타 '웨아터' -> '웨이터' 정정
    const _srcRoleKey =
      headers.find((h) => normalizeHeaderSafe(h) === "직급" || normalizeHeaderSafe(h) === "직위") || "직급";
    const _srcNameKey =
      headers.find((h) => normalizeHeaderSafe(h) === "스트리머" || normalizeHeaderSafe(h) === "비제이명" || normalizeHeaderSafe(h) === "멤버"
      ) || "스트리머";
    const _srcBeforeKey = headers.find((h) => normalizeHeaderSafe(h) === "직급전") || "직급전";
    const _srcRounds = [1, 2, 3, 4, 5].map((n) => {
      return headers.find((h) => normalizeHeaderSafe(h) === `${n}회차`) || `${n}회차`;
    });
    const _srcSumKey =
      headers.find((h) => normalizeHeaderSafe(h) === "합산기여도") ||
      headers.find((h) => normalizeHeaderSafe(h) === "누적기여도") ||
      "합산기여도";

    // 표 컬럼(고정)
    const SEASON_KEEP = [
      "순위",
      "직급",
      "스트리머",
      "직급전",
      "1회차",
      "2회차",
      "3회차",
      "4회차",
      "5회차",
      "합산기여도",
    ];

    // 원본 -> 표준 키로 정규화
    rows = rows
      .map((r) => {
        const roleVal = normalizeRoleLabel(r?.[_srcRoleKey] ?? r?.["직급"]);
        const nameVal = r?.[_srcNameKey] ?? r?.["스트리머"] ?? "";
        const o = {
          순위: r?.["순위"] ?? r?.["랭킹"] ?? "",
          직급: roleVal ?? "",
          스트리머: nameVal ?? "",
          직급전: r?.[_srcBeforeKey] ?? r?.["직급전"] ?? "",
          "1회차": r?.[_srcRounds[0]] ?? r?.["1회차"] ?? "",
          "2회차": r?.[_srcRounds[1]] ?? r?.["2회차"] ?? "",
          "3회차": r?.[_srcRounds[2]] ?? r?.["3회차"] ?? "",
          "4회차": r?.[_srcRounds[3]] ?? r?.["4회차"] ?? "",
          "5회차": r?.[_srcRounds[4]] ?? r?.["5회차"] ?? "",
          합산기여도: r?.[_srcSumKey] ?? r?.["합산기여도"] ?? r?.["누적기여도"] ?? "",
        };
        return o;
      })
      .filter((r) => !integratedIsBPlayer({ 직급: r.직급, 스트리머: r.스트리머 }));

    // ✅ 합산기여도 기준 순위 재구성(내림차순)
    // ✅ 합산기여도 기준 순위 재구성(내림차순) — 플레이어만 기준
    const sumKey = "합산기여도";
    {
      const rankedAll = rows
        .map((r) => ({ ...r, _score: scoreNumber(r[sumKey]) }))
        .sort((a, b) => {
          const d = b._score - a._score;
          if (d !== 0) return d;
          return normalize(a["스트리머"]).localeCompare(normalize(b["스트리머"]), "ko");
        });
      rankedAll.forEach((r, i) => (r._calcRank = i + 1));
      rows = rankedAll;
    }

    const rankKey = "순위";
    const roleKey = "직급";
    const nameKeyForOrder = "스트리머";
    let displayHeaders = SEASON_KEEP;

    // 헤더 가운데 정렬(요청: 직급전, 1~4회차, 합산기여도)
    const SEASON_CENTER_HEADERS = new Set(["직급전","1회차","2회차","3회차","4회차","합산기여도"]);

    // filter: streamer
    if (q) {
      rows = rows.filter((r) => normalize(r["스트리머"]).includes(q));
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
            const cls = SEASON_CENTER_HEADERS.has(h) ? ' class="th-center"' : '';
            return `<th data-key="${h}"${cls}>${h}${ind}</th>`;
          })
          .join("")}
      </tr>
    `;

    tbody.innerHTML = rows
      .map((r) => {
        const rankNum = Number(r._calcRank ?? (rankKey ? r[rankKey] : 0) ?? 0);
        const topRow = (rankNum >= 1 && rankNum <= 5) ? rankNum : 0;
        const top = (rankNum >= 1 && rankNum <= 3) ? rankNum : 0;
        const trClass = topRow ? ` class="top${topRow}"` : "";

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

    // (디버그) 현재 로드된 통합 엑셀 파일 정보
    if (state.main.fileInfo?.hash8) {
      meta.textContent += ` / 통합파일 해시: ${state.main.fileInfo.hash8}`;
    }

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
        const topRow = (rankNum >= 1 && rankNum <= 5) ? rankNum : 0;
        const top = (rankNum >= 1 && rankNum <= 3) ? rankNum : 0;
        const trClass = topRow ? ` class="top${topRow}"` : "";
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
    const { ab, url } = await fetchArrayBufferAny(buildCandidateUrls(FILE_MAIN));

    // 🔎 어떤 파일을 실제로 불러왔는지 확인용(해시 8자리)
    try {
      const digest = await crypto.subtle.digest("SHA-256", ab);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      state.main.fileInfo = { url, hash8: hex.slice(0, 8) };
    } catch (_) {
      state.main.fileInfo = { url, hash8: "" };
    }

    const wb = XLSX.read(ab, { type: "array" });
    const names = wb.SheetNames || [];

    // ✅ 시트 이름으로 찾기(순서 의존 제거)
    const pickSheet = (cands) => {
      const normNames = names.map((n) => normalizeHeaderSafe(n));
      for (const c of cands) {
        const nc = normalizeHeaderSafe(c);
        const idx = normNames.findIndex((x) => x === nc);
        if (idx >= 0) return names[idx];
      }
      // 부분일치도 허용
      for (const c of cands) {
        const nc = normalizeHeaderSafe(c);
        const idx = normNames.findIndex((x) => x.includes(nc));
        if (idx >= 0) return names[idx];
      }
      return "";
    };

    const totalSheet = pickSheet(["누적기여도", "누적 기여도"]);
    const integratedSheet = pickSheet([
      "시즌통합랭킹",
      "시즌 통합 랭킹",
      "통합랭킹",
      "S1~S10 YXL_기여도",
      "S1S10YXL기여도",
      "S1~S10기여도",
      "S1S10기여도",
    ]);

    // 누적기여도
    state.main.total = totalSheet ? sheetToTable(wb, totalSheet).rows : [];
    // 시즌통합랭킹
    const integrated = integratedSheet ? sheetToTable(wb, integratedSheet) : { headers: [], rows: [] };
    state.main.integratedHeaders = integrated.headers || [];
    state.main.integratedRows = integrated.rows || [];

    // 시즌별 시트: "시즌숫자"가 들어간 시트들 자동 탐색(누적/통합 제외)
    const seasonNames = names.filter((n) => {
      const nn = normalizeHeaderSafe(n);
      if (!nn) return false;
      if (totalSheet && n === totalSheet) return false;
      if (integratedSheet && n === integratedSheet) return false;
      return /시즌\d+/.test(nn); // 예: yxl시즌1, 시즌2 등
    });

    state.main.seasonSheetNames = seasonNames;
    state.main.seasons.clear();
    seasonNames.forEach((sn) => {
      state.main.seasons.set(sn, sheetToTable(wb, sn));
    });
  }


  async function loadSynergyExcel() {
    const { ab } = await fetchArrayBufferAny(buildCandidateUrls(FILE_SYNERGY));
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
    // ✅ 지원: (1) segmented 버튼 방식(#integratedViewToggle) (2) select 방식(#integratedViewSelect, 커스텀 드롭다운 포함)
    const wrap = document.getElementById("integratedViewToggle");
    const sel = document.getElementById("integratedViewSelect");

    const btns = wrap ? Array.from(wrap.querySelectorAll("button[data-view]")) : [];

    const apply = (view, doRender = true) => {
      const v = view === "bplayer" ? "bplayer" : "player";
      localStorage.setItem(INTEGRATED_VIEW_KEY, v);

      // 버튼 UI 동기화
      if (btns.length) {
        btns.forEach((b) => {
          const on = b.dataset.view === v;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
      }

      // 셀렉트 UI 동기화
      if (sel) {
        sel.value = v;
        // 커스텀 셀렉트 라벨 동기화(있다면)
        if (_cselect.has("integratedViewSelect")) rebuildCustomSelect("integratedViewSelect");
      }

      if (doRender) renderIntegrated();
    };

    // 초기값 반영(렌더는 loadAll()에서)
    apply(getIntegratedView(), false);

    // (A) segmented 버튼 클릭
    if (wrap && btns.length) {
      wrap.addEventListener("click", (e) => {
        const btn = e.target?.closest?.("button[data-view]");
        if (!btn || !wrap.contains(btn)) return;
        e.preventDefault();
        apply(btn.dataset.view);
      });
    }

    // (B) select 변경
    if (sel) {
      // 중복 바인딩 방지
      if (!sel.dataset.bound) {
        sel.dataset.bound = "1";
        sel.addEventListener("change", () => {
          apply(sel.value);
        });
      }
      // 커스텀 드롭다운(있으면) 세팅
      setupCustomSelect("integratedViewSelect");
    }
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
    /* =========================
       🌗 Theme Toggle (Light/Dark)
    ========================= */
    const themeBtn = document.getElementById("themeToggle");
    const THEME_KEY = "yxl_theme";
    function applyTheme(mode){
      const isLight = mode === "light";
      document.body.classList.toggle("theme-light", isLight);
      document.documentElement.classList.toggle("theme-light", isLight);
      if (themeBtn){
        const icon = themeBtn.querySelector(".theme-icon");
        if (icon) icon.textContent = isLight ? "☀️" : "🌙";
        themeBtn.setAttribute("aria-label", isLight ? "어둡게 전환" : "밝게 전환");
        themeBtn.setAttribute("title", isLight ? "어둡게" : "밝게");
      }
    }
    // 초기 적용
    // 서버 접속 시 기본은 항상 라이트모드
    localStorage.setItem(THEME_KEY, "light");
    applyTheme("light");
    // 클릭 토글
    if (themeBtn){
      themeBtn.addEventListener("click", () => {
        const next = document.body.classList.contains("theme-light") ? "dark" : "light";
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
      });
    }


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
      btnPlay.textContent = on ? "⏸︎" : "▶︎";
      btnPlay.setAttribute("aria-label", on ? "일시정지" : "재생");
      btnPlay.setAttribute("title", on ? "일시정지" : "재생");
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

    // ✅ BGM 선택 변경 시 저장 + (재생 중이면) 즉시 트랙 전환
    if (sel && !sel.dataset.bound){
      sel.addEventListener("change", async () => {
        const k = sel.value;
        setSelectedKey(k);
        const isOn = localStorage.getItem(KEY_ON) === "1";
        const entered = gate ? gate.classList.contains("is-hidden") : true;
        if (isOn && entered){
          await playSelected({ reset: true });
          setPlayUI(true);
        }
      });
      sel.dataset.bound = "1";
    }


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
      setSelectedKey(sel.value);
      if (gateVisible()) return; // 게이트 중엔 저장/표시만, 재생은 X
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
      { gen: "1대부장", name: "류시아", cnt: "4,698,914개" },
      { gen: "2대부장", name: "류시아", cnt: "3,070,017개" },
      { gen: "3대부장", name: "류시아", cnt: "3,687,480개" },
      { gen: "4대부장", name: "유누", cnt: "2,750,614개" },
      { gen: "5대부장", name: "유누", cnt: "2,800,254개" },
      { gen: "6대부장", name: "유누", cnt: "2,358,342개" },
      { gen: "7대부장", name: "루루", cnt: "2,898,789개" },
      { gen: "8대부장", name: "은우", cnt: "3,102,272개" },
      { gen: "9대부장", name: "은우", cnt: "3,611,788개" },
      { gen: "10대부장", name: "지유", cnt: "4,001,954개" }
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

  // ✅ 특별 랭크(회장/부회장/Top5) 강조 클래스
  const isPresident = item.gen === "회장님";
  const isVice = item.gen === "부회장님";
  const isTop5 = item.gen === "3등" || item.gen === "4등" || item.gen === "5등";
  const isSpecial = isPresident || isVice || isTop5;

  line.classList.toggle("is-president", isPresident);
  line.classList.toggle("is-vice", isVice);
  line.classList.toggle("is-top5", isTop5);
  line.classList.toggle("is-special", isSpecial);
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

      const txt = `YXL · ${START_DISPLAY} ~ ing · D+${dplus}`;
      el.textContent = txt;
      el.dataset.text = txt;
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
    const highlightEl = document.getElementById("schHighlight");
    if (!grid || !rangeEl) return;

    const btnPrev = document.getElementById("schPrev");
    const btnNext = document.getElementById("schNext");
    const btnToday = document.getElementById("schToday");

    const modal = document.getElementById("schModal");
    const modalTitle = document.getElementById("schModalTitle");
    const modalBody = document.getElementById("schModalBody");

    const today = kstDate00();
    let cursor = new Date(today.getFullYear(), today.getMonth(), 1);

    const eventsFor = (ymd) =>
      YXL_SCHEDULE
        .filter((e) => e?.date === ymd)
        .slice()
        .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

    const getTypeText = (e) => (e?.type ?? "").toString().trim();

    const eventKind = (e) => {
      const t = getTypeText(e);
      if (!t) return "other";
      if (t.includes("생일")) return "birthday";
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

    function fmtYM(d) {
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    function startGridOfMonth(d) {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const start = new Date(first);
      // Sunday(0) 시작
      start.setDate(first.getDate() - first.getDay());
      start.setHours(0, 0, 0, 0);
      return start;
    }

    function openModal(ymd) {
      if (!modal || !modalTitle || !modalBody) return;

      const d = new Date(`${ymd}T00:00:00+09:00`);
      const DOW = ["일","월","화","수","목","금","토"];
      modalTitle.textContent = `${ymd.replaceAll("-", ".")} (${DOW[d.getDay()]})`;

      const ev = eventsFor(ymd);
      if (!ev.length) {
        modalBody.innerHTML = `<div class="schModalEmpty">일정이 없습니다.</div>`;
      } else {
        modalBody.innerHTML = ev
          .map((e) => {
            const kind = eventKind(e);
            const t = getTypeText(e);
            const time = (e.time ?? "").toString().trim() || "—";
            const title = (e.title ?? "").toString().trim();
            const tag = t ? `<span class="schBlockTag">${escapeHtml(t)}</span>` : "";
            return `
              <div class="schDetailItem schBlock ${blockClass(kind)}">
                <span class="schBlockTime">${escapeHtml(time)}</span>
                <span class="schBlockTitle" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
                ${tag}
              </div>
            `;
          })
          .join("");
      }

      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    }

    function closeModal() {
      if (!modal) return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    // modal close handlers
    if (modal && !modal.dataset.bound) {
      modal.dataset.bound = "1";
      modal.addEventListener("click", (e) => {
        const t = e.target;
        if (t?.dataset?.close === "1") closeModal();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
      });
    }

    function renderNextBar() {
      if (!highlightEl) return;
      // 가장 가까운 일정 1건 + 7일 이내 추가 일정은 +N개로 요약
      const now = new Date(`${toYMD(kstDate00())}T00:00:00+09:00`);
      const list = YXL_SCHEDULE
        .slice()
        .filter((e) => (e?.date ?? "").toString().trim().length === 10)
        .map((e) => {
          const t = (e.time ?? "").toString().trim();
          const hhmm = t && /^\d{1,2}:\d{2}$/.test(t) ? t : "23:59";
          const dt = new Date(`${e.date}T${hhmm}:00+09:00`);
          return { ...e, __dt: dt };
        })
        .filter((e) => !Number.isNaN(e.__dt?.getTime?.()) && e.__dt.getTime() >= now.getTime())
        .sort((a, b) => a.__dt.getTime() - b.__dt.getTime());

      if (!list.length) {
        highlightEl.classList.add("is-empty");
        highlightEl.innerHTML = "";
        return;
      }

      highlightEl.classList.remove("is-empty");

      const first = list[0];
      const today00 = kstDate00();
      const d0 = new Date(`${first.date}T00:00:00+09:00`);
      const diff = Math.floor((d0.getTime() - today00.getTime()) / 86400000);
      const dtag = diff === 0 ? "D-Day" : (diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`);

      const until = new Date(today00.getTime() + 7 * 86400000);
      const moreN = Math.max(0, list.filter((e) => e.__dt.getTime() < until.getTime()).length - 1);

      const mm = String(d0.getMonth() + 1).padStart(2, "0");
      const dd = String(d0.getDate()).padStart(2, "0");
      const dowMap = ["일","월","화","수","목","금","토"];
      const dow = dowMap[d0.getDay()];

      const t = (first.time ?? "").toString().trim();
      const timeText = t ? `${t} · ` : "";
      const kind = eventKind(first);
      const titleText = (first.title ?? "").toString();
      const typeText = getTypeText(first);
      const typeBadge = typeText ? ` · ${typeText}` : "";

      highlightEl.innerHTML = `
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

    function renderMonth() {
      rangeEl.textContent = fmtYM(cursor);
      grid.innerHTML = "";

      const start = startGridOfMonth(cursor);

      for (let i = 0; i < 42; i++) {
        const d = addDays(start, i);
        const ymd = toYMD(d);

        const inMonth = d.getMonth() === cursor.getMonth();
        const ev = eventsFor(ymd);
        const count = ev.length;

        const day = d.getDay(); // 0=일 ... 6=토
        const isWeekend = day === 0 || day === 6;
        const isHoliday = isKoreanHoliday(ymd);
        const isToday = ymd === toYMD(today);

        const cell = document.createElement("div");
        cell.className =
          "schMCell schDay" +
          (isToday ? " is-today" : "") +
          (!inMonth ? " is-out" : "") +
          (isWeekend ? " is-weekend" : "") +
          (isHoliday ? " is-holiday" : "");

        const label = inMonth ? String(d.getDate()) : `${String(d.getMonth() + 1)}.${String(d.getDate())}`;

        const preview = count
          ? `<div class="schPreview">
              ${ev
                .slice(0, 2)
                .map((e) => {
                  const kind = eventKind(e);
                  return `<div class="schBlock ${blockClass(kind)}">
                            <span class="schBlockTime">${escapeHtml((e.time || "—").toString())}</span>
                            <span class="schBlockTitle" title="${escapeHtml(e.title || "")}">${escapeHtml(e.title || "")}</span>
                          </div>`;
                })
                .join("")}
              ${count > 2 ? `<button class="schPvMoreBtn" type="button" data-ymd="${ymd}">+${count - 2}개 더</button>` : ""}
            </div>`
          : `<div class="schEmpty"></div>`;

        cell.innerHTML = `
          <div class="schMTop">
            <div class="schMDate">${escapeHtml(label)}</div>
            ${count ? `<div class="schCount" aria-label="일정 ${count}개">${count}</div>` : `<div class="schCount schCount--ghost" aria-hidden="true"></div>`}
          </div>
          ${preview}
        `;

        // 클릭: 일정이 있을 때만 모달
        if (count > 0) {
          cell.addEventListener("click", (e) => {
            const btn = e.target?.closest?.(".schPvMoreBtn");
            if (btn) {
              e.preventDefault();
              e.stopPropagation();
              openModal(btn.dataset.ymd);
              return;
            }
            openModal(ymd);
          });
        }

        grid.appendChild(cell);
      }

      renderNextBar();
    }

    btnPrev?.addEventListener("click", () => {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
      renderMonth();
    });
    btnNext?.addEventListener("click", () => {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      renderMonth();
    });
    btnToday?.addEventListener("click", () => {
      cursor = new Date(today.getFullYear(), today.getMonth(), 1);
      renderMonth();
    });

    renderMonth();
  }


  /* =========================
     Init
  ========================= */
  const __safe = (fn) => {
    try { return fn && fn(); } catch (e) { console.error(e); }
  };

  __safe(initYxlDday);
  __safe(initHallOfFame);
  __safe(initYxlSchedule);
  __safe(initTabs);
  __safe(initSearchInputs);
  __safe(initIntegratedToggle);
  // ✅ 로고(헤더) 클릭 시 새로고침
  const logoRefresh = document.getElementById("logoRefresh");
  logoRefresh?.addEventListener("click", (e) => {
    e.preventDefault();
    // 캐시 문제 있으면 아래 2줄로 바꿔도 됨:
    // const url = location.pathname + location.search;
    // location.replace(url);
    location.reload();
  });

  loadAll();
  startAutoRefresh();
});
