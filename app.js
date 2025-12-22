document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     기본 DOM 유틸
  ========================================================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const safeText = (v) => (v == null ? "" : String(v));
  const toNum = (v) => {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const s = String(v).replace(/[,\s]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const fmtNum = (n) => (toNum(n)).toLocaleString("ko-KR");

  const normalizeNick = (s) =>
    safeText(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");

  const readJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const writeJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  /* =========================================================
     파일 경로 (루트 우선, 없으면 data/)
  ========================================================= */
  const FILES = {
    yxl: ["YXL_통합.xlsx", "data/YXL_통합.xlsx"],
    synergy: ["시너지표.xlsx", "data/시너지표.xlsx"],
  };

  async function fetchArrayBufferFirst(paths) {
    const v = Date.now();
    for (const p of paths) {
      try {
        const res = await fetch(`${p}?v=${v}`, { cache: "no-store" });
        if (!res.ok) continue;
        return await res.arrayBuffer();
      } catch {
        // try next
      }
    }
    throw new Error("파일을 불러오지 못했습니다: " + paths.join(", "));
  }

  async function loadWorkbook(paths) {
    const buf = await fetchArrayBufferFirst(paths);
    // eslint-disable-next-line no-undef
    return XLSX.read(buf, { type: "array" });
  }

  function sheetToObjects(wb, sheetName) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    // eslint-disable-next-line no-undef
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    return Array.isArray(rows) ? rows : [];
  }

  /* =========================================================
     변동사항(순위 변화) 계산
  ========================================================= */
  function applyRankDelta(rows, { storageKey }) {
    const prev = readJSON(storageKey, {});
    const next = {};
    rows.forEach((r) => {
      const key = normalizeNick(r.streamer);
      const curRank = toNum(r.rank) || null;
      const prevRank = toNum(prev[key]) || null;
      next[key] = curRank || 0;

      if (!prevRank || !curRank) {
        r.delta = { type: "new", text: "—" };
        return;
      }
      const diff = prevRank - curRank; // +면 상승(순위 숫자 감소)
      if (diff > 0) r.delta = { type: "up", text: `▲${diff}` };
      else if (diff < 0) r.delta = { type: "down", text: `▼${Math.abs(diff)}` };
      else r.delta = { type: "same", text: "—" };
    });
    writeJSON(storageKey, next);
  }

  function renderDeltaCell(delta) {
    if (!delta) return `<span class="delta new">—</span>`;
    const cls = delta.type || "new";
    return `<span class="delta ${cls}">${safeText(delta.text || "—")}</span>`;
  }

  /* =========================================================
     탭 전환
  ========================================================= */
  const TAB_KEY = "yxl_active_tab_v1";

  function activatePanel(id) {
    const tabs = $$(".dash-tab");
    const panels = $$(".dash-panel");

    tabs.forEach((t) => {
      const on = t.dataset.target === id;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((p) => {
      const on = p.id === id;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });

    try { localStorage.setItem(TAB_KEY, id); } catch {}
  }

  $$(".dash-tab").forEach((btn) => {
    btn.addEventListener("click", () => activatePanel(btn.dataset.target));
  });

  // 초기 탭
  const savedTab = (() => {
    try { return localStorage.getItem(TAB_KEY); } catch { return null; }
  })();
  if (savedTab && document.getElementById(savedTab)) activatePanel(savedTab);
  else activatePanel("dash-synergy");

  /* =========================================================
     Gate + BGM (입장 버튼이 항상 먹도록 보강)
  ========================================================= */
  (function gateAndBgm() {
    const KEY = "yxl_bgm_on_v2";
    const gate = $("#gate");
    const gateBtn = $("#gateBtn");
    const gateMsg = $("#gateMsg");
    const particleLayer = $("#gateParticles");
    const audio = $("#bgm");
    const headerToggle = $("#bgmToggle");

    if (!gate || !gateBtn || !audio || !particleLayer) return;

    audio.volume = 0.25;

    function setHeaderUI(isOn) {
      if (!headerToggle) return;
      headerToggle.classList.toggle("is-on", isOn);
      headerToggle.textContent = isOn ? "BGM 정지" : "BGM 재생";
      headerToggle.setAttribute("aria-pressed", isOn ? "true" : "false");
    }

    function showGate() {
      gate.classList.remove("is-hidden");
      gate.setAttribute("aria-hidden", "false");
    }

    function hideGate() {
      gate.classList.add("is-hidden");
      gate.setAttribute("aria-hidden", "true");
    }

    async function tryPlay(userInitiated) {
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

    // 파티클(가벼운 연출)
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
      for (let i = 0; i < 18; i++) makeSpark(x, y);
    }

    const enter = async (e) => {
      if (gateMsg) gateMsg.textContent = "";
      if (e && e.clientX != null) burstAtClientPoint(e.clientX, e.clientY);
      hideGate(); // ✅ 무조건 숨김(입장 실패 방지)
      await tryPlay(true);
    };

    gateBtn.addEventListener("click", enter);
    gateBtn.addEventListener("touchstart", (e) => enter(e.touches?.[0] || e), { passive: true });

    // 헤더 토글
    headerToggle?.addEventListener("click", async () => {
      if (audio.paused) await tryPlay(true);
      else stop();
    });

    // 다음 방문: 저장값이 1이면 gate 없이 자동시도
    const savedOn = localStorage.getItem(KEY) === "1";
    if (savedOn) {
      hideGate();
      tryPlay(false);
    } else {
      showGate();
      setHeaderUI(false);
    }
  })();

  /* =========================================================
     SOOP LIVE (bjSearch / liveSearch)
     - CORS가 막히면 자동으로 OFF 처리됩니다.
  ========================================================= */
  const SOOP_SEARCH_API = "https://sch.sooplive.co.kr/api.php";

  // 사용자 제공 BJID 매핑(우선 적용)
  const BJID_MAP = {
    "리윤_♥": "sladk51",
    "후잉♥": "jaeha010",
    "하랑짱♥": "asy1218",
    "쩔밍♡": "wnsdus5900",
    "김유정S2": "tkek55",
    "서니_♥": "iluvpp",
    "#율무": "offside629",
    "소다♥": "zbxlzzz",
    "강소지♥": "nowsoji",
  };

  function readBjidCache() {
    return readJSON("soop_bjid_cache_v1", {});
  }
  function writeBjidCache(cache) {
    writeJSON("soop_bjid_cache_v1", cache);
  }

  async function soopFindBjidByNick(nick) {
    const clean = safeText(nick).trim();
    const key = normalizeNick(clean);
    if (!key) return null;

    const cache = readBjidCache();
    const hit = cache[key];
    const now = Date.now();
    if (hit && hit.user_id && now - hit.ts < 7 * 24 * 60 * 60 * 1000) return hit;

    const url = new URL(SOOP_SEARCH_API);
    url.searchParams.set("m", "bjSearch");
    url.searchParams.set("t", "json");
    url.searchParams.set("keyword", clean);
    url.searchParams.set("nPageNo", "1");
    url.searchParams.set("nListCnt", "10");
    url.searchParams.set("szOrder", "score");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    const data = j && (j.DATA || j.data);
    if (!Array.isArray(data) || !data.length) return null;

    const nKey = normalizeNick(clean);
    let best = data[0];
    let bestScore = -1;

    for (const it of data) {
      const candNick = it.user_nick || it.station_name || "";
      const cKey = normalizeNick(candNick);
      let score = 0;
      if (cKey === nKey) score += 100;
      if (cKey.includes(nKey) || nKey.includes(cKey)) score += 25;
      score += Math.max(0, 20 - Math.abs(cKey.length - nKey.length));
      if (score > bestScore) {
        bestScore = score;
        best = it;
      }
    }

    const out = best && best.user_id ? { user_id: best.user_id, user_nick: best.user_nick, ts: now } : null;
    if (out) {
      cache[key] = out;
      writeBjidCache(cache);
    }
    return out;
  }

  async function soopGetLiveInfoByBjid(bjid) {
    if (!bjid) return { isLive: false, broadNo: "", thumb: "", title: "" };

    const url = new URL(SOOP_SEARCH_API);
    url.searchParams.set("m", "liveSearch");
    url.searchParams.set("t", "json");
    url.searchParams.set("keyword", bjid);
    url.searchParams.set("nPageNo", "1");
    url.searchParams.set("nListCnt", "20");
    url.searchParams.set("szOrder", "broad_start");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return { isLive: false, broadNo: "", thumb: "", title: "" };
    const j = await res.json().catch(() => null);
    const list = j && (j.REAL_BROAD || j.real_broad || []);
    if (!Array.isArray(list) || !list.length) return { isLive: false, broadNo: "", thumb: "", title: "" };

    const row = list.find((x) => (x.user_id || "").toLowerCase() === bjid.toLowerCase()) || list[0];
    const broadNo = safeText(row.broad_no || "").trim();
    const thumb = safeText(row.broad_img || row.sn_url || "").trim();
    const title = safeText(row.broad_title || "").trim();
    return { isLive: !!broadNo, broadNo, thumb, title };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* =========================================================
     렌더: 누적 / 통합 / 시즌 / 시너지
  ========================================================= */
  function renderTotal(rows) {
    const tbody = $("#totalTable tbody");
    if (!tbody) return;

    const q = normalizeNick($("#totalSearch")?.value);
    const filtered = q ? rows.filter((r) => normalizeNick(r.streamer).includes(q)) : rows;

    tbody.innerHTML = filtered
      .slice()
      .sort((a, b) => (a.rank || 9999) - (b.rank || 9999))
      .map((r) => {
        const medal =
          r.rank === 1 ? `<span class="medal gold">1</span>` :
          r.rank === 2 ? `<span class="medal silver">2</span>` :
          r.rank === 3 ? `<span class="medal bronze">3</span>` :
          `<span class="rank">${r.rank}</span>`;

        return `
          <tr>
            <td class="rank-cell">${medal}</td>
            <td>${safeText(r.streamer)}</td>
            <td style="text-align:right;">${fmtNum(r.total)}</td>
            <td style="text-align:right;">${renderDeltaCell(r.delta)}</td>
          </tr>
        `;
      })
      .join("");

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
    }
  }

  const integratedState = { key: "rank", dir: "asc" };
  function renderIntegrated(rows) {
    const tbody = $("#integratedTable tbody");
    if (!tbody) return;

    const q = normalizeNick($("#integratedSearch")?.value);
    const filtered = q ? rows.filter((r) => normalizeNick(r.streamer).includes(q)) : rows;

    const sorted = filtered.slice().sort((a, b) => {
      const k = integratedState.key;
      const dir = integratedState.dir === "asc" ? 1 : -1;

      const av = a[k];
      const bv = b[k];
      const an = typeof av === "number" ? av : toNum(av);
      const bn = typeof bv === "number" ? bv : toNum(bv);

      if (Number.isFinite(an) && Number.isFinite(bn) && (an !== bn)) return (an - bn) * dir;
      return safeText(av).localeCompare(safeText(bv), "ko") * dir;
    });

    tbody.innerHTML = sorted
      .map((r) => `
        <tr>
          <td>${safeText(r.season)}</td>
          <td>${toNum(r.rank) || ""}</td>
          <td>${safeText(r.grade)}</td>
          <td>${safeText(r.streamer)}</td>
          <td style="text-align:right;">${fmtNum(r.total)}</td>
        </tr>
      `)
      .join("");

    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
    }
  }

  const seasonState = { key: "rank", dir: "asc" };
  function renderSeason(rows) {
    const tbody = $("#seasonTable tbody");
    if (!tbody) return;

    const q = normalizeNick($("#seasonSearch")?.value);
    const filtered = q ? rows.filter((r) => normalizeNick(r.streamer).includes(q)) : rows;

    const sorted = filtered.slice().sort((a, b) => {
      const k = seasonState.key;
      const dir = seasonState.dir === "asc" ? 1 : -1;
      const av = a[k];
      const bv = b[k];
      const an = typeof av === "number" ? av : toNum(av);
      const bn = typeof bv === "number" ? bv : toNum(bv);
      if (Number.isFinite(an) && Number.isFinite(bn) && (an !== bn)) return (an - bn) * dir;
      return safeText(av).localeCompare(safeText(bv), "ko") * dir;
    });

    tbody.innerHTML = sorted
      .map((r) => `
        <tr>
          <td>${toNum(r.rank) || ""}</td>
          <td>${safeText(r.grade)}</td>
          <td>${safeText(r.streamer)}</td>
          <td style="text-align:right;">${fmtNum(r.total)}</td>
        </tr>
      `)
      .join("");

    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
    }
  }

  const synergyState = {
    key: "rank",
    dir: "asc",
    rows: [],
    liveMap: {}, // normalizeNick -> {bjid,isLive,broadNo,thumb,title}
  };

  function renderSynergy(rows) {
    const tbody = $("#synergyTable tbody");
    if (!tbody) return;

    const q = normalizeNick($("#synergySearch")?.value);
    const filtered = q ? rows.filter((r) => normalizeNick(r.streamer).includes(q)) : rows;

    const sorted = filtered.slice().sort((a, b) => {
      const k = synergyState.key;
      const dir = synergyState.dir === "asc" ? 1 : -1;

      if (k === "delta") {
        const as = a.delta?.text || "";
        const bs = b.delta?.text || "";
        return as.localeCompare(bs, "ko") * dir;
      }

      const av = a[k];
      const bv = b[k];
      const an = typeof av === "number" ? av : toNum(av);
      const bn = typeof bv === "number" ? bv : toNum(bv);

      if (Number.isFinite(an) && Number.isFinite(bn) && (an !== bn)) return (an - bn) * dir;
      return safeText(av).localeCompare(safeText(bv), "ko") * dir;
    });

    tbody.innerHTML = sorted
      .map((r) => {
        const key = normalizeNick(r.streamer);
        const live = synergyState.liveMap[key] || {};
        const isLive = !!live.isLive;
        const dot = isLive ? `<span class="live-dot" aria-hidden="true"></span>` : "";
        const dataBjid = safeText(live.bjid || r.bjid || "");
        const dataBroad = safeText(live.broadNo || "");
        const dataThumb = safeText(live.thumb || "");
        const dataTitle = safeText(live.title || "");

        return `
          <tr>
            <td>${toNum(r.rank) || ""}</td>
            <td>
              <div class="bj-cell">
                ${dot}
                <span class="bj-name"
                  data-nick="${safeText(r.streamer).replace(/"/g, "&quot;")}"
                  data-bjid="${dataBjid.replace(/"/g, "&quot;")}"
                  data-live="${isLive ? "1" : "0"}"
                  data-broadno="${dataBroad.replace(/"/g, "&quot;")}"
                  data-thumb="${dataThumb.replace(/"/g, "&quot;")}"
                  data-title="${dataTitle.replace(/"/g, "&quot;")}"
                >${safeText(r.streamer)}</span>
              </div>
            </td>
            <td style="text-align:right;">${fmtNum(r.balloons)}</td>
            <td style="text-align:right;">${renderDeltaCell(r.delta)}</td>
          </tr>
        `;
      })
      .join("");

    if (!sorted.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:rgba(255,255,255,.55); padding:16px;">검색 결과가 없습니다.</td></tr>`;
    }
  }

  // 헤더 클릭 정렬
  function bindSortable(tableSel, stateObj) {
    const table = $(tableSel);
    if (!table) return;
    $$("thead th[data-key]", table).forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        if (!key) return;

        if (stateObj.key !== key) {
          stateObj.key = key;
          stateObj.dir = "asc";
        } else {
          stateObj.dir = stateObj.dir === "asc" ? "desc" : "asc";
        }

        // 해당 테이블 다시 렌더
        if (tableSel === "#synergyTable") renderSynergy(synergyState.rows);
        if (tableSel === "#integratedTable" && appState.yxl) renderIntegrated(appState.yxl.integrated);
        if (tableSel === "#seasonTable" && appState.yxl) {
          const sn = $("#seasonSelect")?.value;
          renderSeason(appState.yxl.seasons[sn] || []);
        }
      });
    });
  }

  bindSortable("#synergyTable", synergyState);
  bindSortable("#integratedTable", integratedState);
  bindSortable("#seasonTable", seasonState);

  /* =========================================================
     시너지: LIVE 툴팁 + 클릭 링크 (LIVE면 play, OFF면 station)
     - OFF일 때는 툴팁 표시 안 함
  ========================================================= */
  (function bindSynergyHoverAndClick() {
    const tooltip = $("#soopTooltip");
    const thumbEl = $("#soopThumb");
    const titleEl = $("#soopTitle");
    const tbody = $("#synergyTable tbody");
    if (!tooltip || !thumbEl || !titleEl || !tbody) return;

    function positionTooltip(clientX, clientY) {
      const pad = 16;
      const w = tooltip.offsetWidth || 320;
      const h = tooltip.offsetHeight || 200;

      let left = clientX + 16;
      let top = clientY + 16;

      const maxLeft = window.innerWidth - w - pad;
      const maxTop = window.innerHeight - h - pad;

      if (left > maxLeft) left = clientX - w - 16;
      if (top > maxTop) top = clientY - h - 16;

      tooltip.style.left = `${Math.max(pad, left)}px`;
      tooltip.style.top = `${Math.max(pad, top)}px`;
    }

    function hideTooltip() {
      tooltip.hidden = true;
      thumbEl.removeAttribute("src");
      titleEl.textContent = "";
    }

    tbody.addEventListener("mousemove", (e) => {
      if (tooltip.hidden) return;
      positionTooltip(e.clientX, e.clientY);
    });

    tbody.addEventListener("mouseover", (e) => {
      const el = e.target.closest(".bj-name");
      if (!el) return;

      const isLive = el.dataset.live === "1";
      const thumb = safeText(el.dataset.thumb).trim();
      const title = safeText(el.dataset.title).trim();

      // ✅ OFF면 툴팁 자체를 안 띄움
      if (!isLive || !thumb) return;

      thumbEl.src = thumb;
      titleEl.textContent = title;
      tooltip.hidden = false;
      positionTooltip(e.clientX, e.clientY);
    });

    tbody.addEventListener("mouseout", (e) => {
      const el = e.target.closest(".bj-name");
      if (!el) return;
      hideTooltip();
    });

    tbody.addEventListener("click", (e) => {
      const el = e.target.closest(".bj-name");
      if (!el) return;

      const bjid = safeText(el.dataset.bjid).trim();
      if (!bjid) return;

      const isLive = el.dataset.live === "1";
      const broadNo = safeText(el.dataset.broadno).trim();

      if (isLive && broadNo) {
        window.open(`https://play.sooplive.co.kr/${encodeURIComponent(bjid)}/${encodeURIComponent(broadNo)}`, "_blank", "noopener");
      } else {
        window.open(`https://www.sooplive.co.kr/station/${encodeURIComponent(bjid)}`, "_blank", "noopener");
      }
    });

    // 스크롤/리사이즈 시 숨김
    window.addEventListener("scroll", hideTooltip, { passive: true });
    window.addEventListener("resize", hideTooltip);
  })();

  /* =========================================================
     Excel 로드/가공
  ========================================================= */
  function parseYxlWorkbook(wb) {
    const sheets = wb.SheetNames || [];

    // 1) 누적기여도
    const totalSheet = sheets[0];
    const totalRaw = sheetToObjects(wb, totalSheet);
    const total = totalRaw
      .map((r) => ({
        rank: toNum(r["순위"]),
        streamer: safeText(r["스트리머"] || r["멤버"] || r["비제이명"] || ""),
        total: toNum(r["누적기여도"] || r["누적별풍선"] || r["누적"] || 0),
      }))
      .filter((r) => r.streamer);

    applyRankDelta(total, { storageKey: "yxl_total_rank_v1" });

    // 2) 시즌통합랭킹
    const integratedSheet = sheets[1];
    const integratedRaw = sheetToObjects(wb, integratedSheet);
    const integrated = integratedRaw
      .map((r) => {
        const season = safeText(r["시즌"] || "");
        const rank = toNum(r["순위"]);
        const grade = safeText(r["직급"] || "");
        const streamer = safeText(r["스트리머"] || "");

        // 숫자 컬럼 합산(시즌/순위/직급/스트리머 제외)
        let sum = 0;
        Object.keys(r).forEach((k) => {
          if (["시즌", "순위", "직급", "스트리머"].includes(k)) return;
          sum += toNum(r[k]);
        });

        return { season, rank, grade, streamer, total: sum };
      })
      .filter((r) => r.streamer);

    // 3) 시즌별(3~12번째 시트)
    const seasonSheets = sheets.slice(2, 12);
    const seasons = {};
    seasonSheets.forEach((sn) => {
      const raw = sheetToObjects(wb, sn);
      const rows = raw
        .map((r) => {
          const rank = toNum(r["순위"]);
          const grade = safeText(r["직급"] || "");
          const streamer = safeText(r["스트리머"] || r["멤버"] || "");
          let sum = 0;
          Object.keys(r).forEach((k) => {
            if (["순위", "직급", "스트리머", "멤버"].includes(k)) return;
            sum += toNum(r[k]);
          });
          return { rank, grade, streamer, total: sum };
        })
        .filter((r) => r.streamer);
      seasons[sn] = rows;
    });

    return { sheetNames: sheets, total, integrated, seasons };
  }

  function parseSynergyWorkbook(wb) {
    const sheetName = (wb.SheetNames || [])[0] || "쿼리2";
    const raw = sheetToObjects(wb, sheetName);

    const rows = raw
      .map((r) => {
        const rank = toNum(r["순위"]);
        const streamer = safeText(r["비제이명"] || r["스트리머"] || r["멤버"] || "");
        const balloons = toNum(r["월별 누적별풍선"] || r["누적별풍선"] || r["별풍선갯수"] || 0);
        const bjidFromSheet = safeText(r["BJId"] || r["BJID"] || r["bjid"] || "").trim();
        return { rank, streamer, balloons, bjid: bjidFromSheet };
      })
      .filter((r) => r.streamer);

    applyRankDelta(rows, { storageKey: "yxl_synergy_rank_v1" });

    return { rows };
  }

  async function updateSynergyLive(rows) {
    const outMap = { ...synergyState.liveMap };
    const queue = rows.slice();
    const concurrency = 3;

    async function worker() {
      while (queue.length) {
        const r = queue.shift();
        const nick = r.streamer;
        const key = normalizeNick(nick);

        // ✅ BJID 우선순위: 시트(BJId) > 고정 매핑 > 검색
        let bjid = safeText(r.bjid).trim() || BJID_MAP[nick] || BJID_MAP[key] || "";
        try {
          if (!bjid) {
            const found = await soopFindBjidByNick(nick);
            bjid = found?.user_id || "";
          }
        } catch {
          // ignore
        }

        // bjid가 없으면 OFF 처리
        if (!bjid) {
          outMap[key] = { bjid: "", isLive: false, broadNo: "", thumb: "", title: "" };
          continue;
        }

        try {
          const live = await soopGetLiveInfoByBjid(bjid);
          outMap[key] = {
            bjid,
            isLive: !!live.isLive,
            broadNo: live.broadNo || "",
            thumb: live.thumb || "",
            title: live.title || "",
          };
        } catch {
          // CORS/네트워크 실패 시: OFF 처리(표시는 OFF=아무것도 없음)
          outMap[key] = { bjid, isLive: false, broadNo: "", thumb: "", title: "" };
        }

        await sleep(80);
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    synergyState.liveMap = outMap;
  }

  /* =========================================================
     상태 + 로드
  ========================================================= */
  const appState = { yxl: null, synergy: null };

  function setUpdatedAt(text) {
    const el = $("#updatedAt");
    if (el) el.textContent = text || new Date().toLocaleString("ko-KR");
  }

  async function loadAll() {
    // 1) YXL_통합.xlsx
    const yxlWb = await loadWorkbook(FILES.yxl);
    const yxl = parseYxlWorkbook(yxlWb);
    appState.yxl = yxl;

    // 시즌 select 채우기
    const select = $("#seasonSelect");
    if (select) {
      const seasonSheets = (yxl.sheetNames || []).slice(2, 12);
      select.innerHTML = seasonSheets.map((n) => `<option value="${n}">${n}</option>`).join("");

      // 저장값 복원
      try {
        const saved = localStorage.getItem("yxl_season_sheet_v1");
        if (saved && seasonSheets.includes(saved)) select.value = saved;
      } catch {}

      select.addEventListener("change", () => {
        try { localStorage.setItem("yxl_season_sheet_v1", select.value); } catch {}
        renderSeason(yxl.seasons[select.value] || []);
      });
    }

    // 2) 시너지표.xlsx
    const synWb = await loadWorkbook(FILES.synergy);
    const syn = parseSynergyWorkbook(synWb);
    appState.synergy = syn;
    synergyState.rows = syn.rows;

    // 렌더(일단 데이터만)
    renderTotal(yxl.total);
    renderIntegrated(yxl.integrated);
    if (select && select.value) renderSeason(yxl.seasons[select.value] || []);
    else {
      const first = Object.keys(yxl.seasons)[0];
      if (first) renderSeason(yxl.seasons[first] || []);
    }
    renderSynergy(syn.rows);

    // LIVE 정보 갱신(비동기)
    updateSynergyLive(syn.rows).then(() => {
      renderSynergy(syn.rows);
    });

    // 상단 업데이트 시간
    setUpdatedAt(new Date().toLocaleString("ko-KR"));
  }

  // 검색 바인딩
  $("#totalSearch")?.addEventListener("input", () => appState.yxl && renderTotal(appState.yxl.total));
  $("#integratedSearch")?.addEventListener("input", () => appState.yxl && renderIntegrated(appState.yxl.integrated));
  $("#seasonSearch")?.addEventListener("input", () => {
    if (!appState.yxl) return;
    const sn = $("#seasonSelect")?.value;
    renderSeason(appState.yxl.seasons[sn] || []);
  });
  $("#synergySearch")?.addEventListener("input", () => appState.synergy && renderSynergy(synergyState.rows));

  // 시작
  loadAll().catch((err) => {
    console.error(err);
    setUpdatedAt("데이터 로드 실패");
    // 최소한 gate는 동작해야 하므로 여기서 종료
  });

  /* =========================================================
     Garland 랜덤 반짝
  ========================================================= */
  (function initGarlandTwinkle() {
    const bulbs = $$(".garland .bulb");
    if (!bulbs.length) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      bulbs.forEach((b) => {
        b.style.setProperty("--o", "0.95");
        b.style.setProperty("--s", "1.0");
        b.style.setProperty("--blur", "18px");
      });
      return;
    }

    function schedule(bulb) {
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

      setTimeout(tick, 120 + Math.random() * 800);
    }

    bulbs.forEach(schedule);
  })();
});
