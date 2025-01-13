// script.js

// Grab elements
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
const alphaVideoButton = document.getElementById("alphaVideoButton");
const spotifyMobileSection = document.querySelector(
  ".spotify-mobile-bottom-section"
);

// Toggle mobile nav
hamburger.addEventListener("click", () => {
  navLinks.classList.toggle("show");

  // Hide alpha-video button if nav is open, show otherwise
  if (navLinks.classList.contains("show")) {
    alphaVideoButton.style.display = "none";
  } else {
    alphaVideoButton.style.display = "block";
  }
});

// Toggle the mobile Spotify bottom section when alpha-video is clicked
alphaVideoButton.addEventListener("click", () => {
  // Instead of style.display, we'll toggle .show
  spotifyMobileSection.classList.toggle("show");
});

// Subscribe Modal Logic (if any)
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("subscribe-modal");
  const closeBtn = document.getElementById("close-modal");
  let hasShownModal = false;
  const scrollThreshold = 2500;

  window.addEventListener("scroll", () => {
    if (!hasShownModal && window.scrollY > scrollThreshold) {
      if (modal) {
        modal.style.display = "flex";
        hasShownModal = true;
      }
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  // (If you removed fade anchor code for smooth scrolling, it's not here)
});
