/**
 * oaw-validator.mjs — Reusable Open Agentic Web MVP 0.2 Conformance & Security Auditor
 * Works identically in modern browsers (ES Module) and Node.js 22+ CLI.
 */
export function auditBundle({ baseUrl, manifest, network, links, corsHeader }) {
  const checks = [];
  const add = (id, category, status, message) => checks.push({ id, category, status, message });

  // 1. Manifest Structure
  if (manifest && Array.isArray(manifest.networks) && manifest.networks.length > 0) {
    add("M1", "Manifest", "PASS", `Declares ${manifest.networks.length} network(s) in agent-manifest.json.`);
  } else {
    add("M1", "Manifest", "FAIL", "agent-manifest.json missing non-empty networks[] array.");
  }

  const net0 = manifest?.networks?.[0];
  if (net0 && net0.name && net0.front_man && net0.hocon) {
    add("M2", "Manifest", "PASS", `Primary network '${net0.name}' declares front_man '${net0.front_man}' and hocon '${net0.hocon}'.`);
  } else {
    add("M2", "Manifest", "FAIL", "Primary network entry missing name, front_man, or hocon.");
  }

  if (manifest?.peer_policy) {
    add("M3", "Trust Boundary", "PASS", `Explicit peer_policy declared: '${manifest.peer_policy}'.`);
  } else {
    add("M3", "Trust Boundary", "WARN", "No explicit peer_policy field (defaults to allowlist).");
  }

  // 2. Network Schema (Neuro SAN JSON)
  const tools = network?.tools;
  if (Array.isArray(tools) && tools.length > 0) {
    add("N1", "Network Schema", "PASS", `Contains ${tools.length} agent definition(s).`);
  } else {
    add("N1", "Network Schema", "FAIL", "Network file missing non-empty tools[] array.");
  }

  const names = new Set();
  let dupes = 0;
  let missingInstr = 0;
  for (const a of tools || []) {
    if (names.has(a.name)) dupes++;
    names.add(a.name);
    if (!a.instructions) missingInstr++;
  }
  add("N2", "Network Schema", dupes === 0 ? "PASS" : "FAIL", dupes === 0 ? "All agent names are unique." : `Found ${dupes} duplicate agent name(s).`);
  add("N3", "Network Schema", net0 && names.has(net0.front_man) ? "PASS" : "FAIL", net0 && names.has(net0.front_man) ? `front_man '${net0.front_man}' resolves in tools[].` : "front_man not found in network.tools[].");
  add("N4", "Network Schema", missingInstr === 0 ? "PASS" : "WARN", missingInstr === 0 ? "Every agent includes explicit LLM instructions." : `${missingInstr} agent(s) missing instructions.`);

  // 3. Cycle detection
  const graph = new Map();
  for (const a of tools || []) {
    graph.set(a.name, (a.tools || []).filter(t => typeof t === "string" && names.has(t)));
  }
  let hasCycle = false;
  const visiting = new Set(), visited = new Set();
  const dfs = (u) => {
    visiting.add(u);
    for (const v of graph.get(u) || []) {
      if (visiting.has(v)) hasCycle = true;
      else if (!visited.has(v)) dfs(v);
    }
    visiting.delete(u); visited.add(u);
  };
  for (const n of names) if (!visited.has(n)) dfs(n);
  add("N5", "Bounded Execution", hasCycle ? "FAIL" : "PASS", hasCycle ? "Cycle detected in local agent delegation graph." : "Delegation graph is acyclic (DAG).");

  // 4. Security & Privacy
  const raw = JSON.stringify({ manifest, network, links });
  const leak = /(sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,})/.test(raw);
  add("S1", "Security", leak ? "FAIL" : "PASS", leak ? "Possible hardcoded API key/token found in public artifacts!" : "Zero hardcoded credentials detected in public JSON.");
  const demoFlag = network?.demo_mode === true;
  add("S2", "Grounding", demoFlag ? "WARN" : "PASS", demoFlag ? "demo_mode: true found (not recommended)." : "No demo_mode fabrication flag present.");

  // 5. CORS & Peer Links
  if (corsHeader !== undefined) {
    add("C1", "CORS / Web Publication", corsHeader ? "PASS" : "FAIL", corsHeader ? `CORS header present (${corsHeader}).` : "Missing Access-Control-Allow-Origin header for cross-origin callers.");
  }
  add("L1", "Peer Links", links && links.version === 1 ? "PASS" : "WARN", links && links.version === 1 ? "Valid links.json (version 1) present." : "links.json missing or version != 1.");

  const passed = checks.filter(c => c.status === "PASS").length;
  const failed = checks.filter(c => c.status === "FAIL").length;
  const score = Math.round((passed / checks.length) * 100);
  return {
    target: baseUrl || "local-bundle",
    audited_at: new Date().toISOString(),
    spec_profile: "Worldwide Agentic Web MVP 0.2",
    score,
    status: failed === 0 ? "CONFORMANT" : "NON-CONFORMANT",
    passed,
    failed,
    total_checks: checks.length,
    checks
  };
}

export async function auditRemoteSite(siteBaseUrl) {
  const base = siteBaseUrl.endsWith("/") ? siteBaseUrl : siteBaseUrl + "/";
  const mResp = await fetch(`${base}agent-manifest.json`, { mode: "cors", credentials: "omit" });
  if (!mResp.ok) throw new Error(`HTTP ${mResp.status} fetching ${base}agent-manifest.json`);
  const corsHeader = mResp.headers.get("access-control-allow-origin") || "CORS fetch succeeded";
  const manifest = await mResp.json();
  const netEntry = manifest.networks?.[0];
  let network = null;
  if (netEntry?.hocon) {
    const nResp = await fetch(new URL(netEntry.hocon, base).toString(), { mode: "cors", credentials: "omit" });
    if (nResp.ok) network = await nResp.json();
  }
  let links = null;
  try {
    const lResp = await fetch(`${base}links.json`, { mode: "cors", credentials: "omit" });
    if (lResp.ok) links = await lResp.json();
  } catch (_) {}
  return auditBundle({ baseUrl: base, manifest, network, links, corsHeader });
}
