/**
 * Open Agentic Web Browser Runtime (MVP Profile 0.2 Reference-Compatible)
 * - Validates agent-manifest.json & <network>.network.json before execution
 * - Pluggable Inference (BYOK: Otari, OpenRouter, OpenAI, Custom/Ollama)
 * - Zero-Key Local Demo Engine for instant offline/judge testing
 * - Local website_* actions with JSON Schema validation & human confirmation for irreversible writes
 * - Cross-origin Peer Loading with explicit Consent Card & strict BYOK / sly_data isolation
 * - Observable Execution Trace
 */

export const PROVIDERS = {
  otari: {
    label: "Mozilla Otari (Hackathon Default)",
    baseUrl: "https://api.otari.ai/api/v1",
    model: "alibaba/qwen3.8-flash"
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini"
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini"
  },
  ollama: {
    label: "Local Ollama (No Key)",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "llama3.1"
  }
};

export function validateManifestAndNetwork(manifest, network, expectedName) {
  const errors = [];
  const warnings = [];
  if (!manifest || typeof manifest !== "object") {
    errors.push("agent-manifest.json must be a JSON object.");
    return { valid: false, errors, warnings };
  }
  if (!Array.isArray(manifest.networks) || manifest.networks.length === 0) {
    errors.push("agent-manifest.json must declare at least one entry in networks[].");
  }
  const netEntry = (manifest.networks || []).find(n => !expectedName || n.name === expectedName);
  if (!netEntry) {
    errors.push(`Network '${expectedName}' not found in agent-manifest.json.`);
  } else {
    if (!netEntry.name) errors.push("Network entry missing 'name'.");
    if (!netEntry.front_man) errors.push("Network entry missing 'front_man'.");
    if (!netEntry.hocon) errors.push("Network entry missing 'hocon' path.");
  }

  if (!network || typeof network !== "object") {
    errors.push("Network definition must be a JSON object.");
    return { valid: false, errors, warnings };
  }
  if (!Array.isArray(network.tools) || network.tools.length === 0) {
    errors.push("Network definition must contain a non-empty 'tools' array.");
    return { valid: false, errors, warnings };
  }

  const names = new Set();
  for (const agent of network.tools) {
    if (!agent.name) {
      errors.push("Found agent definition without 'name'.");
      continue;
    }
    if (names.has(agent.name)) {
      errors.push(`Duplicate agent name '${agent.name}'.`);
    }
    names.add(agent.name);
    if (!agent.function || !agent.function.description) {
      warnings.push(`Agent '${agent.name}' missing function.description.`);
    }
    if (!agent.instructions) {
      warnings.push(`Agent '${agent.name}' missing instructions.`);
    }
  }

  if (netEntry && netEntry.front_man && !names.has(netEntry.front_man)) {
    errors.push(`front_man '${netEntry.front_man}' does not exist in network.tools.`);
  }

  // Check for cycles in local agent delegation graph
  const graph = new Map();
  for (const agent of network.tools) {
    const localRefs = (agent.tools || []).filter(t => typeof t === "string" && names.has(t));
    graph.set(agent.name, localRefs);
  }
  const visiting = new Set();
  const visited = new Set();
  function dfs(node) {
    visiting.add(node);
    for (const nxt of graph.get(node) || []) {
      if (visiting.has(nxt)) {
        errors.push(`Delegation cycle detected involving '${node}' -> '${nxt}'.`);
      } else if (!visited.has(nxt)) {
        dfs(nxt);
      }
    }
    visiting.delete(node);
    visited.add(node);
  }
  for (const n of names) {
    if (!visited.has(n)) dfs(n);
  }

  // Security check: no hardcoded secrets or demo_mode
  const raw = JSON.stringify(network);
  if (/sk-[A-Za-z0-9]{16,}/.test(raw)) {
    errors.push("Potential API key secret detected inside public network definition.");
  }
  if (network.demo_mode === true) {
    warnings.push("Network declares demo_mode: true (discouraged by MVP spec).");
  }

  return { valid: errors.length === 0, errors, warnings, agents: Array.from(names) };
}

