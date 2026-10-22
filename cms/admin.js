let content = { texts: {}, images: {}, gallery: [] };

const statusElement = document.getElementById("status");
const galleryFields = document.getElementById("gallery-fields");
const galleryUploader = document.getElementById("gallery-uploader");
const galleryUploadInput = document.getElementById("gallery-upload-input");
const saveButton = document.getElementById("save-button");
const publishButton = document.getElementById("publish-button");
let draggedIndex = null;
let dirty = false;
let contentLoaded = false;
const websitePreview = document.getElementById("website-preview");
const galleryDialog = document.getElementById("gallery-dialog");
let previewResizeObserver;
let previewResizeFrame;
document.getElementById("gallery-button").addEventListener("click", () => galleryDialog.showModal());
document.getElementById("close-gallery").addEventListener("click", () => {
  galleryDialog.close();
  refreshPreview();
});
window.addEventListener("beforeunload", event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
const refreshPreview = () => { websitePreview.src = "/index.html?preview=" + Date.now(); };
const preparePreview = () => {
  if (!contentLoaded) return;
  const doc = websitePreview.contentDocument;
  if (!doc || doc.documentElement.dataset.editorReady) return;
  doc.documentElement.dataset.editorReady = "true";
  const style = doc.createElement("style");
  style.textContent = `[data-cms-text], [data-cms-image] { outline: 2px dashed #315c8680; outline-offset: 4px; cursor: pointer; }
    [contenteditable]:focus { outline: 3px solid #315c86; background: #fff9df; }
    [data-cms-image]:hover { outline: 3px solid #315c86; }`;
  doc.head.append(style);
  // Let the editor page own scrolling instead of nesting a second viewport.
  const previewStyle = doc.createElement("style");
  previewStyle.textContent = `html, body { overflow: hidden !important; }
    .navbar, .skip-link, .back-to-top { display: none !important; }
    #home { margin-top: 0 !important; }
    body { padding-bottom: 0 !important; }
    .gallery-slide img { height: min(520px, 110vw) !important; }
    [data-cms-text], [data-cms-image] { scroll-margin-top: 140px; }`;
  doc.head.append(previewStyle);
  const resizePreview = () => {
    cancelAnimationFrame(previewResizeFrame);
    previewResizeFrame = requestAnimationFrame(() => {
      const height = Math.ceil(doc.body.getBoundingClientRect().height);
      if (height > 0 && websitePreview.style.height !== `${height}px`) websitePreview.style.height = `${height}px`;
    });
  };
  previewResizeObserver?.disconnect();
  previewResizeObserver = new ResizeObserver(resizePreview);
  previewResizeObserver.observe(doc.body);
  doc.fonts.ready.then(resizePreview);
  resizePreview();
  websitePreview.contentWindow.renderTestimonials?.(content.testimonials);
  doc.querySelectorAll("[data-cms-text]").forEach(element => {
    const key = element.dataset.cmsText;
    if (Object.hasOwn(content.texts, key)) element.textContent = content.texts[key];
    element.contentEditable = "plaintext-only";
    element.title = "Click to edit these words";
    element.addEventListener("input", () => {
      content.texts[key] = element.textContent;
      setStatus("Unsaved changes. Click Publish Website when you are ready.");
    });
    element.addEventListener("paste", event => {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      const selection = websitePreview.contentWindow.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = doc.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      element.dispatchEvent(new Event("input"));
    });
  });
  doc.querySelectorAll("[data-cms-image]").forEach(image => {
    const key = image.dataset.cmsImage;
    const item = content.images[key];
    if (item) { image.src = item.src; image.alt = item.alt || ""; }
    image.title = "Click to replace this photo";
    image.tabIndex = 0;
    const choosePhoto = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp,image/gif";
      input.addEventListener("change", async () => {
        if (!input.files[0]) return;
        saveButton.disabled = publishButton.disabled = true;
        try {
          setStatus("Uploading replacement photo...");
          const uploaded = await uploadPhotoSet(input.files[0]);
          content.images[key] = { src: uploaded.path, thumb: uploaded.thumb, alt: image.alt };
          image.src = "/" + uploaded.path;
          setStatus("Unsaved changes. Photo replaced — click Publish Website when ready.");
        } catch (error) { setStatus(error.message); }
        finally { saveButton.disabled = publishButton.disabled = false; }
      });
      input.click();
    };
    image.addEventListener("click", choosePhoto);
    image.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choosePhoto(); }
    });
  });
  const gallery = doc.querySelector("[data-cms-gallery]");
  if (gallery) {
    gallery.replaceChildren(...content.gallery.map(item => {
      const figure = doc.createElement("figure");
      figure.className = "gallery-slide";
      const image = doc.createElement("img");
      image.src = item.src; image.alt = item.alt || ""; image.loading = "lazy";
      figure.append(image);
      return figure;
    }));
    // Reinitialize the site's carousel with the draft's slides.
    const carousel = doc.querySelector("[data-carousel]");
    if (carousel) {
      const replacement = carousel.cloneNode(true);
      delete replacement.dataset.carouselReady;
      carousel.replaceWith(replacement);
      const slides = Array.from(replacement.querySelectorAll(".gallery-slide"));
      const track = replacement.querySelector(".gallery-track");
      let position = 0;
      const show = step => {
        position = (position + step + slides.length) % slides.length;
        if (track) track.style.transform = `translateX(-${position * 100}%)`;
        const counter = doc.querySelector("[data-carousel-status]");
        if (counter) counter.textContent = `Photo ${position + 1} of ${slides.length}`;
      };
      replacement.querySelectorAll("[data-carousel-prev], [data-carousel-next]").forEach(button => {
        button.disabled = !slides.length;
        button.addEventListener("click", () => show(button.hasAttribute("data-carousel-next") ? 1 : -1));
      });
      if (slides.length) show(0);
    }
    const status = doc.querySelector("[data-carousel-status]");
    if (status && !content.gallery.length) status.textContent = "No gallery photos yet";
    const gallerySection = doc.getElementById("gallery");
    if (gallerySection) {
      const manageButton = doc.createElement("button");
      manageButton.type = "button";
      manageButton.textContent = "Manage gallery photos";
      manageButton.style.cssText = "display:block;margin:20px auto;padding:14px 20px;min-height:48px;border:0;border-radius:8px;background:#315c86;color:white;font:inherit;font-weight:800;cursor:pointer;max-width:100%;";
      manageButton.addEventListener("click", () => galleryDialog.showModal());
      const carousel = gallerySection.querySelector("[data-carousel]");
      if (carousel) carousel.before(manageButton);
      else gallerySection.append(manageButton);
    }
  }
  doc.addEventListener("click", event => {
    const link = event.target.closest("a");
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute("href");
    if (href?.startsWith("#")) {
      const target = doc.getElementById(href.slice(1));
      if (target) window.scrollTo({ top: window.scrollY + websitePreview.getBoundingClientRect().top + target.getBoundingClientRect().top - 140, behavior: "smooth" });
    }
  }, true);
};
websitePreview.addEventListener("load", preparePreview);

