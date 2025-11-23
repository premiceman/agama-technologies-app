const SECTION_IDS = ['hero', 'platforms', 'vendor', 'buyer', 'rooms', 'ai', 'licenses'];
const NAV_ACTIVE_CLASS = 'active';

document.addEventListener('DOMContentLoaded', () => {
  if (window.AOS) {
    window.AOS.init({ once: true, duration: 700, easing: 'ease-out-cubic' });
  }

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initSmoothScroll();
  initScrollSpy();
  initLiquidBackground();
});

function initSmoothScroll() {
  const links = document.querySelectorAll('a.nav-link[href^="#"]');
  links.forEach(link => {
    link.addEventListener('click', event => {
      const targetId = link.getAttribute('href')?.replace('#', '');
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function initScrollSpy() {
  const navLinks = Array.from(document.querySelectorAll('#navLinks .nav-link'));
  if (!navLinks.length) return;

  const sectionElements = SECTION_IDS.map(id => document.getElementById(id)).filter(Boolean);
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        navLinks.forEach(link => link.classList.toggle(NAV_ACTIVE_CLASS, link.getAttribute('href') === `#${id}`));
      });
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: 0.1 }
  );

  sectionElements.forEach(section => observer.observe(section));
}

function initLiquidBackground() {
  const root = document.documentElement;
  if (!root) return;

  let pointerX = 0.5;
  let pointerY = 0.5;
  let pointerFrame = null;
  let scrollFrame = null;

  const commitPointer = () => {
    pointerFrame = null;
    root.style.setProperty('--pointer-x', pointerX.toFixed(3));
    root.style.setProperty('--pointer-y', pointerY.toFixed(3));
  };

  const handlePointer = event => {
    pointerX = clamp(event.clientX / window.innerWidth || 0, 0, 1);
    pointerY = clamp(event.clientY / window.innerHeight || 0, 0, 1);
    if (!pointerFrame) {
      pointerFrame = requestAnimationFrame(commitPointer);
    }
  };

  window.addEventListener('pointermove', handlePointer, { passive: true });

  const commitScroll = () => {
    scrollFrame = null;
    const max = document.body.scrollHeight - window.innerHeight;
    const progress = max > 0 ? window.scrollY / max : 0;
    root.style.setProperty('--scroll-progress', clamp(progress, 0, 1).toFixed(3));
  };

  const handleScroll = () => {
    if (!scrollFrame) {
      scrollFrame = requestAnimationFrame(commitScroll);
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  commitPointer();
  commitScroll();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
