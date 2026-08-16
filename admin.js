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
  const TAG_OPTIONS = ["Bridal", "Wedding Guest", "Vacation", "Accessories", "Ready to Wear", "Shoes"];

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

      card.querySelectorAll("[data-tag]").forEach((btn) => {
        btn.addEventListener("click", () => toggleTag(item.id, btn.dataset.tag));
      });

      const scheduleInput = card.querySelector(".schedule-input");
      card.querySelectorAll("[data-schedule]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!scheduleInput) return;
          if (btn.dataset.schedule === "now") {
            scheduleInput.value = toDatetimeLocalValue(new Date());
          } else if (btn.dataset.schedule === "mon") {
            scheduleInput.value = toDatetimeLocalValue(nextWeekday(1, 9));
          } else if (btn.dataset.schedule === "thu") {
            scheduleInput.value = toDatetimeLocalValue(nextWeekday(4, 9));
          }
        });
      });

      const approveBtn = card.querySelector("[data-approve]");
      if (approveBtn) {
        approveBtn.addEventListener("click", () => {
          const goLiveAt = scheduleInput ? new Date(scheduleInput.value).toISOString() : new Date().toISOString();
          approveWithSchedule(item.id, goLiveAt);
        });
      }

      const copyBtn = card.querySelector("[data-copy-dm]");
      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(dmMessageFor(item));
            const original = copyBtn.textContent;
            copyBtn.textContent = "Copied!";
            setTimeout(() => { copyBtn.textContent = original; }, 1500);
          } catch (e) {
            alert(dmMessageFor(item));
          }
        });
      }

      const dmToggleBtn = card.querySelector("[data-dm-toggle]");
      if (dmToggleBtn) {
        dmToggleBtn.addEventListener("click", () => toggleDmSent(item.id));
      }

      renderAdminPhotos(item.id);
    });
  }

  // ---------- manual "add a listing" panel ----------

  const addListingToggle = document.getElementById("addListingToggle");
  const addListingPanel = document.getElementById("addListingPanel");
  const addListingSubmit = document.getElementById("addListingSubmit");
  const addListingStatus = document.getElementById("addListingStatus");

  addListingToggle.addEventListener("click", () => {
    const showing = addListingPanel.style.display !== "none";
    addListingPanel.style.display = showing ? "none" : "block";
    addListingToggle.textContent = showing ? "+ Add a listing manually" : "− Hide add listing form";
  });

  addListingSubmit.addEventListener("click", async () => {
    addListingStatus.className = "status-msg";

    const photoFiles = document.getElementById("alPhotos").files;
    const brand = document.getElementById("alBrand").value.trim();
    const itemName = document.getElementById("alItemName").value.trim();
    const size = document.getElementById("alSize").value.trim();
    const price = document.getElementById("alPrice").value;
    const originalPrice = document.getElementById("alOriginalPrice").value;
    const condition = document.getElementById("alCondition").value;
    const category = document.getElementById("alCategory").value;
    const description = document.getElementById("alDescription").value.trim();
    const seller = document.getElementById("alSeller").value.trim().replace(/^@/, "");

    if (!brand || !size || !price || !seller || photoFiles.length === 0) {
      addListingStatus.textContent = "Please fill in photos, brand, size, price, and seller handle — those are required.";
      addListingStatus.className = "status-msg show error";
      return;
    }

    addListingSubmit.disabled = true;
    addListingSubmit.textContent = "Adding…";

    try {
      const photo_urls = [];
      for (const file of photoFiles) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabaseClient.storage
          .from("listing-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        const { data } = supabaseClient.storage.from("listing-photos").getPublicUrl(path);
        photo_urls.push(data.publicUrl);
      }

      const { error: insertError } = await supabaseClient.from("listings").insert({
        brand,
        item_name: itemName || null,
        size,
        price: Number(price),
        original_price: originalPrice ? Number(originalPrice) : null,
        condition: condition || null,
        category: category || null,
        description: description || null,
        seller_ig_handle: seller,
        photo_urls,
        status: "pending",
      });
      if (insertError) throw insertError;

      addListingStatus.textContent = "Added — check the Pending tab below.";
      addListingStatus.className = "status-msg show success";

      ["alBrand","alItemName","alSize","alPrice","alOriginalPrice","alCondition","alCategory","alDescription","alSeller"]
        .forEach((id) => { document.getElementById(id).value = ""; });
      document.getElementById("alPhotos").value = "";

      await loadListings();
    } catch (err) {
      addListingStatus.textContent = err.message || "Something went wrong.";
      addListingStatus.className = "status-msg show error";
    } finally {
      addListingSubmit.disabled = false;
      addListingSubmit.textContent = "Add to Pending";
    }
  });

  // ---------- photo management ----------

  function renderAdminPhotos(itemId) {
    const item = allListings.find((l) => l.id === itemId);
    if (!item) return;
    const el = document.getElementById(`admin-photos-${itemId}`);
    if (!el) return;

    const photos = item.photo_urls || [];
    el.innerHTML = photos.map((url, idx) => `
      <div class="admin-photo-thumb ${idx === 0 ? "primary" : ""}" data-idx="${idx}">
        <img src="${url}" />
        ${idx === 0
          ? `<span class="primary-badge">Primary</span>`
          : `<button type="button" class="set-primary-btn" data-set-primary="${idx}">Set primary</button>`}
        <button type="button" class="remove-photo-btn" data-remove-photo="${idx}">&times;</button>
      </div>
    `).join("") + `
      <label class="admin-add-photo-tile">
        + Add
        <input type="file" accept="image/*" multiple class="admin-add-photo-input" data-add-photo="1" />
      </label>
    `;

    el.querySelectorAll("[data-set-primary]").forEach((btn) => {
      btn.addEventListener("click", () => setPrimaryPhoto(itemId, Number(btn.dataset.setPrimary)));
    });
    el.querySelectorAll("[data-remove-photo]").forEach((btn) => {
      btn.addEventListener("click", () => removePhoto(itemId, Number(btn.dataset.removePhoto)));
    });
    const addInput = el.querySelector("[data-add-photo]");
    if (addInput) {
      addInput.addEventListener("change", (e) => addPhotos(itemId, Array.from(e.target.files || [])));
    }
  }

  async function savePhotoUrls(itemId, photo_urls) {
    const item = allListings.find((l) => l.id === itemId);
    if (item) item.photo_urls = photo_urls;

    const { error } = await supabaseClient
      .from("listings")
      .update({ photo_urls })
      .eq("id", itemId);

    if (error) {
      alert(error.message);
      return false;
    }
    return true;
  }

  async function setPrimaryPhoto(itemId, idx) {
    const item = allListings.find((l) => l.id === itemId);
    if (!item) return;
    const photos = [...(item.photo_urls || [])];
    const [chosen] = photos.splice(idx, 1);
    photos.unshift(chosen);
    await savePhotoUrls(itemId, photos);
    renderAdminPhotos(itemId);
  }

  async function removePhoto(itemId, idx) {
    const item = allListings.find((l) => l.id === itemId);
    if (!item) return;
    const photos = [...(item.photo_urls || [])];
    photos.splice(idx, 1);
    await savePhotoUrls(itemId, photos);
    renderAdminPhotos(itemId);
  }

  async function addPhotos(itemId, files) {
    const item = allListings.find((l) => l.id === itemId);
    if (!item || files.length === 0) return;

    const photos = [...(item.photo_urls || [])];
    for (const file of files) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabaseClient.storage
        .from("listing-photos")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) {
        alert(error.message);
        continue;
      }
      const { data } = supabaseClient.storage.from("listing-photos").getPublicUrl(path);
      photos.push(data.publicUrl);
    }
    await savePhotoUrls(itemId, photos);
    renderAdminPhotos(itemId);
  }

  // ---------- scheduling helpers ----------

  function toDatetimeLocalValue(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function nextWeekday(targetDay, hour) {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(hour, 0);
    const diff = (targetDay - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    if (diff === 0 && new Date() > d) d.setDate(d.getDate() + 7);
    return d;
  }

  function defaultScheduleValue() {
    const nextMon = nextWeekday(1, 9);
    const nextThu = nextWeekday(4, 9);
    const soonest = nextMon < nextThu ? nextMon : nextThu;
    return toDatetimeLocalValue(soonest);
  }

  function formatGoLive(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
      ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  // ---------- DM helpers ----------

  function soldLink(item) {
    return `${window.location.origin}/sold.html?id=${item.id}`;
  }

  function dmMessageFor(item) {
    const when = item.go_live_at ? formatGoLive(item.go_live_at) : "our next drop";
    return `Hey! Your ${item.brand}${item.item_name ? " " + item.item_name : ""} was chosen for our next drop — going live ${when}. Look out for DMs! Once it sells, you can mark it sold yourself here: ${soldLink(item)}`;
  }

  function copyDmHtml(item) {
    if (item.status !== "live") return "";
    return `<button type="button" class="chip-btn" data-copy-dm="1" style="background:var(--ink); color:#fff;">Copy DM message</button>`;
  }

  function dmToggleHtml(item) {
    if (item.status !== "live") return "";
    return `<button type="button" class="tag-chip dm-toggle ${item.dm_sent ? "active" : ""}" data-dm-toggle="1">${item.dm_sent ? "✓ DM'ed" : "Mark as DM'ed"}</button>`;
  }

  // ---------- tags ----------

  function tagChipsHtml(item) {
    const tags = item.tags || [];
    return `<div class="tag-chips">${TAG_OPTIONS.map((t) => `<button type="button" class="tag-chip ${tags.includes(t) ? "active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("")}</div>`;
  }

  // ---------- status / schedule UI ----------

  function liveStatusBadgeHtml(item) {
    if (item.status !== "live") return "";
    const isFuture = item.go_live_at && new Date(item.go_live_at) > new Date();
    return isFuture
      ? `<span class="status-badge scheduled">Scheduled — goes live ${formatGoLive(item.go_live_at)}</span>`
      : `<span class="status-badge live-now">Live now</span>`;
  }

  function scheduleControlsHtml(item) {
    return `
      <div class="schedule-block">
        <div class="actions" style="margin-top:0;">
          <button type="button" class="chip-btn" data-schedule="now">Now</button>
          <button type="button" class="chip-btn" data-schedule="mon">Next Mon 9am</button>
          <button type="button" class="chip-btn" data-schedule="thu">Next Thu 9am</button>
        </div>
        <input type="datetime-local" class="schedule-input" value="${defaultScheduleValue()}" />
      </div>`;
  }

  function cardHtml(item) {
    const isPending = item.status === "pending";
    const actions = actionButtons(item);
    return `
      <div class="admin-card" data-id="${item.id}">
        <div class="admin-photos" id="admin-photos-${item.id}"></div>
        <div class="details">
          <h3>${escapeHtml(item.brand)} ${item.item_name ? "— " + escapeHtml(item.item_name) : ""}</h3>
          <p>Size ${escapeHtml(item.size || "—")} · $${Number(item.price).toFixed(0)}${item.original_price ? ` <span style="opacity:.6">(paid $${Number(item.original_price).toFixed(0)})</span>` : ""}</p>
          <p>@${escapeHtml(item.seller_ig_handle)}</p>
          <p>${escapeHtml(item.condition || "")} ${item.category ? "· " + escapeHtml(item.category) : ""}</p>
          ${tagChipsHtml(item)}
          ${liveStatusBadgeHtml(item)}
          ${isPending ? scheduleControlsHtml(item) : ""}
          <div class="actions">${actions}${copyDmHtml(item)}${dmToggleHtml(item)}</div>
        </div>
      </div>`;
  }

  function actionButtons(item) {
    if (item.status === "pending") {
      return `
        <button class="chip-btn approve" data-approve="1">Approve for this date</button>
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

  async function approveWithSchedule(id, goLiveAtISO) {
    const { error } = await supabaseClient
      .from("listings")
      .update({ status: "live", go_live_at: goLiveAtISO })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    const item = allListings.find((l) => l.id === id);
    if (item) {
      item.status = "live";
      item.go_live_at = goLiveAtISO;
    }
    renderList();
  }

  async function toggleTag(id, tag) {
    const item = allListings.find((l) => l.id === id);
    if (!item) return;
    const current = item.tags || [];
    const nextTags = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];

    const { error } = await supabaseClient
      .from("listings")
      .update({ tags: nextTags })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    item.tags = nextTags;
    renderList();
  }

  async function toggleDmSent(id) {
    const item = allListings.find((l) => l.id === id);
    if (!item) return;
    const nextValue = !item.dm_sent;

    const { error } = await supabaseClient
      .from("listings")
      .update({ dm_sent: nextValue })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    item.dm_sent = nextValue;
    renderList();
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
