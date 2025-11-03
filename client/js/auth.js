const handleAuth = (formId, endpoint, errorId) => {
  const form = document.getElementById(formId);
  const error = document.getElementById(errorId);
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error && (error.hidden = true);
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error('Request failed');
      }
      window.location.href = 'projects.html';
    } catch (err) {
      console.error(err);
      if (error) {
        error.hidden = false;
      }
    }
  });
};

handleAuth('login-form', '/api/auth/login', 'login-error');
handleAuth('signup-form', '/api/auth/register', 'signup-error');
