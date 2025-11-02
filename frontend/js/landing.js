(function() {
  const modalEl = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const loginFeedback = document.getElementById('loginFeedback');
  const loginStages = loginForm ? Array.from(loginForm.querySelectorAll('.login-stage')) : [];
  const loginRestart = document.getElementById('loginRestart');
  const pulseForm = document.getElementById('quickPulseForm');
  const pulseResult = document.getElementById('quickPulseResult');
  const workspaceBuilder = document.getElementById('workspaceBuilder');
  const workspaceSteps = workspaceBuilder ? Array.from(workspaceBuilder.querySelectorAll('.workspace-step')) : [];
  const workspaceNext = document.getElementById('workspaceNext');
  const workspaceBack = document.getElementById('workspaceBack');
  const workspaceLabel = document.getElementById('workspaceStepLabel');
  const workspaceIntelBody = document.getElementById('workspaceIntelBody');
  const workspaceStatus = document.getElementById('workspaceStatus');
  const loginTriggers = document.querySelectorAll('[data-login-trigger]');
  const tourOverlay = document.getElementById('tourOverlay');
  const tourTriggers = document.querySelectorAll('[data-tour-trigger]');

  let bootstrapModal = null;
  let loginChallengeToken = null;
  let authUser = null;
  const authCallbacks = [];
  let workspaceStep = 0;
  let workspaceIntel = null;
  let workspaceLoadingIntel = false;

  const pulseNarratives = {
    data: {
      title: 'Data modernisation momentum',
      summary:
        'Your data estate can deliver immediate ROI with governed self-service, metric store adoption, and AI-assisted governance.',
      plays: ['Stand up a unified semantic layer', 'Automate quality scoring and lineage', 'Co-create AI-ready governance guardrails']
    },
    observability: {
      title: 'Observability & resilience accelerator',
      summary:
        'Expand telemetry coverage, compress MTTR, and reduce spend through SLO-aligned pipelines and automation.',
      plays: ['Formalise business KPIs into SLOs', 'Deploy event-driven remediation', 'Use FinOps telemetry for cloud governance']
    },
    security: {
      title: 'Zero Trust and cyber resilience leap',
      summary:
        'Balance board expectations and SOC efficiency with layered detection, policy automation, and cyber fusion analytics.',
      plays: ['Prioritise privileged access and workload segmentation', 'Instrument threat-informed use cases', 'Operationalise security analytics with shared telemetry']
    },
    ml: {
      title: 'Machine learning & AIOps multiplier',
      summary:
        'Combine ML operations and reliability practices to prioritise experiments, scale inferencing, and automate incident flow.',
      plays: ['Create feature and model registries', 'Automate runbook remediation with AI copilots', 'Align FinOps with ML workload forecasting']
    },
    genai: {
      title: 'Generative AI productisation fast-track',
      summary:
        'Establish guardrails, accelerate experimentation, and deliver measurable GenAI outcomes across the stack.',
      plays: ['Formalise responsible AI policies', 'Instrument prompt and response analytics', 'Launch cross-functional GenAI discovery sprints']
    }
  };

  const urgencySignals = {
    stabilise: 'Focus on stabilising mission-critical services and tackling accumulated risk first.',
    accelerate: 'Executive sponsors are ready to accelerate investment; prioritise roadmap visibility and value proof points.',
    disrupt: 'Disruptive ambitions need clear guardrails and staged investment waves to land enterprise change.'
  };

  async function hydrateSession() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.user) {
        authUser = json.user;
        document.body.classList.add('is-authenticated');
        flushAuthCallbacks();
      }
    } catch (err) {
      console.warn('Unable to hydrate session', err);
    }
  }

  function flushAuthCallbacks() {
    while (authCallbacks.length) {
      const cb = authCallbacks.shift();
      try {
        cb(authUser);
      } catch (err) {
        console.error(err);
      }
    }
  }

  function onRequireAuth(callback) {
    if (authUser) {
      callback(authUser);
      return true;
    }
    authCallbacks.push(callback);
    openLoginModal();
    return false;
  }

  function openLoginModal() {
    if (!bootstrapModal && modalEl) {
      bootstrapModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    }
    if (bootstrapModal) {
      resetLoginStages();
      bootstrapModal.show();
    }
  }

  function resetLoginStages() {
    if (!loginStages.length) return;
    loginChallengeToken = null;
    loginStages.forEach(stage => stage.classList.add('d-none'));
    const first = loginStages.find(stage => stage.dataset.stage === 'password');
    if (first) first.classList.remove('d-none');
    loginFeedback.textContent = '';
    loginForm.reset();
  }

  async function submitLogin(stage, payload) {
    if (!loginForm) return;
    try {
      loginFeedback.textContent = 'Authenticating…';
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stage, ...payload })
      });
      const data = await res.json();
      if (!res.ok) {
        loginFeedback.textContent = data?.error || 'Unable to login';
        loginFeedback.classList.remove('text-success');
        loginFeedback.classList.add('text-danger');
        return;
      }

      if (data.status === 'OTP_REQUIRED' && data.challengeToken) {
        loginChallengeToken = data.challengeToken;
        toggleLoginStage('challenge');
        loginFeedback.textContent = 'Verification code required. Check your authenticator device.';
        loginFeedback.classList.remove('text-danger');
        loginFeedback.classList.add('text-info');
        const otpInput = loginForm.querySelector('#loginOtp');
        otpInput && otpInput.focus();
        return;
      }

      authUser = data.user;
      loginFeedback.classList.remove('text-danger');
      loginFeedback.classList.add('text-success');
      loginFeedback.textContent = `Welcome back${data.user?.name ? `, ${data.user.name}` : ''}. Redirecting…`;
      flushAuthCallbacks();
      setTimeout(() => {
        bootstrapModal && bootstrapModal.hide();
        loginFeedback.textContent = '';
      }, 900);
    } catch (err) {
      loginFeedback.textContent = 'Unable to login right now. Please try again.';
      loginFeedback.classList.remove('text-success');
      loginFeedback.classList.add('text-danger');
    }
  }

  function toggleLoginStage(stageName) {
    loginStages.forEach(stage => {
      stage.classList.toggle('d-none', stage.dataset.stage !== stageName);
    });
  }

  function initLoginFlow() {
    if (!modalEl || !loginForm) return;
    bootstrapModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });

    loginTriggers.forEach(trigger => {
      trigger.addEventListener('click', event => {
        event.preventDefault();
        openLoginModal();
      });
    });

    loginForm.addEventListener('submit', event => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const stage = loginStages.find(stage => !stage.classList.contains('d-none'))?.dataset.stage || 'password';
      if (stage === 'password') {
        const email = formData.get('email');
        const password = formData.get('password');
        if (!email || !password) {
          loginFeedback.textContent = 'Email and password are required.';
          loginFeedback.classList.add('text-danger');
          return;
        }
        const rememberDevice = formData.get('rememberDevice') === '1';
        submitLogin('password', { email, password, rememberDevice });
      } else {
        if (!loginChallengeToken) {
          loginFeedback.textContent = 'Challenge expired. Please start again.';
          loginFeedback.classList.add('text-danger');
          toggleLoginStage('password');
          return;
        }
        const otp = (formData.get('otp') || '').toString().trim();
        if (!/^\d{6}$/.test(otp)) {
          loginFeedback.textContent = 'Enter the 6-digit verification code.';
          loginFeedback.classList.add('text-danger');
          return;
        }
        const rememberDevice = formData.get('rememberDevice') === '1';
        submitLogin('challenge', { challengeToken: loginChallengeToken, otp, rememberDevice });
      }
    });

    loginRestart?.addEventListener('click', () => {
      resetLoginStages();
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
      resetLoginStages();
    });
  }

  function initPulse() {
    if (!pulseForm || !pulseResult) return;
    pulseForm.addEventListener('submit', event => {
      event.preventDefault();
      const formData = new FormData(pulseForm);
      const focus = formData.get('focus');
      const urgency = formData.get('urgency');
      const investment = formData.get('investment');
      if (!focus || !urgency || !investment) {
        pulseResult.textContent = 'Complete all fields to generate your preview.';
        pulseResult.classList.remove('d-none');
        return;
      }
      const narrative = pulseNarratives[focus];
      const urgencyCopy = urgencySignals[urgency];
      if (!narrative) return;
      pulseResult.innerHTML = `
        <div class="value-pulse value-pulse--highlight">
          <h5 class="mb-2">${narrative.title}</h5>
          <p class="mb-2">${narrative.summary}</p>
          <p class="small mb-3">${urgencyCopy}</p>
          <ul class="text-fg-3 small mb-3">
            ${narrative.plays.map(play => `<li>${play}</li>`).join('')}
          </ul>
          <a class="btn btn-outline-light btn-sm" href="/assessment.html">Unlock full enterprise assessment</a>
        </div>`;
      pulseResult.classList.remove('d-none');
    });
  }

  function parseCsvInput(value) {
    return String(value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  function showWorkspaceStep(index) {
    workspaceStep = index;
    workspaceSteps.forEach((step, idx) => {
      step.classList.toggle('d-none', idx !== index);
    });
    if (workspaceLabel) {
      workspaceLabel.textContent = `Step ${index + 1} of ${workspaceSteps.length}`;
    }
    if (workspaceBack) workspaceBack.disabled = index === 0;
    if (workspaceNext) {
      if (index === workspaceSteps.length - 1) {
        workspaceNext.textContent = 'Create workspace';
      } else if (index === workspaceSteps.length - 2) {
        workspaceNext.textContent = 'Enrich company';
      } else {
        workspaceNext.textContent = 'Next';
      }
    }
  }

  async function fetchWorkspaceIntel(payload) {
    workspaceLoadingIntel = true;
    if (workspaceIntelBody) {
      workspaceIntelBody.textContent = 'Gathering corporate intelligence…';
    }
    try {
      const res = await fetch('/api/organizations/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.status === 401) {
        if (workspaceIntelBody) {
          workspaceIntelBody.textContent = 'Please login to enrich organisation intelligence.';
        }
        onRequireAuth(() => fetchWorkspaceIntel(payload));
        return null;
      }
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        if (workspaceIntelBody) {
          workspaceIntelBody.textContent = error?.error || 'Unable to fetch organisation intelligence.';
        }
        return null;
      }
      const data = await res.json();
      if (data?.intel) {
        const intel = data.intel;
        if (workspaceIntelBody) {
          workspaceIntelBody.innerHTML = renderWorkspaceIntel(intel);
        }
        workspaceLoadingIntel = false;
        return intel;
      }
      if (workspaceIntelBody) {
        workspaceIntelBody.textContent = 'No enrichment data returned. You can proceed with manual details.';
      }
      workspaceLoadingIntel = false;
      return null;
    } catch (err) {
      if (workspaceIntelBody) {
        workspaceIntelBody.textContent = 'Unable to reach enrichment service right now.';
      }
      workspaceLoadingIntel = false;
      return null;
    }
  }

  function renderWorkspaceIntel(intel) {
    if (!intel) return 'No data available. You can continue manually.';
    const profile = intel.profile || {};
    const funding = (profile.fundingRounds || []).slice(0, 3).map(round => `${round.round || 'Round'} — ${round.amount || 'N/A'}`);
    const initiatives = (profile.keyInitiatives || []).slice(0, 3).map(item => item.name || item.objective).filter(Boolean);
    return `
      <p class="mb-2">${intel.summary || 'Summary unavailable.'}</p>
      <div class="small text-fg-3">
        <div><strong>Headcount:</strong> ${profile.headcountEstimate || profile.employeeRange || 'Not disclosed'}</div>
        <div><strong>Classification:</strong> ${profile.classification || 'Unknown'} | <strong>Industry tags:</strong> ${(profile.industryTags || []).join(', ') || '—'}</div>
        ${funding.length ? `<div><strong>Recent funding:</strong> ${funding.join('; ')}</div>` : ''}
        ${initiatives.length ? `<div><strong>Key initiatives:</strong> ${initiatives.join('; ')}</div>` : ''}
      </div>`;
  }

  async function createWorkspace() {
    if (workspaceLoadingIntel) return;
    const formData = new FormData(workspaceBuilder);
    const strategicDrivers = parseCsvInput(formData.get('strategicDrivers'));
    const capabilityFocus = parseCsvInput(formData.get('capabilityFocus'));
    const payload = {
      name: formData.get('name'),
      companyDomain: formData.get('companyDomain'),
      industry: formData.get('industry'),
      region: formData.get('region'),
      companySize: formData.get('companySize'),
      stage: formData.get('stage'),
      strategicDrivers,
      capabilityFocus,
      overview: '',
      companyProfile: workspaceIntel?.profile || {}
    };
    if (!payload.name || !payload.companyDomain || !payload.industry || !payload.region || !payload.companySize) {
      workspaceStatus.textContent = 'Complete all required fields before creating the workspace.';
      workspaceStatus.classList.add('text-danger');
      return;
    }
    workspaceStatus.textContent = 'Creating workspace…';
    workspaceStatus.classList.remove('text-danger');
    workspaceStatus.classList.remove('text-success');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        workspaceStatus.textContent = data?.error || 'Unable to create workspace.';
        workspaceStatus.classList.add('text-danger');
        return;
      }
      workspaceStatus.classList.add('text-success');
      workspaceStatus.textContent = 'Workspace created. Redirecting to your console…';
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1200);
    } catch (err) {
      workspaceStatus.textContent = 'Unexpected error creating workspace. Please try again.';
      workspaceStatus.classList.add('text-danger');
    }
  }

  function initWorkspaceWizard() {
    if (!workspaceBuilder || !workspaceSteps.length) return;
    showWorkspaceStep(0);

    workspaceNext?.addEventListener('click', async () => {
      if (workspaceStep === 0) {
        const required = ['workspaceName', 'workspaceCompany', 'workspaceIndustry', 'workspaceRegion'];
        for (const id of required) {
          const input = document.getElementById(id);
          if (input && !input.value.trim()) {
            input.focus();
            workspaceStatus.textContent = 'Please complete the highlighted fields before continuing.';
            workspaceStatus.classList.add('text-danger');
            return;
          }
        }
        workspaceStatus.textContent = '';
        showWorkspaceStep(1);
        return;
      }
      if (workspaceStep === 1) {
        const formData = new FormData(workspaceBuilder);
        if (!formData.get('companySize')) {
          const sizeSelect = document.getElementById('workspaceCompanySize');
          sizeSelect && sizeSelect.focus();
          workspaceStatus.textContent = 'Select your company size to continue.';
          workspaceStatus.classList.add('text-danger');
          return;
        }
        workspaceStatus.textContent = '';
        showWorkspaceStep(2);
        const focusValues = parseCsvInput(formData.get('capabilityFocus'));
        const primaryCapability = focusValues[0] || 'security';
        const enrichmentPayload = {
          query: formData.get('companyDomain'),
          capability: primaryCapability,
          industry: formData.get('industry'),
          fetchDetailsFor: formData.get('companyDomain')
        };
        const fetchCallback = () => {
          fetchWorkspaceIntel(enrichmentPayload).then(intel => {
            workspaceIntel = intel;
          });
        };
        if (!onRequireAuth(fetchCallback)) {
          if (workspaceIntelBody) {
            workspaceIntelBody.textContent = 'Please login to enrich organisation intelligence.';
          }
        }
        return;
      }
      if (workspaceStep === 2) {
        const confirm = document.getElementById('workspaceConfirm');
        if (confirm && !confirm.checked) {
          workspaceStatus.textContent = 'Confirm the data sharing statement to continue.';
          workspaceStatus.classList.add('text-danger');
          return;
        }
        if (!onRequireAuth(() => createWorkspace())) {
          workspaceStatus.textContent = 'Please login to create your workspace.';
          workspaceStatus.classList.add('text-danger');
        }
      }
    });

    workspaceBack?.addEventListener('click', () => {
      if (workspaceStep === 0) return;
      workspaceStatus.textContent = '';
      showWorkspaceStep(workspaceStep - 1);
    });
  }

  function initTour() {
    if (!tourOverlay) return;
    const storageKey = 'agama-enterprise-tour';
    let hasCompleted = localStorage.getItem(storageKey) === 'done';

    const steps = [
      {
        id: 'login',
        target: document.querySelector('[data-tour-step="login"]') || document.querySelector('[data-login-trigger]'),
        label: 'Secure login',
        body: 'Authenticate with password plus multi-factor verification. Every session is monitored and logged in real time.'
      },
      {
        id: 'pulse',
        target: document.querySelector('[data-tour-step="pulse"]'),
        label: 'Free readiness pulse',
        body: 'Run a 90-second assessment preview to benchmark urgency and unlock stakeholder-ready talking points.'
      },
      {
        id: 'workspace',
        target: document.querySelector('[data-tour-step="workspace"]'),
        label: 'Intelligent workspaces',
        body: 'Launch a workspace enriched with OpenAI-sourced intelligence to align success criteria, initiatives, and procurement readiness.'
      }
    ].filter(step => step.target);

    if (!steps.length) return;

    let index = 0;
    let autoStartTimer = null;
    const labelEl = tourOverlay.querySelector('.tour-step-label');
    const bodyEl = tourOverlay.querySelector('.tour-step-body');
    const actionButtons = tourOverlay.querySelectorAll('[data-tour-action]');
    const panelEl = tourOverlay.querySelector('.tour-panel');

    function highlightTarget(step) {
      document.querySelectorAll('[data-tour-step]').forEach(el => el.classList.remove('tour-highlight'));
      step?.target?.classList.add('tour-highlight');
    }

    function showStep(idx) {
      const step = steps[idx];
      if (!step) {
        endTour();
        return;
      }
      tourOverlay.classList.remove('d-none');
      labelEl.textContent = step.label;
      bodyEl.textContent = step.body;
      highlightTarget(step);
      tourOverlay.setAttribute('aria-hidden', 'false');
      panelEl?.focus({ preventScroll: true });
    }

    function nextStep() {
      index += 1;
      if (index >= steps.length) {
        endTour();
        return;
      }
      showStep(index);
    }

    function prevStep() {
      index = Math.max(0, index - 1);
      showStep(index);
    }

    function endTour() {
      highlightTarget(null);
      tourOverlay.classList.add('d-none');
      tourOverlay.setAttribute('aria-hidden', 'true');
      if (!hasCompleted) {
        localStorage.setItem(storageKey, 'done');
        hasCompleted = true;
      }
    }

    function startTour(manual = false) {
      if (autoStartTimer) {
        clearTimeout(autoStartTimer);
        autoStartTimer = null;
      }
      index = 0;
      showStep(index);
      if (manual && !hasCompleted) {
        localStorage.setItem(storageKey, 'done');
        hasCompleted = true;
      }
    }

    actionButtons.forEach(btn => {
      const action = btn.dataset.tourAction;
      btn.addEventListener('click', () => {
        if (action === 'next') nextStep();
        if (action === 'prev') prevStep();
        if (action === 'skip') endTour();
      });
    });

    document.addEventListener('keydown', event => {
      if (tourOverlay.classList.contains('d-none')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        endTour();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextStep();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevStep();
      }
    });

    tourTriggers.forEach(trigger => {
      trigger.addEventListener('click', event => {
        event.preventDefault();
        startTour(true);
      });
    });

    if (!hasCompleted) {
      autoStartTimer = setTimeout(() => startTour(false), 1200);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initLoginFlow();
    initPulse();
    initWorkspaceWizard();
    initTour();
    hydrateSession();
  });
})();
