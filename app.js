document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     ✅ 데이터 소스 (루트에 두세요)
     - YXL_통합.xlsx : 누적/시즌통합/시즌별
     - 시너지표.xlsx  : 시너지표(쿼리 결과)
  ========================================================= */
  const FILE_YXL = "YXL_통합.xlsx";
  const FILE_SYNERGY = "시너지표.xlsx";

  // 3시간(=10800000ms) 자동 업데이트
  const AUTO_REFRESH_MS = 3 * 60 * 60 * 1000;

  /* =========================
     유틸
  ========================= */
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];
  const fmtNum = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v ?? "";
    return n.toLocaleString("ko-KR");
  };
  const normalize = (v) => String(v ?? "").trim();
  const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v)) return v;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };
  const ymKey = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` : "";

  const setUpdatedAt = (date) => {
    const el = qs("#updatedAt");
    if (!el) return;
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, "0");
    el.textContent = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  /* =========================
     XLSX 로더
  ========================= */
  async function fetchWorkbook(url) {
    if (!window.XLSX) throw new Error("XLSX 라이브러리를 찾을 수 없습니다. (index.html에 xlsx 스크립트가 필요)");
    const res = await fetch(`${url}?v=${Date.now()}`);
    if (!res.ok) throw new Error(`${url} 불러오기 실패 (${res.status})`);
    const buf = await res.arrayBuffer();
    return window.XLSX.read(buf, { type: "array", cellDates: true });
  }

  function sheetToRows(wb, sheetName) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    // defval: null 로 빈칸도 키가 유지되게
    return window.XLSX.utils.sheet_to_json(ws, { defval: null });
  }

  /* =========================
     순위 변동(로컬 저장) 계산
  ========================= */
  function applyRankDelta(rows, nameKey, rankKey, storageKey) {
    let prev = {};
    try { prev = JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch(e){ prev = {}; }

    const next = {};
    const out = rows.map((r) => {
      const name = normalize(r[nameKey]);
      const rank = Number(r[rankKey]);
      if (!name || !Number.isFinite(rank)) return { ...r, __deltaText: "", __deltaClass: "" };

      next[name] = rank;

      if (prev[name] == null) {
        return { ...r, __deltaText: "NEW", __deltaClass: "delta-new" };
      }
      const delta = Number(prev[name]) - rank; // +면 상승
      if (delta > 0) return { ...r, __deltaText: `▲${delta}`, __deltaClass: "delta-up" };
      if (delta < 0) return { ...r, __deltaText: `▼${Math.abs(delta)}`, __deltaClass: "delta-down" };
      return { ...r, __deltaText: "—", __deltaClass: "delta-same" };
    });

    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch(e){}
    return out;
  }

  /* =========================
     Tabs
  ========================= */
  function initTabs() {
    const tabs = qsa(".dash-tab");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabs.forEach((b) => {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });

        const target = btn.dataset.target;
        qsa(".dash-panel").forEach((p) => {
          const on = p.id === target;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  /* =========================
     Render: 누적 기여도표 (1번 시트)
  ========================= */
  function renderTotal(rows) {
    const table = qs("#totalTable");
    if (!table) return;
    const tbody = qs("tbody", table);
    tbody.innerHTML = "";

    const data = applyRankDelta(rows, "스트리머", "순위", "yxl_total_prev_ranks");

    for (const r of data) {
      const tr = document.createElement("tr");

      const rank = Number(r["순위"]);
      const tdRank = document.createElement("td");
      tdRank.textContent = Number.isFinite(rank) ? rank : "";
      if (rank === 1) tr.classList.add("top1");
      if (rank === 2) tr.classList.add("top2");
      if (rank === 3) tr.classList.add("top3");
      tr.appendChild(tdRank);

      const tdName = document.createElement("td");
      tdName.textContent = r["스트리머"] ?? "";
      tr.appendChild(tdName);

      const tdVal = document.createElement("td");
      tdVal.style.textAlign = "right";
      tdVal.textContent = fmtNum(r["누적기여도"]);
      tr.appendChild(tdVal);

      const tdDelta = document.createElement("td");
      tdDelta.style.textAlign = "right";
      tdDelta.textContent = r.__deltaText || "";
      tdDelta.className = r.__deltaClass || "";
      tr.appendChild(tdDelta);

      tbody.appendChild(tr);
    }
  }

  function bindTotalSearch(allRows) {
    const input = qs("#totalSearch");
    if (!input) return;
    input.addEventListener("input", () => {
      const q = normalize(input.value).toLowerCase();
      if (!q) return renderTotal(allRows);
      const filtered = allRows.filter((r) => normalize(r["스트리머"]).toLowerCase().includes(q));
      renderTotal(filtered);
    });
  }

  /* =========================
     Render: 시즌통합랭킹 (2번 시트)
     - 시즌 선택 박스 없이 전체 표시
  ========================= */
  const integratedSort = { key: "합산기여도", dir: "desc" };

  function compare(a, b, key, dir) {
    const av = a[key];
    const bv = b[key];
    const an = Number(av);
    const bn = Number(bv);
    let r = 0;
    if (Number.isFinite(an) && Number.isFinite(bn)) r = an - bn;
    else r = normalize(av).localeCompare(normalize(bv), "ko");
    return dir === "asc" ? r : -r;
  }

  function renderIntegrated(rows) {
    const table = qs("#integratedTable");
    if (!table) return;
    const tbody = qs("tbody", table);
    tbody.innerHTML = "";

    const { key, dir } = integratedSort;
    const data = [...rows].sort((a,b)=>compare(a,b,key,dir));

    for (const r of data) {
      const tr = document.createElement("tr");
      const cols = ["시즌","순위","직급","스트리머","직급전","1회차","2회차","3회차","4회차","5회차","합산기여도"];
      cols.forEach((c) => {
        const td = document.createElement("td");
        const isNum = ["순위","직급전","1회차","2회차","3회차","4회차","5회차","합산기여도"].includes(c);
        if (isNum) td.style.textAlign = "right";
        td.textContent = isNum ? fmtNum(r[c]) : (r[c] ?? "");
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  }

  function bindIntegratedSort(rows) {
    const table = qs("#integratedTable");
    if (!table) return;
    qsa("thead th[data-key]", table).forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.dataset.key;
        if (!k) return;
        if (integratedSort.key === k) integratedSort.dir = integratedSort.dir === "asc" ? "desc" : "asc";
        else { integratedSort.key = k; integratedSort.dir = "asc"; }
        renderIntegrated(rows);
        updateSortIndicators(table, integratedSort);
      });
    });
    updateSortIndicators(table, integratedSort);
  }

  function updateSortIndicators(table, state) {
    qsa("thead th", table).forEach((th) => {
      const old = qs(".sort-ind", th);
      if (old) old.remove();
      if (th.dataset.key === state.key) {
        const s = document.createElement("span");
        s.className = "sort-ind";
        s.textContent = state.dir === "asc" ? " ▲" : " ▼";
        th.appendChild(s);
      }
    });
  }

  function bindIntegratedSearch(allRows) {
    const input = qs("#integratedSearch");
    if (!input) return;
    input.addEventListener("input", () => {
      const q = normalize(input.value).toLowerCase();
      if (!q) return renderIntegrated(allRows);
      const filtered = allRows.filter((r) => normalize(r["스트리머"]).toLowerCase().includes(q));
      renderIntegrated(filtered);
    });
  }

  /* =========================
     Render: 시즌별 기여도표 (3~12 시트)
  ========================= */
  const seasonSort = { key: "합산기여도", dir: "desc" };
  let seasonSheets = {}; // { displayName: rows }

  function buildSeasonSelect() {
    const sel = qs("#seasonSelect");
    if (!sel) return;
    sel.innerHTML = "";
    Object.keys(seasonSheets).forEach((name, idx) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (idx === 0) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderSeasonTable(rows, displayName) {
    const table = qs("#seasonTable");
    if (!table) return;

    const thead = qs("thead", table);
    const tbody = qs("tbody", table);
    tbody.innerHTML = "";

    if (!rows || !rows.length) {
      thead.innerHTML = "<tr><th>데이터가 없습니다</th></tr>";
      return;
    }

    // 컬럼 자동 감지
    const keys = Object.keys(rows[0]);
    // 우선순위로 앞으로
    const preferred = ["순위","직급","스트리머"];
    const rest = keys.filter(k => !preferred.includes(k));
    // 합산은 맨 뒤로
    const sumKey = rest.find(k => k.includes("합산"));
    const rest2 = rest.filter(k => k !== sumKey);
    const cols = [...preferred.filter(k=>keys.includes(k)), ...rest2, ...(sumKey ? [sumKey] : [])];

    // 헤더
    thead.innerHTML = "";
    const trh = document.createElement("tr");
    cols.forEach((k) => {
      const th = document.createElement("th");
      th.textContent = k;
      th.dataset.key = k;
      trh.appendChild(th);
    });
    thead.appendChild(trh);

    // 정렬 적용
    const { key, dir } = seasonSort;
    const data = [...rows].sort((a,b)=>compare(a,b,key,dir));

    const dataWithDelta = applyRankDelta(data, "스트리머", "순위", `yxl_season_prev_${displayName}`);

    dataWithDelta.forEach((r) => {
      const tr = document.createElement("tr");
      cols.forEach((k) => {
        const td = document.createElement("td");
        const isNum = Number.isFinite(Number(r[k])) && k !== "직급" && k !== "스트리머";
        if (isNum) td.style.textAlign = "right";
        td.textContent = isNum ? fmtNum(r[k]) : (r[k] ?? "");
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    // 헤더 클릭 정렬
    qsa("thead th[data-key]", table).forEach((th) => {
      th.onclick = () => {
        const k = th.dataset.key;
        if (!k) return;
        if (seasonSort.key === k) seasonSort.dir = seasonSort.dir === "asc" ? "desc" : "asc";
        else { seasonSort.key = k; seasonSort.dir = "asc"; }
        renderSeasonTable(rows, displayName);
        updateSortIndicators(table, seasonSort);
      };
    });
    updateSortIndicators(table, seasonSort);
  }

  function bindSeasonControls() {
    const sel = qs("#seasonSelect");
    const input = qs("#seasonSearch");
    if (!sel) return;

    const apply = () => {
      const seasonName = sel.value;
      const all = seasonSheets[seasonName] || [];
      const q = normalize(input?.value).toLowerCase();
      const filtered = q ? all.filter(r => normalize(r["스트리머"]).toLowerCase().includes(q)) : all;
      renderSeasonTable(filtered, seasonName);
    };

    sel.addEventListener("change", apply);
    if (input) input.addEventListener("input", apply);

    // 초기 렌더
    apply();
  }

  /* =========================
     Render: 시너지표 (시너지표.xlsx)
     - 순위, 스트리머, 누적별풍선, 변동사항
     - 3시간마다 자동 업데이트 문구
     - 년/월 변경 표시 달력 위젯
  ========================= */
  function renderSynergy(rows) {
    const table = qs("#synergyTable");
    if (!table) return;

    // 새로고침시간(쿼리 결과) 추출
    const refreshTime = rows?.length ? toDate(rows[0]["새로고침시간"]) : null;
    setUpdatedAt(refreshTime || new Date());

    // 달력 위젯
    const cal = qs("#synergyCalendar");
    if (cal) {
      const nowYM = ymKey(refreshTime || new Date());
      const storeKey = "yxl_synergy_last_ym";
      const prevYM = localStorage.getItem(storeKey) || "";
      const changed = prevYM && prevYM !== nowYM;

      cal.innerHTML = `
        <div class="cal-icon">📅</div>
        <div class="cal-body">
          <div class="cal-title">데이터 기준월</div>
          <div class="cal-ym">${nowYM.replace("-", "년 ")}월</div>
          <div class="cal-sub">
            ${prevYM ? `이전: <b>${prevYM.replace("-", "년 ")}월</b>` : "이전 기록 없음"}
            ${changed ? `<span class="badge badge-warn">월 변경</span>` : ``}
          </div>
        </div>
      `;

      try { localStorage.setItem(storeKey, nowYM); } catch(e){}
    }

    // 변동사항 계산
    const mapped = rows.map((r) => ({
      "순위": r["순위"],
      "스트리머": r["비제이명"] ?? r["스트리머"] ?? r["BJ"] ?? "",
      "누적별풍선": r["월별 누적별풍선"] ?? r["누적별풍선"] ?? r["누적"] ?? "",
      "새로고침시간": r["새로고침시간"]
    }));

    const data = applyRankDelta(mapped, "스트리머", "순위", "yxl_synergy_prev_ranks");

    const tbody = qs("tbody", table);
    tbody.innerHTML = "";
    data.forEach((r) => {
      const tr = document.createElement("tr");

      const tdRank = document.createElement("td");
      tdRank.textContent = r["순위"] ?? "";
      tr.appendChild(tdRank);

      const tdName = document.createElement("td");
      tdName.textContent = r["스트리머"] ?? "";
      tr.appendChild(tdName);

      const tdVal = document.createElement("td");
      tdVal.style.textAlign = "right";
      tdVal.textContent = fmtNum(r["누적별풍선"]);
      tr.appendChild(tdVal);

      const tdDelta = document.createElement("td");
      tdDelta.style.textAlign = "right";
      tdDelta.textContent = r.__deltaText || "";
      tdDelta.className = r.__deltaClass || "";
      tr.appendChild(tdDelta);

      tbody.appendChild(tr);
    });
  }

  function bindSynergySearch(allRowsRaw) {
    const input = qs("#synergySearch");
    if (!input) return;
    input.addEventListener("input", () => {
      const q = normalize(input.value).toLowerCase();
      if (!q) return renderSynergy(allRowsRaw);
      const filtered = allRowsRaw.filter((r) => normalize(r["비제이명"]).toLowerCase().includes(q));
      renderSynergy(filtered);
    });
  }

  /* =========================
     데이터 로드 + 초기화
  ========================= */
  let totalRows = [];
  let integratedRows = [];
  let synergyRows = [];

  async function loadAll() {
    try {
      const [wbYXL, wbSyn] = await Promise.all([
        fetchWorkbook(FILE_YXL),
        fetchWorkbook(FILE_SYNERGY),
      ]);

      // 1) 누적기여도 (1번 시트)
      const totalSheet = wbYXL.SheetNames[0];
      totalRows = sheetToRows(wbYXL, totalSheet);

      // 2) 시즌통합랭킹 (2번 시트)
      const integratedSheet = wbYXL.SheetNames[1];
      integratedRows = sheetToRows(wbYXL, integratedSheet);

      // 3) 시즌별(3~12)
      seasonSheets = {};
      wbYXL.SheetNames.slice(2, 12).forEach((sn) => {
        // 표시명은 "시즌1" 같은 느낌으로 정리
        const m = sn.match(/시즌\s*(\d+)/) || sn.match(/시즌(\d+)/);
        const display = m ? `시즌 ${m[1]}` : sn.replace(/YXL[_\s]*/g, "");
        seasonSheets[display] = sheetToRows(wbYXL, sn);
      });

      // 4) 시너지표.xlsx (쿼리2)
      const synSheet = wbSyn.SheetNames[0];
      synergyRows = sheetToRows(wbSyn, synSheet);

      // 렌더
      renderTotal(totalRows);
      renderIntegrated(integratedRows);
      buildSeasonSelect();
      bindSeasonControls();
      renderSynergy(synergyRows);

      // 바인딩
      bindTotalSearch(totalRows);
      bindIntegratedSearch(integratedRows);
      bindIntegratedSort(integratedRows);
      bindSynergySearch(synergyRows);

      // 업데이트 시간(기본)
      setUpdatedAt(new Date());
    } catch (err) {
      console.error(err);
      const el = qs("#updatedAt");
      if (el) el.textContent = "엑셀 로드 실패";
      alert(`엑셀 파일을 불러오지 못했습니다.\n\n- 파일이 index.html과 같은 폴더(루트)에 있는지 확인\n- 파일명: ${FILE_YXL}, ${FILE_SYNERGY}\n\n에러: ${err.message}`);
    }
  }

  function scheduleAutoRefresh() {
    // 안내 문구
    const msg = qs("#synergyAutoMsg");
    if (msg) msg.textContent = "3시간마다 자동 업데이트가 됩니다";

    setInterval(() => {
      loadAll();
    }, AUTO_REFRESH_MS);
  }

  initTabs();
  loadAll();
  scheduleAutoRefresh();

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
