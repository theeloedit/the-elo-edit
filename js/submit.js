(function () {
  const form = document.getElementById("submitForm");
  const submitBtn = document.getElementById("submitBtn");
  const statusMsg = document.getElementById("statusMsg");

  function showStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = `status-msg show ${type}`;
  }

  async function uploadPhotos(files) {
    const urls = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabaseClient.storage
        .from("listing-photos")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabaseClient.storage.from("listing-photos").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";
    statusMsg.className = "status-msg";

    try {
      const photoFiles = document.getElementById("photos").files;
      if (!photoFiles.length) throw new Error("Please add at least one photo.");
      if (photoFiles.length > 3) throw new Error("Please choose up to 3 photos only.");

      const photo_urls = await uploadPhotos(photoFiles);

      const payload = {
        brand: document.getElementById("brand").value.trim(),
        item_name: document.getElementById("itemName").value.trim() || null,
        size: document.getElementById("size").value.trim(),
        price: Number(document.getElementById("price").value),
        original_price: document.getElementById("originalPrice").value
          ? Number(document.getElementById("originalPrice").value)
          : null,
        condition: document.getElementById("condition").value || null,
        category: document.getElementById("category").value || null,
        description: document.getElementById("description").value.trim() || null,
        seller_ig_handle: document.getElementById("igHandle").value.trim().replace(/^@/, ""),
        photo_urls,
        status: "pending",
      };

      const { error } = await supabaseClient.from("listings").insert(payload);
      if (error) throw error;

      form.reset();
      showStatus("Submitted! Mary will review it and let you know if it's going in the next drop.", "success");
    } catch (err) {
      showStatus(err.message || "Something went wrong. Please try again.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit for review";
    }
  });
})();
