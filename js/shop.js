(function () {
  const grid = document.getElementById("shopGrid");
  const filterBar = document.getElementById("filterBar");
  const filterCategory = document.getElementById("filterCategory");
  const filterTag = document.getElementById("filterTag");
  const filterSize = document.getElementById("filterSize");
  const filterPrice = document.getElementById("filterPrice");

  const TAG_OPTIONS = ["Bridal", "Wedding Guest", "Vacation", "Accessories", "Ready to Wear", "Shoes"];

  let allListings = [];

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function cardHtml(item) {
    const photo = (item.photo_urls && item.photo_urls[0]) || "";
    return `
      <a class="shop-card" href="index.html?item=${item.id}">
        <div class="shop-card-photo" style="background-image:url('${photo}')"></div>
        <div class="shop-card-body">
          <p class="shop-card-brand">${escapeHtml(item.brand)}</p>
          ${item.item_name ? `<p class="shop-card-name">${escapeHtml(item.item_name)}</p>` : ""}
          <p class="shop-card-price">$${Number(item.price).toFixed(0)}${item.original_price ? ` <span class="orig-price">originally $${Number(item.original_price).toFixed(0)}</span>` : ""}</p>
          ${item.size ? `<p class="shop-card-size">Size ${escapeHtml(item.size)}</p>` : ""}
        </div>
      </a>`;
  }

  function fillSelect(select, values) {
    const unique = [...new Set(values.filter(Boolean))].sort();
    unique.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
  }

  function renderGrid(items) {
    if (items.length === 0) {
      grid.innerHTML = `<div class="empty-list">No pieces match those filters right now.</div>`;
      return;
    }
    grid.innerHTML = `<div class="shop-grid">${items.map(cardHtml).join("")}</div>`;
  }

  function applyFilters() {
    const cat = filterCategory.value;
    const tag = filterTag.value;
    const size = filterSize.value;
    const priceRange = filterPrice.value;

    let filtered = allListings.filter((item) => {
      if (cat && item.category !== cat) return false;
      if (tag && !(item.tags || []).includes(tag)) return false;
      if (size && item.size !== size) return false;
      if (priceRange) {
        const [min, max] = priceRange.split("-").map(Number);
        const price = Number(item.price);
        if (price < min || price > max) return false;
      }
      return true;
    });

    renderGrid(filtered);
  }

  [filterCategory, filterTag, filterSize, filterPrice].forEach((el) => {
    el.addEventListener("change", applyFilters);
  });

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
    fillSelect(filterCategory, allListings.map((i) => i.category));
    fillSelect(filterTag, TAG_OPTIONS);
    fillSelect(filterSize, allListings.map((i) => i.size));

    renderGrid(allListings);
  }

  load();
})();