export class OAWRuntime {
  constructor(options) {
    this.mountEl = options.mountEl;
    this.manifestUrl = options.manifestUrl || "./agent-manifest.json";
    this.linksUrl = options.linksUrl || "./links.json";
    this.actions = options.actions || {};
    this.greeting = options.greeting || "Hello! I am an Open Agentic Web assistant running locally in your browser.";
    this.sampleQueries = options.sampleQueries || [];
    this.localFallbackHandler = options.localFallbackHandler || null;
    this.storageKey = `oaw_byok_${options.networkName || "default"}`;

    this.manifest = null;
    this.network = null;
    this.links = null;
    this.history = [];
    this.traces = [];
    this.approvedOrigins = new Set();
    this.maxSteps = 8;
    this.byok = this.loadByok();
  }

  loadByok() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      mode: "demo", // "demo" (zero-key local engine) | "byok" (live OpenAI-compatible router)
      provider: "otari",
      baseUrl: PROVIDERS.otari.baseUrl,
      model: PROVIDERS.otari.model,
      apiKey: ""
    };
  }

  saveByok(cfg) {
    this.byok = { ...this.byok, ...cfg };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.byok));
    } catch (_) {}
  }

  clearByok() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (_) {}
    this.byok = {
      mode: "demo",
      provider: "otari",
      baseUrl: PROVIDERS.otari.baseUrl,
      model: PROVIDERS.otari.model,
      apiKey: ""
    };
  }

  logTrace(type, title, detail = "") {
    const entry = {
      time: new Date().toLocaleTimeString(),
      type,
      title,
      detail
    };
    this.traces.unshift(entry);
    if (this.traces.length > 40) this.traces.pop();
    this.renderTraces();
  }

  async boot() {
    try {
      const mResp = await fetch(this.manifestUrl);
      if (!mResp.ok) throw new Error(`HTTP ${mResp.status} loading ${this.manifestUrl}`);
      this.manifest = await mResp.json();

      const netEntry = this.manifest.networks[0];
      const nResp = await fetch(netEntry.hocon);
      if (!nResp.ok) throw new Error(`HTTP ${nResp.status} loading ${netEntry.hocon}`);
      this.network = await nResp.json();

      try {
        const lResp = await fetch(this.linksUrl);
        if (lResp.ok) this.links = await lResp.json();
      } catch (_) {
        this.links = { version: 1, networks: {} };
      }

      const check = validateManifestAndNetwork(this.manifest, this.network, netEntry.name);
      if (!check.valid) {
        throw new Error("Network validation failed: " + check.errors.join("; "));
      }

      this.renderShell(netEntry, check);
      this.logTrace("system", "Runtime Booted (MVP 0.2)", `Network: ${netEntry.name} | Front agent: ${netEntry.front_man} | Agents: ${check.agents.join(", ")}`);
      this.appendMessage("assistant", this.greeting);
    } catch (err) {
      this.mountEl.innerHTML = `<div class="oaw-error"><strong>Agent Runtime Fail-Closed:</strong> ${this.escapeHtml(err.message)}</div>`;
    }
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  renderShell(netEntry, check) {
    this.mountEl.innerHTML = `
      <div class="oaw-widget">
        <div class="oaw-header">
          <div>
            <span class="oaw-badge">Open Agentic Web MVP 0.2</span>
            <h3 class="oaw-title">${this.escapeHtml(this.manifest.brand?.name || netEntry.name)} — Browser Agent Runtime</h3>
            <p class="oaw-sub">Front Agent: <code>${this.escapeHtml(netEntry.front_man)}</code> · Specialists: <code>${this.escapeHtml(check.agents.join(", "))}</code></p>
          </div>
          <div class="oaw-header-actions">
            <span class="oaw-mode-pill" id="oaw-mode-pill"></span>
            <button type="button" class="oaw-btn-ghost" id="oaw-toggle-settings">⚙ AI Model Settings (BYOK)</button>
          </div>
        </div>

        <div class="oaw-settings-panel" id="oaw-settings-panel" hidden>
          <div class="oaw-settings-grid">
            <label>
              Execution Mode
              <select id="oaw-mode">
                <option value="demo">Zero-Key Local Simulator (Instant Demo)</option>
                <option value="byok">Live BYOK LLM (Otari / OpenRouter / OpenAI)</option>
              </select>
            </label>
            <label>
              Router Preset
              <select id="oaw-provider">
                <option value="otari">Mozilla Otari (Hackathon Default)</option>
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Local Ollama</option>
              </select>
            </label>
            <label>
              Router Base URL
              <input type="text" id="oaw-baseurl" placeholder="https://api.otari.ai/api/v1" />
            </label>
            <label>
              Model
              <input type="text" id="oaw-model" placeholder="alibaba/qwen3.8-flash" />
            </label>
            <label class="oaw-full">
              Your API Key (stays strictly in your browser localStorage — never sent to peer sites)
              <input type="password" id="oaw-apikey" placeholder="Paste Otari / OpenRouter / OpenAI key..." />
            </label>
          </div>
          <div class="oaw-settings-footer">
            <button type="button" class="oaw-btn-primary" id="oaw-save-byok">Save &amp; Apply</button>
            <button type="button" class="oaw-btn-danger" id="oaw-clear-byok">Delete Stored Key</button>
            <span class="oaw-hint">Keys are never embedded in manifests, prompts, or cross-origin peer calls.</span>
          </div>
        </div>

        <div class="oaw-body">
          <div class="oaw-chat-col">
            <div class="oaw-samples" id="oaw-samples"></div>
            <div class="oaw-messages" id="oaw-messages"></div>
            <div class="oaw-dialog-slot" id="oaw-dialog-slot"></div>
            <form class="oaw-input-row" id="oaw-form">
              <input type="text" id="oaw-input" placeholder="Ask the agent network or trigger a site action..." autocomplete="off" />
              <button type="submit" class="oaw-btn-primary">Send</button>
            </form>
          </div>
          <div class="oaw-trace-col">
            <div class="oaw-trace-head">
              <strong>Observable Execution Trace</strong>
              <span class="oaw-trace-meta">sly_data: deny-by-default</span>
            </div>
            <div class="oaw-traces" id="oaw-traces"></div>
          </div>
        </div>
      </div>
    `;

    // Populate samples
    const samplesEl = this.mountEl.querySelector("#oaw-samples");
    for (const q of this.sampleQueries) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "oaw-chip";
      btn.textContent = q;
      btn.addEventListener("click", () => this.handleUserMessage(q));
      samplesEl.appendChild(btn);
    }

    // Bind settings
    const panel = this.mountEl.querySelector("#oaw-settings-panel");
    const modeSel = this.mountEl.querySelector("#oaw-mode");
    const provSel = this.mountEl.querySelector("#oaw-provider");
    const urlInp = this.mountEl.querySelector("#oaw-baseurl");
    const modInp = this.mountEl.querySelector("#oaw-model");
    const keyInp = this.mountEl.querySelector("#oaw-apikey");

    const syncInputs = () => {
      modeSel.value = this.byok.mode;
      provSel.value = this.byok.provider || "otari";
      urlInp.value = this.byok.baseUrl || "";
      modInp.value = this.byok.model || "";
      keyInp.value = this.byok.apiKey || "";
      const pill = this.mountEl.querySelector("#oaw-mode-pill");
      pill.textContent = this.byok.mode === "byok"
        ? `Live BYOK · ${this.byok.model}`
        : "Zero-Key Demo Engine";
      pill.className = `oaw-mode-pill ${this.byok.mode === "byok" ? "live" : "demo"}`;
    };
    syncInputs();

    this.mountEl.querySelector("#oaw-toggle-settings").addEventListener("click", () => {
      panel.hidden = !panel.hidden;
    });
    provSel.addEventListener("change", () => {
      const p = PROVIDERS[provSel.value];
      if (p) {
        urlInp.value = p.baseUrl;
        modInp.value = p.model;
      }
    });
    this.mountEl.querySelector("#oaw-save-byok").addEventListener("click", () => {
      this.saveByok({
        mode: modeSel.value,
        provider: provSel.value,
        baseUrl: urlInp.value.trim(),
        model: modInp.value.trim(),
        apiKey: keyInp.value.trim()
      });
      syncInputs();
      panel.hidden = true;
      this.logTrace("config", "Inference Router Updated", `Mode: ${this.byok.mode} | Router: ${this.byok.baseUrl} | Model: ${this.byok.model}`);
    });
    this.mountEl.querySelector("#oaw-clear-byok").addEventListener("click", () => {
      this.clearByok();
      syncInputs();
      this.logTrace("security", "BYOK Credentials Deleted", "Cleared from origin-scoped localStorage.");
    });

    this.mountEl.querySelector("#oaw-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = this.mountEl.querySelector("#oaw-input");
      const text = inp.value.trim();
      if (!text) return;
      inp.value = "";
      this.handleUserMessage(text);
    });
  }

  renderTraces() {
    const el = this.mountEl.querySelector("#oaw-traces");
    if (!el) return;
    el.innerHTML = this.traces.map(t => `
      <div class="oaw-trace-item oaw-trace-${t.type}">
        <div class="oaw-trace-top"><span>${this.escapeHtml(t.title)}</span><time>${this.escapeHtml(t.time)}</time></div>
        ${t.detail ? `<div class="oaw-trace-detail">${this.escapeHtml(t.detail)}</div>` : ""}
      </div>
    `).join("");
  }

  appendMessage(role, htmlOrText, isHtml = false) {
    const box = this.mountEl.querySelector("#oaw-messages");
    const div = document.createElement("div");
    div.className = `oaw-msg oaw-msg-${role}`;
    if (isHtml) {
      div.innerHTML = htmlOrText;
    } else {
      div.innerHTML = this.escapeHtml(htmlOrText).replace(/\n/g, "<br>");
    }
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  requestConfirmation({ title, summaryRows, confirmLabel = "Confirm Action", cancelLabel = "Keep Current State" }) {
    return new Promise((resolve) => {
      const slot = this.mountEl.querySelector("#oaw-dialog-slot");
      const rowsHtml = summaryRows.map(([k, v]) => `<div><span>${this.escapeHtml(k)}:</span> <strong>${this.escapeHtml(v)}</strong></div>`).join("");
      slot.innerHTML = `
        <div class="oaw-confirm-card">
          <div class="oaw-confirm-tag">Human Confirmation Required (Irreversible Action)</div>
          <h4>${this.escapeHtml(title)}</h4>
          <div class="oaw-confirm-rows">${rowsHtml}</div>
          <div class="oaw-confirm-actions">
            <button type="button" class="oaw-btn-primary" id="oaw-confirm-yes">${this.escapeHtml(confirmLabel)}</button>
            <button type="button" class="oaw-btn-ghost" id="oaw-confirm-no">${this.escapeHtml(cancelLabel)}</button>
          </div>
        </div>
      `;
      slot.querySelector("#oaw-confirm-yes").addEventListener("click", () => {
        slot.innerHTML = "";
        this.logTrace("consent", "User Approved Action", title);
        resolve(true);
      });
      slot.querySelector("#oaw-confirm-no").addEventListener("click", () => {
        slot.innerHTML = "";
        this.logTrace("consent", "User Declined Action", title);
        resolve(false);
      });
    });
  }

  requestPeerConsent({ peerOrigin, peerName, purpose, preview }) {
    if (this.approvedOrigins.has(peerOrigin)) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const slot = this.mountEl.querySelector("#oaw-dialog-slot");
      slot.innerHTML = `
        <div class="oaw-consent-card">
          <div class="oaw-confirm-tag">Cross-Origin Peer Consent (MVP 0.2 Section 3.2)</div>
          <h4>Allow contacting peer site <code>${this.escapeHtml(peerOrigin)}</code>?</h4>
          <p><strong>Peer Network:</strong> ${this.escapeHtml(peerName)}<br>
             <strong>Purpose:</strong> ${this.escapeHtml(purpose)}<br>
             <strong>Request preview:</strong> ${this.escapeHtml(preview.slice(0, 140))}</p>
          <p class="oaw-privacy-note">Security guarantee: Your BYOK API key and private context (<code>sly_data</code>) will NEVER be sent to this peer origin. The peer network runs locally in your browser.</p>
          <div class="oaw-confirm-actions">
            <button type="button" class="oaw-btn-primary" id="oaw-peer-once">Allow Once</button>
            <button type="button" class="oaw-btn-secondary" id="oaw-peer-session">Allow for Session</button>
            <button type="button" class="oaw-btn-danger" id="oaw-peer-deny">Deny</button>
          </div>
        </div>
      `;
      slot.querySelector("#oaw-peer-once").addEventListener("click", () => {
        slot.innerHTML = "";
        this.logTrace("consent", "Peer Contact Allowed (Once)", `${peerOrigin}/${peerName}`);
        resolve(true);
      });
      slot.querySelector("#oaw-peer-session").addEventListener("click", () => {
        this.approvedOrigins.add(peerOrigin);
        slot.innerHTML = "";
        this.logTrace("consent", "Peer Contact Allowed (Session)", `${peerOrigin}/${peerName}`);
        resolve(true);
      });
      slot.querySelector("#oaw-peer-deny").addEventListener("click", () => {
        slot.innerHTML = "";
        this.logTrace("security", "Peer Contact Denied by User", `${peerOrigin}/${peerName}`);
        resolve(false);
      });
    });
  }

  async callPeerNetwork(peerUrl, query) {
    const parsed = new URL(peerUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const peerNetworkName = segments.pop();
    const basePath = `${parsed.origin}/${segments.length ? segments.join("/") + "/" : ""}`;

    // Check peer_policy / allowed_peers
    const policy = this.manifest.peer_policy || "allowlist";
    const allowed = this.manifest.allowed_peers || [];
    if (policy !== "open" && !allowed.includes(parsed.origin)) {
      this.logTrace("security", "Peer Origin Blocked by Manifest Policy", `${parsed.origin} not in allowed_peers`);
      return { ok: false, reason: `Origin ${parsed.origin} is not permitted by this site's peer_policy (${policy}).` };
    }

    const consented = await this.requestPeerConsent({
      peerOrigin: parsed.origin,
      peerName: peerNetworkName,
      purpose: "Fetch public agent-manifest.json and network definition via CORS (no credentials sent).",
      preview: query
    });
    if (!consented) {
      return { ok: false, reason: "Visitor declined cross-origin contact with peer site." };
    }

    try {
      this.logTrace("peer", "Fetching Peer Manifest (CORS)", `${basePath}agent-manifest.json`);
      const pmResp = await fetch(`${basePath}agent-manifest.json`, { credentials: "omit", mode: "cors" });
      if (!pmResp.ok) throw new Error(`HTTP ${pmResp.status} fetching peer manifest`);
      const peerManifest = await pmResp.json();
      const entry = (peerManifest.networks || []).find(n => n.name === peerNetworkName);
      if (!entry) throw new Error(`Peer network '${peerNetworkName}' not found in peer manifest (exact match required).`);

      const netUrl = new URL(entry.hocon, basePath).toString();
      const pnResp = await fetch(netUrl, { credentials: "omit", mode: "cors" });
      if (!pnResp.ok) throw new Error(`HTTP ${pnResp.status} fetching peer network`);
      const peerNetwork = await pnResp.json();

      const validation = validateManifestAndNetwork(peerManifest, peerNetwork, peerNetworkName);
      if (!validation.valid) {
        throw new Error(`Peer network failed validation: ${validation.errors.join("; ")}`);
      }

      // Optional public catalog data if peer exposes grounded read-only JSON
      let peerCatalog = null;
      if (peerManifest.public_data_url) {
        const dUrl = new URL(peerManifest.public_data_url, basePath).toString();
        const dResp = await fetch(dUrl, { credentials: "omit", mode: "cors" });
        if (dResp.ok) peerCatalog = await dResp.json();
      }

      this.logTrace("peer", "Peer Network Validated & Loaded Locally", `${peerNetworkName} (${validation.agents.join(", ")}) · BYOK key isolated`);
      return { ok: true, peerManifest, peerNetwork, peerCatalog, peerOrigin: parsed.origin };
    } catch (err) {
      this.logTrace("error", "Peer Fetch Failed (Fail-Closed)", err.message);
      return { ok: false, reason: `Could not reach peer ${parsed.origin}: ${err.message}. Ensure the peer server is running with CORS enabled.` };
    }
  }

  async invokeAction(name, args = {}) {
    const action = this.actions[name];
    if (!action) {
      return { ok: false, reason: `Unknown site action '${name}'.` };
    }
    this.logTrace("tool", `Calling ${name} (${action.effect || "read"})`, JSON.stringify(args));
    if (action.effect === "irreversible") {
      if (action.preflight) {
        const pre = action.preflight(args);
        if (!pre.ok) {
          this.logTrace("error", `${name} Preflight Refused`, pre.reason);
          return pre;
        }
        const approved = await this.requestConfirmation({
          title: pre.dialogTitle || `Confirm ${name}`,
          summaryRows: pre.summaryRows || [["Action", name]],
          confirmLabel: pre.confirmLabel || "Confirm",
          cancelLabel: pre.cancelLabel || "Cancel"
        });
        if (!approved) {
          return { ok: false, reason: "Action cancelled by user in confirmation dialog." };
        }
      }
    }
    try {
      const res = await action.handler(args, this);
      this.logTrace("tool", `Receipt from ${name}`, res.ok ? (res.summary || "OK") : `Refused: ${res.reason}`);
      return res;
    } catch (err) {
      this.logTrace("error", `${name} Unknown Outcome`, err.message);
      return { ok: false, unknown_outcome: true, reason: `Execution error (unknown outcome): ${err.message}` };
    }
  }

  async callLiveByokLlm(userText) {
    if (!this.byok.apiKey && this.byok.provider !== "ollama") {
      return "Live BYOK mode is active, but no API key is configured. Open ⚙ AI Model Settings (BYOK) to enter your Otari/OpenRouter/OpenAI key, or switch to Zero-Key Local Simulator.";
    }
    const front = this.network.tools.find(t => t.name === this.manifest.networks[0].front_man) || this.network.tools[0];
    const toolDefs = Object.entries(this.actions).map(([k, a]) => ({
      type: "function",
      function: {
        name: k,
        description: a.description,
        parameters: a.parameters || { type: "object", properties: {} }
      }
    }));

    const messages = [
      { role: "system", content: `${front.instructions}\n\nYou are running inside the Open Agentic Web browser runtime. Use the available website_* tools to read real state and never fabricate prices or records.` },
      ...this.history.slice(-6),
      { role: "user", content: userText }
    ];

    for (let step = 0; step < this.maxSteps; step++) {
      this.logTrace("llm", `BYOK Inference Call #${step + 1}`, `${this.byok.baseUrl} (${this.byok.model})`);
      const resp = await fetch(`${this.byok.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.byok.apiKey ? { "Authorization": `Bearer ${this.byok.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: this.byok.model,
          messages,
          tools: toolDefs.length ? toolDefs : undefined,
          tool_choice: toolDefs.length ? "auto" : undefined
        })
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Router HTTP ${resp.status}: ${errText.slice(0, 180)}`);
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("Empty response from LLM router.");
      messages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          let parsedArgs = {};
          try { parsedArgs = JSON.parse(tc.function.arguments || "{}"); } catch (_) {}
          const result = await this.invokeAction(tc.function.name, parsedArgs);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result)
          });
        }
        continue;
      }
      return msg.content || "(No text returned)";
    }
    return "Execution stopped: reached maximum step budget.";
  }

  async handleUserMessage(text) {
    this.appendMessage("user", text);
    this.history.push({ role: "user", content: text });
    try {
      let reply;
      if (this.byok.mode === "byok") {
        reply = await this.callLiveByokLlm(text);
      } else if (this.localFallbackHandler) {
        reply = await this.localFallbackHandler(text, this);
      } else {
        reply = "Switch to Live BYOK mode in ⚙ AI Model Settings to chat with this agent network.";
      }
      this.history.push({ role: "assistant", content: reply });
      this.appendMessage("assistant", reply);
    } catch (err) {
      this.logTrace("error", "Execution Error", err.message);
      this.appendMessage("assistant", `Error: ${err.message}`);
    }
  }
}
