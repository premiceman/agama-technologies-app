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
  },
  totalSeats: 2, // unified seat count for licensing step
  suiteSelection: {
    sellerSuite: false,
    buyerSuite: false
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

  updateFinishButtonState();
}

function formatPrice(amount) {
  return `$${amount.toLocaleString()}`;
}

function getTotalSeats() {
  return Number(onboardingState.totalSeats || 0);
}

function isContactSalesMode() {
  return getTotalSeats() > 200;
}

function syncSeatControlsFromState() {
  const slider = document.getElementById('seatSlider');
  const input = document.getElementById('seatInput');
  const totalSeats = getTotalSeats() || 0;

  if (slider) {
    slider.value = String(
      Math.min(Math.max(totalSeats || 2, Number(slider.min) || 2), Number(slider.max) || 250)
    );
  }
  if (input) {
    input.value = totalSeats || 2;
  }
}

function setTotalSeatsFromValue(rawValue) {
  const min = 2;
  const max = 250;
  let value = Number(rawValue || 0);
  if (Number.isNaN(value)) value = min;

  value = Math.min(Math.max(value, min), max);
  onboardingState.totalSeats = value;

  syncSeatControlsFromState();
  updatePriceSummary();
  updateFinishButtonState();
}

function updateSuiteButtons() {
  const sellerPriceLabel = document.getElementById('sellerPriceLabel');
  if (sellerPriceLabel) sellerPriceLabel.textContent = '$150/seat/mo';
  const buyerPriceLabel = document.getElementById('buyerPriceLabel');
  if (buyerPriceLabel) buyerPriceLabel.textContent = '$190/seat/mo';

  const suiteSelection = onboardingState.suiteSelection || {};

  document.querySelectorAll('[data-suite-toggle]').forEach(btn => {
    const suite = btn.getAttribute('data-suite-toggle');
    const active = suite === 'seller' ? suiteSelection.sellerSuite : suiteSelection.buyerSuite;
    btn.classList.toggle('btn-primary', active);
    btn.classList.toggle('btn-outline-light', !active);
    const label = suite === 'seller' ? 'Seller' : 'Buyer';
    btn.textContent = active ? 'Selected' : `Add ${label} Suite`;
  });

  document.querySelectorAll('.selectable-card').forEach(card => {
    const suite = card.getAttribute('data-suite');
    const active = suite === 'seller' ? suiteSelection.sellerSuite : suiteSelection.buyerSuite;
    card.classList.toggle('border', true);
    card.classList.toggle('border-success', active);
    card.classList.toggle('shadow', active);
    card.classList.toggle('opacity-50', onboardingState.orgManaged);
  });

  updatePriceSummary();
  updateFinishButtonState();
}

