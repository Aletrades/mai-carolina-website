/* ============================================
   Mai Carolina — Real Estate Website
   GSAP + Lenis + ScrollTrigger
   ============================================ */

const CONFIG = {
  leadWebhookUrl: "https://n8n.srv906468.hstgr.cloud/webhook/mai-website-leads",
  phoneDisplay: "(404) 516-6690",
  phoneTel: "+14045166690",
  accent: "#00B4D8",
};

// ---- Intro overlay ----
function initIntroOverlay() {
  const overlay = document.getElementById("intro-overlay");
  if (!overlay) return;

  // Kill the static loader — intro replaces it
  document.getElementById("loader")?.remove();

  // Lock page scroll while intro plays — users can't skip past it
  document.documentElement.classList.add("intro-active");
  document.body.classList.add("intro-active");

  // Stop Lenis smooth scroll during intro (it intercepts wheel/touch events
  // and would otherwise bypass our scroll lock on mobile).
  if (typeof lenis !== "undefined" && lenis.stop) lenis.stop();

  const video = document.getElementById("intro-video");
  const tagline = overlay.querySelector(".intro-tagline");
  const loading = document.getElementById("intro-loading");
  const tapplay = document.getElementById("intro-tapplay");
  const soundHint = document.getElementById("intro-sound-hint");

  // Belt-and-suspenders: ensure muted is set before play() is called (required for iOS autoplay)
  video.muted = true;
  video.defaultMuted = true;

  // Auto-unmute on first user interaction + hide the sound hint
  const tryUnmute = () => {
    if (!video.muted) return;
    video.muted = false;
    soundHint?.classList.add("gone");
    // Fade the volume in so the cut isn't jarring
    video.volume = 0;
    let vol = 0;
    const ramp = setInterval(() => {
      vol = Math.min(1, vol + 0.1);
      video.volume = vol;
      if (vol >= 1) clearInterval(ramp);
    }, 40);
  };
  ["click", "touchstart", "keydown", "pointerdown"].forEach((ev) => {
    window.addEventListener(ev, tryUnmute, { once: true, passive: true });
  });

  // Block scrolling attempts while intro is active — no skip, users must watch
  const blockScroll = (e) => { e.preventDefault(); };
  window.addEventListener("wheel", blockScroll, { passive: false });
  window.addEventListener("touchmove", blockScroll, { passive: false });
  window.addEventListener("keydown", (e) => {
    // Block keys that scroll: space, arrows, page up/down, home, end
    const blocked = [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
                     "PageUp", "PageDown", "Home", "End"];
    if (blocked.includes(e.key)) e.preventDefault();
  }, { once: false });

  let finished = false;
  const cleanup = () => {
    // Unlock scroll and remove the scroll-blocking listeners
    document.documentElement.classList.remove("intro-active");
    document.body.classList.remove("intro-active");
    window.removeEventListener("wheel", blockScroll);
    window.removeEventListener("touchmove", blockScroll);
    // Resume Lenis smooth scroll now that the user can navigate the site
    if (typeof lenis !== "undefined" && lenis.start) lenis.start();
  };
  const finish = (fast = false) => {
    if (finished) return;
    finished = true;
    gsap.to(overlay, {
      opacity: 0,
      scale: fast ? 1 : 1.04,
      duration: fast ? 0.35 : 0.55,
      ease: "power2.inOut",
      onComplete: () => { overlay.remove(); cleanup(); },
    });
  };

  // Pre-schedule the tagline reveal (at ~4s) and the overlay fade-out (at ~6.5s)
  // so the end transition is smooth — fade starts BEFORE video ends, no visible lag.
  let taglineShown = false;
  let fadeStarted = false;
  video.addEventListener("timeupdate", () => {
    if (!taglineShown && video.currentTime >= 4) {
      taglineShown = true;
      gsap.fromTo(tagline,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out" }
      );
    }
    if (!fadeStarted && video.currentTime >= 6.5) {
      fadeStarted = true;
      // Start the overlay fade while the video is still playing its last frames
      // — by the time video.ended fires, overlay is already mostly gone.
      finished = true;
      gsap.to(overlay, {
        opacity: 0,
        scale: 1.04,
        duration: 0.7,
        ease: "power2.inOut",
        onComplete: () => { overlay.remove(); cleanup(); },
      });
    }
  });

  // Safety catch: if the browser misfires and we never hit 6.5s, still handle ended
  video.addEventListener("ended", () => finish(true));

  // Wait until the video can play through without re-buffering, THEN reveal + play
  const startPlayback = () => {
    loading?.classList.add("hidden");
    video.classList.add("ready");
    video.play().catch(() => {
      // Autoplay blocked — show tap-to-play fallback
      tapplay.hidden = false;
      tapplay.querySelector(".intro-tapplay-btn").addEventListener("click", () => {
        tapplay.hidden = true;
        video.play().catch(() => finish(true));
      }, { once: true });
    });
  };

  // Start playback once video is ready. If it's already cached/buffered, fire immediately.
  let started = false;
  const onReady = () => {
    if (started) return;
    started = true;
    startPlayback();
  };

  // Critical: on a cached refresh, readyState may already be 4 before we attach listeners
  if (video.readyState >= 4) {
    onReady();
  } else {
    video.addEventListener("canplaythrough", onReady, { once: true });
    video.addEventListener("loadeddata", () => {
      // Also kick off if loadeddata fires but canplaythrough doesn't within 1s
      setTimeout(() => { if (!started && video.readyState >= 3) onReady(); }, 1000);
    }, { once: true });
  }

  // Fallback: 2s cap on the buffer wait
  setTimeout(() => {
    if (!started && video.readyState >= 2) onReady();
  }, 2000);

  // Safety bail: 7s with no playable data at all → skip to hero
  setTimeout(() => {
    if (!started && video.readyState < 2) finish();
  }, 7000);

  // Nudge: ensure the network request actually fires for the video
  video.load();
}

