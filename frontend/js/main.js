const WORKOS_SIGNUP_PATH = '/api/auth/workos/signup';

const PLATFORM_CONTENT = {
  valuesphere: {
    eyebrow: 'ValueSphere Consulting Suite',
    title: 'Reimagine value creation across consulting, procurement, and revenue orchestration.',
    description:
      'ValueSphere Consulting combines Navigator assessments for individuals with Catalyst advisory squads for enterprises. It anchors the Agama platform suite.',
    primaryCta: { href: '/valuesphere.html', label: 'Explore ValueSphere' },
    secondaryCta: { href: WORKOS_SIGNUP_PATH, label: 'Launch your workspace' },
    highlightTitle: 'VALUESPHERE HIGHLIGHTS',
    highlightHeading: 'Navigator & Catalyst programs',
    highlights: [
      'Personalised Navigator diagnostics for individual leaders.',
      'Catalyst advisory guilds co-delivering measurable change.',
      'Embedded ROI models aligned to your industry realities.'
    ],
    badges: [
      { icon: 'bi-buildings', text: 'Business & personal licenses' },
      { icon: 'bi-stars', text: 'Enterprise-grade glass design' }
    ],
    theme: {
      '--bg': '#050910',
      '--bg-body': '#070d17',
      '--bg-surface': '#0c1524',
      '--bg-elevated': '#101a2d',
      '--glass': 'rgba(16,26,45,.72)',
      '--glass-border': 'rgba(124,156,255,.18)',
      '--brand': '#7c9cff',
      '--brand-strong': '#597bf2',
      '--brand-2': '#00e5c1',
      '--brand-2-strong': '#05c7aa',
      '--accent': '#ff7af4'
    }
  },
  procurepath: {
    eyebrow: 'ProcurePath Control Tower',
    title: 'Unify procurement intelligence with a control tower built for vendor mastery.',
    description:
      'ProcurePath gives sourcing teams contract health, negotiation guardrails, and vendor relationship intelligence in one workspace.',
    primaryCta: { href: '/procurepath.html', label: 'Discover ProcurePath' },
    secondaryCta: { href: WORKOS_SIGNUP_PATH, label: 'Activate a business license' },
    highlightTitle: 'PROCUREPATH SNAPSHOT',
    highlightHeading: 'Vendor orchestration playbooks',
    highlights: [
      'Relationship graphs connecting risk, spend, and contractual posture.',
      'Deal strategy engine for pricing scenarios and negotiation moves.',
      'Lifecycle automation with audit trails and milestone alerts.'
    ],
    badges: [
      { icon: 'bi-diagram-3', text: 'Vendor relationship intelligence' },
      { icon: 'bi-shield-lock', text: 'Business license required' }
    ],
    theme: {
      '--bg': '#041019',
      '--bg-body': '#061624',
      '--bg-surface': '#0a1d2e',
      '--bg-elevated': '#0e263a',
      '--glass': 'rgba(10,28,41,.75)',
      '--glass-border': 'rgba(0,229,193,.2)',
      '--brand': '#00e5c1',
      '--brand-strong': '#05c7aa',
      '--brand-2': '#7c9cff',
      '--brand-2-strong': '#597bf2',
      '--accent': '#7c9cff'
    }
  },
  revenueforge: {
    eyebrow: 'RevenueForge AI Studio',
    title: 'Coach every commercial motion with an AI-native revenue studio.',
    description:
      'RevenueForge helps teams design sales lifecycles, generate AI-qualified leads, and collaborate on every opportunity dossier.',
    primaryCta: { href: '/revenueforge.html', label: 'Tour RevenueForge' },
    secondaryCta: { href: WORKOS_SIGNUP_PATH, label: 'Enable for your org' },
    highlightTitle: 'REVENUEFORGE HIGHLIGHTS',
    highlightHeading: 'AI-assisted commercial execution',
    highlights: [
      'Lifecycle architect tailored to your sales stages.',
      'Deal intelligence copilot for pricing and discovery.',
      'Engagement lounge housing every AI-generated lead.'
    ],
    badges: [
      { icon: 'bi-lightning-charge', text: 'AI-guided sales motions' },
      { icon: 'bi-people', text: 'Business license required' }
    ],
    theme: {
      '--bg': '#0b0814',
      '--bg-body': '#100c1f',
      '--bg-surface': '#161231',
      '--bg-elevated': '#1b1540',
      '--glass': 'rgba(22,18,49,.75)',
      '--glass-border': 'rgba(255,122,244,.18)',
      '--brand': '#ff7af4',
      '--brand-strong': '#ff5ce4',
      '--brand-2': '#7c9cff',
      '--brand-2-strong': '#597bf2',
      '--accent': '#00e5c1'
    }
  }
};

