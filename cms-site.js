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
  } catch (error) {
    console.warn("Using built-in page content because CMS content could not be loaded.", error);
  } finally {
    ready();
  }
})();
