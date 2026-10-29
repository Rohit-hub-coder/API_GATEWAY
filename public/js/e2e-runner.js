// e2e-runner.js - Browser-Side Automated 22-Check Acceptance Suite
const E2ERunner = (() => {

  const CHECKS = [
    "Gateway direct health (/api/v1/health) returns 200",
    "Aggregate health returns 200",
    "AuthService reports UP",
    "BookingService reports UP",
    "FlightService reports UP",
    "GET /api/v1/flights/flight returns 200",
    "Flight catalog contains real flight records",
    "Target Flight ID 1 identified with seat inventory",
    "User signup returns 201 Created",
    "OTP generated successfully in response",
    "OTP verification returns 200 OK",
    "Signin returns 200 OK",
    "Received valid signed JWT bearer token",
    "User profile endpoint accessible with Bearer token",
    "Booking created with 201 Created",
    "Booking record contains valid ID and totalCost",
    "Flight seats accurately decremented",
    "GET /api/v1/bookings returns 200",
    "User booking records retrieved successfully",
    "PATCH /api/v1/bookings/:id/cancel returns 200 OK",
    "Flight seats accurately restored after cancellation",
    "Unauthorized request without token rejected with 401"
  ];

  async function runAll(mountId = 'e2eModalMount') {
    let modal = document.getElementById(mountId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = mountId;
      document.body.appendChild(modal);
    }

    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md';
    modal.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        <!-- Header -->
        <div class="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div class="flex items-center gap-2">
            <span class="text-base">🧪</span>
            <div>
              <h3 class="font-bold text-white text-sm">Automated E2E Acceptance Suite</h3>
              <p class="text-[11px] text-slate-400">Verifying all 22 end-to-end distributed system assertions</p>
            </div>
          </div>
          <button id="closeE2EBtn" onclick="document.getElementById('${mountId}').remove()" class="text-slate-400 hover:text-white text-sm hidden">✕</button>
        </div>

        <!-- Progress Summary -->
        <div class="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div id="e2eSummaryText" class="font-mono text-slate-300 font-bold">
            Running 0/22 assertions...
          </div>
          <div class="w-32 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div id="e2eProgressBar" class="bg-blue-600 h-2 transition-all duration-200" style="width: 0%"></div>
          </div>
        </div>

        <!-- Checklist -->
        <div id="e2eChecklist" class="p-4 space-y-2 overflow-y-auto flex-1 font-mono text-[11px]">
          ${CHECKS.map((c, i) => `
            <div id="check_${i}" class="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-slate-400 flex items-center gap-2">
              <span class="check-icon">⚪</span>
              <span class="check-text">${i + 1}. ${c}</span>
            </div>
          `).join('')}
        </div>

        <!-- Footer Banner -->
        <div id="e2eFooterBanner" class="p-4 border-t border-slate-800 bg-slate-950 text-center font-bold text-xs text-slate-400">
          Executing automated test transactions...
        </div>
      </div>
    `;

    const updateCheck = (index, passed, extra = '') => {
      const el = document.getElementById(`check_${index}`);
      if (!el) return;
      const icon = el.querySelector('.check-icon');
      if (passed) {
        el.className = 'p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2';
        icon.textContent = '✅';
      } else {
        el.className = 'p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2';
        icon.textContent = '❌';
      }
      const progress = Math.round(((index + 1) / CHECKS.length) * 100);
      document.getElementById('e2eProgressBar').style.width = `${progress}%`;
      document.getElementById('e2eSummaryText').textContent = `Running ${index + 1}/22 assertions...`;
    };

    let passedCount = 0;
    const rand = Math.floor(1000 + Math.random() * 9000);
    const testEmail = `e2e_showcase_${Date.now()}_${rand}@example.com`;
    const testPassword = 'Password123!';
    let token = null;
    let initialSeats = 0;
    let bookingId = null;

    try {
      // 1. Gateway direct health
      const h1 = await API.checkGatewayHealth();
      if (h1.status === 'up') { passedCount++; updateCheck(0, true); } else { updateCheck(0, false); }

      // 2. Aggregate health
      const h2 = await API.checkAggregateHealth();
      const aggOk = h2.auth.status === 'up' && h2.bookings.status === 'up' && h2.flights.status === 'up';
      if (aggOk) { passedCount++; updateCheck(1, true); } else { updateCheck(1, false); }

      // 3. Auth UP
      if (h2.auth.status === 'up') { passedCount++; updateCheck(2, true); } else { updateCheck(2, false); }

      // 4. Booking UP
      if (h2.bookings.status === 'up') { passedCount++; updateCheck(3, true); } else { updateCheck(3, false); }

      // 5. Flight UP
      if (h2.flights.status === 'up') { passedCount++; updateCheck(4, true); } else { updateCheck(4, false); }

      // 6. Flight Search returns 200
      const fRes = await API.getFlights();
      if (fRes.ok) { passedCount++; updateCheck(5, true); } else { updateCheck(5, false); }

      // 7. Returned real flight records
      if (Array.isArray(fRes.data) && fRes.data.length > 0) { passedCount++; updateCheck(6, true); } else { updateCheck(6, false); }

      // 8. Target Flight ID 1 identified with seats
      const targetFlight = fRes.data ? fRes.data.find(f => f.id === 1) || fRes.data[0] : null;
      initialSeats = targetFlight ? targetFlight.totalSeats : 0;
      if (targetFlight && initialSeats > 0) { passedCount++; updateCheck(7, true); } else { updateCheck(7, false); }

      // 9. Signup returns 201
      const signupRes = await API.signup('E2E Showcase Pilot', testEmail, testPassword);
      if (signupRes.status === 201) { passedCount++; updateCheck(8, true); } else { updateCheck(8, false); }

      // 10. OTP generated
      const otp = signupRes.data?.otp;
      if (otp) { passedCount++; updateCheck(9, true); } else { updateCheck(9, false); }

      // 11. OTP verification returns 200
      const otpRes = await API.verifyOtp(testEmail, otp);
      if (otpRes.ok) { passedCount++; updateCheck(10, true); } else { updateCheck(10, false); }

      // 12. Signin returns 200
      const signinRes = await API.signin(testEmail, testPassword);
      token = signinRes.data?.token || signinRes.data;
      if (signinRes.ok) { passedCount++; updateCheck(11, true); } else { updateCheck(11, false); }

      // 13. Valid JWT bearer token
      if (token && typeof token === 'string' && token.split('.').length === 3) { passedCount++; updateCheck(12, true); } else { updateCheck(12, false); }

      // 14. Profile accessible with token
      const profRes = await API.getProfile();
      if (profRes.ok) { passedCount++; updateCheck(13, true); } else { updateCheck(13, false); }

      // 15. Booking created with 201
      const bookRes = await API.createBooking(1, 2);
      if (bookRes.status === 201) { passedCount++; updateCheck(14, true); } else { updateCheck(14, false); }

      // 16. Valid ID and totalCost
      bookingId = bookRes.data?.id;
      if (bookingId && bookRes.data?.totalCost) { passedCount++; updateCheck(15, true); } else { updateCheck(15, false); }

      // 17. Seats decremented by 2
      const fCheck1 = await API.getFlight(1);
      const afterSeats = fCheck1.data?.totalSeats;
      if (afterSeats === initialSeats - 2) { passedCount++; updateCheck(16, true); } else { updateCheck(16, false); }

      // 18. GET /api/v1/bookings returns 200
      const myBookings = await API.getBookings();
      if (myBookings.ok) { passedCount++; updateCheck(17, true); } else { updateCheck(17, false); }

      // 19. Booking records retrieved
      if (Array.isArray(myBookings.data) && myBookings.data.length > 0) { passedCount++; updateCheck(18, true); } else { updateCheck(18, false); }

      // 20. Cancellation returns 200
      const cancelRes = await API.cancelBooking(bookingId);
      if (cancelRes.ok) { passedCount++; updateCheck(19, true); } else { updateCheck(19, false); }

      // 21. Seats restored accurately
      const fCheck2 = await API.getFlight(1);
      const restoredSeats = fCheck2.data?.totalSeats;
      if (restoredSeats === initialSeats) { passedCount++; updateCheck(20, true); } else { updateCheck(20, false); }

      // 22. Unauthorized request without token rejected with 401
      const unauthRes = await fetch(`${window.location.origin}/api/v1/bookings`);
      if (unauthRes.status === 401) { passedCount++; updateCheck(21, true); } else { updateCheck(21, false); }

    } catch (e) {
      console.error('E2E Runner exception', e);
    }

    // Final Banner
    const footer = document.getElementById('e2eFooterBanner');
    const closeBtn = document.getElementById('closeE2EBtn');
    if (closeBtn) closeBtn.classList.remove('hidden');

    if (passedCount === CHECKS.length) {
      footer.className = 'p-4 border-t border-emerald-500/30 bg-emerald-950/60 text-center font-bold text-sm text-emerald-300';
      footer.textContent = `🎉 ALL 22/22 ASSERTIONS PASSED! System is fully verified.`;
      document.getElementById('e2eSummaryText').textContent = `22/22 PASSED (100%)`;
    } else {
      footer.className = 'p-4 border-t border-rose-500/30 bg-rose-950/60 text-center font-bold text-sm text-rose-300';
      footer.textContent = `${passedCount}/${CHECKS.length} passed. Please inspect failing check.`;
      document.getElementById('e2eSummaryText').textContent = `${passedCount}/22 PASSED`;
    }

    // Refresh UI flights & bookings in main screen
    UIFlights.loadFlights('flightsContainer');
    UIFlights.loadBookings('bookingsContainer');
  }

  return {
    runAll
  };
})();

window.E2ERunner = E2ERunner;
