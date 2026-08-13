type SiteWindow = Window & typeof globalThis & {
  CWLUtils?: {
    storageGet?: (key: string) => string | null;
    storageSet?: (key: string, value: string) => unknown;
    t?: (key: string, fallback: string) => string;
    throttle?: <T extends (...args: any[]) => void>(callback: T, wait: number) => T;
  };
};

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  hue: number;
};

const STORAGE_KEY_THEME = "coder-color-scheme";
const THEME_MODES = ["auto", "light", "dark"] as const;
type ThemeMode = typeof THEME_MODES[number];

function initTheme(doc: Document, win: SiteWindow) {
  let stored: string | null = null;
  try {
    stored = win.CWLUtils?.storageGet
      ? win.CWLUtils.storageGet(STORAGE_KEY_THEME)
      : win.localStorage.getItem(STORAGE_KEY_THEME);
  } catch (error) {
    win.console.warn("Failed to read theme from localStorage:", error);
  }

  const systemThemeQuery = (win.matchMedia
    ? win.matchMedia("(prefers-color-scheme: dark)")
    : null) as LegacyMediaQueryList | null;
  let themeMode: ThemeMode = THEME_MODES.includes(stored as ThemeMode)
    ? stored as ThemeMode
    : "auto";
  const systemTheme = () => !systemThemeQuery || systemThemeQuery.matches ? "dark" : "light";
  const updateButtons = (actualTheme: string) => {
    for (const button of doc.querySelectorAll<HTMLElement>(".theme-toggle")) {
      button.dataset.themeMode = themeMode;
      button.dataset.themeActual = actualTheme;
      button.title = themeMode === "auto" ? "Auto theme" : `${actualTheme} theme`;
      const icon = button.querySelector<HTMLElement>("i");
      if (icon) icon.className = "fas fa-adjust";
    }
  };
  const applyTheme = () => {
    const actualTheme = themeMode === "auto" ? systemTheme() : themeMode;
    doc.body.classList.toggle("colorscheme-dark", actualTheme === "dark");
    doc.body.classList.toggle("colorscheme-light", actualTheme === "light");
    updateButtons(actualTheme);
  };
  const saveTheme = () => {
    try {
      if (win.CWLUtils?.storageSet) win.CWLUtils.storageSet(STORAGE_KEY_THEME, themeMode);
      else win.localStorage.setItem(STORAGE_KEY_THEME, themeMode);
    } catch (error) {
      win.console.warn("Failed to save theme to localStorage:", error);
    }
  };
  const nextTheme = () => THEME_MODES[(THEME_MODES.indexOf(themeMode) + 1) % THEME_MODES.length];

  applyTheme();
  const buttonListeners: Array<[HTMLElement, () => void]> = [];
  for (const button of doc.querySelectorAll<HTMLElement>(".theme-toggle")) {
    const onClick = () => {
      themeMode = nextTheme();
      applyTheme();
      saveTheme();
    };
    button.addEventListener("click", onClick);
    buttonListeners.push([button, onClick]);
  }
  const onSystemThemeChange = () => {
    if (themeMode === "auto") applyTheme();
  };
  if (systemThemeQuery?.addEventListener) systemThemeQuery.addEventListener("change", onSystemThemeChange);
  else systemThemeQuery?.addListener?.(onSystemThemeChange);
  return () => {
    buttonListeners.forEach(([button, listener]) => button.removeEventListener("click", listener));
    if (systemThemeQuery?.removeEventListener) systemThemeQuery.removeEventListener("change", onSystemThemeChange);
    else systemThemeQuery?.removeListener?.(onSystemThemeChange);
  };
}

function initBackToTop(doc: Document, win: SiteWindow) {
  const existing = doc.querySelector<HTMLButtonElement>(".to-top");
  const button = existing || doc.createElement("button");
  button.classList.add("to-top");
  button.type = "button";
  if (!button.childNodes.length) {
    const icon = doc.createElement("i");
    icon.className = "fas fa-arrow-up";
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);
  }
  const scrollToTop = () => win.scrollTo({ top: 0, behavior: "smooth" });
  const translate = win.CWLUtils?.t || ((_key: string, fallback: string) => fallback);
  const updateLabel = () => button.setAttribute("aria-label", translate("dyn.totop", "返回顶部"));
  const updateVisibility = () => {
    const scrollTop = win.scrollY || doc.documentElement.scrollTop || 0;
    button.classList.toggle("visible", scrollTop > 420);
  };
  const throttledScroll = win.CWLUtils?.throttle?.(updateVisibility, 100) || updateVisibility;

  button.addEventListener("click", scrollToTop);
  if (!existing) doc.body.appendChild(button);
  win.addEventListener("scroll", throttledScroll, { passive: true });
  doc.addEventListener("cwl:langchange", updateLabel);
  updateLabel();
  updateVisibility();
  doc.body.classList.add("to-top-ready");
  return () => {
    button.removeEventListener("click", scrollToTop);
    win.removeEventListener("scroll", throttledScroll);
    doc.removeEventListener("cwl:langchange", updateLabel);
  };
}

