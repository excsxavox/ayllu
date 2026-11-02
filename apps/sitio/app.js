function tx(key, fallback) {
  const out = window.AylluI18n && typeof window.AylluI18n.t === "function" ? window.AylluI18n.t(key) : key;
  return !out || out === key ? fallback : out;
}

const HERO_IMG = {
  portada: "portada-ayllu.png?v=1",
  lago: "lago-ayllu.png?v=1",
};

function slides() {
  return [
    {
      k: tx("slide.0.k", "AYLLU · LAGUNA TIPOPUGRO"),
      t: tx("slide.0.t", "Hay lugares que se visitan.\nY otros que se viven."),
      d: tx("slide.0.d", "Gastronomía en AYLLU, pesca y glamping.\nEncuentra tu próxima experiencia en la naturaleza."),
      a: tx("slide.0.a", "Explora nuestras experiencias"),
      h: "#experiencias",
      img: HERO_IMG.portada,
      alt: tx("slide.0.img", "Arquitectura orgánica blanca en la ladera de AYLLU"),
    },
    {
      k: tx("slide.1.k", "AYLLU · RESTAURANTE & CAFETERÍA"),
      t: tx("slide.1.t", "Una buena mesa.\nUn gran momento para compartir."),
      d: tx("slide.1.d", "Haz una pausa en AYLLU y disfruta el encuentro.\nLa gastronomía también es parte de tu escapada."),
      a: tx("slide.1.a", "Descubre AYLLU"),
      h: "#restaurante",
      img: HERO_IMG.lago,
      alt: tx("slide.1.img", "Lago sereno entre montañas y nubes en AYLLU"),
    },
    {
      k: tx("slide.2.k", "PESCA · LAGUNA TIPOPUGRO"),
      t: tx("slide.2.t", "Cambia la rutina\npor una tarde de pesca."),
      d: tx("slide.2.d", "Tómate tu tiempo, disfruta el paisaje\ny vive la laguna a tu manera."),
      a: tx("slide.2.a", "Conoce la experiencia"),
      h: "#pesca",
      img: HERO_IMG.lago,
      alt: tx("slide.2.img", "Lago sereno entre montañas y nubes en AYLLU"),
    },
    {
      k: tx("slide.3.k", "GLAMPING · NATURALEZA"),
      t: tx("slide.3.t", "Que tu escapada\ndure un poco más."),
      d: tx("slide.3.d", "Descubre las opciones de alojamiento\ny planea tu estancia en la naturaleza."),
      a: tx("slide.3.a", "Consulta el glamping"),
      h: "#estancias",
      img: HERO_IMG.portada,
      alt: tx("slide.3.img", "Arquitectura orgánica blanca en la ladera de AYLLU"),
    },
  ];
}

let activeSlide = 0;
let imageSwapTimer = null;
const heroCopy = document.querySelector(".hero-copy");
const heroBg = document.querySelector(".hero-background");
const carousel = document.querySelector(".hero");
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
let carouselTimer = null;
let manuallyPaused = motionPreference.matches;

function currentSrc(img) {
  if (!img) return "";
  const raw = img.getAttribute("src") || "";
  return raw.split("?")[0];
}

function setHeroImage(s) {
  if (!heroBg || !s.img) return;
  const nextFile = s.img.split("?")[0];
  if (currentSrc(heroBg) === nextFile) {
    if (s.alt) heroBg.alt = s.alt;
    return;
  }
  window.clearTimeout(imageSwapTimer);
  heroBg.classList.add("swapping");
  imageSwapTimer = window.setTimeout(() => {
    heroBg.addEventListener(
      "load",
      () => {
        heroBg.classList.remove("swapping");
        heroBg.style.animation = "none";
        void heroBg.offsetWidth;
        heroBg.style.animation = "";
      },
      { once: true },
    );
    heroBg.src = s.img;
    if (s.alt) heroBg.alt = s.alt;
    if (heroBg.complete) {
      heroBg.classList.remove("swapping");
    }
  }, 180);
}

function displaySlide(n) {
  const pack = slides();
  activeSlide = ((n % pack.length) + pack.length) % pack.length;
  const s = pack[activeSlide];
  document.querySelector("#hero-kicker").textContent = s.k;
  document.querySelector("#hero-title").textContent = s.t;
  document.querySelector("#hero-description").textContent = s.d;
  const a = document.querySelector("#hero-link");
  a.textContent = s.a;
  a.href = s.h;
  setHeroImage(s);
  document.querySelectorAll("[data-slide]").forEach((b) => {
    b.setAttribute("aria-pressed", String(Number(b.dataset.slide) === activeSlide));
  });
  heroCopy.classList.remove("changing");
  void heroCopy.offsetWidth;
  heroCopy.classList.add("changing");
  scheduleCarousel();
}

function scheduleCarousel() {
  window.clearTimeout(carouselTimer);
  const paused = manuallyPaused || document.hidden;
  carousel.classList.toggle("motion-paused", paused);
  if (!paused) {
    carouselTimer = window.setTimeout(() => displaySlide(activeSlide + 1), 5000);
  }
}

document.querySelector(".prev")?.addEventListener("click", (e) => {
  e.preventDefault();
  displaySlide(activeSlide - 1);
});
document.querySelector(".next")?.addEventListener("click", (e) => {
  e.preventDefault();
  displaySlide(activeSlide + 1);
});
document.querySelectorAll("[data-slide]").forEach((b) => {
  b.addEventListener("click", () => displaySlide(Number(b.dataset.slide)));
});

window.addEventListener("ayllu:lang", () => displaySlide(activeSlide));

const mt = document.querySelector(".menu-toggle");
const head = document.querySelector("#site-header");
mt?.addEventListener("click", () => {
  const open = mt.getAttribute("aria-expanded") !== "true";
  mt.setAttribute("aria-expanded", String(open));
  head.classList.toggle("menu-open", open);
});
document.querySelectorAll("#main-nav a").forEach((a) => {
  a.addEventListener("click", () => {
    mt?.setAttribute("aria-expanded", "false");
    head?.classList.remove("menu-open");
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    head?.classList.remove("menu-open");
    mt?.setAttribute("aria-expanded", "false");
  }
  if (e.key === "ArrowLeft") displaySlide(activeSlide - 1);
  if (e.key === "ArrowRight") displaySlide(activeSlide + 1);
});

if ("IntersectionObserver" in window && !motionPreference.matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  document.querySelectorAll(".section-head,.experience,.restaurant-copy,.outdoor-copy,.glamping>div").forEach((el) => {
    el.classList.add("reveal-ready");
    observer.observe(el);
  });
}

document.addEventListener("visibilitychange", scheduleCarousel);
motionPreference.addEventListener("change", () => {
  manuallyPaused = motionPreference.matches;
  scheduleCarousel();
});

[HERO_IMG.portada, HERO_IMG.lago].forEach((src) => {
  const preload = new Image();
  preload.src = src;
});

displaySlide(0);
