// script.js
document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("nav-links");
  const carousel = document.querySelector("[data-carousel]");

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

  if (carousel) {
    const track = carousel.querySelector(".gallery-track");
    const slides = Array.from(carousel.querySelectorAll(".gallery-slide"));
    const prevButton = carousel.querySelector("[data-carousel-prev]");
    const nextButton = carousel.querySelector("[data-carousel-next]");
    const status = document.querySelector("[data-carousel-status]");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const autoScrollDelay = 4500;
    let currentSlide = 0;
    let autoScrollTimer;

    const updateCarousel = () => {
      track.style.transform = `translateX(-${currentSlide * 100}%)`;

      if (status) {
        status.textContent = `Photo ${currentSlide + 1} of ${slides.length}`;
      }
    };

    const showSlide = direction => {
      currentSlide = (currentSlide + direction + slides.length) % slides.length;
      updateCarousel();
    };

    const stopAutoScroll = () => {
      if (autoScrollTimer) {
        window.clearInterval(autoScrollTimer);
      }
    };

    const startAutoScroll = () => {
      if (prefersReducedMotion || document.hidden) return;

      stopAutoScroll();
      autoScrollTimer = window.setInterval(() => showSlide(1), autoScrollDelay);
    };

    const restartAutoScroll = () => {
      stopAutoScroll();
      startAutoScroll();
    };

    prevButton.addEventListener("click", () => {
      showSlide(-1);
      restartAutoScroll();
    });

    nextButton.addEventListener("click", () => {
      showSlide(1);
      restartAutoScroll();
    });

    carousel.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft") {
        showSlide(-1);
        restartAutoScroll();
      }

      if (event.key === "ArrowRight") {
        showSlide(1);
        restartAutoScroll();
      }
    });

    carousel.addEventListener("mouseenter", stopAutoScroll);
    carousel.addEventListener("mouseleave", startAutoScroll);
    carousel.addEventListener("focusin", stopAutoScroll);
    carousel.addEventListener("focusout", startAutoScroll);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopAutoScroll();
      } else {
        startAutoScroll();
      }
    });

    updateCarousel();
    startAutoScroll();
  }
});
