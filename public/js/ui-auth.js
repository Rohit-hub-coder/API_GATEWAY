// ui-auth.js - Auth Stepper, 1-Click Demo Login, and Decoded JWT Inspector
const UIAuth = (() => {
  let timerInterval = null;

  function render(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const session = State.get().session;
    const isAuth = !!session.token;

    container.innerHTML = `
      <section class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <!-- Section Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-blue-400">Authentication Service (:3001)</span>
              <span id="authStatusBadge" class="text-[11px] px-2.5 py-0.5 rounded-full font-medium ${isAuth ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">
                ${isAuth ? '✓ Authenticated' : 'Guest (No Token)'}
              </span>
            </div>
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <span>🔐 Identity & Access Management</span>
            </h2>
            <p class="text-xs text-slate-400">Signup → Email OTP Verification → Cryptographic JWT Issuance</p>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex items-center gap-2">
            ${!isAuth ? `
              <button id="quickLoginBtn" onclick="UIAuth.handleQuickLogin()" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-lg shadow-blue-600/25 flex items-center gap-1.5">
                <span>⚡ 1-Click Demo Login</span>
              </button>
            ` : `
              <button onclick="UIAuth.handleLogout()" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-medium text-xs transition border border-slate-700 flex items-center gap-1">
                <span>🚪 Sign Out</span>
              </button>
            `}
          </div>
        </div>

        <!-- Interview Mode Callout -->
        <div class="interview-box ${State.get().interviewMode ? 'block' : 'hidden'} interview-callout p-3 rounded-xl text-xs space-y-1">
          <div class="font-semibold text-blue-400 flex items-center gap-1">
            <span>💡 Interview Talking Point (Auth & Gateway):</span>
          </div>
          <p class="text-slate-300">
            Auth Service verifies credentials and issues signed JWTs. The API Gateway validates tokens <strong>locally</strong> using a shared cryptographic key (<code class="text-blue-300 bg-slate-950 px-1 py-0.5 rounded font-mono">JWT_KEY</code>), removing the Auth Service from the latency-sensitive hot path of authenticated requests.
          </p>
          <p class="text-slate-400 text-[11px]">
            * Note: OTP is included in the demo API signup response for seamless testing; in production it is dispatched via SMTP.
          </p>
        </div>

        <!-- 3-Step Stepper (Visible if not authenticated or in manual mode) -->
        ${!isAuth ? `
          <div class="space-y-4">
            <!-- Stepper Indicators -->
            <div class="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
              <div id="step-tab-1" class="py-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                1. Signup
              </div>
              <div id="step-tab-2" class="py-2 rounded-lg bg-slate-800 text-slate-500 border border-slate-700/50">
                2. Verify OTP
              </div>
              <div id="step-tab-3" class="py-2 rounded-lg bg-slate-800 text-slate-500 border border-slate-700/50">
                3. Signin
              </div>
            </div>

            <!-- Step 1: Signup Form -->
            <div id="step-panel-1" class="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Full Name</label>
                  <input type="text" id="manualName" value="Demo Traveler" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none">
                </div>
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Email Address</label>
                  <input type="email" id="manualEmail" value="traveler_${Math.floor(1000 + Math.random()*9000)}@airline.com" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none">
                </div>
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Password</label>
                  <input type="password" id="manualPassword" value="Password123!" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none">
                </div>
              </div>
              <div class="flex justify-end">
                <button onclick="UIAuth.handleStep1Signup()" class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition">
                  Create User & Request OTP →
                </button>
              </div>
            </div>

            <!-- Step 2: OTP Form (Hidden initially) -->
            <div id="step-panel-2" class="hidden space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Confirming Email</label>
                  <input type="email" id="otpEmail" readonly class="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400 outline-none">
                </div>
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">One-Time Password (OTP)</label>
                  <input type="text" id="otpCode" placeholder="Enter 6-digit OTP" class="w-full bg-slate-900 border border-blue-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none font-mono">
                </div>
              </div>
              <div class="flex justify-end gap-2">
                <button onclick="UIAuth.handleStep2Verify()" class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition">
                  Verify Account →
                </button>
              </div>
            </div>

            <!-- Step 3: Signin Form (Hidden initially) -->
            <div id="step-panel-3" class="hidden space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Email</label>
                  <input type="email" id="signinEmail" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none">
                </div>
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Password</label>
                  <input type="password" id="signinPassword" value="Password123!" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none">
                </div>
              </div>
              <div class="flex justify-end">
                <button onclick="UIAuth.handleStep3Signin()" class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition">
                  Sign In & Obtain JWT Token ➔
                </button>
              </div>
            </div>
          </div>
        ` : `
          <!-- Active Authenticated State -->
          <div class="space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800 gap-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                  ✓
                </div>
                <div>
                  <h4 class="font-bold text-white text-sm">${session.email}</h4>
                  <p class="text-xs text-slate-400">Authenticated Subject • Role: Customer</p>
                </div>
              </div>

              <!-- Expiry Countdown -->
              <div class="text-right">
                <div id="jwtCountdown" class="font-mono text-xs font-semibold text-emerald-400">Calculating expiry...</div>
                <div class="text-[10px] text-slate-500">Stateless token expiry</div>
              </div>
            </div>

            <!-- Decoded JWT Inspector (Collapsible) -->
            <details class="group rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden" open>
              <summary class="flex items-center justify-between p-3 cursor-pointer text-xs font-semibold text-slate-300 hover:bg-slate-900/50 transition">
                <span class="flex items-center gap-1.5">
                  <span class="text-blue-400">🔍</span> Decoded JWT Inspector (Local Gateway Verification)
                </span>
                <span class="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
              </summary>

              <div class="p-4 pt-1 space-y-3 border-t border-slate-800/80 text-xs font-mono">
                <!-- Raw Token Preview -->
                <div>
                  <div class="text-[10px] text-slate-500 mb-1">Compact Bearer Token (Authorization Header):</div>
                  <div class="p-2 rounded bg-slate-900 text-blue-300 break-all select-all text-[11px] border border-slate-800/80">
                    ${session.token}
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <!-- Header -->
                  <div>
                    <div class="text-[10px] text-slate-500 mb-1">Decoded Header:</div>
                    <pre class="p-2.5 rounded bg-slate-900 text-emerald-300 text-[11px] border border-slate-800 overflow-x-auto">${JSON.stringify(session.decodedJwt?.header || {}, null, 2)}</pre>
                  </div>
                  <!-- Payload -->
                  <div>
                    <div class="text-[10px] text-slate-500 mb-1">Decoded Payload Claims:</div>
                    <pre class="p-2.5 rounded bg-slate-900 text-amber-300 text-[11px] border border-slate-800 overflow-x-auto">${JSON.stringify(session.decodedJwt?.payload || {}, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </details>
          </div>
        `}
      </section>
    `;

    startExpiryCountdown();
  }

  function startExpiryCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    const session = State.get().session;
    if (!session.decodedJwt || !session.decodedJwt.payload || !session.decodedJwt.payload.exp) return;

    const expSeconds = session.decodedJwt.payload.exp;
    function update() {
      const el = document.getElementById('jwtCountdown');
      if (!el) return;
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = expSeconds - nowSec;

      if (remaining <= 0) {
        el.textContent = 'Token Expired';
        el.className = 'font-mono text-xs font-semibold text-rose-400';
      } else {
        const h = Math.floor(remaining / 3600);
        const m = Math.floor((remaining % 3600) / 60);
        const s = remaining % 60;
        el.textContent = `Expires in: ${h}h ${m}m ${s}s`;
        el.className = 'font-mono text-xs font-semibold text-emerald-400';
      }
    }

    update();
    timerInterval = setInterval(update, 1000);
  }

  // --- Handlers for 3-Step Stepper ---
  async function handleStep1Signup() {
    const name = document.getElementById('manualName').value.trim();
    const email = document.getElementById('manualEmail').value.trim();
    const password = document.getElementById('manualPassword').value.trim();

    if (!name || !email || !password) return alert('Please enter all fields');

    const res = await API.signup(name, email, password);
    if (!res.ok) return alert('Signup failed: ' + res.errorMsg);

    const otp = res.data?.otp;
    document.getElementById('step-panel-1').classList.add('hidden');
    document.getElementById('step-panel-2').classList.remove('hidden');

    document.getElementById('step-tab-1').className = 'py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    document.getElementById('step-tab-2').className = 'py-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30';

    document.getElementById('otpEmail').value = email;
    if (otp) {
      document.getElementById('otpCode').value = otp;
    }
  }

  async function handleStep2Verify() {
    const email = document.getElementById('otpEmail').value;
    const otp = document.getElementById('otpCode').value.trim();
    if (!otp) return alert('Please enter OTP');

    const res = await API.verifyOtp(email, otp);
    if (!res.ok) return alert('OTP verification failed: ' + res.errorMsg);

    document.getElementById('step-panel-2').classList.add('hidden');
    document.getElementById('step-panel-3').classList.remove('hidden');

    document.getElementById('step-tab-2').className = 'py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    document.getElementById('step-tab-3').className = 'py-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30';

    document.getElementById('signinEmail').value = email;
  }

  async function handleStep3Signin() {
    const email = document.getElementById('signinEmail').value;
    const password = document.getElementById('signinPassword').value;

    const res = await API.signin(email, password);
    if (!res.ok) return alert('Signin failed: ' + res.errorMsg);

    const token = res.data?.token || res.data;
    State.setSession(token, email);
    render('authMount');
  }

  // --- 1-Click Demo Login ---
  async function handleQuickLogin() {
    const btn = document.getElementById('quickLoginBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Executing 3-step auth...</span>';
    }

    try {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const name = `Demo Traveler ${rand}`;
      const email = `traveler_${rand}@airline.com`;
      const password = 'Password123!';

      // 1. Signup
      const signupRes = await API.signup(name, email, password);
      if (!signupRes.ok) throw new Error(signupRes.errorMsg);
      const otp = signupRes.data?.otp;

      // 2. OTP Verify
      if (otp) {
        const verifyRes = await API.verifyOtp(email, otp);
        if (!verifyRes.ok) throw new Error(verifyRes.errorMsg);
      }

      // 3. Signin
      const signinRes = await API.signin(email, password);
      if (!signinRes.ok) throw new Error(signinRes.errorMsg);

      const token = signinRes.data?.token || signinRes.data;
      State.setSession(token, email);
      render('authMount');
    } catch (e) {
      alert('1-Click Demo Login failed: ' + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>⚡ 1-Click Demo Login</span>';
      }
    }
  }

  function handleLogout() {
    State.setSession(null, null);
    render('authMount');
  }

  // Subscribe to session changes
  State.subscribe('session', () => render('authMount'));
  State.subscribe('interviewMode', () => {
    const boxes = document.querySelectorAll('.interview-box');
    boxes.forEach(b => b.classList.toggle('hidden', !State.get().interviewMode));
  });

  return {
    render,
    handleStep1Signup,
    handleStep2Verify,
    handleStep3Signin,
    handleQuickLogin,
    handleLogout
  };
})();

window.UIAuth = UIAuth;
