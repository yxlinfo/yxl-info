(function dashboardTabs(){
  const tabs = Array.from(document.querySelectorAll(".dash-tab"));
  const panels = Array.from(document.querySelectorAll(".dash-panel"));
  if (!tabs.length || !panels.length) return;

  function activate(targetId, { pushHash = true } = {}) {
    tabs.forEach(btn => {
      const on = btn.dataset.target === targetId;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    panels.forEach(p => {
      const on = p.id === targetId;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });

    if (pushHash) {
      const url = new URL(location.href);
      url.hash = `dash=${encodeURIComponent(targetId)}`;
      history.replaceState(null, "", url.toString());
    }

    try { localStorage.setItem("yxl_dash", targetId); } catch(e) {}
  }

  tabs.forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.target)));

  const hash = (location.hash || "").replace("#", "");
  const hashTarget = hash.startsWith("dash=") ? decodeURIComponent(hash.slice(5)) : null;

  let initial = hashTarget;
  if (!initial) {
    try { initial = localStorage.getItem("yxl_dash"); } catch(e) {}
  }
  if (!initial || !document.getElementById(initial)) initial = tabs[0].dataset.target;

  activate(initial, { pushHash: true });
})();
