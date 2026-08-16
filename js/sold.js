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
      content.innerHTML = `<div class="empty-list">This item isn't live yet, so there's nothing to mark sold.</div>`;
      return;
    }

    const photo = (data.photo_urls && data.photo_urls[0]) || "";
    content.innerHTML = `
      <div class="admin-card">
        <img src="${photo}" alt="" />
        <div class="details">
          <h3>${escapeHtml(data.brand)} ${data.item_name ? "— " + escapeHtml(data.item_name) : ""}</h3>
          <p>Size ${escapeHtml(data.size || "—")} · $${Number(data.price).toFixed(0)}</p>
        </div>
      </div>
      <button type="button" class="submit-btn" id="soldEloBtn">Sold through The Elo Edit</button>
      <button type="button" class="submit-btn secondary" id="soldElsewhereBtn">Sold elsewhere</button>
      <div class="status-msg" id="statusMsg"></div>
    `;

    document.getElementById("soldEloBtn").addEventListener("click", () => markSold("elo_edit"));
    document.getElementById("soldElsewhereBtn").addEventListener("click", () => markSold("elsewhere"));
  }

  async function markSold(channel) {
    const eloBtn = document.getElementById("soldEloBtn");
    const elsewhereBtn = document.getElementById("soldElsewhereBtn");
    const statusMsg = document.getElementById("statusMsg");
    const clickedBtn = channel === "elo_edit" ? eloBtn : elsewhereBtn;
    const originalText = clickedBtn.textContent;

    eloBtn.disabled = true;
    elsewhereBtn.disabled = true;
    clickedBtn.textContent = "Marking sold…";

    const { error } = await supabaseClient.rpc("mark_listing_sold", { listing_id: id, p_channel: channel });

    if (error) {
      statusMsg.textContent = error.message;
      statusMsg.className = "status-msg show error";
      eloBtn.disabled = false;
      elsewhereBtn.disabled = false;
      clickedBtn.textContent = originalText;
      return;
    }

    eloBtn.style.display = "none";
    elsewhereBtn.style.display = "none";
    statusMsg.textContent = "Marked as sold — it's off the site. Thanks for selling with The Elo Edit!";
    statusMsg.className = "status-msg show success";
  }

  load();
})();
