async function fetchOrgOverview() {
  const res = await fetch('/api/org/admin/overview', { credentials: 'include' });
  if (res.status === 403) return { ok: false, reason: 'forbidden' };
  if (!res.ok) throw new Error('Unable to load overview');
  return res.json();
}

async function updateOrgBilling(payload) {
  const res = await fetch('/api/org/admin/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Unable to update billing');
  return res.json();
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
  const total = organization.seatLimit || 0;
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

  const sellerLimit = org.seatLimits?.sellerSuite || org.seatLimit || 0;
  const buyerLimit = org.seatLimits?.buyerSuite || org.seatLimit || 0;
  setText('billingSeatMix', `${sellerLimit} seller • ${buyerLimit} buyer`);
  setText('billingSeatHint', 'Seat mix across suites');

  document.getElementById('seatLimitInput').value = org.seatLimit || 10;
  document.getElementById('sellerSeatInput').value = org.seatLimits?.sellerSuite || org.seatLimit || 0;
  document.getElementById('buyerSeatInput').value = org.seatLimits?.buyerSuite || org.seatLimit || 0;

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

function bindBillingForm() {
  const form = document.getElementById('billingForm');
  if (!form) return;
  const feedback = document.getElementById('billingFeedback');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = {
      seatLimit: Number(document.getElementById('seatLimitInput').value || 0),
      sellerSeatLimit: Number(document.getElementById('sellerSeatInput').value || 0),
      buyerSeatLimit: Number(document.getElementById('buyerSeatInput').value || 0),
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
