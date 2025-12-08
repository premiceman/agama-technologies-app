(function() {
  const body = document.body;
  if (!body || !body.classList.contains('consulting-page')) return;

  const navLinks = Array.from(document.querySelectorAll('[data-consulting-nav]'));
  const scrollLinks = Array.from(document.querySelectorAll('[data-scroll-target]'));

  initSmoothScroll([...navLinks, ...scrollLinks]);
  initSubnavSpy(navLinks);
  initConsultingForm();
})();

function initSmoothScroll(links) {
  const uniqueLinks = Array.from(new Set(links));
  if (!uniqueLinks.length) return;

  uniqueLinks.forEach(link => {
    link.addEventListener('click', event => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const targetId = href.slice(1);
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      const offset = 90;
      const targetY = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    });
  });
}

function initSubnavSpy(navLinks) {
  if (!navLinks.length) return;
  const sections = navLinks
    .map(link => document.getElementById(link.dataset.subnavTarget))
    .filter(Boolean);

  const setActive = id => {
    navLinks.forEach(link => {
      const isActive = link.dataset.subnavTarget === id;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        setActive(id);
      });
    },
    { threshold: 0.4 }
  );

  sections.forEach(section => observer.observe(section));
}

function initConsultingForm() {
  const form = document.querySelector('.consulting-form form');
  if (!form) return;

  const statusEl = document.getElementById('consulting-form-status');
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

  const setStatus = (message, variant = 'info') => {
    if (!statusEl) return;
    statusEl.classList.remove('d-none', 'alert-info', 'alert-success', 'alert-danger');
    statusEl.classList.add('alert', `alert-${variant}`);
    statusEl.textContent = message;
  };

  const clearStatus = () => {
    if (!statusEl) return;
    statusEl.classList.add('d-none');
    statusEl.textContent = '';
    statusEl.classList.remove('alert', 'alert-info', 'alert-success', 'alert-danger');
  };

  const setLoading = loading => {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading ? 'Sending…' : originalBtnText;
  };

  const clearInvalid = () => {
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  };

  const markInvalid = details => {
    if (!details) return;
    Object.keys(details).forEach(key => {
      if (key === 'focusAreas') {
        form.querySelectorAll('input[name="focusAreas"]').forEach(cb => cb.classList.add('is-invalid'));
        return;
      }
      const field = form.querySelector(`[name="${key}"]`);
      if (field) {
        field.classList.add('is-invalid');
      }
    });
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearStatus();
    clearInvalid();
    setLoading(true);

    const focusAreas = Array.from(form.querySelectorAll('input[name="focusAreas"]:checked')).map(cb => cb.value);
    const payload = {
      name: form.name.value.trim(),
      company: form.company.value.trim(),
      role: form.role.value.trim(),
      email: form.email.value.trim(),
      region: form.region.value.trim(),
      timeline: form.timeline.value,
      budgetBand: form.budget.value.trim(),
      focusAreas,
      challengeDescription: form.stack.value.trim()
    };

    try {
      const res = await fetch('/api/consulting/strategy-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        markInvalid(data.details);
        const message = data.details
          ? 'Please fix the highlighted fields and try again.'
          : data.error || 'Something went wrong. Please try again later.';
        setStatus(message, 'danger');
        return;
      }

      form.reset();
      setStatus(
        'Thanks – we’ve received your details and will get back to you with a tailored strategy session proposal.',
        'success'
      );
    } catch (err) {
      console.error('Consulting strategy call submission failed', err);
      setStatus('Unable to send your request right now. Please try again shortly.', 'danger');
    } finally {
      setLoading(false);
    }
  });
}
