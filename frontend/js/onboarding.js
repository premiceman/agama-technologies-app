const steps = ['persona', 'intent', 'usage', 'license'];
const onboardingState = {
  currentStep: 0,
  user: null,
  answers: {
    persona: null,
    goals: [],
    intent: '',
    usage: [],
    useCases: '',
    licenseSelection: null,
    billingDetails: {}
  },
  recommendation: 'free-personal',
  status: 'pending',
  orgManagedLicense: false
};

function personaLabel(key) {
  switch (key) {
    case 'vendor':
      return 'Vendor';
    case 'buyer':
      return 'Buyer';
    case 'consultant':
      return 'Consultant';
    case 'both':
      return 'Vendor & buyer';
    case 'explorer':
      return 'Exploring';
    default:
      return 'Unknown';
  }
}

function stepName(id) {
  switch (id) {
    case 'persona':
      return 'About you';
    case 'intent':
      return 'Outcomes';
    case 'usage':
      return 'How you will use Agama';
    case 'license':
      return 'License';
    default:
      return id;
  }
}

function updateProgress() {
  const progress = document.getElementById('onboardingProgress');
  const hint = document.getElementById('stepHint');
  if (!progress) return;
  progress.innerHTML = '';
  steps.forEach((step, idx) => {
    const chip = document.createElement('div');
    chip.className = `onboarding-step-chip ${idx === onboardingState.currentStep ? 'active' : ''}`;
    chip.textContent = `${idx + 1}. ${stepName(step)}`;
    progress.appendChild(chip);
  });
  if (hint) hint.textContent = `Step ${onboardingState.currentStep + 1} of ${steps.length}`;
}

function setSectionVisibility() {
  const sections = document.querySelectorAll('.onboarding-section');
  sections.forEach(section => {
    const stepId = section.getAttribute('data-step');
    section.classList.toggle('active', steps[onboardingState.currentStep] === stepId);
  });
  const backBtn = document.getElementById('backStep');
  const nextBtn = document.getElementById('nextStep');
  if (backBtn) backBtn.disabled = onboardingState.currentStep === 0;
  if (nextBtn) nextBtn.textContent = onboardingState.currentStep === steps.length - 1 ? 'Finish onboarding' : 'Continue';
}

function toggleButtons(selector, activeKeys) {
  document.querySelectorAll(selector).forEach(btn => {
    const key = btn.getAttribute('data-goal') || btn.getAttribute('data-usage');
    if (!key) return;
    btn.classList.toggle('btn-primary', activeKeys.includes(key));
    btn.classList.toggle('btn-outline-light', !activeKeys.includes(key));
  });
}

function togglePersonaButtons(activeKey) {
  document.querySelectorAll('[data-persona]').forEach(btn => {
    const key = btn.getAttribute('data-persona');
    btn.classList.toggle('btn-primary', key === activeKey);
    btn.classList.toggle('btn-outline-light', key !== activeKey);
  });
  const statusBadge = document.getElementById('onboardingStatusBadge');
  if (statusBadge && activeKey) statusBadge.textContent = `${personaLabel(activeKey)} onboarding`;
}

function selectLicenseCard(license) {
  onboardingState.answers.licenseSelection = license;
  document.querySelectorAll('[data-license]').forEach(card => {
    const isActive = card.getAttribute('data-license') === license;
    card.classList.toggle('border', true);
    card.classList.toggle('border-success', isActive);
    card.classList.toggle('shadow', isActive);
  });
}

async function persistProgress(payload) {
  try {
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Unable to save onboarding');
    const json = await res.json();
    onboardingState.user = json.user;
    onboardingState.status = json.onboarding?.status || onboardingState.status;
    onboardingState.recommendation = json.onboarding?.recommendation || onboardingState.recommendation;
    return json;
  } catch (err) {
    console.error(err);
    const feedback = document.getElementById('personaFeedback');
    if (feedback) feedback.textContent = 'We could not save your answers. Please try again.';
    return null;
  }
}

function recommendedLabel(plan) {
  switch (plan) {
    case 'vendor-enterprise':
      return 'Recommended for vendors';
    case 'procurement-enterprise':
      return 'Recommended for buyers';
    case 'consulting-enterprise':
      return 'Recommended for consulting';
    default:
      return 'You can change this later';
  }
}

async function handleNextStep() {
  if (!(await validateCurrentStep())) return;
  if (onboardingState.currentStep < steps.length - 1) {
    onboardingState.currentStep += 1;
    updateProgress();
    setSectionVisibility();
    return;
  }

  let payload;

  if (onboardingState.orgManagedLicense) {
    const { licenseSelection, billingDetails, ...restAnswers } = onboardingState.answers;
    payload = {
      ...restAnswers,
      useCases: onboardingState.answers.useCases ? [onboardingState.answers.useCases] : [],
      status: 'completed'
    };
  } else {
    const billingName = document.getElementById('billingName')?.value?.trim();
    const billingEmail = document.getElementById('billingEmail')?.value?.trim();
    const licenseSelection = onboardingState.answers.licenseSelection || 'free-personal';
    onboardingState.answers.licenseSelection = licenseSelection;
    payload = {
      ...onboardingState.answers,
      licenseSelection,
      useCases: onboardingState.answers.useCases ? [onboardingState.answers.useCases] : [],
      billingDetails: { billingName, email: billingEmail },
      status: 'completed'
    };
  }
  const saved = await persistProgress(payload);
  if (saved) {
    window.location.href = '/workspace.html';
  }
}

