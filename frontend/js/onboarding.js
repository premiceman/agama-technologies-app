const steps = ['seller', 'buyer', 'plan'];
const PRICING = { vendor: 150, buyer: 190, both: 250 };

const onboardingState = {
  currentStep: 0,
  user: null,
  organization: null,
  orgManaged: false,
  seats: { vendor: 0, buyer: 0, both: 0 },
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

function getTotalSeats() {
  return onboardingState.seats.vendor + onboardingState.seats.buyer + onboardingState.seats.both;
}

function getMonthlyTotal() {
  return (onboardingState.seats.vendor * PRICING.vendor)
    + (onboardingState.seats.buyer * PRICING.buyer)
    + (onboardingState.seats.both * PRICING.both);
}

function isContactSalesMode() {
  return getTotalSeats() > 200;
}

function getSuiteSeatCount(suite) {
  if (suite === 'seller') return onboardingState.seats.vendor + onboardingState.seats.both;
  if (suite === 'buyer') return onboardingState.seats.buyer + onboardingState.seats.both;
  return 0;
}

function syncSeatInputsFromState() {
  const vendorInput = document.getElementById('vendorSeatsInput');
  if (vendorInput) vendorInput.value = onboardingState.seats.vendor || '';
  const buyerInput = document.getElementById('buyerSeatsInput');
  if (buyerInput) buyerInput.value = onboardingState.seats.buyer || '';
  const bothInput = document.getElementById('bothSeatsInput');
  if (bothInput) bothInput.value = onboardingState.seats.both || '';
}

function updatePriceSummary() {
  const summary = document.getElementById('priceSummary');
  const helper = document.getElementById('suiteSelectionHelper');
  const totalSeats = getTotalSeats();
  const total = getMonthlyTotal();
  if (summary) {
    summary.textContent = totalSeats > 0
      ? `${totalSeats} seats — ${formatPrice(total)}`
      : '$0/mo';
  }
  if (helper) {
    const onFinalStep = onboardingState.currentStep === steps.length - 1;
    if (onFinalStep && !onboardingState.orgManaged && totalSeats === 0) {
      helper.textContent = 'Add at least one seat to finish.';
    } else if (onFinalStep && !onboardingState.orgManaged && isContactSalesMode()) {
      helper.textContent = 'Contact Sales to provision more than 200 seats.';
    } else {
      helper.textContent = 'Monthly billing preview (cards accepted later).';
    }
  }

  const contactBanner = document.getElementById('contactSalesBanner');
  if (contactBanner) {
    contactBanner.classList.toggle('d-none', !isContactSalesMode());
  }

  const nextBtn = document.getElementById('nextStep');
  if (nextBtn) {
    const isFinalStep = onboardingState.currentStep === steps.length - 1;
    const shouldGateBySeats = isFinalStep && !onboardingState.orgManaged;
    const disabled = shouldGateBySeats && (totalSeats === 0 || isContactSalesMode());
    nextBtn.disabled = disabled;
    nextBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }
}

function updateSuiteButtons() {
  const sellerPriceLabel = document.getElementById('sellerPriceLabel');
  if (sellerPriceLabel) sellerPriceLabel.textContent = '$150/seat/mo';
  const buyerPriceLabel = document.getElementById('buyerPriceLabel');
  if (buyerPriceLabel) buyerPriceLabel.textContent = '$190/seat/mo';

  const suiteKeyMap = { seller: 'vendor', buyer: 'buyer' };
  document.querySelectorAll('[data-suite-toggle]').forEach(btn => {
    const suite = btn.getAttribute('data-suite-toggle');
    const suiteKey = suiteKeyMap[suite];
    const activeSeatCount = suite ? getSuiteSeatCount(suite) : 0;
    const active = Boolean(activeSeatCount);
    btn.classList.toggle('btn-primary', active);
    btn.classList.toggle('btn-outline-light', !active);
    const label = suite === 'seller' ? 'Seller' : 'Buyer';
    btn.textContent = active
      ? `Selected (${activeSeatCount} seats)`
      : `Add ${label} Suite`;
    if (suiteKey) {
      btn.setAttribute('data-seat-key', suiteKey);
    }
  });

  document.querySelectorAll('.selectable-card').forEach(card => {
    const suite = card.getAttribute('data-suite');
    const active = getSuiteSeatCount(suite) > 0;
    card.classList.toggle('border', true);
    card.classList.toggle('border-success', active);
    card.classList.toggle('shadow', active);
    card.classList.toggle('opacity-50', onboardingState.orgManaged);
  });

  syncSeatInputsFromState();
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
    seatLimit: getTotalSeats() || Number(document.getElementById('orgSeatsInput')?.value || 10),
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

  document.querySelectorAll('#vendorSeatsInput, #buyerSeatsInput, #bothSeatsInput').forEach(input => {
    input.disabled = managed;
    input.setAttribute('aria-disabled', managed ? 'true' : 'false');
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
    const seatSelection = onboardingJson.onboarding?.responses?.seatSelection || {};
    onboardingState.seats = {
      vendor: Number(seatSelection.vendorSeats || 0),
      buyer: Number(seatSelection.buyerSeats || 0),
      both: Number(seatSelection.bothSeats || 0)
    };

    if (!seatSelection.vendorSeats && onboardingJson.onboarding?.responses?.suiteSelection?.sellerSuite) {
      onboardingState.seats.vendor = 1;
    }
    if (!seatSelection.buyerSeats && onboardingJson.onboarding?.responses?.suiteSelection?.buyerSuite) {
      onboardingState.seats.buyer = 1;
    }
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
  const vendorActive = getSuiteSeatCount('seller') > 0;
  const buyerActive = getSuiteSeatCount('buyer') > 0;
  if (vendorActive && buyerActive) return 'vendor-enterprise';
  if (vendorActive) return 'vendor-enterprise';
  if (buyerActive) return 'procurement-enterprise';
  return 'free-personal';
}

async function handleNextStep() {
  if (onboardingState.currentStep < steps.length - 1) {
    onboardingState.currentStep += 1;
    updateProgress();
    setSectionVisibility();
    return;
  }

  const totalSeats = getTotalSeats();
  if (!onboardingState.orgManaged) {
    if (totalSeats === 0) {
      alert('Add at least one seat to continue.');
      return;
    }
    if (isContactSalesMode()) {
      alert('Contact Sales to provision more than 200 seats.');
      return;
    }
  }

  const payload = {
    finalize: true,
    status: 'completed'
  };

  if (!onboardingState.orgManaged) {
    payload.suiteSelection = {
      sellerSuite: getSuiteSeatCount('seller') > 0,
      buyerSuite: getSuiteSeatCount('buyer') > 0
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
      const suiteKey = btn.getAttribute('data-seat-key') || (suite === 'seller' ? 'vendor' : 'buyer');
      const current = onboardingState.seats[suiteKey] || 0;
      onboardingState.seats[suiteKey] = current > 0 ? 0 : 1;
      updateSuiteButtons();
    });
  });
}

function bindSeatInputs() {
  const seatInputs = [
    { id: 'vendorSeatsInput', key: 'vendor' },
    { id: 'buyerSeatsInput', key: 'buyer' },
    { id: 'bothSeatsInput', key: 'both' }
  ];

  seatInputs.forEach(({ id, key }) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', () => {
      const value = Math.max(0, Number(input.value) || 0);
      onboardingState.seats[key] = value;
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
  bindSeatInputs();
  bindOrgRefresh();
  loadContext();
});
