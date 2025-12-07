async function fetchOrgOverview() {
  const res = await fetch('/api/org/admin/overview', { credentials: 'include' });
  if (res.status === 403) return { ok: false, reason: 'forbidden' };
  if (!res.ok) throw new Error('Unable to load overview');
  return res.json();
}

async function updateOrgBilling(payload) {
  const res = await fetch('/api/org/admin/billing', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Unable to update billing');
  return res.json();
}

async function requestSalesContact() {
  try {
    await fetch('/api/org/admin/billing/contact-sales', { method: 'POST', credentials: 'include' });
    const notice = document.getElementById('contactSalesNotice');
    if (notice) notice.classList.add('alert-success');
    const feedback = document.getElementById('billingFeedback');
    if (feedback) feedback.textContent = 'We have logged your request. Our sales team will contact you soon.';
  } catch (err) {
    console.error('Unable to request sales contact', err);
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatCurrency(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  const amount = Number(value);
  return amount < 0 ? `-$${Math.abs(amount).toLocaleString()}` : `$${amount.toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSeatLabel(organization) {
  const total = (organization.seatLimits?.vendorSuite || 0)
    + (organization.seatLimits?.buyerSuite || 0)
    + (organization.seatLimits?.bothSuites || 0)
    || organization.seatLimit
    || 0;
  const used = organization.seatsUsed || 0;
  return `${used} / ${total} seats`;
}

function formatSuiteStatus(organization) {
  const suites = [];
  if (organization.sellerSuiteEnabled) suites.push('Seller');
  if (organization.buyerSuiteEnabled) suites.push('Buyer');
  if (!suites.length) return 'No suites enabled';
  return suites.join(' + ');
}

function populateOverview(data) {
  const org = data.organization;
  document.getElementById('orgName').textContent = org.name;
  document.getElementById('orgTier').textContent = org.tier || 'business';
  document.getElementById('suiteStatus').textContent = formatSuiteStatus(org);
  document.getElementById('seatUsage').textContent = formatSeatLabel(org);
  document.getElementById('suiteBadge').textContent = formatSuiteStatus(org);

  const vendorLimit = org.seatLimits?.vendorSuite || 0;
  const buyerLimit = org.seatLimits?.buyerSuite || 0;
  const bothLimit = org.seatLimits?.bothSuites || 0;
  setText('billingSeatMix', `${vendorLimit} vendor • ${buyerLimit} buyer • ${bothLimit} both`);
  setText('billingSeatHint', 'Seat mix across suites');

  document.getElementById('vendorSeatInput').value = vendorLimit;
  document.getElementById('buyerSeatInput').value = buyerLimit;
  document.getElementById('bothSeatInput').value = bothLimit;

  const billing = org.billing || {};
  document.getElementById('billingNameInput').value = billing.billingName || '';
  document.getElementById('billingEmailInput').value = billing.email || '';
  document.getElementById('cardNumberInput').value = billing.cardPreview || '';
  document.getElementById('cardExpiryInput').value = billing.cardExpiry || '';
  document.getElementById('cardCvcInput').value = '';
  document.getElementById('billingAddressInput').value = billing.billingAddress || '';
  document.getElementById('billingNotesInput').value = billing.notes || '';

  document.getElementById('cardPreview').textContent = billing.cardPreview || 'No payment method';
  document.getElementById('billingContact').textContent = billing.billingName || billing.email || 'Enter billing details to save.';
  document.getElementById('billingCadence').textContent = billing.billingCadence || 'Monthly';

  setText('nextPaymentDate', formatDate(billing.nextPaymentDate));
  setText('nextPaymentHint', billing.nextPaymentDate ? 'Scheduled renewal' : 'Awaiting schedule');
  setText('lastBillingAmount', formatCurrency(billing.lastPaymentAmount || billing.lastAmount));
  setText('lastBillingHint', billing.lastPaymentDate ? `Processed ${formatDate(billing.lastPaymentDate)}` : 'No invoices yet');
  const payable = billing.totalPayable ?? billing.outstandingBalance ?? billing.currentBalance;
  setText('totalAmountDue', formatCurrency(payable));
  setText('totalAmountHint', payable ? 'Includes taxes & adjustments' : 'No outstanding balance');

  updateBillingSummary();
}

function toggleAccess(isAllowed) {
  const denied = document.getElementById('adminAccess');
  const content = document.getElementById('billingContent');
  if (!isAllowed) {
    denied.classList.remove('d-none');
    content.style.display = 'none';
  } else {
    denied.classList.add('d-none');
    content.style.display = '';
  }
}

function showOrgNav() {
  const label = document.getElementById('orgAdminLabel');
  const section = document.getElementById('orgAdminSection');
  if (label) label.style.display = '';
  if (section) section.style.display = '';
}

function bindLogout() {
  const btn = document.getElementById('logout');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  });
}

function getSeatValues() {
  return {
    vendorSeats: Number(document.getElementById('vendorSeatInput').value || 0),
    buyerSeats: Number(document.getElementById('buyerSeatInput').value || 0),
    bothSeats: Number(document.getElementById('bothSeatInput').value || 0)
  };
}

function updateBillingSummary() {
  const { vendorSeats, buyerSeats, bothSeats } = getSeatValues();
  const totalSeats = vendorSeats + buyerSeats + bothSeats;
  const totalMonthlyUSD = vendorSeats * 150 + buyerSeats * 190 + bothSeats * 250;

  setText('totalSeatCount', totalSeats);
  setText('totalMonthlyAmount', formatCurrency(totalMonthlyUSD));

  const saveButton = document.getElementById('billingSaveButton');
  const contactNotice = document.getElementById('contactSalesNotice');
  const feedback = document.getElementById('billingFeedback');

  if (!saveButton || !feedback || !contactNotice) return;

  saveButton.disabled = false;
  saveButton.classList.remove('d-none');
  contactNotice.classList.add('d-none');

  if (totalSeats === 0) {
    saveButton.disabled = true;
    feedback.textContent = 'Add at least one seat to continue.';
  } else if (totalSeats > 200) {
    saveButton.classList.add('d-none');
    contactNotice.classList.remove('d-none');
    feedback.textContent = 'Over 200 seats require assistance from our sales team.';
  } else {
    feedback.textContent = 'Monthly billing is applied to all suites.';
  }
}

function bindBillingForm() {
  const form = document.getElementById('billingForm');
  if (!form) return;
  const feedback = document.getElementById('billingFeedback');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const { vendorSeats, buyerSeats, bothSeats } = getSeatValues();
    const totalSeats = vendorSeats + buyerSeats + bothSeats;

    if (totalSeats === 0) {
      feedback.textContent = 'Add at least one seat to continue.';
      return;
    }

    if (totalSeats > 200) {
      feedback.textContent = 'Over 200 seats? Contact sales to proceed.';
      return;
    }

    const payload = {
      seatLimits: {
        vendorSuite: vendorSeats,
        buyerSuite: buyerSeats,
        bothSuites: bothSeats
      },
      billingDetails: {
        billingName: document.getElementById('billingNameInput').value,
        email: document.getElementById('billingEmailInput').value,
        cardNumber: document.getElementById('cardNumberInput').value,
        cardExpiry: document.getElementById('cardExpiryInput').value,
        cardCvc: document.getElementById('cardCvcInput').value,
        billingAddress: document.getElementById('billingAddressInput').value,
        notes: document.getElementById('billingNotesInput').value
      }
    };

    try {
      feedback.textContent = 'Saving billing updates...';
      const updated = await updateOrgBilling(payload);
      populateOverview(updated);
      feedback.textContent = 'Saved. Billing remains monthly for all suites.';
    } catch (err) {
      console.error('Billing update failed', err);
      feedback.textContent = 'Could not update billing right now.';
    }
  });

  const seatInputs = ['vendorSeatInput', 'buyerSeatInput', 'bothSeatInput'];
  seatInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateBillingSummary);
    }
  });

  const contactButton = document.getElementById('requestSalesContact');
  if (contactButton) contactButton.addEventListener('click', requestSalesContact);
}

async function init() {
  bindLogout();
  bindBillingForm();

  try {
    const overview = await fetchOrgOverview();
    if (!overview.ok) {
      toggleAccess(false);
      return;
    }
    toggleAccess(true);
    showOrgNav();
    populateOverview(overview);
  } catch (err) {
    console.error('Unable to load org billing view', err);
    toggleAccess(false);
  }
}

document.addEventListener('DOMContentLoaded', init);
