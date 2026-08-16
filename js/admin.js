(function () {
  const loginView = document.getElementById("loginView");
  const dashboardView = document.getElementById("dashboardView");
  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  const loginStatus = document.getElementById("loginStatus");
  const logoutLink = document.getElementById("logoutLink");
  const listEl = document.getElementById("list");
  const tabs = document.querySelectorAll(".tab-btn");

  let activeTab = "pending";
  let allListings = [];

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  async function checkSession() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      showDashboard();
    } else {
      loginView.style.display = "block";
      dashboardView.style.display = "none";
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in…";
    loginStatus.className = "status-msg";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      loginStatus.textContent = error.message;
      loginStatus.className = "status-msg show error";
      loginBtn.disabled = false;
      loginBtn.textContent = "Log in";
      return;
    }

    showDashboard();
  });

  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    loginView.style.display = "block";
    dashboardView.style.display = "none";
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeTab = tab.dataset.tab;
      renderList();
    });
  });

  function showDashboard() {
    loginView.style.display = "none";
    dashboardView.style.display = "block";
    loadListings();
  }

  async function loadListings() {
    listEl.innerHTML = `<div class="empty-list">Loading…</div>`;
    const { data, error } = await supabaseClient
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      listEl.innerHTML = `<div class="empty-list">${escapeHtml(error.message)}</div>`;
      return;
    }

    allListings = data || [];
    renderList();
  }

  function renderList() {
    const items = allListings.filter((l) => l.status === activeTab);

    if (items.length === 0) {
      listEl.innerHTML = `<div class="empty-list">Nothing here yet.</div>`;
      return;
    }

    listEl.innerHTML = items.map(cardHtml).join("");

    items.forEach((item) => {
      const card = document.querySelector(`[data-id="${item.id}"]`);
      if (!card) return;
      card.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => handleAction(item.id, btn.dataset.action));
      });
    });
  }

  function cardHtml(item) {
    const photo = (item.photo_urls && item.photo_urls[0]) || "";
    const actions = actionButtons(item);
    return `
      <div class="admin-card" data-id="${item.id}">
        <img src="${photo}" alt="" />
        <div class="details">
          <h3>${escapeHtml(item.brand)} ${item.item_name ? "— " + escapeHtml(item.item_name) : ""}</h3>
          <p>Size ${escapeHtml(item.size || "—")} · $${Number(item.price).toFixed(0)}${item.original_price ? ` <span style="opacity:.6">(paid $${Number(item.original_price).toFixed(0)})</span>` : ""}</p>
          <p>@${escapeHtml(item.seller_ig_handle)}</p>
          <p>${escapeHtml(item.condition || "")} ${item.category ? "· " + escapeHtml(item.category) : ""}</p>
          <div class="actions">${actions}</div>
        </div>
      </div>`;
  }

  function actionButtons(item) {
    if (item.status === "pending") {
      return `
        <button class="chip-btn approve" data-action="live">Approve</button>
        <button class="chip-btn reject" data-action="rejected">Reject</button>`;
    }
    if (item.status === "live") {
      return `
        <button class="chip-btn sold" data-action="sold">Mark sold</button>
        <button class="chip-btn reject" data-action="rejected">Remove</button>`;
    }
    if (item.status === "sold") {
      return `<button class="chip-btn relist" data-action="live">Relist</button>`;
    }
    if (item.status === "rejected") {
      return `<button class="chip-btn approve" data-action="live">Approve</button>`;
    }
    return "";
  }

  async function handleAction(id, newStatus) {
    const { error } = await supabaseClient
      .from("listings")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    const item = allListings.find((l) => l.id === id);
    if (item) item.status = newStatus;
    renderList();
  }

  checkSession();
})();