function updatePriceSummary() {
  const summary = document.getElementById('priceSummary');
  const helper = document.getElementById('suiteSelectionHelper');
  const totals = document.getElementById('licensingTotals');
  const contactSalesButton = document.getElementById('contactSalesButton');

  const totalSeats = getTotalSeats();
  const suiteSelection = onboardingState.suiteSelection || {};
  const sellerSelected = !!suiteSelection.sellerSuite;
  const buyerSelected = !!suiteSelection.buyerSuite;
  const bothSelected = sellerSelected && buyerSelected;

  // Pricing
  let seatPrice = 0;
  let comparisonSeatPrice = null;
  let isUnified = false;

  if (bothSelected) {
    seatPrice = 140;
    comparisonSeatPrice = 165;
    isUnified = true;
  } else if (sellerSelected) {
    seatPrice = 150;
  } else if (buyerSelected) {
    seatPrice = 190;
  }

  const inContactSalesMode = isContactSalesMode();
  const monthlyTotal = totalSeats > 0 && seatPrice > 0 ? totalSeats * seatPrice : 0;

  // Summary line (simple)
  if (summary) {
    if (totalSeats > 0 && seatPrice > 0) {
      summary.textContent = `${totalSeats} seats — ${formatPrice(monthlyTotal)}/mo`;
    } else if (totalSeats > 0) {
      summary.textContent = `${totalSeats} seats`;
    } else {
      summary.textContent = '$0/mo';
    }
  }

  // Helper text under the price summary (top-right helper, if present)
  if (helper) {
    if (!sellerSelected && !buyerSelected) {
      helper.textContent = 'Select at least one suite to see pricing.';
    } else if (inContactSalesMode) {
      helper.textContent = 'More than 200 seats requires contacting Sales.';
    } else {
      helper.textContent = 'Monthly billing preview (cards accepted later).';
    }
  }

  // Totals section body
  if (totals) {
    if (!sellerSelected && !buyerSelected) {
      totals.innerHTML =
        '<p class="licensing-totals-text">Select at least one suite and set a seat count to see your total.</p>';
    } else if (totalSeats < 2) {
      totals.innerHTML =
        '<p class="licensing-totals-text">Minimum 2 seats are required.</p>';
    } else if (inContactSalesMode) {
      totals.innerHTML =
        '<p class="licensing-totals-text">You have requested more than 200 seats. Contact Sales to discuss enterprise pricing.</p>';
    } else if (seatPrice > 0) {
      let html = `
        <div class="licensing-total-line">
          <span class="label">Total monthly</span>
          <span class="value">${formatPrice(monthlyTotal)}/mo</span>
        </div>
        <div class="licensing-total-subline">
          <span>${formatPrice(seatPrice)}/seat × ${totalSeats} seats</span>
        </div>
      `;

      if (isUnified && comparisonSeatPrice) {
        html += `
          <div class="licensing-total-discount">
            Unified pricing applied: ${formatPrice(seatPrice)}/seat<br />
            <span class="muted">
              Discounted from ${formatPrice(comparisonSeatPrice)}/seat.
              (Assuming a 50/50 split of buyer to seller licenses)
            </span>
          </div>
        `;
      } else if (!isUnified && (sellerSelected || buyerSelected)) {
        html += `
          <div class="licensing-unified-hint">
            Select both suites to unlock unified pricing at $140/seat.
          </div>
        `;
      }

      totals.innerHTML = html;
    } else {
      totals.innerHTML = '';
    }
  }

  // Contact Sales button visibility and control disabling
  const nextBtn = document.getElementById('nextStep');
  const isFinalStep = onboardingState.currentStep === steps.length - 1;

  if (contactSalesButton) {
    contactSalesButton.classList.toggle('d-none', !inContactSalesMode);
  }

  const slider = document.getElementById('seatSlider');
  const seatInput = document.getElementById('seatInput');

  if (inContactSalesMode) {
    if (slider) slider.setAttribute('aria-disabled', 'true');
    if (seatInput) seatInput.setAttribute('aria-disabled', 'true');
  } else {
    if (slider) slider.removeAttribute('aria-disabled');
    if (seatInput) seatInput.removeAttribute('aria-disabled');
  }

  if (nextBtn && isFinalStep) {
    updateFinishButtonState();
  }
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

function computeSeatDistributionForPayload() {
  const total = getTotalSeats();
  const suiteSelection = onboardingState.suiteSelection || {};
  const sellerSelected = !!suiteSelection.sellerSuite;
  const buyerSelected = !!suiteSelection.buyerSuite;

  let vendorSeats = 0;
  let buyerSeats = 0;
  let bothSeats = 0;

  if (sellerSelected && buyerSelected && total > 0) {
    // Unified model: split 50/50 (rounding vendor up)
    vendorSeats = Math.ceil(total / 2);
    buyerSeats = total - vendorSeats;
  } else if (sellerSelected) {
    vendorSeats = total;
  } else if (buyerSelected) {
    buyerSeats = total;
  }

  onboardingState.seats.vendor = vendorSeats;
  onboardingState.seats.buyer = buyerSeats;
  onboardingState.seats.both = bothSeats;

  return { vendorSeats, buyerSeats, bothSeats, totalSeats: total };
}

function updateFinishButtonState() {
  const nextBtn = document.getElementById('nextStep');
  if (!nextBtn) return;

  const isFinalStep = onboardingState.currentStep === steps.length - 1;
  if (!isFinalStep) {
    nextBtn.disabled = false;
    nextBtn.setAttribute('aria-disabled', 'false');
    return;
  }

  const suiteSelection = onboardingState.suiteSelection || {};
  const sellerSelected = !!suiteSelection.sellerSuite;
  const buyerSelected = !!suiteSelection.buyerSuite;
  const suitesSelected = sellerSelected || buyerSelected;

  const totalSeats = getTotalSeats();
  const seatsValid = totalSeats >= 2 && totalSeats <= 200;

  const orgName = (document.getElementById('orgName')?.value || '').trim();
  const orgDomain = (document.getElementById('orgDomain')?.value || '').trim();
  const billingEmail = (document.getElementById('billingEmail')?.value || '').trim();

  const termsAccepted =
    document.getElementById('termsAccepted')?.checked || false;

  const blockedByContactSales = isContactSalesMode();

  const canFinish =
    suitesSelected &&
    seatsValid &&
    !!orgName &&
    !!orgDomain &&
    !!billingEmail &&
    termsAccepted &&
    !blockedByContactSales;

  nextBtn.disabled = !canFinish;
  nextBtn.setAttribute('aria-disabled', canFinish ? 'false' : 'true');
}

function collectOrgDraft() {
  return {
    name: document.getElementById('orgName')?.value?.trim(),
    seatLimit: getTotalSeats() || 2,
    domains: document.getElementById('orgDomain')?.value?.trim()
      ? [document.getElementById('orgDomain').value.trim()]
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

  ['seatSlider', 'seatInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = managed;
      el.setAttribute('aria-disabled', managed ? 'true' : 'false');
    }
  });

  updateSuiteButtons();
}