// ---- Lenis Smooth Scroll ----
const lenis = new Lenis({
  duration: 1.1,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
});
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// ---- Loader ----
function initLoader() {
  const loader = document.getElementById("loader");
  const bar = document.getElementById("loader-bar");
  const images = [...document.querySelectorAll("img")];

  let loaded = 0;
  const total = Math.max(images.length, 1);

  function update() {
    loaded++;
    bar.style.width = Math.round((loaded / total) * 100) + "%";
  }

  if (images.length === 0) {
    bar.style.width = "100%";
  } else {
    images.forEach((img) =>
      img.decode().then(update).catch(update)
    );
  }

  setTimeout(() => {
    bar.style.width = "100%";
    setTimeout(() => {
      gsap.to(loader, {
        opacity: 0, duration: 0.5,
        onComplete: () => loader.remove(),
      });
    }, 300);
  }, 800);
}

// ---- Header scroll effect ----
function initHeader() {
  const header = document.querySelector(".header");
  ScrollTrigger.create({
    start: "top -60",
    onUpdate: () => {
      header.classList.toggle("scrolled", window.scrollY > 60);
    },
  });
}

// ---- Split text into chars ----
function splitText(el) {
  if (!el || el.dataset.split === "true") return [];
  const text = el.textContent;
  el.textContent = "";
  const chars = [];
  for (const ch of text) {
    const span = document.createElement("span");
    span.className = "split-char" + (ch === " " ? " space" : "");
    span.textContent = ch === " " ? "\u00A0" : ch;
    el.appendChild(span);
    if (ch !== " ") chars.push(span);
  }
  el.dataset.split = "true";
  return chars;
}

function splitHtmlPreserving(el) {
  if (!el || el.dataset.split === "true") return [];
  const chars = [];
  const walk = (node) => {
    const kids = [...node.childNodes];
    kids.forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const ch of n.textContent) {
          const span = document.createElement("span");
          span.className = "split-char" + (ch === " " ? " space" : "");
          span.textContent = ch === " " ? "\u00A0" : ch;
          frag.appendChild(span);
          if (ch !== " ") chars.push(span);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1) {
        // Skip splitting inside elements that must stay whole (e.g. gradient-text spans)
        if (n.classList.contains("no-split")) {
          chars.push(n);
          return;
        }
        walk(n);
      }
    });
  };
  walk(el);
  el.dataset.split = "true";
  return chars;
}

