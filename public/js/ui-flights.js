// ui-flights.js - Flight Catalog, Client-Side Filters, Seat Animation & Booking Lifecycle
const UIFlights = (() => {
  let isBookingInProgress = false;
  let activeFilter = { cityId: 'all', maxPrice: 10000 };

  async function init(flightsMountId, bookingsMountId) {
    renderSkeletons(flightsMountId);
    await Promise.all([loadCities(), loadFlights(flightsMountId), loadBookings(bookingsMountId)]);
  }

  function renderSkeletons(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = [1, 2, 3].map(() => `
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse space-y-3">
        <div class="h-6 bg-slate-800 rounded w-1/3"></div>
        <div class="h-4 bg-slate-800/60 rounded w-1/2"></div>
        <div class="h-10 bg-slate-800/40 rounded"></div>
      </div>
    `).join('');
  }

  async function loadCities() {
    const res = await API.getCities();
    if (res.ok && Array.isArray(res.data)) {
      const cityMap = {};
      res.data.forEach(c => { cityMap[c.id] = c.name; });
      State.setCities(cityMap);
      renderFilterDropdown();
    }
  }

  function renderFilterDropdown() {
    const filterSelect = document.getElementById('cityFilterSelect');
    if (!filterSelect) return;
    const cities = State.get().cities;
    filterSelect.innerHTML = `<option value="all">All Cities</option>` + 
      Object.entries(cities).map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
  }

  async function loadFlights(containerId = 'flightsContainer') {
    const res = await API.getFlights();
    if (res.ok && Array.isArray(res.data)) {
      State.setFlights(res.data);
      renderFlightList(containerId);
    } else {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = `
          <div class="p-6 text-center text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20 text-xs">
            Failed to load flights catalog (${res.errorMsg}). Ensure Flights Service (:3000) is running.
          </div>
        `;
      }
    }
  }

  function renderFlightList(containerId = 'flightsContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let flights = State.get().flights || [];
    const cities = State.get().cities || {};

    // Apply client-side filters (Correction 4: Do not invent query params)
    if (activeFilter.cityId !== 'all') {
      const targetCityId = parseInt(activeFilter.cityId, 10);
      flights = flights.filter(f => f.departureAirportId === targetCityId || f.arrivalAirportId === targetCityId);
    }
    if (activeFilter.maxPrice) {
      flights = flights.filter(f => f.price <= activeFilter.maxPrice);
    }

    if (flights.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800 text-xs">
          No scheduled flights match your filter criteria.
        </div>
      `;
      return;
    }

    container.innerHTML = flights.map(f => {
      const departure = new Date(f.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const arrival = new Date(f.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isSoldOut = f.totalSeats <= 0;

      return `
        <div id="flightCard_${f.id}" class="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition space-y-4 shadow-md">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center font-bold text-blue-400">
                <span class="text-[10px] tracking-wider text-slate-400">FLT</span>
                <span class="text-sm leading-none font-mono">${f.flightNumber}</span>
              </div>
              <div>
                <h4 class="font-bold text-white text-sm flex items-center gap-2">
                  Flight ${f.flightNumber}
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Gate ${f.boardingGate || '2B'}
                  </span>
                </h4>
                <p class="text-xs text-slate-400">Aircraft ID: ${f.airplaneId} • Reliable Inventory</p>
              </div>
            </div>

            <div class="text-right">
              <div class="text-lg font-bold text-emerald-400 font-mono">₹${f.price.toLocaleString()}</div>
              <div class="text-[11px] text-slate-400">Fare per seat</div>
            </div>
          </div>

          <!-- Schedule & Seat Stats -->
          <div class="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
            <div class="flex items-center gap-2 font-mono text-slate-300">
              <span>Dep: ${departure}</span>
              <span class="text-slate-600">➔</span>
              <span>Arr: ${arrival}</span>
            </div>

            <!-- Seat Counter Pill with Animation Support -->
            <div class="flex items-center gap-2">
              <span class="text-slate-400">Available:</span>
              <span id="seatBadge_${f.id}" class="seat-number-change px-2.5 py-0.5 rounded-md font-bold font-mono text-xs ${isSoldOut ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
                ${f.totalSeats} seats
              </span>
            </div>
          </div>

          <!-- Booking Actions -->
          <div class="flex items-center justify-end gap-2.5 pt-1">
            <div class="flex items-center gap-1.5 text-xs text-slate-400">
              <label>Qty:</label>
              <select id="seatSelect_${f.id}" class="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-200 outline-none">
                <option value="1">1 Seat</option>
                <option value="2" selected>2 Seats</option>
                <option value="3">3 Seats</option>
                <option value="4">4 Seats</option>
              </select>
            </div>
            <button id="bookBtn_${f.id}" onclick="UIFlights.handleBook(${f.id})" ${isSoldOut ? 'disabled' : ''} class="px-4 py-1.5 rounded-lg text-xs font-semibold ${isSoldOut ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'} transition flex items-center gap-1.5">
              <span>${isSoldOut ? 'Sold Out' : 'Book Seats'}</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Animate Seat Counter using fetched data
  function animateSeatUpdate(flightId, newSeats) {
    const badge = document.getElementById(`seatBadge_${flightId}`);
    if (!badge) return;
    badge.classList.add('seat-number-bounce');
    badge.textContent = `${newSeats} seats`;
    badge.className = `seat-number-change seat-number-bounce px-2.5 py-0.5 rounded-md font-bold font-mono text-xs ${newSeats <= 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`;
    setTimeout(() => {
      badge.classList.remove('seat-number-bounce');
    }, 500);
  }

  // Book Flight with double-click guard and real seat re-fetch
  async function handleBook(flightId) {
    if (isBookingInProgress) return;
    const session = State.get().session;
    if (!session.token) {
      alert('Please authenticate first via 1-Click Demo Login!');
      return;
    }

    const selectEl = document.getElementById(`seatSelect_${flightId}`);
    const btn = document.getElementById(`bookBtn_${flightId}`);
    const seatsToBook = parseInt(selectEl ? selectEl.value : 2, 10);

    isBookingInProgress = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Booking...</span>';
    }

    try {
      const res = await API.createBooking(flightId, seatsToBook);
      if (!res.ok) {
        throw new Error(res.errorMsg || 'Booking creation failed');
      }

      // CORRECTION 5: Always re-fetch /flights/flight/:id after booking
      const flightRes = await API.getFlight(flightId);
      if (flightRes.ok && flightRes.data) {
        animateSeatUpdate(flightId, flightRes.data.totalSeats);
        // Update flight in state
        const flights = State.get().flights.map(f => f.id === flightId ? { ...f, totalSeats: flightRes.data.totalSeats } : f);
        State.setFlights(flights);
      }

      // Refresh Bookings list
      await loadBookings('bookingsContainer');
    } catch (err) {
      alert('Booking Error: ' + err.message);
    } finally {
      isBookingInProgress = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Book Seats</span>';
      }
    }
  }

  // Load and render user bookings (CORRECTION 3: Use real status "Booked" or "Cancelled"; CORRECTION 4: Join flightId to get flight number)
  async function loadBookings(containerId = 'bookingsContainer') {
    const session = State.get().session;
    const container = document.getElementById(containerId);
    const countBadge = document.getElementById('bookingCountBadge');

    if (!session.token) {
      if (container) {
        container.innerHTML = `<p class="text-xs text-slate-500 text-center py-6">Authenticate to view and manage your bookings.</p>`;
      }
      if (countBadge) countBadge.textContent = '0 Bookings';
      return;
    }

    const res = await API.getBookings();
    if (res.ok && Array.isArray(res.data)) {
      State.setBookings(res.data);
      if (countBadge) countBadge.textContent = `${res.data.length} Booking${res.data.length === 1 ? '' : 's'}`;

      if (container) {
        if (res.data.length === 0) {
          container.innerHTML = `<p class="text-xs text-slate-500 text-center py-6">No reservations found. Book a seat to view your tickets here!</p>`;
          return;
        }

        const flightsMap = {};
        (State.get().flights || []).forEach(f => { flightsMap[f.id] = f; });

        container.innerHTML = res.data.map(b => {
          // CORRECTION 3: Real status string from API
          const realStatus = b.status || 'Booked';
          const isCancelled = realStatus.toLowerCase() === 'cancelled';
          // CORRECTION 4: Join booking.flightId with flights list to show flight number
          const flight = flightsMap[b.flightId] || {};
          const flightNum = flight.flightNumber || `ID ${b.flightId}`;

          return `
            <div id="bookingCard_${b.id}" class="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs space-y-2.5 shadow-sm">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 font-bold text-white">
                  <span>Booking #${b.id}</span>
                  <span class="text-slate-500 font-normal">• Flight ${flightNum}</span>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${isCancelled ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
                  ${realStatus}
                </span>
              </div>

              <div class="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Reserved: ${b.noOfSeats} seat(s)</span>
                <span class="font-mono text-white font-medium">₹${(b.totalCost || 0).toLocaleString()}</span>
              </div>

              ${!isCancelled ? `
                <div class="flex justify-end pt-1">
                  <button onclick="UIFlights.handleCancel(${b.id}, ${b.flightId})" class="text-[11px] text-rose-400 hover:text-rose-300 font-medium transition flex items-center gap-1">
                    <span>✕ Cancel Ticket (Restore Seats)</span>
                  </button>
                </div>
              ` : `
                <div class="text-[10px] text-slate-500 italic text-right">
                  Seats released back to flight inventory
                </div>
              `}
            </div>
          `;
        }).join('');
      }
    }
  }

  // Cancel Booking and Re-fetch seat inventory
  async function handleCancel(bookingId, flightId) {
    if (!confirm(`Are you sure you want to cancel Booking #${bookingId}?`)) return;

    try {
      const res = await API.cancelBooking(bookingId);
      if (!res.ok) throw new Error(res.errorMsg || 'Cancellation failed');

      // CORRECTION 5: Always re-fetch /flights/flight/:id after cancel
      const flightRes = await API.getFlight(flightId);
      if (flightRes.ok && flightRes.data) {
        animateSeatUpdate(flightId, flightRes.data.totalSeats);
        const flights = State.get().flights.map(f => f.id === flightId ? { ...f, totalSeats: flightRes.data.totalSeats } : f);
        State.setFlights(flights);
      }

      // Re-fetch bookings list
      await loadBookings('bookingsContainer');
    } catch (err) {
      alert('Cancellation failed: ' + err.message);
    }
  }

  // Filter updates
  function setCityFilter(cityId) {
    activeFilter.cityId = cityId;
    renderFlightList('flightsContainer');
  }

  function setPriceFilter(maxPrice) {
    activeFilter.maxPrice = maxPrice;
    document.getElementById('priceFilterVal').textContent = `₹${maxPrice.toLocaleString()}`;
    renderFlightList('flightsContainer');
  }

  // Subscribe to changes
  State.subscribe('flights', () => renderFlightList('flightsContainer'));
  State.subscribe('session', () => loadBookings('bookingsContainer'));

  return {
    init,
    loadFlights,
    loadBookings,
    handleBook,
    handleCancel,
    setCityFilter,
    setPriceFilter
  };
})();

window.UIFlights = UIFlights;
