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
  let dmFilter = "all";
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
    let items = allListings.filter((l) => l.status === activeTab);
    if (activeTab === "live" && dmFilter !== "all") {
      items = items.filter((l) => (dmFilter === "dmed" ? l.dm_sent : !l.dm_sent));
    }

    const dmFilterHtml = activeTab === "live" ? `
      <div class="dm-filter-bar">
        <button type="button" class="filter-chip ${dmFilter === "all" ? "active" : ""}" data-dm-filter="all">All</button>
        <button type="button" class="filter-chip ${dmFilter === "dmed" ? "active" : ""}" data-dm-filter="dmed">DM'ed</button>
        <button type="button" class="filter-chip ${dmFilter === "not-dmed" ? "active" : ""}" data-dm-filter="not-dmed">Not DM'ed</button>
      </div>` : "";

    if (items.length === 0) {
      listEl.innerHTML = dmFilterHtml + `<div class="empty-list">Nothing here yet.</div>`;
    } else {
      listEl.innerHTML = dmFilterHtml + items.map(cardHtml).join("");
    }

    listEl.querySelectorAll("[data-dm-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        dmFilter = btn.dataset.dmFilter;
        renderList();
      });
    });

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
            scheduleInput.value = toDatetimeLocalValue(nextWeekday(1, 20));
          } else if (btn.dataset.schedule === "thu") {
            scheduleInput.value = toDatetimeLocalValue(nextWeekday(4, 20));
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

      card.querySelectorAll("[data-move]").forEach((btn) => {
        btn.addEventListener("click", () => moveItem(item.id, btn.dataset.move === "up" ? -1 : 1));
      });

      const storyBtn = card.querySelector("[data-story]");
      if (storyBtn) {
        storyBtn.addEventListener("click", async () => {
          const original = storyBtn.textContent;
          storyBtn.disabled = true;
          storyBtn.textContent = "Building…";
          try {
            await generateStoryImage(item);
          } catch (e) {
            alert("Couldn't generate the story image. " + (e && e.message ? e.message : ""));
          } finally {
            storyBtn.disabled = false;
            storyBtn.textContent = original;
          }
        });
      }

      const editToggleBtn = card.querySelector("[data-edit-toggle]");
      const editBlock = document.getElementById(`edit-${item.id}`);
      if (editToggleBtn && editBlock) {
        editToggleBtn.addEventListener("click", () => {
          editBlock.style.display = editBlock.style.display === "none" ? "block" : "none";
        });
      }
      const cancelEditBtn = card.querySelector("[data-cancel-edit]");
      if (cancelEditBtn && editBlock) {
        cancelEditBtn.addEventListener("click", () => { editBlock.style.display = "none"; });
      }
      const saveEditBtn = card.querySelector("[data-save-edit]");
      if (saveEditBtn) {
        saveEditBtn.addEventListener("click", () => saveListingDetails(item.id));
      }

      renderAdminPhotos(item.id);
    });
  }

  // ---------- manual ranking (shop grid + drops feed order) ----------

  function sortLiveItems(a, b) {
    const aHas = a.sort_order != null;
    const bHas = b.sort_order != null;
    if (aHas && bHas) return a.sort_order - b.sort_order;
    if (aHas) return -1;
    if (bHas) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  }

  async function moveItem(id, direction) {
    const liveItems = allListings.filter((l) => l.status === "live").sort(sortLiveItems);
    const idx = liveItems.findIndex((l) => l.id === id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= liveItems.length) return;

    const reordered = [...liveItems];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    for (let i = 0; i < reordered.length; i++) {
      const newOrder = i + 1;
      if (reordered[i].sort_order !== newOrder) {
        reordered[i].sort_order = newOrder;
        await supabaseClient.from("listings").update({ sort_order: newOrder }).eq("id", reordered[i].id);
      }
    }
    renderList();
  }

  // ---------- Instagram story graphic ----------

  function loadImageEl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Photo failed to load."));
      img.src = src;
    });
  }

  function drawCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sx, sy, sw, sh;
    if (imgRatio > boxRatio) {
      sh = img.height;
      sw = sh * boxRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / boxRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text || "").split(" ");
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawDottedLine(ctx, x1, y1, x2, y2, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 8]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  async function generateStoryImage(item) {
    const W = 1080, H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    const CREAM = "#eae1c8";
    const BROWN = "#5c4a30";
    const OXBLOOD = "#6d2323";
    const PLACEHOLDER = "#d8cba9";

    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, W, H);

    try {
      await Promise.all([
        document.fonts.load("italic 500 90px 'Cormorant Garamond'"),
        document.fonts.load("600 92px 'Cormorant Garamond'"),
        document.fonts.load("italic 500 54px 'Cormorant Garamond'"),
        document.fonts.load("500 48px 'Cormorant Garamond'"),
        document.fonts.load("600 48px 'Cormorant Garamond'"),
        document.fonts.load("400 40px 'Cormorant Garamond'"),
      ]);
      await document.fonts.ready;
    } catch (e) {
      // fonts best-effort — canvas falls back to system serif if unavailable
    }

    ctx.textAlign = "center";
    ctx.fillStyle = OXBLOOD;
    ctx.font = "italic 500 90px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText("elo", W / 2, 150);

    const photos = (item.photo_urls || []).slice(0, 3);
    const photoColX = 650;
    const photoColW = 360;
    const photoTop = 280;
    const photoBottom = 1840;
    const gap = 20;
    const count = Math.max(photos.length, 1);
    const eachH = (photoBottom - photoTop - gap * (count - 1)) / count;

    if (photos.length === 0) {
      ctx.fillStyle = PLACEHOLDER;
      ctx.fillRect(photoColX, photoTop, photoColW, photoBottom - photoTop);
    } else {
      for (let i = 0; i < photos.length; i++) {
        const py = photoTop + i * (eachH + gap);
        try {
          const img = await loadImageEl(photos[i]);
          drawCover(ctx, img, photoColX, py, photoColW, eachH);
        } catch (e) {
          ctx.fillStyle = PLACEHOLDER;
          ctx.fillRect(photoColX, py, photoColW, eachH);
        }
      }
    }

    const padX = 70;
    const textColW = 560;
    ctx.textAlign = "left";
    ctx.fillStyle = BROWN;

    let y = 400;

    ctx.font = "600 92px 'Cormorant Garamond', Georgia, serif";
    wrapText(ctx, item.brand || "", textColW).forEach((line) => {
      ctx.fillText(line, padX, y);
      y += 105;
    });

    if (item.item_name) {
      y += 10;
      ctx.font = "italic 500 54px 'Cormorant Garamond', Georgia, serif";
      ctx.fillText(item.item_name, padX, y);
      y += 90;
    } else {
      y += 20;
    }

    ctx.font = "500 48px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText(`Size: ${item.size || "—"}`, padX, y);
    y += 72;
    ctx.fillText(`Price: $${Number(item.price).toFixed(0)}`, padX, y);
    y += 72;
    if (item.original_price) {
      ctx.fillText(`Paid: $${Number(item.original_price).toFixed(0)}`, padX, y);
      y += 72;
    }

    y += 30;
    drawDottedLine(ctx, padX, y, padX + textColW, y, BROWN);
    y += 70;

    const noteText = item.description || item.condition || "";
    if (noteText) {
      ctx.font = "600 48px 'Cormorant Garamond', Georgia, serif";
      ctx.fillText("Notes:", padX, y);
      y += 60;
      ctx.font = "400 40px 'Cormorant Garamond', Georgia, serif";
      wrapText(ctx, noteText, textColW).slice(0, 3).forEach((line) => {
        ctx.fillText(line, padX, y);
        y += 52;
      });
      y += 20;
    }

    drawDottedLine(ctx, padX, y, padX + textColW, y, BROWN);
    y += 70;

    ctx.font = "500 48px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText(item.seller_ig_handle ? `Seller: @${item.seller_ig_handle}` : "Seller:", padX, y);

    const dataUrl = canvas.toDataURL("image/png");
    const safeName = (item.brand || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `elo-story-${safeName}-${item.id.slice(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // ---------- edit listing details ----------

  function editBlockHtml(item) {
    return `
      <div class="edit-block" id="edit-${item.id}" style="display:none; margin-top:10px; padding-top:10px; border-top:1px solid var(--line);">
        <div class="field">
          <label>Brand</label>
          <input type="text" class="ed-brand" value="${escapeHtml(item.brand)}" />
        </div>
        <div class="field">
          <label>Item name</label>
          <input type="text" class="ed-item-name" value="${escapeHtml(item.item_name || "")}" />
        </div>
        <div class="two-col">
          <div class="field">
            <label>Size</label>
            <input type="text" class="ed-size" value="${escapeHtml(item.size || "")}" />
          </div>
          <div class="field">
            <label>Sell price ($)</label>
            <input type="number" class="ed-price" value="${item.price}" />
          </div>
        </div>
        <div class="two-col">
          <div class="field">
            <label>What was paid ($)</label>
            <input type="number" class="ed-original-price" value="${item.original_price != null ? item.original_price : ""}" />
          </div>
          <div class="field">
            <label>Condition</label>
            <input type="text" class="ed-condition" value="${escapeHtml(item.condition || "")}" />
          </div>
        </div>
        <div class="field">
          <label>Category</label>
          <input type="text" class="ed-category" value="${escapeHtml(item.category || "")}" />
        </div>
        <div class="field">
          <label>Description</label>
          <textarea class="ed-description">${escapeHtml(item.description || "")}</textarea>
        </div>
        <div class="field">
          <label>Seller's Instagram handle</label>
          <input type="text" class="ed-seller" value="${escapeHtml(item.seller_ig_handle)}" />
        </div>
        <div class="actions">
          <button type="button" class="chip-btn approve" data-save-edit="1">Save changes</button>
          <button type="button" class="chip-btn" data-cancel-edit="1">Cancel</button>
        </div>
      </div>`;
  }

  async function saveListingDetails(id) {
    const card = document.querySelector(`[data-id="${id}"]`);
    if (!card) return;

    const price = card.querySelector(".ed-price").value;
    const originalPrice = card.querySelector(".ed-original-price").value;
    const brand = card.querySelector(".ed-brand").value.trim();
    const size = card.querySelector(".ed-size").value.trim();
    const seller = card.querySelector(".ed-seller").value.trim().replace(/^@/, "");

    if (!brand || !size || !price || !seller) {
      alert("Brand, size, price, and seller handle can't be empty.");
      return;
    }

    const updates = {
      brand,
      item_name: card.querySelector(".ed-item-name").value.trim() || null,
      size,
      price: Number(price),
      original_price: originalPrice ? Number(originalPrice) : null,
      condition: card.querySelector(".ed-condition").value.trim() || null,
      category: card.querySelector(".ed-category").value.trim() || null,
      description: card.querySelector(".ed-description").value.trim() || null,
      seller_ig_handle: seller,
    };

    const { error } = await supabaseClient.from("listings").update(updates).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    const item = allListings.find((l) => l.id === id);
    if (item) Object.assign(item, updates);
    renderList();
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
    const nextMon = nextWeekday(1, 20);
    const nextThu = nextWeekday(4, 20);
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
          <button type="button" class="chip-btn" data-schedule="mon">Next Mon 8pm</button>
          <button type="button" class="chip-btn" data-schedule="thu">Next Thu 8pm</button>
        </div>
        <input type="datetime-local" class="schedule-input" value="${defaultScheduleValue()}" />
      </div>`;
  }

  function moveControlsHtml(item) {
    if (item.status !== "live" || dmFilter !== "all") return "";
    return `
      <div class="move-controls">
        <button type="button" class="filter-chip" data-move="up">&uarr; Move up</button>
        <button type="button" class="filter-chip" data-move="down">&darr; Move down</button>
      </div>`;
  }

  function storyBtnHtml(item) {
    if (item.status !== "pending" && item.status !== "live") return "";
    return `<button type="button" class="chip-btn" data-story="1" style="background:var(--accent-soft); color:var(--ink);">Download IG story</button>`;
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
          ${item.status === "sold" && item.sold_via ? `<p>Sold via ${item.sold_via === "elo_edit" ? "The Elo Edit" : "elsewhere"}</p>` : ""}
          ${tagChipsHtml(item)}
          ${liveStatusBadgeHtml(item)}
          ${moveControlsHtml(item)}
          ${isPending ? scheduleControlsHtml(item) : ""}
          <div class="actions">${actions}${copyDmHtml(item)}${dmToggleHtml(item)}${storyBtnHtml(item)}<button type="button" class="chip-btn" data-edit-toggle="1">Edit details</button></div>
          ${editBlockHtml(item)}
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