// ---- Hero animations ----
function initHero() {
  const titleEl = document.querySelector(".hero-title");
  const titleChars = titleEl ? splitHtmlPreserving(titleEl) : [];

  const tl = gsap.timeline({ delay: 0.8 });

  tl.from(".hero-badge", { y: 20, opacity: 0, duration: 0.5, ease: "power3.out" });
  if (titleChars.length) {
    tl.from(titleChars, {
      y: 40, opacity: 0, rotateX: -50,
      duration: 0.7, stagger: 0.025, ease: "power3.out",
    }, "-=0.2");
  }
  tl.from(".hero-subtitle", { y: 20, opacity: 0, duration: 0.5, ease: "power3.out" }, "-=0.3")
    .from(".hero-actions", { y: 20, opacity: 0, duration: 0.5, ease: "power3.out" }, "-=0.2")
    .from(".hero-social", { y: 15, opacity: 0, duration: 0.4, ease: "power3.out" }, "-=0.2")
    .from(".hero-photo-shape", { x: 60, opacity: 0, duration: 0.8, ease: "power2.out" }, 0.5)
    .from(".hero-photo", { y: 50, opacity: 0, duration: 0.8, ease: "power3.out" }, 0.6)
    .from(".hero-floating-card", { y: 20, opacity: 0, scale: 0.9, duration: 0.5, ease: "back.out(1.5)" }, 1.1);
}

// ---- Section headings split + scroll reveal ----
function initHeadingsReveal() {
  const headings = document.querySelectorAll(
    ".about-text h2, .services-inner h2, .process-inner h2, .testimonials-inner h2, .free-guide h2, .contact-info h2, .closing h2"
  );
  headings.forEach((h) => {
    const chars = splitHtmlPreserving(h);
    if (!chars.length) return;
    gsap.from(chars, {
      y: 40, opacity: 0, rotateX: -60,
      duration: 0.7, stagger: 0.02, ease: "power3.out",
      scrollTrigger: { trigger: h, start: "top 85%", once: true },
    });
  });
}

// ---- Reveal on scroll ----
function initReveal() {
  const reveals = document.querySelectorAll(".reveal");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  reveals.forEach((el) => observer.observe(el));
}

// ---- Odometer-style counter animations ----
function initCounters() {
  const stats = document.querySelectorAll(".stat");

  ScrollTrigger.create({
    trigger: ".stats-bar",
    start: "top 80%",
    once: true,
    onEnter: () => {
      stats.forEach((stat, i) => {
        const numEl = stat.querySelector(".stat-num");
        const target = parseInt(stat.dataset.value);
        const duration = 1.8;
        const obj = { val: 0 };
        let lastText = "";

        gsap.to(obj, {
          val: target,
          duration,
          delay: i * 0.08,
          ease: "steps(" + Math.max(target, 24) + ")",
          onUpdate: () => {
            const next = String(Math.round(obj.val));
            if (next !== lastText) {
              numEl.textContent = next;
              // quick vertical flip on every digit change
              gsap.fromTo(numEl,
                { y: -6, rotateX: 45, filter: "blur(0.5px)" },
                { y: 0, rotateX: 0, filter: "blur(0)", duration: 0.12, ease: "power2.out" }
              );
              lastText = next;
            }
          },
          onComplete: () => {
            gsap.fromTo(numEl,
              { scale: 1 },
              { scale: 1.15, duration: 0.15, ease: "power2.out", yoyo: true, repeat: 1 }
            );
          },
        });
      });
    },
  });
}

// ---- Cursor glow ----
function initCursorGlow() {
  if (matchMedia("(hover: none)").matches) return;
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  document.body.appendChild(glow);

  const xTo = gsap.quickTo(glow, "x", { duration: 0.6, ease: "power3" });
  const yTo = gsap.quickTo(glow, "y", { duration: 0.6, ease: "power3" });

  let shown = false;
  window.addEventListener("mousemove", (e) => {
    if (!shown) { glow.classList.add("active"); shown = true; }
    xTo(e.clientX);
    yTo(e.clientY);
  });
  window.addEventListener("mouseleave", () => glow.classList.remove("active"));
  window.addEventListener("mouseenter", () => glow.classList.add("active"));
}

// ---- Magnetic buttons ----
function initMagnetic() {
  if (matchMedia("(hover: none)").matches) return;
  const targets = document.querySelectorAll(".btn, .floating-cta, .hero-social a, .contact-item");
  targets.forEach((el) => {
    const strength = el.classList.contains("floating-cta") ? 0.3 : 0.22;
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * strength;
      const y = (e.clientY - r.top - r.height / 2) * strength;
      gsap.to(el, { x, y, duration: 0.4, ease: "power3.out" });
    });
    el.addEventListener("mouseleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
    });
  });
}

