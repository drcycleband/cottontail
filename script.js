// script.js
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");

  if (hamburger && navLinks) {
    // Toggle mobile nav
    hamburger.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("show");
      hamburger.setAttribute("aria-expanded", String(isOpen));
    });

    // Close menu on link click
    const links = navLinks.querySelectorAll("a");
    links.forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", event => {
      if (!navLinks.classList.contains("show")) return;

      const clickedMenu = navLinks.contains(event.target);
      const clickedButton = hamburger.contains(event.target);

      if (!clickedMenu && !clickedButton) {
        navLinks.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        navLinks.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
      }
    });
  }
});
