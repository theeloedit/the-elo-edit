(async function () {
  const app = document.getElementById("app");
  let listings = [];
  let current = 0;
  let currentPhoto = 0;

  function igDmUrl(handle) {
    const clean = (handle || "").trim().replace(/^@/, "");
    return `https://ig.me/m/${encodeURIComponent(clean)}`;
  }

  function render() {
    if (listings.length === 0) {
      app.innerHTML = `
        <div class="empty-state">
          <h2>No new drops right now</h2>
          <p>Check back soon — new pieces go up Mondays &amp; Thursdays.</p>
          <div class="nav-links"><a href="shop.html">Shop everything available</a> &nbsp;·&nbsp; <a href="submit.html">Have something to sell?</a></div>
        </div>`;
      return;
    }

    const segs = listings
      .map((_, i) => `<div class="progress-seg ${i < current ? "done" : ""}"><div class="fill" style="width:${i <= current ? "100%" : "0%"}"></div></div>`)
      .join("");

    const cards = listings
      .map((item, i) => {
        const photos = (item.photo_urls && item.photo_urls.length ? item.photo_urls : [""]);
        const photoIdx = i === current ? Math.min(currentPhoto, photos.length - 1) : 0;
        const photo = photos[photoIdx];
        const meta = [item.size, item.condition, item.category].filter(Boolean);
        const dots = photos.length > 1
          ? `<div class="photo-dots">${photos.map((_, p) => `<div class="dot ${p === photoIdx ? "active" : ""}" data-photo-idx="${p}"></div>`).join("")}</div>`
          : "";
        return `
        <div class="story-card ${i === current ? "active" : ""}" data-index="${i}">
          <img class="story-photo" src="${photo}" alt="${escapeHtml(item.brand)}" />
          ${dots}
          <div class="story-info">
            <p class="brand">${escapeHtml(item.brand)}</p>
            ${item.item_name ? `<p class="item-name">${escapeHtml(item.item_name)}</p>` : ""}
            <div class="story-meta">${meta.map((m) => `<span>${escapeHtml(m)}</span>`).join("")}</div>
            <div class="story-price">$${Number(item.price).toFixed(0)}${item.original_price ? ` <span class="orig-price">originally $${Number(item.original_price).toFixed(0)}</span>` : ""}</div>
            <a class="buy-btn" target="_blank" rel="noopener" href="${igDmUrl(item.seller_ig_handle)}">Buy — DM seller</a>
          </div>
        </div>`;
      })
      .join("");

    app.innerHTML = `
      <div class="progress-track">${segs}</div>
      <div class="brand-bar"><span class="brand-name">The Elo Edit</span><a class="shop-link" href="shop.html">Shop all</a></div>
      <div class="card-stack">${cards}</div>
      <div class="tap-zone left" id="tapLeft"></div>
      <div class="tap-zone right" id="tapRight"></div>
    `;

    document.getElementById("tapLeft").addEventListener("click", () => go(-1));
    document.getElementById("tapRight").addEventListener("click", () => go(1));

    app.querySelectorAll(".dot[data-photo-idx]").forEach((dot) => {
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        currentPhoto = Number(dot.dataset.photoIdx);
        render();
      });
    });
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function go(dir) {
    const next = current + dir;
    if (next < 0 || next >= listings.length) return;
    current = next;
    currentPhoto = 0;
    render();
  }

  function cyclePhoto(dir) {
    const photos = listings[current].photo_urls || [];
    const next = currentPhoto + dir;
    if (next < 0 || next >= photos.length) return;
    currentPhoto = next;
    render();
  }

  function attachSwipe(el) {
    let startX = 0, startY = 0;
    el.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        go(dx < 0 ? 1 : -1);
      } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
        cyclePhoto(dy > 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  function getRequestedItemId() {
    return new URLSearchParams(window.location.search).get("item");
  }

  async function load() {
    const { data, error } = await supabaseClient
      .from("listings")
      .select("*")
      .eq("status", "live")
      .order("created_at", { ascending: false });

    if (error) {
      app.innerHTML = `<div class="empty-state"><h2>Something went wrong</h2><p>${escapeHtml(error.message)}</p></div>`;
      return;
    }

    listings = data || [];

    const requestedId = getRequestedItemId();
    if (requestedId) {
      const idx = listings.findIndex((l) => l.id === requestedId);
      if (idx !== -1) current = idx;
    }

    render();
  }

  attachSwipe(app);
  load();
})();
