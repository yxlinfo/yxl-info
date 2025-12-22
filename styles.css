(function gateAndBgmWithHearts(){
  const KEY = "yxl_bgm_on";

  const gate = document.getElementById("gate");
  const gateBtn = document.getElementById("gateBtn");
  const gateMsg = document.getElementById("gateMsg");
  const particleLayer = document.getElementById("gateParticles");

  const audio = document.getElementById("bgm");
  const headerToggle = document.getElementById("bgmToggle");

  if (!gate || !gateBtn || !audio || !particleLayer) return;

  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.25;

  let floatTimer = null;

  function setHeaderUI(isOn){
    if (!headerToggle) return;
    headerToggle.classList.toggle("is-on", isOn);
    headerToggle.textContent = isOn ? "BGM 정지" : "BGM 재생";
    headerToggle.setAttribute("aria-pressed", isOn ? "true" : "false");
  }

  function showGate(){
    gate.classList.remove("is-hidden");
    gate.setAttribute("aria-hidden", "false");
    startFloatingHearts();
  }

  function hideGate(){
    gate.classList.add("is-hidden");
    gate.setAttribute("aria-hidden", "true");
    stopFloatingHearts();
  }

  function showMiniToast(text){
    let t = document.getElementById("bgmToast");
    if (!t){
      t = document.createElement("div");
      t.id = "bgmToast";
      t.style.position = "fixed";
      t.style.left = "50%";
      t.style.bottom = "18px";
      t.style.transform = "translateX(-50%)";
      t.style.zIndex = "99999";
      t.style.padding = "10px 12px";
      t.style.borderRadius = "999px";
      t.style.border = "1px solid rgba(255,255,255,.18)";
      t.style.background = "rgba(11,18,32,.88)";
      t.style.color = "rgba(255,255,255,.9)";
      t.style.fontWeight = "800";
      t.style.fontSize = "12px";
      t.style.boxShadow = "0 12px 30px rgba(0,0,0,.35)";
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.style.display = "block";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => (t.style.display = "none"), 2200);
  }

  async function tryPlay({ userInitiated = false } = {}){
    try{
      if (audio.readyState < 2) audio.load();
      await audio.play();
      localStorage.setItem(KEY, "1");
      setHeaderUI(true);
      return true;
    }catch(e){
      localStorage.setItem(KEY, "0");
      setHeaderUI(false);

      // 유저 클릭으로도 실패하면(확장/정책 등) 안내만 하고 입장은 유지
      if (userInitiated){
        showMiniToast("BGM 재생이 차단됐어요. 우측 상단 'BGM 재생' 버튼으로 다시 시도해줘!");
        if (gateMsg) gateMsg.textContent = "BGM 재생이 차단됐어요. 입장 후 우측 상단 BGM 버튼으로 다시 시도해줘!";
      }
      return false;
    }
  }

  function stop(){
    audio.pause();
    audio.currentTime = 0;
    localStorage.setItem(KEY, "0");
    setHeaderUI(false);
  }

  // ----- 파티클 -----
  function makeHeart(x, y, opts = {}){
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

  function makeSpark(x, y){
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

  function burstAtClientPoint(clientX, clientY){
    const rect = gate.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const heartCount = 22 + Math.floor(Math.random() * 14);
    for (let i = 0; i < heartCount; i++) makeHeart(x, y, { spread: 280, rise: 220 });
    for (let i = 0; i < 18; i++) makeSpark(x, y);
  }

  function startFloatingHearts(){
    if (floatTimer) return;
    floatTimer = setInterval(() => {
      const rect = gate.getBoundingClientRect();
      const x = 40 + Math.random() * (rect.width - 80);
      const y = rect.height - (20 + Math.random() * 80);
      makeHeart(x, y, { spread: 120, rise: 260, dur: 1600 + Math.random() * 900, size: 10 + Math.random() * 10 });
    }, 220);
  }

  function stopFloatingHearts(){
    if (!floatTimer) return;
    clearInterval(floatTimer);
    floatTimer = null;
  }

  // ✅ 핵심 변경: 클릭하면 "무조건 입장" + 그 다음 재생 시도
  gateBtn.addEventListener("click", (e) => {
    if (gateMsg) gateMsg.textContent = "";
    burstAtClientPoint(e.clientX, e.clientY);

    // 먼저 화면 전환(입장)
    setTimeout(() => hideGate(), 180);

    // 그 다음 BGM 재생 시도(유저 클릭 이벤트 안에서 호출되게 setTimeout 없이 바로도 가능)
    tryPlay({ userInitiated: true });
  });

  // 헤더 BGM 버튼
  if (headerToggle){
    headerToggle.addEventListener("click", async () => {
      if (audio.paused){
        const ok = await tryPlay({ userInitiated: true });
        if (ok) showMiniToast("BGM 재생 중 🎧");
      } else {
        stop();
        showMiniToast("BGM 정지");
      }
    });
  }

  // 다음 방문: 켜둔 기록이 있으면 게이트 없이 바로 진입 + 자동재생 '시도'
  const savedOn = localStorage.getItem(KEY) === "1";
  if (savedOn){
    hideGate();
    tryPlay({ userInitiated: false });
  } else {
    showGate();
    setHeaderUI(false);
  }

  // 탭 복귀 시 재시도
  document.addEventListener("visibilitychange", () => {
    const shouldOn = localStorage.getItem(KEY) === "1";
    if (!document.hidden && shouldOn && audio.paused) tryPlay({ userInitiated: false });
  });
})();