function initReveal(doc: Document, win: SiteWindow, prefersReduced: boolean) {
  if (prefersReduced || typeof win.IntersectionObserver !== "function") return () => {};
  const targets = Array.from(doc.querySelectorAll<HTMLElement>(
    ".card, .ai-card, .insight-list li, .timeline-stats div, .feedback-item, .post-item",
  ));
  if (!targets.length) return () => {};
  targets.forEach((target) => target.classList.add("reveal"));
  const observer = new win.IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  targets.forEach((target) => observer.observe(target));
  return () => observer.disconnect();
}

function initSkillBars(doc: Document, win: SiteWindow, prefersReduced: boolean) {
  const fills = Array.from(doc.querySelectorAll<HTMLElement>(".skill-fill[data-level]"));
  if (!fills.length) return () => {};
  if (prefersReduced || typeof win.IntersectionObserver !== "function") {
    fills.forEach((fill) => fill.classList.add("is-filled"));
    return () => {};
  }
  const observer = new win.IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.querySelector(".skill-fill")?.classList.add("is-filled");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.4 });
  fills.forEach((fill) => observer.observe(fill.parentElement || fill));
  return () => observer.disconnect();
}

function initPointerTrail(doc: Document, win: SiteWindow, prefersReduced: boolean) {
  const canvas = doc.querySelector<HTMLCanvasElement>(".cursor-canvas");
  if (!canvas || prefersReduced) return () => {};
  let context: CanvasRenderingContext2D | null = null;
  const particles: Particle[] = [];
  let hue = 190;
  let animationFrame = 0;
  let canvasSized = false;
  let disposed = false;

  const resizeCanvas = () => {
    if (!context) return;
    const ratio = win.devicePixelRatio || 1;
    canvas.width = Math.floor(win.innerWidth * ratio);
    canvas.height = Math.floor(win.innerHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    canvasSized = true;
  };
  const removeParticle = (index: number) => {
    particles[index] = particles[particles.length - 1];
    particles.pop();
  };
  const stopDraw = () => {
    if (animationFrame) win.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };
  const scheduleDraw = () => {
    if (disposed || animationFrame || doc.hidden || !particles.length) return;
    animationFrame = win.requestAnimationFrame(draw);
  };
  const drawParticle = (particle: Particle) => {
    if (!context) return;
    const coreRadius = particle.radius * particle.life;
    const glowRadius = coreRadius * 2.4;
    context.globalAlpha = particle.life * 0.28;
    context.beginPath();
    context.fillStyle = `hsla(${particle.hue}, 90%, 62%, 1)`;
    context.arc(particle.x, particle.y, glowRadius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = particle.life;
    context.beginPath();
    context.arc(particle.x, particle.y, coreRadius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  };
  function draw() {
    animationFrame = 0;
    if (disposed || doc.hidden || !particles.length || !context) return;
    context.clearRect(0, 0, win.innerWidth, win.innerHeight);
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.012;
      particle.life -= 0.018;
      if (particle.life <= 0) removeParticle(index);
      else drawParticle(particle);
    }
    scheduleDraw();
  }
  const onResize = () => {
    if (canvasSized) resizeCanvas();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!context) {
      context = canvas.getContext("2d");
      if (!context) return;
    }
    if (!canvasSized) resizeCanvas();
    hue = (hue + 2) % 360;
    particles.push({
      x: event.clientX,
      y: event.clientY,
      vx: (Math.random() - 0.5) * 1.6,
      vy: (Math.random() - 0.5) * 1.6,
      radius: Math.random() * 4 + 2,
      life: 1,
      hue: hue + Math.random() * 40,
    });
    if (particles.length > 90) particles.shift();
    scheduleDraw();
  };
  const onPointerLeave = () => doc.body.classList.remove("cursor-active");
  const onVisibilityChange = () => doc.hidden ? stopDraw() : scheduleDraw();
  win.addEventListener("resize", onResize);
  win.addEventListener("pointermove", onPointerMove);
  win.addEventListener("pointerleave", onPointerLeave);
  doc.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    disposed = true;
    stopDraw();
    particles.length = 0;
    win.removeEventListener("resize", onResize);
    win.removeEventListener("pointermove", onPointerMove);
    win.removeEventListener("pointerleave", onPointerLeave);
    doc.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

export function initSiteRuntime(
  doc: Document = document,
  win: SiteWindow = window as SiteWindow,
) {
  if (!doc.body || doc.documentElement.dataset.siteRuntimeReady === "true") return;
  doc.documentElement.dataset.siteRuntimeReady = "true";
  const prefersReduced = win.matchMedia
    ? win.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
  const cleanups = [
    initTheme(doc, win),
    initBackToTop(doc, win),
    initReveal(doc, win, prefersReduced),
    initSkillBars(doc, win, prefersReduced),
    initPointerTrail(doc, win, prefersReduced),
  ];
  win.addEventListener("pagehide", () => {
    cleanups.forEach((cleanup) => cleanup());
    delete doc.documentElement.dataset.siteRuntimeReady;
    win.addEventListener("pageshow", (event) => {
      if ((event as PageTransitionEvent).persisted) initSiteRuntime(doc, win);
    }, { once: true });
  }, { once: true });
}