const setStatus = message => {
  statusElement.textContent = message;
  if (/Unsaved|added|replaced|order changed/i.test(message)) dirty = true;
};

const makeElement = (tag, className, textContent) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
};

const imagePreviewSrc = item => item?.thumb || item?.src || "";

const prepPreviewImage = (image, src, alt = "") => {
  image.loading = "lazy";
  image.decoding = "async";
  image.src = src || "";
  image.alt = alt;
};

const resizeImage = (file, maxSize, quality, label) => new Promise((resolve, reject) => {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    resolve(file);
    return;
  }

  const image = new Image();
  const url = URL.createObjectURL(file);

  image.onload = () => {
    URL.revokeObjectURL(url);

    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("Could not resize the selected photo."));
        return;
      }

      const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
      resolve(new File([blob], `${baseName}-${label}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", quality);
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error("Could not read the selected photo."));
  };

  image.src = url;
});

const uploadImage = async file => {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
};

const uploadPhotoSet = async file => {
  try {
    const fullImage = await resizeImage(file, 1800, 0.86, "site");
    const thumbImage = await resizeImage(file, 520, 0.76, "thumb");
    const [fullUpload, thumbUpload] = await Promise.all([
      uploadImage(fullImage),
      uploadImage(thumbImage)
    ]);

    return {
      path: fullUpload.path,
      thumb: thumbUpload.path
    };
  } catch (error) {
    const fallback = await uploadImage(file);
    return {
      path: fallback.path,
      thumb: fallback.path
    };
  }
};

const addFilesToGallery = async files => {
  const images = Array.from(files).filter(file => file.type.startsWith("image/"));
  if (images.length === 0) {
    setStatus("Choose one or more photos first.");
    return;
  }

  galleryUploadInput.disabled = true;
  saveButton.disabled = true;
  publishButton.disabled = true;

  try {
    for (let index = 0; index < images.length; index += 1) {
      setStatus(`Optimizing and uploading photo ${index + 1} of ${images.length}...`);
      const uploaded = await uploadPhotoSet(images[index]);
      content.gallery.unshift({
        src: uploaded.path,
        thumb: uploaded.thumb,
        alt: "Cottontail Childcare photo"
      });
    }

    renderGalleryFields();
    setStatus(`${images.length} photo${images.length === 1 ? "" : "s"} added. Drag to reorder, then Save Draft.`);
  } catch (error) {
    setStatus(error.message || "Could not add gallery photos.");
  } finally {
    galleryUploadInput.disabled = false;
    saveButton.disabled = false;
    publishButton.disabled = false;
    galleryUploadInput.value = "";
  }
};

const createGalleryItem = (item, index) => {
  const row = makeElement("article", "gallery-item");
  row.draggable = true;
  row.dataset.index = String(index);

  const preview = document.createElement("img");
  preview.className = "gallery-preview";
  prepPreviewImage(preview, imagePreviewSrc(item), item.alt || "");

  const number = makeElement("span", "gallery-number", String(index + 1));
  const fields = makeElement("details", "gallery-details");
  const summary = makeElement("summary", "", "Edit");
  const detailsBody = makeElement("div", "gallery-details-body");
  fields.addEventListener("toggle", () => {
    row.draggable = !fields.open;
  });

  const altLabel = makeElement("label", "edit-field");
  altLabel.appendChild(makeElement("span", "field-label", "Photo description"));
  const altInput = document.createElement("textarea");
  altInput.rows = 2;
  altInput.value = item.alt || "";
  altInput.addEventListener("input", () => {
    item.alt = altInput.value;
    preview.alt = altInput.value;
    setStatus("Unsaved changes.");
  });
  altLabel.appendChild(altInput);

  const replaceDetails = makeElement("details", "replace-details");
  const replaceSummary = makeElement("summary", "", "Replace Photo");
  const replaceRow = makeElement("div", "upload-row");
  const replaceInput = document.createElement("input");
  replaceInput.type = "file";
  replaceInput.accept = "image/*";
  const replaceButton = document.createElement("button");
  replaceButton.type = "button";
  replaceButton.className = "secondary";
  replaceButton.textContent = "Upload Replacement";
  replaceButton.addEventListener("click", async () => {
    const file = replaceInput.files && replaceInput.files[0];
    if (!file) {
      setStatus("Choose a replacement photo first.");
      return;
    }

    try {
      replaceButton.disabled = true;
      setStatus("Optimizing and uploading replacement photo...");
      const uploaded = await uploadPhotoSet(file);
      item.src = uploaded.path;
      item.thumb = uploaded.thumb;
      preview.src = uploaded.thumb || uploaded.path;
      setStatus("Photo replaced. Click Save Draft when you are done.");
    } catch (error) {
      setStatus(error.message || "Could not replace photo.");
    } finally {
      replaceButton.disabled = false;
    }
  });
  replaceRow.append(replaceInput, replaceButton);
  replaceDetails.append(replaceSummary, replaceRow);

  const actions = makeElement("div", "gallery-actions");
  const up = document.createElement("button");
  up.type = "button";
  up.className = "secondary";
  up.textContent = "Up";
  up.disabled = index === 0;
  up.addEventListener("click", () => {
    [content.gallery[index - 1], content.gallery[index]] = [content.gallery[index], content.gallery[index - 1]];
    renderGalleryFields();
    setStatus("Unsaved changes.");
  });

  const down = document.createElement("button");
  down.type = "button";
  down.className = "secondary";
  down.textContent = "Down";
  down.disabled = index === content.gallery.length - 1;
  down.addEventListener("click", () => {
    [content.gallery[index + 1], content.gallery[index]] = [content.gallery[index], content.gallery[index + 1]];
    renderGalleryFields();
    setStatus("Unsaved changes.");
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    if (!window.confirm("Remove this gallery photo?")) return;
    content.gallery.splice(index, 1);
    renderGalleryFields();
    setStatus("Unsaved changes.");
  });

  actions.append(up, down, remove);
  detailsBody.append(altLabel, replaceDetails, actions);
  fields.append(summary, detailsBody);

  row.addEventListener("dragstart", event => {
    if (fields.open) {
      event.preventDefault();
      return;
    }

    draggedIndex = index;
    row.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  });

  row.addEventListener("dragend", () => {
    row.classList.remove("dragging");
    draggedIndex = null;
  });

  row.addEventListener("dragover", event => {
    event.preventDefault();
    row.classList.add("drag-over");
    event.dataTransfer.dropEffect = "move";
  });

  row.addEventListener("dragleave", () => {
    row.classList.remove("drag-over");
  });

  row.addEventListener("drop", event => {
    event.preventDefault();
    row.classList.remove("drag-over");
    const from = draggedIndex ?? Number(event.dataTransfer.getData("text/plain"));
    const to = index;
    if (!Number.isInteger(from) || from === to) return;

    const [moved] = content.gallery.splice(from, 1);
    content.gallery.splice(to, 0, moved);
    renderGalleryFields();
    setStatus("Gallery order changed. Click Save Draft when you are done.");
  });

  row.append(number, preview, fields);
  return row;
};

const renderGalleryFields = () => {
  galleryFields.innerHTML = "";

  content.gallery.forEach((item, index) => {
    galleryFields.appendChild(createGalleryItem(item, index));
  });
};

galleryUploadInput.addEventListener("change", () => {
  addFilesToGallery(galleryUploadInput.files);
});

["dragenter", "dragover"].forEach(eventName => {
  galleryUploader.addEventListener(eventName, event => {
    event.preventDefault();
    galleryUploader.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach(eventName => {
  galleryUploader.addEventListener(eventName, event => {
    event.preventDefault();
    galleryUploader.classList.remove("drag-over");
  });
});

galleryUploader.addEventListener("drop", event => {
  addFilesToGallery(event.dataTransfer.files);
});

const testimonialsDialog = document.getElementById("testimonials-dialog");
const testimonialFields = document.getElementById("testimonial-fields");
document.getElementById("testimonials-button").addEventListener("click", () => testimonialsDialog.showModal());
document.getElementById("close-testimonials").addEventListener("click", () => testimonialsDialog.close());
const updateTestimonialPreview = () => {
  websitePreview.contentWindow.renderTestimonials?.(content.testimonials);
  setStatus("Unsaved changes. Click Publish Website when you are ready.");
};
const renderTestimonialFields = () => {
  testimonialFields.replaceChildren();
  content.testimonials.forEach((item, index) => {
    const row = makeElement("details", "testimonial-editor");
    const summary = makeElement("summary", "", item.name || "New testimonial");
    row.append(summary);
    const field = (labelText, key, type = "text") => {
      const label = makeElement("label", "", labelText);
      const input = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") input.type = type;
      else input.rows = 6;
      input.value = item[key] || "";
      if (key === "name" || key === "text") input.required = true;
      input.addEventListener("input", () => {
        item[key] = input.value;
        if (key === "name") summary.textContent = input.value || "New testimonial";
        updateTestimonialPreview();
      });
      label.append(input);
      row.append(label);
    };
    field("Reviewer’s name (required)", "name");
    field("Review (required)", "text", "textarea");
    const label = makeElement("label", "", "Star rating (optional)");
    const select = document.createElement("select");
    [0, 5, 4, 3, 2, 1].forEach(value => {
      const option = makeElement("option", "", value ? `${value} stars` : "No star rating");
      option.value = String(value);
      select.append(option);
    });
    select.value = String(item.rating || 0);
    select.addEventListener("change", () => { item.rating = Number(select.value); updateTestimonialPreview(); });
    label.append(select); row.append(label);
    field("Review date (optional)", "date", "date");
    field("Source, e.g. Google or Email (optional)", "source");
    field("Original review link (optional)", "url", "url");
    const actions = makeElement("div", "testimonial-actions");
    [["Move up", -1], ["Move down", 1], ["Remove", 0]].forEach(([text, step]) => {
      const button = makeElement("button", "secondary", text);
      button.type = "button";
      button.disabled = step !== 0 && (index + step < 0 || index + step >= content.testimonials.length);
      button.addEventListener("click", () => {
        if (!step) {
          if (!confirm(`Remove ${item.name || "this testimonial"}? You can close without saving to discard this change.`)) return;
          content.testimonials.splice(index, 1);
        } else {
          [content.testimonials[index], content.testimonials[index + step]] = [content.testimonials[index + step], item];
        }
        renderTestimonialFields(); updateTestimonialPreview();
      });
      actions.append(button);
    });
    row.append(actions); testimonialFields.append(row);
  });
};
document.getElementById("add-testimonial").addEventListener("click", () => {
  content.testimonials.unshift({ name: "", text: "", rating: 0, date: "", source: "", url: "" });
  renderTestimonialFields();
  const first = testimonialFields.firstElementChild;
  first.open = true;
  first.querySelector("input").focus();
  updateTestimonialPreview();
});

const saveContent = async () => {
  if ((content.testimonials || []).some(item => !item.name?.trim() || !item.text?.trim())) {
    testimonialsDialog.showModal();
    throw new Error("Add a name and review to each testimonial, or remove the unfinished entry.");
  }
  const response = await fetch("/api/content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(content)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
};

const loadContent = async () => {
  const response = await fetch("/api/content");
  if (!response.ok) {
    throw new Error("Could not load site content.");
  }

  content = await response.json();
  content.texts ||= {};
  content.images ||= {};
  content.gallery ||= [];
  content.testimonials ||= [];
  renderTestimonialFields();
  renderGalleryFields();
  contentLoaded = true;
  refreshPreview();
  setStatus("Ready. Click outlined words or photos to edit your website.");
};

saveButton.addEventListener("click", async () => {
  try {
    saveButton.disabled = true;
    setStatus("Saving draft...");
    await saveContent();
    dirty = false;
    setStatus("Draft saved. Click Publish Website when you are ready for it to go live.");
  } catch (error) {
    setStatus(error.message || "Save failed.");
  } finally {
    saveButton.disabled = false;
  }
});

publishButton.addEventListener("click", async () => {
  try {
    publishButton.disabled = true;
    saveButton.disabled = true;
    setStatus("Saving draft before publishing...");
    await saveContent();
    dirty = false;

    setStatus("Publishing to GitHub...");
    const response = await fetch("/api/publish", {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json();
    setStatus(result.message || "Published.");
  } catch (error) {
    setStatus(error.message || "Publish failed.");
  } finally {
    publishButton.disabled = false;
    saveButton.disabled = false;
  }
});

loadContent().catch(error => {
  setStatus(error.message || "Could not load CMS.");
});