async function validateCurrentStep() {
  const current = steps[onboardingState.currentStep];
  if (current === 'persona' && !onboardingState.answers.persona) {
    const feedback = document.getElementById('personaFeedback');
    if (feedback) feedback.textContent = 'Select the option closest to your role.';
    return false;
  }

  if (current === 'intent') {
    if (!onboardingState.answers.goals.length) {
      alert('Pick at least one outcome so we can tailor Agama.');
      return false;
    }
    await persistProgress({
      persona: onboardingState.answers.persona,
      goals: onboardingState.answers.goals,
      intent: onboardingState.answers.intent,
      status: 'in-progress'
    });
  }

  if (current === 'usage') {
    await persistProgress({
      useCases: onboardingState.answers.useCases ? [onboardingState.answers.useCases] : [],
      usage: onboardingState.answers.usage,
      status: 'in-progress'
    });
  }

  if (current === 'license') {
    if (onboardingState.orgManagedLicense) {
      return true;
    }

    if (!onboardingState.answers.licenseSelection) {
      onboardingState.answers.licenseSelection = 'free-personal';
      selectLicenseCard('free-personal');
    }
  }

  return true;
}

function bindNavigation() {
  const nextBtn = document.getElementById('nextStep');
  const backBtn = document.getElementById('backStep');
  if (nextBtn) nextBtn.addEventListener('click', handleNextStep);
  if (backBtn) backBtn.addEventListener('click', () => {
    if (onboardingState.currentStep === 0) return;
    onboardingState.currentStep -= 1;
    updateProgress();
    setSectionVisibility();
  });
}

function bindPersonaSelection() {
  document.querySelectorAll('[data-persona]').forEach(btn => {
    btn.addEventListener('click', async () => {
      onboardingState.answers.persona = btn.getAttribute('data-persona');
      togglePersonaButtons(onboardingState.answers.persona);
      onboardingState.recommendation = recommendPlan(onboardingState.answers.persona);
      await persistProgress({ persona: onboardingState.answers.persona, recommendation: onboardingState.recommendation, status: 'in-progress' });
      renderRecommendation();
    });
  });
}

function bindGoals() {
  document.querySelectorAll('[data-goal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const goal = btn.getAttribute('data-goal');
      const hasGoal = onboardingState.answers.goals.includes(goal);
      onboardingState.answers.goals = hasGoal
        ? onboardingState.answers.goals.filter(g => g !== goal)
        : [...onboardingState.answers.goals, goal];
      toggleButtons('[data-goal]', onboardingState.answers.goals);
    });
  });

  const intentInput = document.getElementById('intentInput');
  if (intentInput) {
    intentInput.addEventListener('input', () => {
      onboardingState.answers.intent = intentInput.value.trim();
    });
  }
}

function bindUsage() {
  document.querySelectorAll('[data-usage]').forEach(btn => {
    btn.addEventListener('click', () => {
      const usage = btn.getAttribute('data-usage');
      const selected = onboardingState.answers.usage.includes(usage);
      onboardingState.answers.usage = selected
        ? onboardingState.answers.usage.filter(item => item !== usage)
        : [...onboardingState.answers.usage, usage];
      toggleButtons('[data-usage]', onboardingState.answers.usage);
    });
  });

  const useCaseInput = document.getElementById('useCaseInput');
  if (useCaseInput) {
    useCaseInput.addEventListener('input', () => {
      onboardingState.answers.useCases = useCaseInput.value.trim();
    });
  }
}

function bindLicenseSelection() {
  document.querySelectorAll('[data-license-select]').forEach(btn => {
    btn.addEventListener('click', async event => {
      if (onboardingState.orgManagedLicense) return;

      const license = btn.getAttribute('data-license-select');
      selectLicenseCard(license);
      onboardingState.answers.licenseSelection = license;
      const billingName = document.getElementById('billingName')?.value?.trim();
      const billingEmail = document.getElementById('billingEmail')?.value?.trim();
      await persistProgress({
        licenseSelection: license,
        billingDetails: { billingName, email: billingEmail },
        status: 'in-progress'
      });
      if (license === 'vendor-enterprise' || license === 'procurement-enterprise') {
        window.open('mailto:sales@agamatechnologies.com?subject=Agama%20Enterprise%20Workspace', '_blank');
      }
    });
  });

  const salesBtn = document.getElementById('consultingOrgContact');
  if (salesBtn) {
    salesBtn.addEventListener('click', () => {
      window.open('mailto:sales@agamatechnologies.com?subject=Consulting%20Enterprise%20License', '_blank');
    });
  }
}

