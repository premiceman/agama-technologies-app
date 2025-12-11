async function createFullAccessOrg() {
  const payload = {
    status: 'completed',
    finalize: true,
    suiteSelection: { vendorSuite: true, buyerSuite: true },
    organizationDraft: { name: 'Agama Full Access', seatLimit: 500 },
  };

  const res = await fetch('/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err.error || 'Unable to finalize onboarding.';
    throw new Error(message);
  }

  return res.json();
}

function updateStatus({
  statusText = 'Preparing your workspace…',
  detailText = 'Creating a shared workspace with both suites enabled.',
  ready = false,
  error = null,
}) {
  const statusEl = document.getElementById('onboardingStatus');
  const detailEl = document.getElementById('onboardingDetail');
  const hintEl = document.getElementById('progressHint');
  const button = document.getElementById('continueButton');

  if (statusEl) statusEl.textContent = statusText;
  if (detailEl) detailEl.textContent = detailText;
  if (hintEl) hintEl.textContent = error || (ready ? 'All access unlocked.' : 'This will only take a moment.');
  if (button) button.disabled = !ready || Boolean(error);
}

async function finalizeOnboarding() {
  try {
    updateStatus({ statusText: 'Setting up access…' });
    await createFullAccessOrg();
    updateStatus({
      statusText: 'All access granted',
      detailText: 'Seller, Buyer, and ValueSphere capabilities are enabled for your account.',
      ready: true,
    });
    const button = document.getElementById('continueButton');
    if (button) {
      button.addEventListener('click', () => {
        window.location.href = '/workspace.html';
      });
    }
    setTimeout(() => {
      window.location.href = '/workspace.html';
    }, 1200);
  } catch (err) {
    console.error('Onboarding error', err);
    updateStatus({
      statusText: 'Unable to finish onboarding',
      detailText: err?.message || 'Please refresh and try again.',
      error: err?.message || 'Error applying full access.',
    });
  }
}

document.addEventListener('DOMContentLoaded', finalizeOnboarding);
