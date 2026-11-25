#!/usr/bin/env python3
"""Automated MVP Profile 0.2 conformance & integrity validator for all 4 sites."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITES = [
    "01_forgelink_workshop",
    "01b_steel_supplier_peer",
    "02_agentic_spec_auditor",
    "03_civicmesh_portal",
]

errors = []
for s in SITES:
    d = ROOT / s
    manifest_p = d / "agent-manifest.json"
    links_p = d / "links.json"
    index_p = d / "index.html"
    rt_p = d / "runtime/oaw-runtime.js"
    for req in (manifest_p, links_p, index_p, rt_p):
        if not req.exists():
            errors.append(f"[{s}] Missing required file: {req.name}")
    manifest = json.loads(manifest_p.read_text(encoding="utf-8"))
    links = json.loads(links_p.read_text(encoding="utf-8"))
    assert manifest.get("spec_version") == "0.2", f"[{s}] spec_version != 0.2"
    assert links.get("version") == 1, f"[{s}] links.json version != 1"
    net_entry = manifest["networks"][0]
    net_p = (d / net_entry["hocon"]).resolve()
    if not net_p.exists():
        errors.append(f"[{s}] Network file missing: {net_entry['hocon']}")
        continue
    net = json.loads(net_p.read_text(encoding="utf-8"))
    agent_names = [a["name"] for a in net.get("tools", [])]
    if len(agent_names) != len(set(agent_names)):
        errors.append(f"[{s}] Duplicate agent names")
    if net_entry["front_man"] not in agent_names:
        errors.append(f"[{s}] front_man '{net_entry['front_man']}' not in network tools")
    print(f"[PASS] {s}: network={net_entry['name']}, front_man={net_entry['front_man']}, agents={agent_names}")

if errors:
    print("\nVALIDATION FAILED:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("\nALL 4 OPEN AGENTIC WEB NODES PASSED MVP 0.2 VALIDATION.")
