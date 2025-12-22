/* YXLinfo v19
   - Excel 기반 대시보드 (YXL_통합.xlsx, 시너지표.xlsx)
   - 시너지표: LIVE 썸네일 툴팁(라이브일 때만), ON 표시(네온 빨간불), 클릭 이동(라이브/방송국)
   - 
*/
(() => {
  "use strict";

  /* =========================
     설정
     ========================= */
  const UPDATE_MS = 3 * 60 * 60 * 1000; // 3시간
  const EXCEL_CANDIDATES = ["data/YXL_통합.xlsx", "YXL_통합.xlsx"];
  const SYNERGY_CANDIDATES = ["data/시너지표.xlsx", "시너지표.xlsx"];

  const SOOP_SEARCH_API = "https://sch.sooplive.co.kr/api.php"; // 통합검색 (bjSearch / liveSearch)

  /* =========================
     유틸
     ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const safeText = (v) => (v ?? "").toString();
  const toNum = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const s = safeText(v).replace(/[,\s]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const fmtNum = (n) => new Intl.NumberFormat("ko-KR").format(toNum(n));

  const normalizeNick = (s) =>
    safeText(s)
      .trim()
      .replace(/\s+/g, "")
      .replace(/[❤♥♡]/g, "")
      .toLowerCase();

  // ✅ 시너지표 BJID 매핑(사용자 제공)
  const BJID_MAP = {
    [normalizeNick("리윤_♥")]: "sladk51",
    [normalizeNick("후잉♥")]: "jaeha010",
    [normalizeNick("하랑짱♥")]: "asy1218",
    [normalizeNick("쩔밍♡")]: "wnsdus5900",
    [normalizeNick("김유정S2")]: "tkek55",
    [normalizeNick("서니_♥")]: "iluvpp",
    [normalizeNick("#율무")]: "offside629",
    [normalizeNick("소다♥")]: "zbxlzzz",
    [normalizeNick("강소지♥")]: "nowsoji",
  };

  const readJSON = (key, fallback = null) => {
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

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* =========================
     게이트 + BGM
     ========================= */
  function initGate() {
    const gate = $("#gate");
    const gateBtn = $("#gateBtn");
    const bgm = $("#bgm");
    const bgmToggle = $("#bgmToggle");

    if (!gate || !gateBtn) return;

    const KEY = "yxl_gate_open";
    const opened = readJSON(KEY, false);

    const showGate = () => {
      gate.classList.remove("is-hidden");
      gate.removeAttribute("aria-hidden");
    };
    const hideGate = () => {
      gate.classList.add("is-hidden");
      gate.setAttribute("aria-hidden", "true");
    };

    // 초기 상태
    if (opened) hideGate();
    else showGate();

    // 오디오 자동재생은 대부분 브라우저에서 막힘 → 사용자 클릭 후 재생
    const tryPlay = async () => {
      if (!bgm) return;
      try {
        await bgm.play();
        bgm.dataset.playing = "1";
        if (bgmToggle) bgmToggle.textContent = "BGM OFF";
      } catch {
        // 무시 (정책상 실패할 수 있음)
      }
    };

    gateBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      writeJSON(KEY, true);
      hideGate();
      await tryPlay();
    });

    bgmToggle?.addEventListener("click", async () => {
      if (!bgm) return;
      const playing = bgm.dataset.playing === "1";
      try {
        if (playing) {
          bgm.pause();
          bgm.dataset.playing = "0";
          bgmToggle.textContent = "BGM ON";
        } else {
          await bgm.play();
          bgm.dataset.playing = "1";
          bgmToggle.textContent = "BGM OFF";
        }
      } catch {
        // 무시
      }
    });
  }

  /* =========================
     탭 전환
     ========================= */
  function initTabs() {
    const tabs = $$(".dash-tab");
    const panels = $$(".dash-panel");
    if (!tabs.length || !panels.length) return;

    const KEY = "yxl_dash";

    const activate = (id, { pushHash = true } = {}) => {
      panels.forEach((p) => {
        const isOn = p.id === id;
        p.hidden = !isOn;
        p.classList.toggle("is-active", isOn);
      });
      tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.target === id));

      try {
        localStorage.setItem(KEY, id);
      } catch {}

      if (pushHash) {
        const url = new URL(location.href);
        url.hash = `dash=${id}`;
        history.replaceState(null, "", url.toString());
      }
    };

    const readHash = () => {
      const h = location.hash || "";
      const m = h.match(/dash=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : "";
    };

    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        const id = t.dataset.target;
        if (id) activate(id, { pushHash: true });
      });
    });

    let initial = readHash();
    if (!initial) initial = localStorage.getItem(KEY) || "";
    if (!initial || !document.getElementById(initial)) initial = tabs[0].dataset.target;

    activate(initial, { pushHash: true });

    window.addEventListener("hashchange", () => {
      const id = readHash();
      if (id && document.getElementById(id)) activate(id, { pushHash: false });
    });
  }

  /* =========================
     엑셀 로더 (SheetJS)
     ========================= */
  async function fetchArrayBuffer(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
    return await res.arrayBuffer();
  }

  async function loadWorkbookFromCandidates(candidates) {
    const stamp = Date.now();
    let lastErr = null;
    for (const p of candidates) {
      try {
        const buf = await fetchArrayBuffer(`${p}?v=${stamp}`);
        return XLSX.read(buf, { type: "array" });
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Workbook load failed");
  }

  function sheetToRows(workbook, sheetName) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) return [];
    // defval: null → 빈셀 유지
    return XLSX.utils.sheet_to_json(ws, { defval: null });
  }

  function parseYxlWorkbook(wb) {
    const names = wb.SheetNames || [];

    // 1) 누적기여도 (첫번째 시트)
    const totalSheet = names[0];
    const totalRaw = sheetToRows(wb, totalSheet);
    const total = totalRaw
      .map((r) => ({
        rank: toNum(r["순위"] ?? r["랭킹"] ?? r["Rank"]),
        streamer: safeText(r["스트리머"] ?? r["멤버"] ?? r["BJ"] ?? r["이름"]).trim(),
        total: toNum(r["누적기여도"] ?? r["기여도"] ?? r["합산기여도"] ?? r["별풍선"]),
      }))
      .filter((r) => r.streamer);

    // 2) 시즌통합랭킹 (두번째 시트)
    const integratedSheet = names[1];
    const integratedRaw = sheetToRows(wb, integratedSheet);
    const integrated = integratedRaw
      .map((r) => {
        const season = safeText(r["시즌"] ?? "").trim();
        const rank = toNum(r["순위"] ?? r["랭킹"]);
        const grade = safeText(r["직급"] ?? "").trim();
        const streamer = safeText(r["스트리머"] ?? r["멤버"] ?? "").trim();

        // 합산: 시즌/순위/직급/스트리머 제외한 숫자 컬럼 모두 더함
        let sum = 0;
        for (const [k, v] of Object.entries(r)) {
          if (["시즌", "순위", "랭킹", "직급", "스트리머", "멤버"].includes(k)) continue;
          sum += toNum(v);
        }
        return { season, rank, grade, streamer, sum };
      })
      .filter((r) => r.streamer);

    // 3) 시즌별 (3~12번째 시트)
    const seasonSheets = names.slice(2, 12);
    const seasons = {};
    for (const sn of seasonSheets) {
      const raw = sheetToRows(wb, sn);
      const rows = raw
        .map((r) => {
          const rank = toNum(r["순위"] ?? r["랭킹"]);
          const grade = safeText(r["직급"] ?? "").trim();
          const streamer = safeText(r["스트리머"] ?? r["멤버"] ?? "").trim();
          const total = toNum(r["합산기여도"] ?? r["누적기여도"] ?? r["기여도"]);
          let sum = total;
          if (!sum) {
            sum = 0;
            for (const [k, v] of Object.entries(r)) {
              if (["순위", "랭킹", "직급", "스트리머", "멤버"].includes(k)) continue;
              sum += toNum(v);
            }
          }
          return { rank, grade, streamer, sum };
        })
        .filter((r) => r.streamer);

      seasons[sn] = rows;
    }

    return { total, integrated, seasons, sheetNames: names };
  }

  function parseSynergyWorkbook(wb) {
    const names = wb.SheetNames || [];
    const sheetName = names.includes("쿼리2") ? "쿼리2" : names[0];
    const raw = sheetToRows(wb, sheetName);

    const rows = raw
      .map((r) => ({
        rank: toNum(r["순위"] ?? r["랭킹"]),
        streamer: safeText(r["비제이명"] ?? r["스트리머"] ?? r["멤버"]).trim(),
        balloons: toNum(r["월별 누적별풍선"] ?? r["누적별풍선"] ?? r["별풍선"]),
        refreshedAt: safeText(r["새로고침시간"] ?? r["업데이트"] ?? "").trim(),
      }))
      .filter((r) => r.streamer);

    // refreshedAt은 모든 행에 동일 값이라고 가정
    const refreshedAt = rows.find((x) => x.refreshedAt)?.refreshedAt || "";

    // monthKey: YYYY-MM
    const monthKey = (() => {
      const m = refreshedAt.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
      if (!m) {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      const y = m[1];
      const mo = String(m[2]).padStart(2, "0");
      return `${y}-${mo}`;
    })();

    return { rows, refreshedAt, monthKey };
  }

  /* =========================
     변동사항(순위 변화) 계산
     ========================= */
  function applyRankDelta(rows, { storageKey, monthKey }) {
    const key = `${storageKey}:${monthKey}`;
    const prev = readJSON(key, {}); // { streamerKey: rank }
    const next = {};

    rows.forEach((r) => {
      const k = normalizeNick(r.streamer);
      const prevRank = toNum(prev[k] ?? 0) || null;
      const curRank = toNum(r.rank) || null;
      next[k] = curRank;

      if (!prevRank || !curRank) {
        r.delta = { type: "new", diff: 0, text: "" };
        return;
      }
      const diff = prevRank - curRank; // +면 상승(순위 숫자 감소)
      if (diff > 0) r.delta = { type: "up", diff, text: `▲${diff}` };
      else if (diff < 0) r.delta = { type: "down", diff: Math.abs(diff), text: `▼${Math.abs(diff)}` };
      else r.delta = { type: "same", diff: 0, text: "-" };
    });

    writeJSON(key, next);
  }

  function renderDeltaCell(delta) {
    if (!delta || !delta.text) return `<span class="delta new"></span>`;
    const cls = delta.type || "new";
    return `<span class="delta ${cls}">${delta.text}</span>`;
  }

  /* =========================
     SOOP: BJID 찾기 + LIVE 확인 (CORS 실패 시 기능 자동 비활성)
     ========================= */
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

    // 가장 비슷한 닉을 선택
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

  /* =========================
     렌더: 누적 / 통합 / 시즌별
     ========================= */
  function renderTotal(rows) {
    const tbody = $("#totalTable tbody");
    if (!tbody) return;

    const q = safeText($("#totalSearch")?.value).trim();
    const filtered = q ? rows.filter((r) => r.streamer.includes(q)) : rows;

    tbody.innerHTML = filtered
      .slice()
      .sort((a, b) => (a.rank || 9999) - (b.rank || 9999))
      .map((r) => {
        const medal =
          r.rank === 1 ? `<span class="medal gold">1</span>` : r.rank === 2 ? `<span class="medal silver">2</span>` : r.rank === 3 ? `<span class="medal bronze">3</span>` : `<span class="rank">${r.rank}</span>`;
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
  }

  function renderIntegrated(rows) {
    const tbody = $("#integratedTable tbody");
    if (!tbody) return;

    const q = safeText($("#integratedSearch")?.value).trim();
    const filtered = q ? rows.filter((r) => r.streamer.includes(q)) : rows;

    tbody.innerHTML = filtered
      .slice()
      .sort((a, b) => (a.rank || 9999) - (b.rank || 9999))
      .map((r) => {
        return `
          <tr>
            <td class="rank-cell"><span class="rank">${r.rank}</span></td>
            <td>${safeText(r.season)}</td>
            <td>${safeText(r.grade)}</td>
            <td>${safeText(r.streamer)}</td>
            <td style="text-align:right;">${fmtNum(r.sum)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderSeason(rows) {
    const tbody = $("#seasonTable tbody");
    if (!tbody) return;

    const q = safeText($("#seasonSearch")?.value).trim();
    const filtered = q ? rows.filter((r) => r.streamer.includes(q)) : rows;

    tbody.innerHTML = filtered
      .slice()
      .sort((a, b) => (a.rank || 9999) - (b.rank || 9999))
      .map((r) => {
        return `
          <tr>
            <td class="rank-cell"><span class="rank">${r.rank}</span></td>
            <td>${safeText(r.grade)}</td>
            <td>${safeText(r.streamer)}</td>
            <td style="text-align:right;">${fmtNum(r.sum)}</td>
          </tr>
        `;
      })
      .join("");
  }

  /* =========================
     렌더: 시너지표 + LIVE 상태/툴팁
     ========================= */
  const synergyState = {
    rows: [],
    // streamerKey -> { bjid, isLive, broadNo, thumb, title }
    liveMap: {},
  };

  function renderSynergy(rows) {
    const tbody = $("#synergyTable tbody");
    if (!tbody) return;

    const q = safeText($("#synergySearch")?.value).trim();
    const filtered = q ? rows.filter((r) => r.streamer.includes(q)) : rows;

    tbody.innerHTML = filtered
      .slice()
      .sort((a, b) => (a.rank || 9999) - (b.rank || 9999))
      .map((r) => {
        const key = normalizeNick(r.streamer);
        const live = synergyState.liveMap[key] || {};
        const isLive = !!live.isLive;

        const statusHtml = isLive ? `<span class="live-dot" title="LIVE"></span>` : `<span class="live-dot is-off" title="OFF"></span>`;

        return `
          <tr data-streamer-key="${key}">
            <td class="rank-cell"><span class="rank">${r.rank}</span></td>
            <td>
              <div class="name-cell">
                ${statusHtml}
                <span class="bj-link" data-action="open" data-streamer="${encodeURIComponent(r.streamer)}">${safeText(r.streamer)}</span>
              </div>
            </td>
            <td style="text-align:right;">${fmtNum(r.balloons)}</td>
            <td style="text-align:right;">${renderDeltaCell(r.delta)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function initSynergyInteractions() {
    const table = $("#synergyTable");
    const tooltip = $("#synergyTooltip");
    if (!table || !tooltip) return;

    let raf = 0;

    const hideTooltip = () => {
      tooltip.hidden = true;
      tooltip.innerHTML = "";
    };

    const positionTooltip = (x, y) => {
      const pad = 14;
      const w = tooltip.offsetWidth || 260;
      const h = tooltip.offsetHeight || 160;
      const maxX = window.innerWidth - w - pad;
      const maxY = window.innerHeight - h - pad;
      tooltip.style.left = Math.max(pad, Math.min(x + 14, maxX)) + "px";
      tooltip.style.top = Math.max(pad, Math.min(y + 14, maxY)) + "px";
    };

    table.addEventListener("mousemove", (e) => {
      if (tooltip.hidden) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => positionTooltip(e.clientX, e.clientY));
    });

    table.addEventListener("mouseleave", hideTooltip);

    // hover: LIVE일 때만 썸네일 표시
    table.addEventListener("mouseover", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const nameEl = target.closest(".bj-link");
      if (!nameEl) return;

      const tr = nameEl.closest("tr");
      const key = tr?.dataset.streamerKey || "";
      const live = synergyState.liveMap[key] || {};
      if (!live.isLive || !live.thumb) {
        hideTooltip();
        return;
      }

      tooltip.hidden = false;
      tooltip.innerHTML = `
        <img src="${live.thumb}" alt="LIVE thumbnail" />
        <div class="tt-title">${safeText(live.title || "LIVE")}</div>
      `;
    });

    // click: LIVE면 라이브 주소 / 아니면 방송국
    table.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const nameEl = target.closest(".bj-link[data-action='open']");
      if (!nameEl) return;

      const tr = nameEl.closest("tr");
      const key = tr?.dataset.streamerKey || "";
      const live = synergyState.liveMap[key] || {};

      // streamer 원문
      const streamer = decodeURIComponent(nameEl.dataset.streamer || "");
      const fallbackSearch = `https://www.sooplive.com/search?keyword=${encodeURIComponent(streamer)}`;

      if (!live.bjid) {
        window.open(fallbackSearch, "_blank", "noopener");
        return;
      }

      if (live.isLive && live.broadNo) {
        window.open(`https://play.sooplive.co.kr/${live.bjid}/${live.broadNo}`, "_blank", "noopener");
      } else {
        window.open(`https://www.sooplive.co.kr/station/${live.bjid}`, "_blank", "noopener");
      }
    });
  }

  async function enrichSynergyLive(rows) {
    // 1) bjid 찾기 → 2) liveSearch로 라이브 확인
    // 너무 과한 병렬 호출 방지 (동시 4개)
    const concurrency = 4;
    const queue = rows.slice();
    const outMap = { ...synergyState.liveMap };

    const worker = async () => {
      while (queue.length) {
        const r = queue.shift();
        const key = normalizeNick(r.streamer);
        if (!key) continue;

        // 이미 최근에 확인한 정보가 있으면 스킵(90초)
        const existing = outMap[key];
        if (existing && existing.ts && Date.now() - existing.ts < 90_000) continue;

        try {
          const mappedBjid = BJID_MAP[key] || "";
          const bj = mappedBjid ? { user_id: mappedBjid } : await soopFindBjidByNick(r.streamer);
          const bjid = bj?.user_id || "";
          if (!bjid) {
            outMap[key] = { bjid: (BJID_MAP[key] || ""), isLive: false, broadNo: "", thumb: "", title: "", ts: Date.now() };
            continue;
          }

          const live = await soopGetLiveInfoByBjid(bjid);

          outMap[key] = {
            bjid,
            isLive: !!live.isLive,
            broadNo: live.broadNo || "",
            thumb: live.thumb || "",
            title: live.title || "",
            ts: Date.now(),
          };
        } catch {
          // CORS/네트워크 실패 시: 해당 행만 offline 처리
          outMap[key] = { bjid: (BJID_MAP[key] || ""), isLive: false, broadNo: "", thumb: "", title: "", ts: Date.now() };
        }

        // 짧은 딜레이(서버 부담 완화)
        await sleep(60);
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    synergyState.liveMap = outMap;
  }

  /* =========================
     전체 로드 + 렌더 + 3시간 타이머
     ========================= */
  const state = {
    yxl: null,
    synergy: null,
  };

  function setUpdatedAtNow() {
    const el = $("#updatedAt");
    if (el) el.textContent = new Date().toLocaleString("ko-KR");
  }
    el.textContent = new Date(nextAt).toLocaleString("ko-KR");
  }

  function setSynergyRefreshedUI(text) {
    const el = $("#synergyRefreshedAt");
    if (el) el.textContent = text || "--";
  }

  function bindSearchInputs() {
    $("#totalSearch")?.addEventListener("input", () => state.yxl && renderTotal(state.yxl.total));
    $("#integratedSearch")?.addEventListener("input", () => state.yxl && renderIntegrated(state.yxl.integrated));
    $("#seasonSearch")?.addEventListener("input", () => {
      if (!state.yxl) return;
      const sn = $("#seasonSelect")?.value;
      renderSeason(state.yxl.seasons[sn] || []);
    });
    $("#synergySearch")?.addEventListener("input", () => state.synergy && renderSynergy(state.synergy.rows));
  }

  function initSeasonSelect(sheetNames) {
    const select = $("#seasonSelect");
    if (!select) return;

    const seasonSheets = (sheetNames || []).slice(2, 12);
    select.innerHTML = seasonSheets.map((n) => `<option value="${n}">${n}</option>`).join("");

    select.addEventListener("change", () => {
      if (!state.yxl) return;
      const sn = select.value;
      renderSeason(state.yxl.seasons[sn] || []);
    });
  }

  async function refreshAll() {
    try {
      // 엑셀 로드
      const yxlWb = await loadWorkbookFromCandidates(EXCEL_CANDIDATES);
      const yxl = parseYxlWorkbook(yxlWb);

      // 누적 변동사항 적용 (이번 달 기준)
      const d = new Date();
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      applyRankDelta(yxl.total, { storageKey: "yxl_total_rank", monthKey });

      state.yxl = yxl;

      initSeasonSelect(yxl.sheetNames);

      // 렌더
      renderTotal(yxl.total);
      renderIntegrated(yxl.integrated);

      const defaultSeason = $("#seasonSelect")?.value || Object.keys(yxl.seasons)[0];
      renderSeason(yxl.seasons[defaultSeason] || []);

      // 시너지 로드
      const synWb = await loadWorkbookFromCandidates(SYNERGY_CANDIDATES);
      const syn = parseSynergyWorkbook(synWb);

      applyRankDelta(syn.rows, { storageKey: "yxl_synergy_rank", monthKey: syn.monthKey });

      state.synergy = syn;
      synergyState.rows = syn.rows;

      setSynergyRefreshedUI(syn.refreshedAt || "--");

      renderSynergy(syn.rows);

      // LIVE 정보 업데이트 (비동기)
      await enrichSynergyLive(syn.rows);
      renderSynergy(syn.rows); // 상태 반영 재렌더

      // 공통 UI
      setUpdatedAtNow();

      // 다음 업데이트 시간
    } catch (e) {
      console.error(e);
      setUpdatedAtNow();
      // 최소한 사용자에게 느낌표라도
      const el = $("#synergyRefreshedAt");
      if (el) el.textContent = "데이터 로드 실패 (파일 경로/이름 확인)";
    }
  }

  function startAutoRefresh() {
    // 페이지를 열어두면 3시간마다 갱신
    setInterval(() => {
      refreshAll();
    }, UPDATE_MS);
  }

  /* =========================
     시작
     ========================= */
  document.addEventListener("DOMContentLoaded", async () => {
    initGate();
    initTabs();
    bindSearchInputs();
    initSynergyInteractions();
    await refreshAll();
    startAutoRefresh();
  });
})();
