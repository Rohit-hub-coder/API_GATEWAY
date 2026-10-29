// ui-trace.js - Distributed Pipeline Visualizer, Terminal Activity Log, Request Inspector & RabbitMQ Proof
const UITrace = (() => {

  function render(pipelineMountId, logsMountId, rmqMountId) {
    renderPipeline(pipelineMountId);
    renderLogs(logsMountId);
    renderRabbitMQ(rmqMountId);
  }

  // 1. Visual Pipeline Diagram
  function renderPipeline(mountId = 'pipelineMount') {
    const el = document.getElementById(mountId);
    if (!el) return;

    el.innerHTML = `
      <section class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <h3 class="font-bold text-sm text-white flex items-center gap-2">
              <span>⚡ Live Distributed Transaction Pipeline</span>
            </h3>
            <p class="text-xs text-slate-400">Visualizing real-time propagation across microservices & asynchronous message broker</p>
          </div>
          <span id="pipelineStatusPill" class="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            Idle • Ready
          </span>
        </div>

        <!-- Pipeline Nodes Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-2 text-center text-xs">
          <!-- Node 1: Browser -->
          <div id="pnode-browser" class="pipeline-node bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div class="text-base">💻</div>
            <div class="font-bold text-white text-[11px]">Client UI</div>
            <div class="text-[10px] text-slate-500 font-mono">Browser</div>
          </div>

          <!-- Node 2: Gateway -->
          <div id="pnode-gateway" class="pipeline-node bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div class="text-base">🛡️</div>
            <div class="font-bold text-white text-[11px]">API Gateway</div>
            <div class="text-[10px] text-slate-500 font-mono">:3004 • JWT</div>
          </div>

          <!-- Node 3: Service -->
          <div id="pnode-service" class="pipeline-node bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div class="text-base">🎫</div>
            <div class="font-bold text-white text-[11px]">Booking Svc</div>
            <div class="text-[10px] text-slate-500 font-mono">:3002 • ACID</div>
          </div>

          <!-- Node 4: Flights -->
          <div id="pnode-flights" class="pipeline-node bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div class="text-base">✈️</div>
            <div class="font-bold text-white text-[11px]">Flights Svc</div>
            <div class="text-[10px] text-slate-500 font-mono">:3000 • Atomic</div>
          </div>

          <!-- Node 5: MySQL & Outbox -->
          <div id="pnode-outbox" class="pipeline-node bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div class="text-base">📦</div>
            <div class="font-bold text-white text-[11px]">Outbox Table</div>
            <div class="text-[10px] text-slate-500 font-mono">MySQL 8.0</div>
          </div>

          <!-- Node 6: RabbitMQ -->
          <div id="pnode-rabbitmq" class="pipeline-node bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div class="text-base">🐰</div>
            <div class="font-bold text-white text-[11px]">RabbitMQ</div>
            <div class="text-[10px] text-slate-500 font-mono">AMQP :5672</div>
          </div>

          <!-- Node 7: Reminder -->
          <div id="pnode-reminder" class="pipeline-node bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div class="text-base">📢</div>
            <div class="font-bold text-white text-[11px]">Reminder Svc</div>
            <div class="text-[10px] text-slate-500 font-mono">:3003 • Worker</div>
          </div>

          <!-- Node 8: Email -->
          <div id="pnode-email" class="pipeline-node bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div class="text-base">✉️</div>
            <div class="font-bold text-white text-[11px]">Email Dispatch</div>
            <div class="text-[10px] text-slate-500 font-mono">Ethereal / SMTP</div>
          </div>
        </div>
      </section>
    `;
  }

  // Trigger visual wave across pipeline nodes
  function triggerPipelineAnimation(isSuccess = true, path = '') {
    const pill = document.getElementById('pipelineStatusPill');
    if (pill) {
      pill.textContent = isSuccess ? 'Processing: 200 OK' : 'Refused / Error';
      pill.className = `text-[11px] font-mono px-2.5 py-0.5 rounded-full ${isSuccess ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`;
    }

    const nodeSequence = [
      'pnode-browser',
      'pnode-gateway',
      'pnode-service',
      'pnode-flights',
      'pnode-outbox',
      'pnode-rabbitmq',
      'pnode-reminder',
      'pnode-email'
    ];

    nodeSequence.forEach((nodeId, idx) => {
      const el = document.getElementById(nodeId);
      if (!el) return;
      setTimeout(() => {
        el.classList.add(isSuccess ? 'active-success' : 'active-error');
        setTimeout(() => {
          el.classList.remove('active-success', 'active-error');
        }, 1200);
      }, idx * 120);
    });
  }

  // 2. Terminal-Style Activity Log
  function renderLogs(mountId = 'logsMount') {
    const el = document.getElementById(mountId);
    if (!el) return;

    const traces = State.get().traceEvents || [];

    el.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-rose-500/80"></div>
            <div class="w-3 h-3 rounded-full bg-amber-500/80"></div>
            <div class="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            <h4 class="font-bold text-xs text-white ml-1 font-mono">Distributed Activity Log</h4>
          </div>
          <span class="text-[10px] text-slate-500 font-mono">Click entry to inspect payload</span>
        </div>

        <div id="terminalLogList" class="terminal-scroll space-y-1.5 font-mono text-[11px] max-h-60 overflow-y-auto pr-1">
          ${traces.length === 0 ? `
            <div class="text-slate-500 py-6 text-center">No transactions recorded yet. Perform an action to see real-time HTTP traces.</div>
          ` : traces.map((t, idx) => {
            const time = new Date(t.timestamp).toLocaleTimeString();
            const isSuccess = t.success;
            return `
              <div onclick="UITrace.openInspector(${idx})" class="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-950 cursor-pointer transition flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 truncate">
                  <span class="text-slate-500 text-[10px]">[${time}]</span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${isSuccess ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                    ${t.method}
                  </span>
                  <span class="text-slate-300 truncate">${t.path}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[10px] ${isSuccess ? 'text-emerald-400' : 'text-rose-400'}">${t.status}</span>
                  <span class="text-[10px] text-slate-500">${t.durationMs}ms</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 3. RabbitMQ & Messaging Proof Card (Correction 2: Strict REMINDER_QUEUE, no invention of stats)
  function renderRabbitMQ(mountId = 'rabbitmqMount') {
    const el = document.getElementById(mountId);
    if (!el) return;

    const rmq = State.get().health.rabbitmq || {};
    const stats = rmq.stats || {};
    const isUp = rmq.status === 'up';

    // Correction 2: Show "no events yet" if published is n/a
    const publishedText = stats.published !== 'n/a' ? stats.published : 'no events yet';
    const deliveredText = stats.delivered !== 'n/a' ? stats.delivered : 'no events yet';
    const ackText = stats.acknowledged !== 'n/a' ? stats.acknowledged : 'no events yet';
    const readyText = stats.messages_ready !== 'n/a' ? stats.messages_ready : 0;
    const consumersText = stats.consumers !== 'n/a' ? stats.consumers : 'n/a';

    el.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-lg">🐰</span>
            <div>
              <h4 class="font-bold text-sm text-white">RabbitMQ Event Broker</h4>
              <p class="text-[11px] text-slate-400">AMQP Port 5672 • Management API Port 15672</p>
            </div>
          </div>
          <span class="text-[11px] font-mono px-2 py-0.5 rounded-full ${isUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">
            ${isUp ? 'Broker Online' : 'Broker Unreachable'}
          </span>
        </div>

        <!-- Real Metrics Grid -->
        <div class="grid grid-cols-2 gap-2.5 text-xs font-mono">
          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
            <div class="text-[10px] text-slate-500">Queue Name:</div>
            <div class="font-bold text-blue-400 truncate">${stats.name || 'REMINDER_QUEUE'}</div>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
            <div class="text-[10px] text-slate-500">Ready Messages:</div>
            <div class="font-bold ${readyText === 0 ? 'text-emerald-400' : 'text-amber-400'}">${readyText}</div>
            <div class="text-[9px] text-slate-500 italic">Ready = 0 (Consumed immediately)</div>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
            <div class="text-[10px] text-slate-500">Active Consumers:</div>
            <div class="font-bold text-white">${consumersText} worker</div>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
            <div class="text-[10px] text-slate-500">Events Published:</div>
            <div class="font-bold text-emerald-400">${publishedText}</div>
          </div>
        </div>

        <!-- Dashboard Link Button -->
        <div class="flex items-center justify-between pt-1">
          <a href="http://localhost:15672" target="_blank" class="text-xs px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 transition flex items-center gap-1.5">
            <span>Open RabbitMQ Dashboard (guest / guest) ↗</span>
          </a>
          <button onclick="UITrace.refreshRabbitMQ()" class="text-xs text-slate-400 hover:text-slate-200">
            🔄 Refresh
          </button>
        </div>
      </div>
    `;
  }

  // 4. Request / Response Inspector Drawer
  function openInspector(traceIndex) {
    const traces = State.get().traceEvents || [];
    const t = traces[traceIndex];
    if (!t) return;

    let drawer = document.getElementById('traceInspectorModal');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'traceInspectorModal';
      document.body.appendChild(drawer);
    }

    drawer.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm';
    drawer.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
        <!-- Header -->
        <div class="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
              ${t.method}
            </span>
            <span class="text-white font-bold truncate">${t.path}</span>
          </div>
          <button onclick="document.getElementById('traceInspectorModal').remove()" class="text-slate-400 hover:text-white text-base">✕</button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4 overflow-y-auto flex-1">
          <!-- Metadata -->
          <div class="grid grid-cols-3 gap-2 text-[11px]">
            <div class="p-2 rounded bg-slate-950 border border-slate-800">
              <span class="text-slate-500">Status:</span> <span class="${t.success ? 'text-emerald-400' : 'text-rose-400'}">${t.status}</span>
            </div>
            <div class="p-2 rounded bg-slate-950 border border-slate-800">
              <span class="text-slate-500">Latency:</span> <span class="text-blue-400">${t.durationMs}ms</span>
            </div>
            <div class="p-2 rounded bg-slate-950 border border-slate-800 truncate">
              <span class="text-slate-500">Correlation ID:</span> <span class="text-slate-300 truncate">${t.id}</span>
            </div>
          </div>

          <!-- Request Payload -->
          <div>
            <div class="text-[10px] text-slate-400 mb-1">Request Payload:</div>
            <pre class="p-3 rounded-xl bg-slate-950 text-blue-300 border border-slate-800 overflow-x-auto text-[11px]">${JSON.stringify(t.reqBody || 'None', null, 2)}</pre>
          </div>

          <!-- Response Payload -->
          <div>
            <div class="text-[10px] text-slate-400 mb-1">Response JSON:</div>
            <pre class="p-3 rounded-xl bg-slate-950 text-emerald-300 border border-slate-800 overflow-x-auto text-[11px]">${JSON.stringify(t.resBody || 'Empty', null, 2)}</pre>
          </div>
        </div>
      </div>
    `;
  }

  async function refreshRabbitMQ() {
    const res = await API.checkRabbitMQStatus();
    State.setHealth({ rabbitmq: res });
    renderRabbitMQ('rabbitmqMount');
  }

  // Subscribe to changes
  State.subscribe('traceEvents', () => {
    renderLogs('logsMount');
    const lastTrace = State.get().traceEvents[0];
    if (lastTrace) {
      triggerPipelineAnimation(lastTrace.success, lastTrace.path);
    }
  });
  State.subscribe('health', () => renderRabbitMQ('rabbitmqMount'));

  return {
    render,
    openInspector,
    refreshRabbitMQ,
    triggerPipelineAnimation
  };
})();

window.UITrace = UITrace;
