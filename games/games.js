"use strict";

(async function () {
  const API_URL = "/api/games.json";

  const elQ = document.getElementById("q");
  const elClearQ = document.getElementById("clearQ");
  const elCount = document.getElementById("count");
  const elUpdated = document.getElementById("updated");
  const elTags = document.querySelector(".pgTagRow");
  const elGrid = document.getElementById("grid");
  const elLoading = document.getElementById("loading");
  const elEmpty = document.getElementById("empty");

  const resetBtn = document.getElementById("resetFilters");
  const segBtns = Array.from(document.querySelectorAll(".segBtn"));

  let data = null;
  let activeCat = "all";
  let activeTag = null;

  function fmtUpdated(iso) {
    try {
      const d = new Date(iso);
      if (!isFinite(d.getTime())) return "";
      // Keep it simple / stable for users
      return "Updated: " + d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }

  function estTimeLabel(sec) {
    const s = Number(sec || 0);
    if (!s) return null;
    if (s < 60) return "~1 min";
    const m = Math.round(s / 60);
    return "~" + m + " min";
  }

  function catLabel(cat) {
    if (cat === "daily") return "Daily";
    if (cat === "quick") return "Quick";
    if (cat === "skills") return "Skills";
    if (cat === "soon") return "Soon";
    return cat || "";
  }

  function iconUrlFor(game) {
    // Prefer known logo mapping, fall back to generic sigma
    const base = "https://numberglyph.com/logos/";
    const map = {
      numberglyph: base + "numberglyph.svg",
      opglyph: base + "opglyph.svg",
      hieroglyph: base + "hieroglyph.svg",
      connectglyph: base + "connectglyph.svg",
      focusglyph: base + "focusglyph.svg",
      memoryglyph: base + "memoryglyph.svg",
      multiglyph: base + "multiglyph.svg"
    };
    return map[game.slug] || "https://numberglyph.com/logo-sigma.png";
  }

  function catOrder(cat) {
    // sort order for rendering
    if (cat === "daily") return 1;
    if (cat === "quick") return 2;
    if (cat === "skills") return 3;
    if (cat === "soon") return 4;
    return 99;
  }

  function normalize(s) {
    return String(s || "").toLowerCase().trim();
  }

  function gameMatches(game, q) {
    if (!q) return true;
    const hay = [
      game.name,
      game.slug,
      game.category,
      (game.tags || []).join(" "),
      game.description
    ].join(" ");
    return normalize(hay).includes(normalize(q));
  }

  function buildTagButtons(allTags) {
    if (!elTags) return;
    elTags.innerHTML = "";
    allTags.forEach(tag => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pgTag";
      b.textContent = tag;
      b.dataset.tag = tag;
      b.addEventListener("click", () => {
        activeTag = (activeTag === tag) ? null : tag;
        render();
      });
      elTags.appendChild(b);
    });
  }

  function syncTagUI() {
    if (!elTags) return;
    elTags.querySelectorAll(".pgTag").forEach(btn => {
      btn.classList.toggle("on", btn.dataset.tag === activeTag);
    });
  }

  function syncCatUI() {
    segBtns.forEach(b => b.classList.toggle("on", b.dataset.cat === activeCat));
  }

  function cardHTML(game) {
    const barClass = game.category || "";
    const timeLabel = estTimeLabel(game.time_to_play_sec);
    const modes = Array.isArray(game.modes) ? game.modes.filter(Boolean) : [];
    const isSoon = game.category === "soon" || !game.url_play;

    const playHref = game.url_play || "#";
    const guideHref = game.url_guide || "";

    const meta = [];
    meta.push(catLabel(game.category));
    if (timeLabel) meta.push(timeLabel);
    if (modes.length) meta.push("Modes: " + modes.join(" • "));

    const tags = Array.isArray(game.tags) ? game.tags.slice(0, 4) : [];

    return `
      <article class="pgCard">
        <div class="pgCardBar ${barClass}"></div>
        <div class="pgCardTop">
          <div class="pgCardTitleRow">
            <div class="pgCardIcon">
              <img src="${iconUrlFor(game)}" alt="" loading="lazy" decoding="async" />
            </div>
            <div style="min-width:0">
              <div class="pgCardTitle">${escapeHTML(game.name)}</div>
              <div class="pgCardSub">${escapeHTML(game.short || game.subtitle || (tags.join(" • ") || " "))}</div>
            </div>
          </div>
        </div>

        <div class="pgCardBody">
          <p class="pgCardDesc">${escapeHTML(game.description || "")}</p>

          <div class="pgCardMeta">
            ${meta.map(x => `<span class="pgPill">${escapeHTML(x)}</span>`).join("")}
          </div>

          <div class="pgCardActions">
            ${
              isSoon
                ? `<span class="pgBtn primary disabled" aria-disabled="true">Coming soon</span>`
                : `<a class="pgBtn primary" href="${playHref}" target="_blank" rel="noopener">Play</a>`
            }
            ${
              guideHref
                ? `<a class="pgBtn" href="${guideHref}" target="_blank" rel="noopener">How to play</a>`
                : ``
            }
          </div>
        </div>
      </article>
    `;
  }

  function escapeHTML(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render() {
    if (!data) return;

    const q = (elQ && elQ.value) ? elQ.value.trim() : "";

    const games = (data.games || [])
      .slice()
      .sort((a, b) => {
        const ca = catOrder(a.category);
        const cb = catOrder(b.category);
        if (ca !== cb) return ca - cb;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    let filtered = games.filter(g => {
      if (activeCat !== "all" && g.category !== activeCat) return false;
      if (activeTag && !(g.tags || []).includes(activeTag)) return false;
      if (!gameMatches(g, q)) return false;
      return true;
    });

    // UI counts + updated
    if (elCount) elCount.textContent = `${filtered.length} game${filtered.length === 1 ? "" : "s"}`;
    if (elUpdated) elUpdated.textContent = data.updated_utc ? fmtUpdated(data.updated_utc) : "";

    syncCatUI();
    syncTagUI();

    // Results
    if (elGrid) {
      elGrid.innerHTML = filtered.map(cardHTML).join("");
      elGrid.hidden = filtered.length === 0;
    }
    if (elEmpty) elEmpty.hidden = filtered.length !== 0;
  }

  function resetFilters() {
    activeCat = "all";
    activeTag = null;
    if (elQ) elQ.value = "";
    render();
  }

  // Wire controls
  segBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      activeCat = btn.dataset.cat || "all";
      render();
    });
  });

  elQ && elQ.addEventListener("input", () => render());
  elClearQ && elClearQ.addEventListener("click", () => { if (elQ) elQ.value = ""; render(); elQ && elQ.focus(); });
  resetBtn && resetBtn.addEventListener("click", resetFilters);

  // Load
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    data = await res.json();

    // Build tag buttons from your declared tags (or derive)
    const tags = Array.isArray(data.tags) && data.tags.length
      ? data.tags
      : Array.from(new Set((data.games || []).flatMap(g => g.tags || []))).sort();

    buildTagButtons(tags);

    if (elLoading) elLoading.hidden = true;
    if (elGrid) elGrid.hidden = false;

    render();
  } catch (e) {
    if (elLoading) elLoading.textContent = "Could not load games.json.";
    console.error(e);
  }
})();



