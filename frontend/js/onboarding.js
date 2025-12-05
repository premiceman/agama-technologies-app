const steps = ['seller', 'buyer', 'plan'];
const PRICING = { seller: 240, buyer: 180 };

const onboardingState = {
  currentStep: 0,
  user: null,
  organization: null,
  orgManaged: false,
  suites: { seller: false, buyer: false },
  billing: {},
  orgDraft: {
    seats: 10,
    domain: ''
  }
};

function stepName(id) {
  switch (id) {
    case 'seller':
      return 'Seller Suite';
    case 'buyer':
      return 'Buyer Suite';
    case 'plan':
      return 'Licensing';
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
  if (nextBtn) nextBtn.textContent = onboardingState.currentStep === steps.length - 1 ? 'Finish' : 'Continue';
}

function formatPrice(amount) {
  return `$${amount.toLocaleString()}/mo`;
}

function updatePriceSummary() {
  const summary = document.getElementById('priceSummary');
  const helper = document.getElementById('suiteSelectionHelper');
  const sellerActive = onboardingState.suites.seller;
  const buyerActive = onboardingState.suites.buyer;
  const total = (sellerActive ? PRICING.seller : 0) + (buyerActive ? PRICING.buyer : 0);
  if (summary) summary.textContent = formatPrice(total);
  if (helper) {
    helper.textContent = total > 0
      ? 'Monthly billing preview (cards accepted later).'
      : 'Select at least one suite to enable billing.';
  }
}

function updateSuiteButtons() {
  document.querySelectorAll('[data-suite-toggle]').forEach(btn => {
    const suite = btn.getAttribute('data-suite-toggle');
    const active = onboardingState.suites[suite];
    btn.classList.toggle('btn-primary', active);
    btn.classList.toggle('btn-outline-light', !active);
    btn.textContent = active ? 'Selected' : `Add ${suite === 'seller' ? 'Seller' : 'Buyer'} Suite`;
  });

  document.querySelectorAll('.selectable-card').forEach(card => {
    const suite = card.getAttribute('data-suite');
    const active = onboardingState.suites[suite];
    card.classList.toggle('border', true);
    card.classList.toggle('border-success', active);
    card.classList.toggle('shadow', active);
    card.classList.toggle('opacity-50', onboardingState.orgManaged);
  });

  updatePriceSummary();
}

function collectBillingDetails() {
  return {
    billingName: document.getElementById('billingName')?.value?.trim(),
    email: document.getElementById('billingEmail')?.value?.trim(),
    cardNumber: document.getElementById('cardNumber')?.value?.trim(),
    cardExpiry: document.getElementById('cardExpiry')?.value?.trim(),
    cardCvc: document.getElementById('cardCvc')?.value?.trim(),
    billingAddress: document.getElementById('billingAddress')?.value?.trim(),
    notes: document.getElementById('billingNotes')?.value?.trim()
  };
}

function collectOrgDraft() {
  return {
    name: document.getElementById('orgNameInput')?.value?.trim(),
    seatLimit: Number(document.getElementById('orgSeatsInput')?.value || 10),
    domains: document.getElementById('orgDomainInput')?.value?.trim()
      ? [document.getElementById('orgDomainInput').value.trim()]
      : []
  };
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
    return res.json();
  } catch (err) {
    console.error(err);
    const feedback = document.getElementById('orgLicenseFeedback');
    if (feedback) feedback.textContent = 'We could not save your choices. Please try again.';
    return null;
  }
}

function setOrgManagedUI(managed, organization) {
  onboardingState.orgManaged = managed;
  const alertEl = document.getElementById('orgManagedAlert');
  const suitePanel = document.getElementById('suiteSelectionPanel');
  const statusText = document.getElementById('orgStatusText');
  const badge = document.getElementById('orgBadge');
  const feedback = document.getElementById('orgLicenseFeedback');

  if (alertEl) alertEl.classList.toggle('d-none', !managed);
  if (suitePanel) suitePanel.classList.toggle('opacity-50', managed);

  if (statusText) {
    statusText.textContent = managed
      ? 'Your licence is already managed by your organisation admin.'
      : 'Create an organisation to manage billing and seats.';
  }

  if (badge) badge.textContent = managed ? 'Org managed' : 'Org setup';
  if (feedback && managed) {
    feedback.textContent = `Managed by ${organization?.name || 'your organisation'}. Finish to continue.`;
  }

  document.querySelectorAll('[data-suite-toggle]').forEach(btn => {
    btn.disabled = managed;
    btn.setAttribute('aria-disabled', managed ? 'true' : 'false');
  });

  updateSuiteButtons();
}

