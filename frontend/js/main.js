const SECTION_IDS = ['hero', 'platforms', 'vendor', 'buyer', 'rooms', 'ai', 'licenses'];
const NAV_ACTIVE_CLASS = 'active';

const defaultTheme = document.body?.getAttribute('data-theme') || 'vendor';

document.addEventListener('DOMContentLoaded', () => {
  if (window.AOS) {
    window.AOS.init({ once: true, duration: 750, easing: 'ease-out-cubic' });
  }

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initSmoothScroll();
  initScrollSpy();
  initLiquidBackground();
  initThemeShift();
  initRoleValueBlocks();
  initContactForm();
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

function initThemeShift() {
  const body = document.body;
  if (!body) return;

  const themeSections = Array.from(document.querySelectorAll('[data-theme-target]'));
  if (!themeSections.length) return;

  body.classList.add('theme-transition');
  const initialTheme = body.getAttribute('data-theme') || defaultTheme;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const theme = entry.target.getAttribute('data-theme-target');
        if (theme) {
          body.setAttribute('data-theme', theme);
        }
      });
    },
    { threshold: 0.45 }
  );

  themeSections.forEach(section => observer.observe(section));

  window.addEventListener(
    'scroll',
    () => {
      if (window.scrollY < 120) {
        body.setAttribute('data-theme', initialTheme);
      }
    },
    { passive: true }
  );
}

function initRoleValueBlocks() {
  const selects = document.querySelectorAll('select[data-role-target]');
  selects.forEach(select => {
    const targetId = select.getAttribute('data-role-target');
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;

    const cards = Array.from(target.querySelectorAll('[data-role]'));
    if (!cards.length) return;

    const setRole = role => {
      cards.forEach(card => {
        const isActive = card.getAttribute('data-role') === role;
        card.classList.toggle('active', isActive);
        card.toggleAttribute('aria-hidden', !isActive);
      });
    };

    select.addEventListener('change', () => setRole(select.value));

    const initial = select.value || cards[0].getAttribute('data-role');
    setRole(initial);
    select.closest('.role-selector')?.classList.add('ready');
  });
}

function initContactForm() {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  const status = form.querySelector('[data-contact-status]');
  form.addEventListener('submit', event => {
    event.preventDefault();

    const data = new FormData(form);
    const values = Object.fromEntries(data.entries());
    const subject = encodeURIComponent(`Agama demo request — ${values.interest || 'Platform'}`);

    const lines = [
      `Name: ${values.name || 'N/A'}`,
      `Company: ${values.company || 'N/A'}`,
      `Email: ${values.email || 'N/A'}`,
      `Role: ${values.role || 'N/A'}`,
      `Interest: ${values.interest || 'Platform'}`,
      `Use case: ${values.message || 'N/A'}`
    ];

    const mailto = `mailto:sales@agamatechnologies.com?subject=${subject}&body=${encodeURIComponent(lines.join('\n'))}`;
    window.location.href = mailto;

    if (status) {
      status.textContent = 'Opening your email client to send the details to sales@agamatechnologies.com...';
      status.classList.add('show');
    }

    form.reset();
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
