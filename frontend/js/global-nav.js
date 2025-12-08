(function() {
  const body = document.body;
  if (!body || body.classList.contains('app-shell')) return;
  const enableNav = body.hasAttribute('data-enable-global-nav');
  if (!enableNav) return;

  const navHost = document.getElementById('globalNavMount');
  const nav = buildNav();

  if (navHost) {
    navHost.replaceWith(nav);
  } else {
    body.insertBefore(nav, body.firstChild);
  }

  setupScrollEffects(nav);
  setupSuitesDropdown(nav);
  setupMobileMenu(nav);
  setupSmoothAnchors(nav);

  function buildNav() {
    const navWrapper = document.createElement('div');
    navWrapper.className = 'global-nav-shell';
    navWrapper.innerHTML = `
      <nav class="global-nav" aria-label="Global navigation">
        <div class="container global-nav-inner">
          <a class="brand" href="/">
            <span class="brand-dot"></span>
            <span class="brand-name">Agama <strong>Technologies</strong></span>
          </a>
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobileNavPanel" aria-label="Toggle navigation">
            <span class="nav-toggle-icon"></span>
          </button>
          <div class="global-nav-links" role="menubar">
            <a class="nav-link" href="/">Platform</a>
            <div class="nav-dropdown" data-dropdown>
              <button class="nav-link nav-link-inline" type="button" aria-expanded="false" aria-haspopup="true">Suites <i class="bi bi-chevron-down small ms-1"></i></button>
              <div class="dropdown-panel" role="menu">
                <a class="suite-card suite-seller" href="/seller-suite.html" role="menuitem">
                  <div class="suite-label">Seller Suite</div>
                  <p class="suite-desc">ValueSphere + RevenueForge for revenue teams.</p>
                </a>
                <a class="suite-card suite-buyer" href="/buyer-suite.html" role="menuitem">
                  <div class="suite-label">Buyer Suite</div>
                  <p class="suite-desc">ProcurePath for procurement, finance, and security.</p>
                </a>
                <a class="suite-card suite-collaboration" href="/collaboration-suite.html" role="menuitem">
                  <div class="suite-label">Collaboration Suite</div>
                  <p class="suite-desc">Engagement Rooms for shared execution and guests.</p>
                </a>
              </div>
            </div>
            <a class="nav-link" href="/consulting">Consulting</a>
            <a class="nav-link" href="/resources">Resources</a>
          </div>
          <div class="global-nav-actions">
            <a class="btn btn-ghost" href="/api/auth/workos/login">Sign in</a>
            <a class="btn btn-primary" href="/contact.html#demo">Get a demo</a>
          </div>
        </div>
      </nav>
      <div class="mobile-nav-backdrop" id="mobileNavBackdrop"></div>
      <div class="mobile-nav-panel" id="mobileNavPanel" aria-hidden="true" role="dialog" aria-label="Mobile navigation">
        <div class="mobile-nav-header">
          <a class="brand" href="/">
            <span class="brand-dot"></span>
            <span class="brand-name">Agama <strong>Technologies</strong></span>
          </a>
          <button class="nav-close" type="button" aria-label="Close navigation">&times;</button>
        </div>
        <div class="mobile-nav-body">
          <a class="mobile-nav-link" href="/">Platform</a>
          <div class="mobile-nav-group" data-suite-group>
            <div class="mobile-nav-label">Suites</div>
            <a class="mobile-nav-link" href="/seller-suite.html">Seller Suite <span class="suite-badge suite-seller"></span></a>
            <a class="mobile-nav-link" href="/buyer-suite.html">Buyer Suite <span class="suite-badge suite-buyer"></span></a>
            <a class="mobile-nav-link" href="/collaboration-suite.html">Collaboration Suite <span class="suite-badge suite-collaboration"></span></a>
          </div>
          <a class="mobile-nav-link" href="/consulting">Consulting</a>
          <a class="mobile-nav-link" href="/resources">Resources</a>
          <hr class="mobile-divider" />
          <a class="mobile-nav-link" href="/api/auth/workos/login">Sign in</a>
          <a class="btn btn-primary w-100" href="/contact.html#demo">Get a demo</a>
        </div>
      </div>
    `;
    return navWrapper;
  }

  function setupScrollEffects(nav) {
    const navEl = nav.querySelector('.global-nav');
    if (!navEl) return;
    const hero = document.getElementById('hero');
    const shrinkOffset = hero ? hero.offsetHeight * 0.35 : 120;
    const handleScroll = () => {
      const isSticky = window.scrollY > shrinkOffset;
      navEl.classList.toggle('is-sticky', isSticky);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  function setupSuitesDropdown(nav) {
    const dropdown = nav.querySelector('[data-dropdown]');
    const toggle = dropdown?.querySelector('button');
    const panel = dropdown?.querySelector('.dropdown-panel');
    if (!dropdown || !toggle || !panel) return;

    let open = false;

    const close = () => {
      open = false;
      dropdown.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      panel.setAttribute('aria-hidden', 'true');
    };

    const openMenu = () => {
      open = true;
      dropdown.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      panel.setAttribute('aria-hidden', 'false');
    };

    const toggleMenu = () => (open ? close() : openMenu());

    toggle.addEventListener('click', event => {
      event.preventDefault();
      toggleMenu();
    });

    dropdown.addEventListener('mouseenter', openMenu);
    dropdown.addEventListener('mouseleave', close);

    toggle.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        close();
        toggle.focus();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openMenu();
        const firstLink = panel.querySelector('a');
        firstLink?.focus();
      }
    });

    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        close();
        toggle.focus();
      }
    });

    document.addEventListener('click', event => {
      if (!dropdown.contains(event.target)) {
        close();
      }
    });
  }

  function setupMobileMenu(nav) {
    const toggle = nav.querySelector('.nav-toggle');
    const panel = nav.querySelector('#mobileNavPanel');
    const backdrop = nav.querySelector('#mobileNavBackdrop');
    const closeBtn = nav.querySelector('.nav-close');
    if (!toggle || !panel || !backdrop || !closeBtn) return;

    const setOpen = isOpen => {
      panel.classList.toggle('open', isOpen);
      backdrop.classList.toggle('show', isOpen);
      panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.classList.toggle('no-scroll', isOpen);
    };

    toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    closeBtn.addEventListener('click', () => setOpen(false));
    backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('keyup', event => {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  function setupSmoothAnchors(nav) {
    nav.querySelectorAll('a[href^="/#"]').forEach(link => {
      link.addEventListener('click', event => {
        const targetId = link.getAttribute('href')?.slice(2);
        const target = document.getElementById(targetId);
        if (!target) return;
        event.preventDefault();
        const offset = 70;
        const rect = target.getBoundingClientRect();
        const targetY = rect.top + window.scrollY - offset;
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      });
    });
  }
})();