function hydrateForms() {
  const orgName = document.getElementById('orgNameInput');
  if (orgName && onboardingState.orgDraft.name) orgName.value = onboardingState.orgDraft.name;
  const orgSeats = document.getElementById('orgSeatsInput');
  if (orgSeats && onboardingState.orgDraft.seatLimit) orgSeats.value = onboardingState.orgDraft.seatLimit;
  const orgDomain = document.getElementById('orgDomainInput');
  if (orgDomain && onboardingState.orgDraft.domains?.length) orgDomain.value = onboardingState.orgDraft.domains[0];

  const billing = onboardingState.billing || {};
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
  };
  setVal('billingName', billing.billingName);
  setVal('billingEmail', billing.email);
  setVal('cardNumber', billing.cardNumber || billing.rawInput);
  setVal('cardExpiry', billing.cardExpiry);
  setVal('cardCvc', billing.cardCvc);
  setVal('billingAddress', billing.billingAddress);
  setVal('billingNotes', billing.notes);
}

async function loadContext() {
  try {
    const onboardingRes = await fetch('/api/onboarding', { credentials: 'include' });
    if (onboardingRes.status === 401) {
      window.location.href = '/api/auth/workos/login';
      return;
    }
    const onboardingJson = await onboardingRes.json();
    onboardingState.user = onboardingJson.user;
    onboardingState.suites = {
      seller: Boolean(onboardingJson.onboarding?.responses?.suiteSelection?.sellerSuite),
      buyer: Boolean(onboardingJson.onboarding?.responses?.suiteSelection?.buyerSuite)
    };
    onboardingState.billing = onboardingJson.user?.billingProfile || {};
    onboardingState.orgDraft = onboardingJson.onboarding?.responses?.organizationDraft || onboardingState.orgDraft;

    const orgRes = await fetch('/api/org/current', { credentials: 'include' });
    if (orgRes.ok) {
      const orgJson = await orgRes.json();
      onboardingState.organization = orgJson.organization;
      const managed = orgJson.organization && orgJson.organization.tier === 'business';
      setOrgManagedUI(managed, orgJson.organization);
    } else {
      setOrgManagedUI(false, null);
    }

    if (onboardingJson.onboarding?.status === 'completed' && !new URLSearchParams(window.location.search).has('force')) {
      window.location.href = '/workspace.html';
      return;
    }

    hydrateForms();
    updateSuiteButtons();
    updateProgress();
    setSectionVisibility();
  } catch (err) {
    console.error('Unable to load onboarding', err);
  }
}

function recommendedLicense() {
  if (onboardingState.suites.seller && onboardingState.suites.buyer) return 'vendor-enterprise';
  if (onboardingState.suites.seller) return 'vendor-enterprise';
  if (onboardingState.suites.buyer) return 'procurement-enterprise';
  return 'free-personal';
}

async function handleNextStep() {
  if (onboardingState.currentStep < steps.length - 1) {
    onboardingState.currentStep += 1;
    updateProgress();
    setSectionVisibility();
    return;
  }

  if (!onboardingState.orgManaged) {
    const hasSuite = onboardingState.suites.seller || onboardingState.suites.buyer;
    if (!hasSuite) {
      alert('Select at least one suite to continue.');
      return;
    }
  }

  const payload = {
    finalize: true,
    status: 'completed'
  };

  if (!onboardingState.orgManaged) {
    payload.suiteSelection = {
      sellerSuite: onboardingState.suites.seller,
      buyerSuite: onboardingState.suites.buyer
    };
    payload.licenseSelection = recommendedLicense();
    payload.organizationDraft = collectOrgDraft();
    payload.billingDetails = collectBillingDetails();
  } else if (onboardingState.organization) {
    payload.suiteSelection = {
      sellerSuite: Boolean(onboardingState.organization.sellerSuiteEnabled),
      buyerSuite: Boolean(onboardingState.organization.buyerSuiteEnabled)
    };
  }

  const saved = await persistProgress(payload);
  if (saved) {
    window.location.href = '/workspace.html';
  }
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

function bindSuiteSelection() {
  document.querySelectorAll('[data-suite-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (onboardingState.orgManaged) return;
      const suite = btn.getAttribute('data-suite-toggle');
      onboardingState.suites[suite] = !onboardingState.suites[suite];
      updateSuiteButtons();
    });
  });
}

function bindOrgRefresh() {
  const btn = document.getElementById('checkOrgLicense');
  const feedback = document.getElementById('orgLicenseFeedback');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (feedback) feedback.textContent = 'Checking organisation membership...';
    try {
      const res = await fetch('/api/org/current', { credentials: 'include' });
      if (!res.ok) {
        if (feedback) feedback.textContent = 'Could not verify organisation. Try again later.';
        return;
      }
      const json = await res.json();
      onboardingState.organization = json.organization;
      const managed = json.organization && json.organization.tier === 'business';
      setOrgManagedUI(managed, json.organization);
      if (feedback) {
        feedback.textContent = managed
          ? 'Organisation detected. Licensing is managed by your admin.'
          : 'No managed organisation found. We will create one with your purchase.';
      }
    } catch (err) {
      console.error('Org check failed', err);
      if (feedback) feedback.textContent = 'Unable to check organisation right now.';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindNavigation();
  bindSuiteSelection();
  bindOrgRefresh();
  loadContext();
});
