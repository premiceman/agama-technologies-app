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