function bindOrgLicenseCheck() {
  const btn = document.getElementById('checkOrgLicense');
  if (!btn) return;
  const feedback = document.getElementById('orgLicenseFeedback');

  btn.addEventListener('click', async () => {
    if (feedback) feedback.textContent = 'Checking your organisation...';

    try {
      const res = await fetch('/api/org/current', { credentials: 'include' });
      if (!res.ok) {
        if (feedback) feedback.textContent = 'Could not verify organisation. Please try again.';
        return;
      }
      const json = await res.json();
      const org = json.organization || null;

      if (org) {
        onboardingState.orgManagedLicense = true;

        document.querySelectorAll('.license-card').forEach(card => {
          card.classList.add('opacity-50');
        });

        document.querySelectorAll('.license-card [data-license-select]').forEach(button => {
          button.classList.add('disabled');
          button.setAttribute('aria-disabled', 'true');
          button.disabled = true;
        });

        if (feedback) {
          feedback.textContent =
            'We found your organisation (' + (org.name || 'Your organisation') + '). Your licence is managed by your admin. You can continue without selecting a plan.';
        }
      } else {
        onboardingState.orgManagedLicense = false;
        document.querySelectorAll('.license-card').forEach(card => {
          card.classList.remove('opacity-50');
        });
        document.querySelectorAll('.license-card [data-license-select]').forEach(button => {
          button.classList.remove('disabled');
          button.removeAttribute('aria-disabled');
          button.disabled = false;
        });

        if (feedback) {
          feedback.textContent =
            'We did not find a business organisation linked to this account. Use the options above to choose a plan or stay on free.';
        }
      }
    } catch (err) {
      console.error('Org licence check failed', err);
      if (feedback) feedback.textContent = 'Unable to check organisation right now.';
    }
  });
}

function recommendPlan(persona) {
  if (persona === 'vendor' || persona === 'both') return 'vendor-enterprise';
  if (persona === 'buyer') return 'procurement-enterprise';
  if (persona === 'consultant') return 'consulting-enterprise';
  return 'free-personal';
}

function renderRecommendation() {
  const badge = document.getElementById('licenseRecommendation');
  if (badge) badge.textContent = recommendedLabel(onboardingState.recommendation);
  document.querySelectorAll('.license-card').forEach(card => {
    const license = card.getAttribute('data-license');
    const recommended = license === onboardingState.recommendation;
    card.classList.toggle('border-info', recommended);
    card.classList.toggle('shadow', card.classList.contains('border-success') || recommended);
  });
}

async function loadOnboarding() {
  try {
    const res = await fetch('/api/onboarding', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/api/auth/workos/login';
      return;
    }
    const json = await res.json();
    onboardingState.user = json.user;
    onboardingState.status = json.onboarding?.status || 'pending';
    onboardingState.recommendation = json.onboarding?.recommendation || recommendPlan(json.user?.persona);
    onboardingState.answers.persona = json.user?.persona && json.user.persona !== 'unknown' ? json.user.persona : null;
    onboardingState.answers.goals = json.onboarding?.responses?.goals || [];
    onboardingState.answers.intent = json.onboarding?.responses?.intent || '';
    onboardingState.answers.useCases = (json.onboarding?.responses?.useCases || [])[0] || '';
    onboardingState.answers.usage = json.onboarding?.responses?.usage || [];
    onboardingState.answers.licenseSelection = json.onboarding?.responses?.licenseSelection || null;

    if (onboardingState.status === 'completed' && !new URLSearchParams(window.location.search).has('force')) {
      window.location.href = '/workspace.html';
      return;
    }

    hydrateForm();
    updateProgress();
    setSectionVisibility();
    renderRecommendation();
  } catch (err) {
    console.error('Unable to load onboarding', err);
  }
}

function hydrateForm() {
  if (onboardingState.answers.persona) {
    togglePersonaButtons(onboardingState.answers.persona);
  }
  toggleButtons('[data-goal]', onboardingState.answers.goals);
  toggleButtons('[data-usage]', onboardingState.answers.usage);
  const intentInput = document.getElementById('intentInput');
  if (intentInput) intentInput.value = onboardingState.answers.intent || '';
  const useCaseInput = document.getElementById('useCaseInput');
  if (useCaseInput) useCaseInput.value = onboardingState.answers.useCases || '';
  if (onboardingState.answers.licenseSelection) {
    selectLicenseCard(onboardingState.answers.licenseSelection);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindNavigation();
  bindPersonaSelection();
  bindGoals();
  bindUsage();
  bindLicenseSelection();
  bindOrgLicenseCheck();
  loadOnboarding();
});
