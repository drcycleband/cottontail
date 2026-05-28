const sections = [
  {
    id: "hero",
    title: "Top Of Home Page",
    hint: "This is the first thing families see.",
    preview: "hero",
    fields: [
      ["heroEyebrow", "Small line above the headline", "input"],
      ["heroTitle", "Main headline", "input"],
      ["heroLead", "Short welcome paragraph", "textarea"],
      ["heroHighlight1", "Quick highlight 1", "input"],
      ["heroHighlight2", "Quick highlight 2", "input"],
      ["heroHighlight3", "Quick highlight 3", "input"]
    ]
  },
  {
    id: "intro",
    title: "First Welcome Section",
    hint: "The warm introduction below the big photo.",
    preview: "simple",
    fields: [
      ["introKicker", "Small intro line", "textarea"],
      ["introTitle", "Section title", "input"],
      ["introBody", "Paragraph", "textarea"]
    ]
  },
  {
    id: "programs",
    title: "Why Families Choose Cottontail",
    hint: "The main learning and care section.",
    preview: "programs",
    fields: [
      ["programsKicker", "Small section label", "input"],
      ["programsTitle", "Section title", "input"],
      ["programsBody", "Opening paragraph", "textarea"],
      ["benefit1Title", "Card 1 title", "input"],
      ["benefit1Body", "Card 1 paragraph", "textarea"],
      ["benefit2Title", "Card 2 title", "input"],
      ["benefit2Body", "Card 2 paragraph", "textarea"],
      ["benefit3Title", "Card 3 title", "input"],
      ["benefit3Body", "Card 3 paragraph", "textarea"],
      ["benefit4Title", "Card 4 title", "input"],
      ["benefit4Body", "Card 4 paragraph", "textarea"]
    ]
  },
  {
    id: "space",
    title: "Our Space",
    hint: "The short section about the classroom and play space.",
    preview: "simple",
    fields: [
      ["spaceTitle", "Section title", "input"],
      ["spaceBody", "Paragraph", "textarea"]
    ]
  },
  {
    id: "galleryCopy",
    title: "Gallery Intro",
    hint: "Words that appear above the photo gallery.",
    preview: "simple",
    fields: [
      ["galleryKicker", "Small section label", "input"],
      ["galleryTitle", "Section title", "input"],
      ["galleryBody", "Paragraph", "textarea"]
    ]
  },
  {
    id: "trust",
    title: "Trusted Care",
    hint: "Teacher, safety, and personal care notes.",
    preview: "threeCards",
    fields: [
      ["trustKicker", "Small section label", "input"],
      ["trustTitle", "Section title", "input"],
      ["trust1Title", "Card 1 title", "input"],
      ["trust1Body", "Card 1 paragraph", "textarea"],
      ["trust2Title", "Card 2 title", "input"],
      ["trust2Body", "Card 2 paragraph", "textarea"],
      ["trust3Title", "Card 3 title", "input"],
      ["trust3Body", "Card 3 paragraph", "textarea"]
    ]
  },
  {
    id: "about",
    title: "Our Mission",
    hint: "The mission section near the bottom.",
    preview: "simple",
    fields: [
      ["aboutKicker", "Small section label", "input"],
      ["aboutTitle", "Section title", "textarea"],
      ["aboutBody1", "Paragraph 1", "textarea"],
      ["aboutBody2", "Paragraph 2", "textarea"]
    ]
  },
  {
    id: "pricing",
    title: "Pricing",
    hint: "Weekly rate and pricing paragraph.",
    preview: "pricing",
    fields: [
      ["pricingKicker", "Small section label", "input"],
      ["pricingTitle", "Price title", "input"],
      ["pricingBody", "Paragraph", "textarea"]
    ]
  },
  {
    id: "cta",
    title: "Tour Reminder",
    hint: "The final reminder to schedule a tour.",
    preview: "simple",
    fields: [
      ["ctaKicker", "Small section label", "input"],
      ["ctaTitle", "Section title", "input"],
      ["ctaBody", "Paragraph", "textarea"]
    ]
  }
];

const imageLabels = {
  heroMain: "Main home page photo",
  benefit1: "Small class size photo",
  benefit2: "Preschool learning photo",
  benefit3: "Safe environment photo",
  benefit4: "Daily updates photo"
};

let content = { texts: {}, images: {}, gallery: [] };

