let content = { texts: {}, images: {}, gallery: [] };

const statusElement = document.getElementById("status");
const galleryFields = document.getElementById("gallery-fields");
const saveButton = document.getElementById("save-button");
const publishButton = document.getElementById("publish-button");

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

const createUploadCard = () => {
  const addCard = makeElement("article", "gallery-add-card");
  const addCopy = makeElement("div", "gallery-copy");
  addCopy.append(
    makeElement("h2", "", "Add New Gallery Photo"),
    makeElement("p", "photo-path", "Choose a photo and it will be optimized for the website automatically.")
  );

  const addInput = document.createElement("input");
  addInput.type = "file";
  addInput.accept = "image/*";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "publish";
  addButton.textContent = "Upload To Gallery";
  addButton.addEventListener("click", async () => {
    const file = addInput.files && addInput.files[0];
    if (!file) {
      setStatus("Choose a gallery photo first.");
      return;
    }

    try {
      addButton.disabled = true;
      setStatus("Optimizing and uploading new gallery photo...");
      const uploaded = await uploadPhotoSet(file);
      content.gallery.unshift({
        src: uploaded.path,
        thumb: uploaded.thumb,
        alt: "Cottontail Childcare photo"
      });
      renderGalleryFields();
      setStatus("Gallery photo added. Add a description, then Save Draft.");
    } catch (error) {
      setStatus(error.message || "Could not add gallery photo.");
    } finally {
      addButton.disabled = false;
    }
  });

  addCard.append(addCopy, addInput, addButton);
  return addCard;
};

const createGalleryItem = (item, index) => {
  const row = makeElement("article", "gallery-item");
  const preview = document.createElement("img");
  preview.className = "gallery-preview";
  prepPreviewImage(preview, imagePreviewSrc(item), item.alt || "");

  const fields = makeElement("div", "gallery-copy");
  fields.appendChild(makeElement("h3", "", `Gallery Photo ${index + 1}`));

  const altLabel = makeElement("label", "edit-field");
  altLabel.appendChild(makeElement("span", "field-label", "Photo description"));
  const altInput = document.createElement("input");
  altInput.value = item.alt || "";
  altInput.addEventListener("input", () => {
    item.alt = altInput.value;
    preview.alt = altInput.value;
    setStatus("Unsaved changes.");
  });
  altLabel.appendChild(altInput);

  const path = makeElement("p", "photo-path", item.src || "No photo selected");

  const replaceRow = makeElement("div", "upload-row");
  const replaceInput = document.createElement("input");
  replaceInput.type = "file";
  replaceInput.accept = "image/*";
  const replaceButton = document.createElement("button");
  replaceButton.type = "button";
  replaceButton.className = "secondary";
  replaceButton.textContent = "Replace Photo";
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
      path.textContent = uploaded.path;
      setStatus("Photo replaced. Click Save Draft when you are done.");
    } catch (error) {
      setStatus(error.message || "Could not replace photo.");
    } finally {
      replaceButton.disabled = false;
    }
  });
  replaceRow.append(replaceInput, replaceButton);

  fields.append(altLabel, replaceRow, path);

  const actions = makeElement("div", "gallery-actions");
  const up = document.createElement("button");
  up.type = "button";
  up.className = "secondary";
  up.textContent = "Move Up";
  up.disabled = index === 0;
  up.addEventListener("click", () => {
    [content.gallery[index - 1], content.gallery[index]] = [content.gallery[index], content.gallery[index - 1]];
    renderGalleryFields();
    setStatus("Unsaved changes.");
  });

  const down = document.createElement("button");
  down.type = "button";
  down.className = "secondary";
  down.textContent = "Move Down";
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
    content.gallery.splice(index, 1);
    renderGalleryFields();
    setStatus("Unsaved changes.");
  });

  actions.append(up, down, remove);
  row.append(preview, fields, actions);
  return row;
};

const renderGalleryFields = () => {
  galleryFields.innerHTML = "";
  galleryFields.appendChild(createUploadCard());

  content.gallery.forEach((item, index) => {
    galleryFields.appendChild(createGalleryItem(item, index));
  });
};

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
