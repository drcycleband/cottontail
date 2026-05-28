let content = { texts: {}, images: {}, gallery: [] };

const statusElement = document.getElementById("status");
const galleryFields = document.getElementById("gallery-fields");
const galleryUploader = document.getElementById("gallery-uploader");
const galleryUploadInput = document.getElementById("gallery-upload-input");
const saveButton = document.getElementById("save-button");
const publishButton = document.getElementById("publish-button");
let draggedIndex = null;

const setStatus = message => {
  statusElement.textContent = message;
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

const saveContent = async () => {
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
  renderGalleryFields();
  setStatus("Ready. Add, reorder, remove, then Save Draft and Publish Website.");
};

saveButton.addEventListener("click", async () => {
  try {
    saveButton.disabled = true;
    setStatus("Saving draft...");
    await saveContent();
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
