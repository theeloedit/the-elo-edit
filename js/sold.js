(function () {
  const content = document.getElementById("content");

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  const id = new URLSearchParams(window.location.search).get("id");

  async function load() {
    if (!id) {
      content.innerHTML = `<div class="empty-list">Missing link details — use the exact link you were sent.</div>`;
      return;
    }

    const { data, error } = await supabaseClient
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      content.innerHTML = `<div class="empty-list">Couldn't find that item — it may already be marked sold.</div>`;
      return;
    }

    if (data.status === "sold") {
      content.innerHTML = `<div class="empty-list">This one's already marked sold. Thanks!</div>`;
      return;
    }

    if (data.status !== "live") {
      content.innerHTML = `<div class="empty-list">This item isn't live yet, so there's nothing to update.</div>`;
      return;
    }

    const photo = (data.photo_urls && data.photo_urls[0]) || "";
    content.innerHTML = `
      <div class="admin-card">
        <img src="${photo}" alt="" />
        <div class="details">
          <h3>${escapeHtml(data.brand)} ${data.item_name ? "— " + escapeHtml(data.item_name) : ""}</h3>
          <p>Size ${escapeHtml(data.size || "—")} · $<span id="currentPrice">${Number(data.price).toFixed(0)}</span></p>
        </div>
      </div>

      <div class="field">
        <label for="newPrice">Update your price ($)</label>
        <input type="number" id="newPrice" min="1" step="1" value="${Number(data.price).toFixed(0)}" />
      </div>
      <button type="button" class="submit-btn secondary" id="savePriceBtn">Update price</button>
      <div class="status-msg" id="priceStatusMsg"></div>

      <button type="button" class="submit-btn" id="confirmBtn" style="margin-top:24px;">Yes, mark this sold</button>
      <div class="status-msg" id="statusMsg"></div>
    `;

    document.getElementById("confirmBtn").addEventListener("click", markSold);
    document.getElementById("savePriceBtn").addEventListener("click", updatePrice);
  }

  async function updatePrice() {
    const btn = document.getElementById("savePriceBtn");
    const statusMsg = document.getElementById("priceStatusMsg");
    const input = document.getElementById("newPrice");
    const newPrice = Number(input.value);

    if (!newPrice || newPrice <= 0) {
      statusMsg.textContent = "Enter a price greater than $0.";
      statusMsg.className = "status-msg show error";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Updating…";

    const { error } = await supabaseClient.rpc("update_listing_price", { listing_id: id, new_price: newPrice });

    btn.disabled = false;
    btn.textContent = "Update price";

    if (error) {
      statusMsg.textContent = error.message;
      statusMsg.className = "status-msg show error";
      return;
    }

    const currentPriceEl = document.getElementById("currentPrice");
    if (currentPriceEl) currentPriceEl.textContent = newPrice.toFixed(0);
    statusMsg.textContent = "Price updated!";
    statusMsg.className = "status-msg show success";
  }

  async function markSold() {
    const btn = document.getElementById("confirmBtn");
    const statusMsg = document.getElementById("statusMsg");
    btn.disabled = true;
    btn.textContent = "Marking sold…";

    const { error } = await supabaseClient.rpc("mark_listing_sold", { listing_id: id });

    if (error) {
      statusMsg.textContent = error.message;
      statusMsg.className = "status-msg show error";
      btn.disabled = false;
      btn.textContent = "Yes, mark this sold";
      return;
    }

    btn.style.display = "none";
    const savePriceBtn = document.getElementById("savePriceBtn");
    if (savePriceBtn) savePriceBtn.style.display = "none";
    statusMsg.textContent = "Marked as sold — it's off the site. Thanks for selling with The Elo Edit!";
    statusMsg.className = "status-msg show success";
  }

  load();
})();
