(function () {
  const navLinks = Array.from(document.querySelectorAll('[data-doc-link]'));
  const sections = navLinks
    .map((link) => {
      const target = document.querySelector(link.getAttribute('href'));
      return target ? { link, target } : null;
    })
    .filter(Boolean);

  if (!sections.length) return;

  if (navLinks.length) {
    navLinks[0].classList.add('active');
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = link.getAttribute('href');
      const target = document.querySelector(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        link.focus({ preventScroll: true });
      }
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const section = sections.find((item) => item.target === entry.target);
        if (!section) return;
        if (entry.isIntersecting) {
          navLinks.forEach((l) => l.classList.remove('active'));
          section.link.classList.add('active');
        }
      });
    },
    { rootMargin: '-40% 0px -50% 0px', threshold: 0.1 }
  );

  sections.forEach(({ target }) => observer.observe(target));
})();
