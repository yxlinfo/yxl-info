
// ===== Gate init (항상 게이트 표시, 클릭 시 BGM 재생 후 입장) =====
(function () {
  let gateInited = false;

  function setGate(show) {
    const g = document.getElementById("gate");
    if (!g) return;
    g.classList.toggle("is-hidden", !show);
  }

  async function enter() {
    const bgm = document.getElementById("bgm");
    try {
      if (bgm) await bgm.play();
    } catch (e) {
      console.warn("BGM play blocked or missing:", e);
    }
    setGate(false);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (gateInited) return;
    gateInited = true;

    setGate(true);

    const btn = document.getElementById("enterBtn");
    const card = document.getElementById("gateCard");
    const gate = document.getElementById("gate");
    const bgm = document.getElementById("bgm");

    // 클릭 전에는 재생하지 않도록 초기화
    if (bgm) { try { bgm.pause(); bgm.currentTime = 0; } catch(e){} }

    // 버튼 클릭
    if (btn) btn.addEventListener("click", (ev) => { ev.stopPropagation(); enter(); });

    // 카드 클릭(버튼 말고 박스 클릭해도 입장)
    if (card) {
      card.addEventListener("click", (ev) => { ev.stopPropagation(); enter(); });
      card.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); enter(); }
      });
    }

    // 배경(오버레이)은 클릭해도 닫히지 않게
    if (gate) gate.addEventListener("click", () => {});
  });
})();