const DEFAULT_THEME_KEYS = Object.keys(PLATFORM_CONTENT.valuesphere.theme);

document.addEventListener('DOMContentLoaded', () => {
  if (window.AOS) {
    window.AOS.init({ once: true, duration: 700, easing: 'ease-out-cubic' });
  }

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initPlatformSwitcher();
  initLiquidBackground();
});

function initPlatformSwitcher() {
  const buttons = document.querySelectorAll('[data-platform-switch]');
  if (!buttons.length) {
    applyPlatformTheme('valuesphere');
    return;
  }

  let active = 'valuesphere';
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-platform-switch');
      if (!id || !PLATFORM_CONTENT[id]) return;
      if (active === id) return;
      active = id;
      applyPlatformTheme(id);
      updatePlatformContent(id);
      buttons.forEach(btn => btn.classList.toggle('active', btn === button));
    });
  });

  applyPlatformTheme(active);
  updatePlatformContent(active);
}

function applyPlatformTheme(id) {
  const root = document.documentElement;
  const theme = PLATFORM_CONTENT[id]?.theme || PLATFORM_CONTENT.valuesphere.theme;
  DEFAULT_THEME_KEYS.forEach(key => {
    root.style.setProperty(key, theme[key] || PLATFORM_CONTENT.valuesphere.theme[key]);
  });
}

function updatePlatformContent(id) {
  const content = PLATFORM_CONTENT[id];
  if (!content) return;

  const eyebrow = document.getElementById('platformEyebrow');
  const title = document.getElementById('platformHeroTitle');
  const description = document.getElementById('platformHeroDescription');
  const primaryCta = document.getElementById('platformPrimaryCta');
  const secondaryCta = document.getElementById('platformSecondaryCta');
  const highlightTitle = document.getElementById('platformHighlightTitle');
  const highlightHeading = document.getElementById('platformHighlightHeading');
  const highlights = document.getElementById('platformHighlights');
  const badges = document.getElementById('platformHeroBadges');

  if (eyebrow) eyebrow.textContent = content.eyebrow;
  if (title) title.textContent = content.title;
  if (description) description.textContent = content.description;
  if (primaryCta) {
    primaryCta.href = content.primaryCta.href;
    primaryCta.textContent = content.primaryCta.label;
  }
  if (secondaryCta) {
    secondaryCta.href = content.secondaryCta.href;
    secondaryCta.textContent = content.secondaryCta.label;
  }
  if (highlightTitle) highlightTitle.textContent = content.highlightTitle;
  if (highlightHeading) highlightHeading.textContent = content.highlightHeading;
  if (highlights) {
    highlights.innerHTML = '';
    content.highlights.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      highlights.appendChild(li);
    });
  }
  if (badges) {
    badges.innerHTML = '';
    content.badges.forEach(badge => {
      const span = document.createElement('span');
      span.innerHTML = `<i class="bi ${badge.icon}"></i> ${badge.text}`;
      badges.appendChild(span);
    });
  }

  document.querySelectorAll('[data-platform-section]').forEach(section => {
    const target = section.getAttribute('data-platform-section');
    section.classList.toggle('d-none', target !== id);
  });
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
