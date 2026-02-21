import { supabase } from './config/supabase.js';

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function logout() {
  await supabase.auth.signOut();
  location.reload();
}

export function renderLoginScreen(onSuccess) {
  const root =
    document.getElementById('root') || document.getElementById('admin-dashboard');
  if (!root) return;

  let mode = 'signin'; // 'signin' | 'signup' | 'forgot'

  function render() {
    root.innerHTML = `
      <div id="login-screen" style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#0b1220;
        padding:20px;
      ">
        <div style="
          width:100%;
          max-width:400px;
          background:#fff;
          border-radius:18px;
          box-shadow:0 20px 60px rgba(0,0,0,0.3);
          padding:40px 32px;
        ">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="font-size:40px;margin-bottom:8px;">🤖</div>
            <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 4px;">Bernard Admin</h1>
            <p style="font-size:13px;color:#64748b;margin:0;">
              ${mode === 'signin' ? 'Sign in to your account' : mode === 'signup' ? 'Create a new account' : 'Reset your password'}
            </p>
          </div>

          <form id="auth-form" autocomplete="off" style="display:flex;flex-direction:column;gap:14px;">
            ${mode === 'signup' ? `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                  <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">First Name</label>
                  <input id="auth-fname" type="text" required placeholder="First name" style="${inputStyle()}" />
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Last Name</label>
                  <input id="auth-lname" type="text" required placeholder="Last name" style="${inputStyle()}" />
                </div>
              </div>
            ` : ''}

            <div>
              <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Email</label>
              <input id="auth-email" type="email" required placeholder="you@example.com" style="${inputStyle()}" />
            </div>

            ${mode !== 'forgot' ? `
              <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Password</label>
                <div style="position:relative;">
                  <input id="auth-password" type="password" required placeholder="${mode === 'signup' ? 'Min 6 characters' : 'Your password'}" minlength="6" style="${inputStyle()}padding-right:42px;" />
                  <button type="button" id="toggle-pw" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:#94a3b8;padding:0;" tabindex="-1">👁</button>
                </div>
              </div>
            ` : ''}

            ${mode === 'signup' ? `
              <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Confirm Password</label>
                <input id="auth-confirm" type="password" required placeholder="Confirm password" minlength="6" style="${inputStyle()}" />
              </div>
            ` : ''}

            ${mode === 'signin' ? `
              <div style="text-align:right;">
                <button type="button" id="btn-forgot" style="background:none;border:none;color:#6c63ff;font-size:12px;font-weight:600;cursor:pointer;padding:0;">Forgot password?</button>
              </div>
            ` : ''}

            <button type="submit" id="auth-submit" style="
              width:100%;
              padding:12px;
              background:linear-gradient(135deg, #6c63ff, #5146ff);
              color:#fff;
              border:none;
              border-radius:10px;
              font-size:15px;
              font-weight:700;
              cursor:pointer;
              transition:opacity 0.2s;
              margin-top:4px;
            ">
              ${mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          <div id="auth-message" style="margin-top:14px;font-size:13px;min-height:20px;text-align:center;"></div>

          <div style="margin-top:20px;text-align:center;font-size:13px;color:#64748b;">
            ${mode === 'signin' ? `
              Don't have an account?
              <button type="button" id="btn-switch" style="background:none;border:none;color:#6c63ff;font-weight:600;cursor:pointer;padding:0;font-size:13px;">Sign up</button>
            ` : `
              Already have an account?
              <button type="button" id="btn-switch" style="background:none;border:none;color:#6c63ff;font-weight:600;cursor:pointer;padding:0;font-size:13px;">Sign in</button>
            `}
          </div>
        </div>
      </div>
    `;

    attachListeners();
  }

  function inputStyle() {
    return 'width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;background:#f8fafc;box-sizing:border-box;transition:border-color 0.2s;';
  }

  function attachListeners() {
    const form = document.getElementById('auth-form');
    const msgEl = document.getElementById('auth-message');
    const submitBtn = document.getElementById('auth-submit');
    const emailInput = document.getElementById('auth-email');

    // Focus first relevant input
    if (mode === 'signup') {
      document.getElementById('auth-fname')?.focus();
    } else {
      emailInput?.focus();
    }

    // Input focus styling
    document.querySelectorAll('#auth-form input').forEach(inp => {
      inp.addEventListener('focus', () => { inp.style.borderColor = '#6c63ff'; });
      inp.addEventListener('blur', () => { inp.style.borderColor = '#e2e8f0'; });
    });

    // Password toggle
    const togglePw = document.getElementById('toggle-pw');
    const pwInput = document.getElementById('auth-password');
    if (togglePw && pwInput) {
      togglePw.addEventListener('click', () => {
        const hidden = pwInput.type === 'password';
        pwInput.type = hidden ? 'text' : 'password';
        togglePw.textContent = hidden ? '🙈' : '👁';
      });
    }

    // Mode switching
    document.getElementById('btn-switch')?.addEventListener('click', () => {
      mode = mode === 'signin' ? 'signup' : 'signin';
      render();
    });

    document.getElementById('btn-forgot')?.addEventListener('click', () => {
      mode = 'forgot';
      render();
    });

    // Form submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msgEl.textContent = '';
      msgEl.style.color = '#ef4444';

      const email = emailInput.value.trim();
      const password = pwInput?.value || '';

      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.6';
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Please wait...';

      try {
        if (mode === 'signin') {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          onSuccess();
          return;
        }

        if (mode === 'signup') {
          const confirmPw = document.getElementById('auth-confirm').value;
          if (password !== confirmPw) {
            throw new Error('Passwords do not match');
          }
          const fname = document.getElementById('auth-fname').value.trim();
          const lname = document.getElementById('auth-lname').value.trim();

          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { first_name: fname, last_name: lname },
            },
          });
          if (error) throw error;

          msgEl.style.color = '#16a34a';
          msgEl.textContent = 'Account created! Check your email to confirm, then sign in.';
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
          submitBtn.textContent = 'Check your email';
          return;
        }

        if (mode === 'forgot') {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
          });
          if (error) throw error;

          msgEl.style.color = '#16a34a';
          msgEl.textContent = 'Password reset link sent! Check your email.';
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
          submitBtn.textContent = 'Email sent';
          return;
        }
      } catch (err) {
        msgEl.textContent = err.message || 'Something went wrong';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.textContent = originalText;
      }
    });
  }

  render();
}
