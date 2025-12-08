(function () {
  const sidebarSelector = '.app-sidebar';
  const linkSelector = '.sidebar-link';
  const indicatorVar = '--sidebar-indicator-offset';

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(sidebarSelector).forEach(sidebar => {
      enhanceSidebar(sidebar);
    });
  });

  function enhanceSidebar(sidebar) {
    const nav = sidebar.querySelector('.sidebar-nav');
    const links = Array.from(sidebar.querySelectorAll(linkSelector));
    if (!nav || !links.length) return;

    const sectionLinks = links
      .map(link => {
        const hash = link.hash?.replace('#', '');
        if (!hash) return null;
        const target = document.getElementById(hash);
        return target ? { link, target } : null;
      })
      .filter(Boolean);

    let currentLink = links.find(link => link.classList.contains('active')) || links[0];

    const setIndicator = link => {
      if (!link || !nav) return;
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      const offset = clamp(linkRect.top - navRect.top, 0, Math.max(navRect.height - linkRect.height, 0));
      sidebar.style.setProperty(indicatorVar, `${offset}px`);
    };

    const selectCurrent = candidate => {
      currentLink = candidate || currentLink;
      setIndicator(currentLink);
    };

    if (sectionLinks.length) {
      const observer = new IntersectionObserver(
        entries => {
          let next = currentLink;
          entries.forEach(entry => {
            const match = sectionLinks.find(item => item.target === entry.target);
            if (!match) return;
            match.link.classList.toggle('in-view', entry.isIntersecting);
            if (entry.isIntersecting) {
              next = match.link;
            }
          });
          const preferred = sectionLinks.find(item => item.link.classList.contains('in-view'))?.link;
          selectCurrent(preferred || next);
        },
        { threshold: 0.48, rootMargin: '-10% 0px -30% 0px' }
      );

      sectionLinks.forEach(({ target }) => observer.observe(target));
      window.addEventListener('scroll', () => setIndicator(currentLink), { passive: true });
    }

    window.addEventListener('resize', () => setIndicator(currentLink));
    nav.addEventListener('scroll', () => setIndicator(currentLink), { passive: true });
    links.forEach(link => {
      link.addEventListener('mouseenter', () => setIndicator(link));
      link.addEventListener('focus', () => setIndicator(link));
      link.addEventListener('click', () => {
        selectCurrent(link);
      });
    });

    selectCurrent(currentLink);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
})();