const statusElement = document.getElementById("status");
const sectionFields = document.getElementById("section-fields");
const imageFields = document.getElementById("image-fields");
const galleryFields = document.getElementById("gallery-fields");
const mainPhotosPanel = document.getElementById("main-photos-panel");
const galleryPanel = document.getElementById("gallery-panel");
const saveButton = document.getElementById("save-button");
const publishButton = document.getElementById("publish-button");
let imageFieldsRendered = false;
let galleryFieldsRendered = false;

const text = key => content.texts[key] || "";

const setStatus = message => {
  statusElement.textContent = message;
};

const makeElement = (tag, className, textContent) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
};

const prepPreviewImage = (image, src, alt = "") => {
  image.loading = "lazy";
  image.decoding = "async";
  image.src = src || "";
  image.alt = alt;
};

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

const imageUploadControl = onUploaded => {
  const wrap = makeElement("div", "upload-row");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = "Choose New Photo";

  button.addEventListener("click", async () => {
    const file = input.files && input.files[0];
    if (!file) {
      setStatus("Choose a photo first.");
      return;
    }

    try {
      setStatus("Uploading photo...");
      const uploaded = await uploadImage(file);
      onUploaded(uploaded);
      setStatus("Photo uploaded. Click Save Changes when you are done.");
    } catch (error) {
      setStatus(error.message || "Upload failed.");
    }
  });

  wrap.append(input, button);
  return wrap;
};

const makeField = ([key, labelText, type], onInput) => {
  const label = makeElement("label", "edit-field");
  const labelName = makeElement("span", "field-label", labelText);
  const input = document.createElement(type === "textarea" ? "textarea" : "input");
  input.value = text(key);
  input.addEventListener("input", () => {
    content.texts[key] = input.value;
    onInput();
    setStatus("Unsaved changes.");
  });

  label.append(labelName, input);
  return label;
};

const previewSimple = section => {
  const wrap = makeElement("div", "site-preview simple-preview");
  const kickerKey = section.fields.find(([key]) => key.endsWith("Kicker"))?.[0];
  const titleKey = section.fields.find(([key]) => key.endsWith("Title"))?.[0];
  const bodyKey = section.fields.find(([key]) => key.endsWith("Body") || key.endsWith("Body1"))?.[0];

  if (kickerKey) wrap.appendChild(makeElement("p", "preview-kicker", text(kickerKey)));
  if (titleKey) wrap.appendChild(makeElement("h3", "", text(titleKey)));
  if (bodyKey) wrap.appendChild(makeElement("p", "", text(bodyKey)));
  return wrap;
};

const previewHero = () => {
  const wrap = makeElement("div", "site-preview hero-preview");
  const image = document.createElement("img");
  prepPreviewImage(image, content.images.heroMain?.src, "");

  const copy = makeElement("div", "hero-preview-copy");
  copy.append(
    makeElement("p", "preview-kicker", text("heroEyebrow")),
    makeElement("h3", "", text("heroTitle")),
    makeElement("p", "", text("heroLead"))
  );

  const chips = makeElement("div", "preview-chips");
  ["heroHighlight1", "heroHighlight2", "heroHighlight3"].forEach(key => {
    chips.appendChild(makeElement("span", "", text(key)));
  });

  copy.appendChild(chips);
  wrap.append(image, copy);
  return wrap;
};

const previewPrograms = () => {
  const wrap = previewSimple(sections.find(section => section.id === "programs"));
  const cardGrid = makeElement("div", "preview-card-grid");

  for (let index = 1; index <= 4; index += 1) {
    const card = makeElement("div", "preview-card");
    const image = document.createElement("img");
    prepPreviewImage(image, content.images[`benefit${index}`]?.src, "");
    card.append(
      image,
      makeElement("strong", "", text(`benefit${index}Title`)),
      makeElement("p", "", text(`benefit${index}Body`))
    );
    cardGrid.appendChild(card);
  }

  wrap.appendChild(cardGrid);
  return wrap;
};

const previewThreeCards = () => {
  const wrap = previewSimple(sections.find(section => section.id === "trust"));
  const cardGrid = makeElement("div", "preview-card-grid three");

  for (let index = 1; index <= 3; index += 1) {
    const card = makeElement("div", "preview-card");
    card.append(makeElement("strong", "", text(`trust${index}Title`)), makeElement("p", "", text(`trust${index}Body`)));
    cardGrid.appendChild(card);
  }

  wrap.appendChild(cardGrid);
  return wrap;
};

