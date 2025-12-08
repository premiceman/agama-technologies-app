(function() {
  const body = document.body;
  if (!body || !body.classList.contains('consulting-page')) return;

  const navLinks = Array.from(document.querySelectorAll('[data-consulting-nav]'));
  const scrollLinks = Array.from(document.querySelectorAll('[data-scroll-target]'));

  initSmoothScroll([...navLinks, ...scrollLinks]);
  initSubnavSpy(navLinks);
})();

function initSmoothScroll(links) {
  const uniqueLinks = Array.from(new Set(links));
  if (!uniqueLinks.length) return;

  uniqueLinks.forEach(link => {
    link.addEventListener('click', event => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const targetId = href.slice(1);
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      const offset = 90;
      const targetY = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    });
  });
}

function initSubnavSpy(navLinks) {
  if (!navLinks.length) return;
  const sections = navLinks
    .map(link => document.getElementById(link.dataset.subnavTarget))
    .filter(Boolean);

  const setActive = id => {
    navLinks.forEach(link => {
      const isActive = link.dataset.subnavTarget === id;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        setActive(id);
      });
    },
    { threshold: 0.4 }
  );

  sections.forEach(section => observer.observe(section));
}