// ---- 3D tilt on cards ----
function initCardTilt() {
  if (matchMedia("(hover: none)").matches) return;
  const cards = document.querySelectorAll(".service-card, .testimonial-card");
  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const rotY = (x - 0.5) * 14;
      const rotX = -(y - 0.5) * 14;
      gsap.to(card, {
        rotateY: rotY,
        rotateX: rotX,
        translateZ: 20,
        duration: 0.4,
        ease: "power2.out",
        transformPerspective: 900,
      });
    });
    card.addEventListener("mouseleave", () => {
      gsap.to(card, {
        rotateY: 0, rotateX: 0, translateZ: 0,
        duration: 0.7, ease: "power3.out",
      });
    });
  });
}

// ---- Georgia banner parallax ----
function initGeorgiaParallax() {
  const bgImg = document.querySelector(".georgia-bg-img");
  if (!bgImg) return;
  gsap.to(bgImg, {
    yPercent: 18,
    ease: "none",
    scrollTrigger: {
      trigger: ".georgia-banner",
      start: "top bottom",
      end: "bottom top",
      scrub: true,
    },
  });
}

// ---- Marquee ----
function initMarquee() {
  const track = document.querySelector(".marquee-track");
  if (!track) return;

  gsap.to(track, {
    xPercent: -50,
    duration: 25,
    ease: "none",
    repeat: -1,
  });
}

// ---- Hero photo parallax on mousemove ----
function initHeroParallax() {
  const photo = document.querySelector(".hero-photo");
  const shape = document.querySelector(".hero-photo-shape");
  const card = document.querySelector(".hero-floating-card");
  const wrap = document.querySelector(".hero-right");
  if (!photo || !wrap) return;

  wrap.addEventListener("mousemove", (e) => {
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) / r.width;
    const y = (e.clientY - r.top - r.height / 2) / r.height;

    gsap.to(photo, { x: x * 12, y: y * 10, duration: 0.8, ease: "power2.out" });
    if (shape) gsap.to(shape, { x: x * -20, y: y * -16, duration: 0.9, ease: "power2.out" });
    if (card) gsap.to(card, { x: x * 20, y: y * 14, duration: 0.9, ease: "power2.out" });
  });

  wrap.addEventListener("mouseleave", () => {
    gsap.to([photo, shape, card].filter(Boolean), { x: 0, y: 0, duration: 0.9, ease: "power2.out" });
  });
}

// ---- Contact Form ----
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById("formStatus");
    const btn = form.querySelector(".btn");
    btn.textContent = "Enviando...";
    btn.disabled = true;

    const data = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch(CONFIG.leadWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        status.textContent = "¡Mensaje enviado! Me pondré en contacto contigo muy pronto.";
        status.style.color = CONFIG.accent;
        form.reset();
      } else {
        throw new Error("Server error");
      }
    } catch {
      status.textContent = `Algo salió mal. Llámame al ${CONFIG.phoneDisplay}.`;
      status.style.color = "#e53e3e";
    } finally {
      btn.textContent = "Contáctame";
      btn.disabled = false;
    }
  });
}

// ---- Smooth anchors ----
function initAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (target) {
        e.preventDefault();
        // Reveal sections that are hidden by default (e.g. About)
        if (!target.classList.contains("revealed")) {
          target.classList.add("revealed");
          // Let the browser render the now-visible element before scrolling,
          // otherwise lenis measures height as 0 and scroll position is wrong
          requestAnimationFrame(() => {
            requestAnimationFrame(() => lenis.scrollTo(target, { offset: -80 }));
          });
        } else {
          lenis.scrollTo(target, { offset: -80 });
        }
      }
    });
  });
}

// ---- Hamburger ----
function initHamburger() {
  const btn = document.querySelector(".hamburger");
  const links = document.querySelector(".nav-links");
  if (!btn || !links) return;

  btn.addEventListener("click", () => {
    btn.classList.toggle("active");
    links.classList.toggle("open");
  });
  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      btn.classList.remove("active");
      links.classList.remove("open");
    });
  });
}

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  initIntroOverlay();
  initLoader();
  initHeader();
  initHero();
  initHeadingsReveal();
  initReveal();
  initCounters();
  initMarquee();
  initGeorgiaParallax();
  initHeroParallax();
  initCursorGlow();
  initMagnetic();
  initCardTilt();
  initContactForm();
  initAnchors();
  initHamburger();
});
