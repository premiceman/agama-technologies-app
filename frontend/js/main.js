document.addEventListener('DOMContentLoaded', () => {
  if (window.AOS) {
    AOS.init({ once: true, duration: 700, easing: 'ease-out-cubic' });
  }

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const metricEls = document.querySelectorAll('.metric');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.target || el.textContent.replace(/[^0-9.]/g, ''));
      if (!el.dataset.animated && target) {
        animateMetric(el, target);
        el.dataset.animated = 'true';
      }
    });
  }, { threshold: 0.5 });

  metricEls.forEach(el => {
    const text = el.textContent.trim();
    const match = text.match(/[0-9.]+/);
    if (match) {
      el.dataset.target = match[0];
      el.firstChild && (el.firstChild.textContent = '0');
      observer.observe(el);
    }
  });

  initLiquidBackground();
});

function animateMetric(el, target) {
  const span = el.querySelector('span');
  let current = 0;
  const duration = 1600;
  const stepTime = 20;
  const steps = Math.ceil(duration / stepTime);
  const increment = target / steps;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.childNodes[0].textContent = formatNumber(current, target % 1 !== 0);
    if (span) span.style.opacity = 1;
  }, stepTime);
}

function formatNumber(value, allowDecimal) {
  if (allowDecimal) return value.toFixed(1);
  return Math.round(value).toString();
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

  const handlePointer = (event) => {
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