document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Config
  ========================= */
  const FILE_MAIN = "YXL_통합.xlsx";
  const FILE_SYNERGY = "시너지표.xlsx";
  const AUTO_REFRESH_MS = 3 * 60 * 60 * 1000; // 3시간

  const CACHE_KEY_SOOP = "yxl_soop_cache_v1";
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10분

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
            <td>${name ?? ""}</td>
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
// rebind after rerender
      });
    });

    renderSynergyMeta();
}

  /* =========================
     SOOP Hover + Live Status
  ========================= */
  function getSoopCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY_SOOP) || "{}");
    } catch {
      return {};
    }
  }

  function setSoopCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY_SOOP, JSON.stringify(cache));
    } catch {}
  }

  async function soopFetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`SOOP API 실패: ${res.status}`);
    return await res.json();
  }

  function pickBestBjSearch(dataArr, streamerName) {
    const target = normalize(streamerName);
    if (!Array.isArray(dataArr)) return null;

    // exact nick match first
    let best = dataArr.find((d) => normalize(d.user_nick) === target);
    if (best) return best;

    // contains match
    best = dataArr.find((d) => normalize(d.user_nick).includes(target) || target.includes(normalize(d.user_nick)));
    return best || dataArr[0] || null;
  }

  function pickBestLiveSearch(realBroadArr, bjid, streamerName) {
    if (!Array.isArray(realBroadArr)) return null;
    const target = normalize(streamerName);
    let best = bjid ? realBroadArr.find((d) => d.user_id === bjid) : null;
    if (best) return best;
    best = realBroadArr.find((d) => normalize(d.user_nick) === target);
    if (best) return best;
    best = realBroadArr.find((d) => normalize(d.user_nick).includes(target) || target.includes(normalize(d.user_nick)));
    return best || null;
  }

  async function resolveSoopInfo(streamerName) {
    const cache = getSoopCache();
    const key = normalize(streamerName);
    const hit = cache[key];
    const now = Date.now();
    if (hit && now - hit.ts < CACHE_TTL_MS) return hit.value;

    const keyword = encodeURIComponent(streamerName.replace(/[♥♡]/g, "").trim());
    // 1) bjSearch -> user_id + station_logo
    const bjUrl = `https://sch.sooplive.co.kr/api.php?m=bjSearch&keyword=${keyword}&nListCnt=10&t=json`;
    const bjJson = await soopFetchJson(bjUrl);
    const bj = pickBestBjSearch(bjJson.DATA, streamerName);
    if (!bj) throw new Error("스트리머 검색 결과 없음");

    // 2) liveSearch -> live 여부 + 썸네일
    const liveUrl = `https://sch.sooplive.co.kr/api.php?m=liveSearch&keyword=${keyword}&nListCnt=30&t=json`;
    const liveJson = await soopFetchJson(liveUrl);
    const live = pickBestLiveSearch(liveJson.REAL_BROAD, bj.user_id, streamerName);

    const value = {
      user_id: bj.user_id,
      user_nick: bj.user_nick,
      station_logo: bj.station_logo,
      isLive: !!live,
      live_thumb: live?.broad_img || null,
      live_url: live?.url || null,
      live_title: live?.broad_title || null,
    };

    cache[key] = { ts: now, value };
    setSoopCache(cache);
    return value;
  }

  function ensureTooltipEl() {
    let el = document.getElementById("soopTooltip");
    if (el) return el;
    el = document.createElement("div");
    el.id = "soopTooltip";
    el.className = "soop-tooltip";
    el.style.display = "none";
    el.innerHTML = `
      <img class="thumb" alt="SOOP 썸네일" />
      <div class="body">
        <p class="title"><span class="t-emoji"></span><span class="t-name"></span></p>
        <p class="sub"></p>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function moveTooltip(el, x, y) {
    const pad = 18;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    let nx = x + 12;
    let ny = y + 12;
    if (nx + rect.width + pad > vw) nx = x - rect.width - 12;
    if (ny + rect.height + pad > vh) ny = y - rect.height - 12;
    el.style.left = nx + "px";
    el.style.top = ny + "px";
  }

  async function enhanceOneName(nameEl) {
    const streamerName = nameEl.dataset.streamer || nameEl.textContent || "";
    const emojiEl = nameEl.closest("td")?.querySelector(".live-emoji");

    // default state
    if (emojiEl) emojiEl.textContent = "⏳";

    let info = null;
    try {
      info = await resolveSoopInfo(streamerName);
      if (emojiEl) emojiEl.textContent = info.isLive ? "🟢" : "⚫";
      // 클릭 시 방송국(또는 라이브) 열기
      nameEl.onclick = () => {
        const url = info.isLive && info.live_url ? info.live_url : `https://ch.sooplive.co.kr/${info.user_id}`;
        window.open(url, "_blank", "noopener,noreferrer");
      };
    } catch (e) {
      if (emojiEl) emojiEl.textContent = "❔";
      nameEl.onclick = null;
      nameEl.dataset.soopError = "1";
    }

    const tooltip = ensureTooltipEl();

    const show = async (ev) => {
      tooltip.style.display = "block";
      moveTooltip(tooltip, ev.clientX, ev.clientY);

      const img = tooltip.querySelector(".thumb");
      const tEmoji = tooltip.querySelector(".t-emoji");
      const tName = tooltip.querySelector(".t-name");
      const sub = tooltip.querySelector(".sub");

      tName.textContent = streamerName;

      if (!info) {
        tEmoji.textContent = "❔";
        img.removeAttribute("src");
        sub.textContent = "SOOP 정보를 불러오지 못했습니다.";
        return;
      }

      tEmoji.textContent = info.isLive ? "🟢" : "⚫";
      img.src = info.isLive && info.live_thumb ? info.live_thumb : info.station_logo;
      sub.textContent = info.isLive
        ? (info.live_title ? `LIVE · ${info.live_title}` : "LIVE")
        : "OFFLINE";
    };

    const hide = () => {
      tooltip.style.display = "none";
    };

    nameEl.addEventListener("mouseenter", show);
    nameEl.addEventListener("mousemove", (ev) => moveTooltip(tooltip, ev.clientX, ev.clientY));
    nameEl.addEventListener("mouseleave", hide);
  }

  function initSoopEnhance() {
    const nameEls = $$(".soop-name");
    if (!nameEls.length) return;

    // 중복 처리 방지
    nameEls.forEach((el) => {
      if (el.dataset.soopBound === "1") return;
      el.dataset.soopBound = "1";
    });

    // 유니크 스트리머만 순차 로딩(과도한 요청 방지)
    const uniq = [];
    const seen = new Set();
    nameEls.forEach((el) => {
      const k = normalize(el.dataset.streamer || el.textContent || "");
      if (!k || seen.has(k)) return;
      seen.add(k);
      uniq.push(el);
    });

    // 순차 처리
    (async () => {
      for (const el of uniq) {
        await enhanceOneName(el);
        // 작은 딜레이(서버/브라우저 부담 감소)
        await new Promise((r) => setTimeout(r, 120));
      }
    })();
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
     Gate + BGM (기존 동작 유지)
  ========================= */
  (function gateAndBgm() {
    const KEY = "yxl_bgm_on";
    const gate = document.getElementById("gate");
    const gateBtn = document.getElementById("gateBtn");
    const gateMsg = document.getElementById("gateMsg");
    const bgm = document.getElementById("bgm");
    const bgmToggle = document.getElementById("bgmToggle");

    });