function hydrateForms() {
  const orgName = document.getElementById('orgName');
  if (orgName && onboardingState.orgDraft.name) orgName.value = onboardingState.orgDraft.name;
  const orgDomain = document.getElementById('orgDomain');
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
    onboardingState.responses = onboardingJson.onboarding?.responses || {};
    const seatSelection = onboardingJson.onboarding?.responses?.seatSelection || {};
    const responsesSuiteSelection = onboardingJson.onboarding?.responses?.suiteSelection || {};
    onboardingState.seats = {
      vendor: Number(seatSelection.vendorSeats || 0),
      buyer: Number(seatSelection.buyerSeats || 0),
      both: Number(seatSelection.bothSeats || 0)
    };

    onboardingState.suiteSelection = {
      sellerSuite: Boolean(responsesSuiteSelection.sellerSuite || onboardingState.seats.vendor > 0),
      buyerSuite: Boolean(responsesSuiteSelection.buyerSuite || onboardingState.seats.buyer > 0)
    };

    const inferredTotalSeats =
      Number(seatSelection.totalSeats || 0)
      || onboardingState.seats.vendor + onboardingState.seats.buyer + onboardingState.seats.both;

    onboardingState.totalSeats = inferredTotalSeats && inferredTotalSeats >= 2
      ? inferredTotalSeats
      : 2;

    onboardingState.billing = onboardingJson.user?.billingProfile || {};
    onboardingState.orgDraft = onboardingJson.onboarding?.responses?.organizationDraft || onboardingState.orgDraft;

    syncSeatControlsFromState();
    updatePriceSummary();
    updateFinishButtonState();

    const orgRes = await fetch('/api/org/current', { credentials: 'include' });
    if (orgRes.ok) {
      const orgJson = await orgRes.json();
      onboardingState.organization = orgJson.organization;
      const managed = orgJson.organization && orgJson.organization.tier === 'business';
      if (managed) {
        onboardingState.suiteSelection = {
          sellerSuite: Boolean(orgJson.organization?.sellerSuiteEnabled),
          buyerSuite: Boolean(orgJson.organization?.buyerSuiteEnabled)
        };
      }
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
  const vendorActive = onboardingState.suiteSelection?.sellerSuite;
  const buyerActive = onboardingState.suiteSelection?.buyerSuite;
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
  const suiteSelection = onboardingState.suiteSelection || {};
  if (!onboardingState.orgManaged) {
    if (!suiteSelection.sellerSuite && !suiteSelection.buyerSuite) {
      alert('Select at least one suite to continue.');
      return;
    }
    if (totalSeats < 2) {
      alert('Add at least two seats to continue.');
      return;
    }
    if (isContactSalesMode()) {
      alert('Contact Sales to provision more than 200 seats.');
      return;
    }
  }

  const seatDistribution = computeSeatDistributionForPayload();

  const termsAccepted =
    document.getElementById('termsAccepted')?.checked || false;
  const marketingOptIn =
    document.getElementById('marketingOptIn')?.checked || false;

  const payload = {
    finalize: true,
    status: 'completed'
  };

  if (!onboardingState.orgManaged) {
    payload.suiteSelection = {
      sellerSuite: Boolean(suiteSelection.sellerSuite),
      buyerSuite: Boolean(suiteSelection.buyerSuite)
    };
    payload.licenseSelection = recommendedLicense();
    payload.organizationDraft = collectOrgDraft();
    payload.billingDetails = collectBillingDetails();
    payload.responses = {
      ...(onboardingState.responses || {}),
      seatSelection: {
        vendorSeats: seatDistribution.vendorSeats,
        buyerSeats: seatDistribution.buyerSeats,
        bothSeats: seatDistribution.bothSeats,
        totalSeats: seatDistribution.totalSeats
      },
      consent: {
        acceptedTerms: termsAccepted,
        marketingOptIn: marketingOptIn
      }
    };
  } else if (onboardingState.organization) {
    payload.suiteSelection = {
      sellerSuite: Boolean(onboardingState.organization.sellerSuiteEnabled),
      buyerSuite: Boolean(onboardingState.organization.buyerSuiteEnabled)
    };
  }

  payload.responses = {
    ...(payload.responses || {}),
    seatSelection: {
      vendorSeats: seatDistribution.vendorSeats,
      buyerSeats: seatDistribution.buyerSeats,
      bothSeats: seatDistribution.bothSeats,
      totalSeats: seatDistribution.totalSeats
    },
    consent: {
      acceptedTerms: termsAccepted,
      marketingOptIn: marketingOptIn
    }
  };

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
      if (suite === 'seller') {
        onboardingState.suiteSelection.sellerSuite = !onboardingState.suiteSelection.sellerSuite;
      } else if (suite === 'buyer') {
        onboardingState.suiteSelection.buyerSuite = !onboardingState.suiteSelection.buyerSuite;
      }
      updateSuiteButtons();
      updateFinishButtonState();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindNavigation();
  bindSuiteSelection();
  const slider = document.getElementById('seatSlider');
  const seatInput = document.getElementById('seatInput');
  const contactSalesButton = document.getElementById('contactSalesButton');
  const refreshOrgStatusBtn = document.getElementById('refreshOrgStatus');

  if (slider) {
    slider.addEventListener('input', (e) => {
      setTotalSeatsFromValue(e.target.value);
    });
  }

  if (seatInput) {
    seatInput.addEventListener('input', (e) => {
      setTotalSeatsFromValue(e.target.value);
    });
    seatInput.addEventListener('blur', (e) => {
      setTotalSeatsFromValue(e.target.value);
    });
  }

  if (contactSalesButton) {
    contactSalesButton.addEventListener('click', () => {
      window.location.href =
        'mailto:sales@agamatechnologies.com?subject=Agama%20Enterprise%20Licensing%20Enquiry';
    });
  }

  if (refreshOrgStatusBtn) {
    refreshOrgStatusBtn.addEventListener('click', () => {
      fetch('/api/org/current', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((org) => {
          if (org) {
            onboardingState.organization = org;
            const managed = org.organization && org.organization.tier === 'business';
            setOrgManagedUI(managed, org.organization);
          }
          updatePriceSummary();
          updateFinishButtonState();
        })
        .catch(() => {
          // fail silently, UI is still usable
        });
    });
  }

  ['orgName', 'orgDomain', 'billingEmail'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateFinishButtonState);
    }
  });

  const termsCheckbox = document.getElementById('termsAccepted');
  const marketingCheckbox = document.getElementById('marketingOptIn');

  if (termsCheckbox) {
    termsCheckbox.addEventListener('change', updateFinishButtonState);
  }
  if (marketingCheckbox) {
    marketingCheckbox.addEventListener('change', () => {
      updateFinishButtonState();
    });
  }

  syncSeatControlsFromState();
  updatePriceSummary();
  updateFinishButtonState();
  loadContext();
});
