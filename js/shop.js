(function () {
  const grid = document.getElementById("shopGrid");
  const filterBar = document.getElementById("filterBar");
  const categoryRow = document.getElementById("filterCategory");
  const tagRow = document.getElementById("filterTag");
  const sizeRow = document.getElementById("filterSize");
  const priceRow = document.getElementById("filterPrice");

  const TAG_OPTIONS = ["Bridal", "Wedding Guest", "Vacation", "Accessories", "Ready to Wear", "Shoes"];
  const PRICE_OPTIONS = [
    { value: "0-100", label: "Under $100" },
    { value: "100-250", label: "$100–250" },
    { value: "250-500", label: "$250–500" },
    { value: "500-999999", label: "$500+" },
  ];

  let allListings = [];
  const state = { category: "", tag: "", size: "", price: "" };

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function cardHtml(item) {
    const photo = (item.photo_urls && item.photo_urls[0]) || "";
    return `
      <a class="shop-card" href="drop.html?item=${item.id}">
        <div class="shop-card-photo" style="background-image:url('${photo}')"></div>
        <div class="shop-card-body">
          <p class="shop-card-brand">${escapeHtml(item.brand)}</p>
          ${item.item_name ? `<p class="shop-card-name">${escapeHtml(item.item_name)}</p>` : ""}
          <p class="shop-card-price">$${Number(item.price).toFixed(0)}${item.original_price ? ` <span class="orig-price">originally $${Number(item.original_price).toFixed(0)}</span>` : ""}</p>
          ${item.size ? `<p class="shop-card-size">Size ${escapeHtml(item.size)}</p>` : ""}
        </div>
      </a>`;
  }

  function buildChipRow(container, options, key) {
    container.innerHTML = options
      .map((o) => `<button type="button" class="tag-chip ${state[key] === o.value ? "active" : ""}" data-value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</button>`)
      .join("");
    container.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        state[key] = btn.dataset.value;
        container.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
        applyFilters();
      });
    });
  }

  function fillFilters() {
    const categories = [...new Set(allListings.map((i) => i.category).filter(Boolean))].sort();
    const sizes = [...new Set(allListings.map((i) => i.size).filter(Boolean))].sort();

    buildChipRow(categoryRow, [{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))], "category");
    buildChipRow(tagRow, [{ value: "", label: "All tags" }, ...TAG_OPTIONS.map((t) => ({ value: t, label: t }))], "tag");
    buildChipRow(sizeRow, [{ value: "", label: "All sizes" }, ...sizes.map((s) => ({ value: s, label: s }))], "size");
    buildChipRow(priceRow, [{ value: "", label: "All prices" }, ...PRICE_OPTIONS], "price");
  }

  function renderGrid(items) {
    if (items.length === 0) {
      grid.innerHTML = `<div class="empty-list">No pieces match those filters right now.</div>`;
      return;
    }
    grid.innerHTML = `<div class="shop-grid">${items.map(cardHtml).join("")}</div>`;
  }

  function applyFilters() {
    const filtered = allListings.filter((item) => {
      if (state.category && item.category !== state.category) return false;
      if (state.tag && !(item.tags || []).includes(state.tag)) return false;
      if (state.size && item.size !== state.size) return false;
      if (state.price) {
        const [min, max] = state.price.split("-").map(Number);
        const price = Number(item.price);
        if (price < min || price > max) return false;
      }
      return true;
    });

    renderGrid(filtered);
  }

  async function load() {
    const { data, error } = await supabaseClient
      .from("listings")
      .select("*")
      .eq("status", "live")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      grid.innerHTML = `<div class="empty-list">${escapeHtml(error.message)}</div>`;
      return;
    }

    allListings = data || [];

    if (allListings.length === 0) {
      grid.innerHTML = `<div class="empty-list">Nothing available right now — check back after the next drop.</div>`;
      return;
    }

    filterBar.style.display = "flex";
    fillFilters();
    renderGrid(allListings);
  }

  load();
})();
