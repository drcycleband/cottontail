// Shared by the public page and the editor's unsaved preview.
window.renderTestimonials = (items = []) => {
  const grid = document.querySelector("[data-cms-testimonials]");
  if (!grid) return;
  grid.replaceChildren();
  items.filter(item => item.name?.trim() && item.text?.trim()).forEach(item => {
    const card = document.createElement("article");
    card.className = "testimonial-card";
    const rating = Number(item.rating);
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
      const stars = document.createElement("div");
      stars.className = "testimonial-stars";
      stars.setAttribute("aria-label", `${rating} out of 5 stars`);
      stars.textContent = "★".repeat(rating);
      card.append(stars);
    }
    const quote = document.createElement("blockquote");
    quote.textContent = item.text;
    card.append(quote);
    if (item.text.length > 320) {
      quote.classList.add("testimonial-excerpt");
      const more = document.createElement("button");
      more.type = "button";
      more.className = "testimonial-more";
      more.textContent = "Read full review";
      more.setAttribute("aria-expanded", "false");
      more.addEventListener("click", () => {
        const collapsed = quote.classList.toggle("testimonial-excerpt");
        more.textContent = collapsed ? "Read full review" : "Show less";
        more.setAttribute("aria-expanded", String(!collapsed));
      });
      card.append(more);
    }
    const footer = document.createElement("footer");
    const avatar = document.createElement("span");
    avatar.className = "testimonial-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = item.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("");
    const byline = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    byline.append(name);
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.date || "")) {
      const date = document.createElement("time");
      date.dateTime = item.date;
      date.textContent = new Date(`${item.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      byline.append(date);
    }
    footer.append(avatar, byline);
    try {
      const url = new URL(item.url);
      if (["https:", "http:"].includes(url.protocol)) {
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = item.source || "Original review";
        link.setAttribute("aria-label", `Read ${item.name}’s original review`);
        footer.append(link);
      }
    } catch {}
    card.append(footer);
    grid.append(card);
  });
};

(async () => {
  const ready = () => window.dispatchEvent(new CustomEvent("cms:ready"));

  const setText = (key, value) => {
    if (!value) return;
    document.querySelectorAll(`[data-cms-text="${key}"]`).forEach(element => {
      element.textContent = value;
    });
  };

  const setImage = (key, image) => {
    if (!image || !image.src) return;
    document.querySelectorAll(`[data-cms-image="${key}"]`).forEach(element => {
      element.setAttribute("src", image.src);
      if (image.alt) {
        element.setAttribute("alt", image.alt);
      }
    });
  };

  const renderGallery = gallery => {
    const track = document.querySelector("[data-cms-gallery]");
    if (!track || !Array.isArray(gallery) || gallery.length === 0) return;

    track.innerHTML = "";
    gallery.forEach(item => {
      if (!item.src) return;

      const figure = document.createElement("figure");
      figure.className = "gallery-slide";

      const image = document.createElement("img");
      image.src = item.src;
      image.alt = item.alt || "Cottontail Childcare photo";
      image.loading = "lazy";

      figure.appendChild(image);
      track.appendChild(figure);
    });

    const status = document.querySelector("[data-carousel-status]");
    if (status) {
      status.textContent = `Photo 1 of ${track.children.length}`;
    }
  };

  try {
    const response = await fetch("data/content.json", { cache: "no-store" });
    if (!response.ok) throw new Error("CMS content file was not found.");

    const content = await response.json();
    Object.entries(content.texts || {}).forEach(([key, value]) => setText(key, value));
    Object.entries(content.images || {}).forEach(([key, image]) => setImage(key, image));
    renderGallery(content.gallery);
    window.renderTestimonials(content.testimonials);
  } catch (error) {
    console.warn("Using built-in page content because CMS content could not be loaded.", error);
  } finally {
    ready();
  }
})();