const previewPricing = () => {
  const wrap = makeElement("div", "site-preview pricing-preview");
  wrap.append(
    makeElement("p", "preview-kicker", text("pricingKicker")),
    makeElement("h3", "", text("pricingTitle")),
    makeElement("p", "", text("pricingBody"))
  );
  return wrap;
};

const buildPreview = section => {
  if (section.preview === "hero") return previewHero();
  if (section.preview === "programs") return previewPrograms();
  if (section.preview === "threeCards") return previewThreeCards();
  if (section.preview === "pricing") return previewPricing();
  return previewSimple(section);
};

const renderSections = () => {
  sectionFields.innerHTML = "";

  sections.forEach(section => {
    const card = makeElement("article", "editor-section");
    const previewSlot = makeElement("div", "preview-slot");
    const form = makeElement("div", "section-form");

    const heading = makeElement("div", "section-title");
    heading.append(makeElement("h2", "", section.title), makeElement("p", "", section.hint));

    const refreshPreview = () => {
      previewSlot.innerHTML = "";
      previewSlot.appendChild(buildPreview(section));
    };

    section.fields.forEach(field => {
      form.appendChild(makeField(field, refreshPreview));
    });

    refreshPreview();
    card.append(previewSlot, heading, form);
    sectionFields.appendChild(card);
  });
};

const renderImageFields = () => {
  imageFields.innerHTML = "";

  Object.entries(imageLabels).forEach(([key, labelText]) => {
    content.images[key] ||= { src: "", alt: "" };
    const image = content.images[key];
    const card = makeElement("article", "image-card");

    const preview = document.createElement("img");
    prepPreviewImage(preview, image.src, image.alt || "");

    const fields = makeElement("div", "image-fields");
    fields.appendChild(makeElement("h3", "", labelText));

    const altLabel = makeElement("label", "edit-field");
    altLabel.appendChild(makeElement("span", "field-label", "Photo description"));
    const altInput = document.createElement("input");
    altInput.value = image.alt || "";
    altInput.addEventListener("input", () => {
      content.images[key].alt = altInput.value;
      preview.alt = altInput.value;
      setStatus("Unsaved changes.");
    });
    altLabel.appendChild(altInput);

    const path = makeElement("p", "photo-path", image.src || "No photo selected");
    const upload = imageUploadControl(uploaded => {
      content.images[key] = { src: uploaded.path, alt: altInput.value };
      preview.src = uploaded.path;
      path.textContent = uploaded.path;
      renderSections();
    });

    fields.append(altLabel, upload, path);
    card.append(preview, fields);
    imageFields.appendChild(card);
  });
};

const renderGalleryFields = () => {
  galleryFields.innerHTML = "";

  content.gallery.forEach((item, index) => {
    const row = makeElement("article", "gallery-item");
    const preview = document.createElement("img");
    preview.className = "gallery-preview";
    prepPreviewImage(preview, item.src, item.alt || "");

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
    const upload = imageUploadControl(uploaded => {
      item.src = uploaded.path;
      preview.src = uploaded.path;
      path.textContent = uploaded.path;
    });

    fields.append(altLabel, upload, path);

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
    galleryFields.appendChild(row);
  });
};

const render = () => {
  renderSections();
  if (mainPhotosPanel.open) renderImageFields();
  if (galleryPanel.open) renderGalleryFields();
};

mainPhotosPanel.addEventListener("toggle", () => {
  if (!mainPhotosPanel.open || imageFieldsRendered) return;
  renderImageFields();
  imageFieldsRendered = true;
});

galleryPanel.addEventListener("toggle", () => {
  if (!galleryPanel.open || galleryFieldsRendered) return;
  renderGalleryFields();
  galleryFieldsRendered = true;
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
  render();
  setStatus("Ready to edit. Save Draft first, then Publish Website.");
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

document.getElementById("add-gallery-photo").addEventListener("click", () => {
  content.gallery.push({ src: "", alt: "" });
  renderGalleryFields();
  galleryFieldsRendered = true;
  setStatus("New gallery photo added. Choose a photo, then save.");
});

loadContent().catch(error => {
  setStatus(error.message || "Could not load CMS.");
});
