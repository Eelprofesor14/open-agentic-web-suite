#!/usr/bin/env python3
"""
Launches all 4 Open Agentic Web sites locally with CORS headers enabled:
  - http://127.0.0.1:8081/  -> 01_forgelink_workshop
  - http://127.0.0.1:8082/  -> 01b_steel_supplier_peer
  - http://127.0.0.1:8083/  -> 02_agentic_spec_auditor
  - http://127.0.0.1:8084/  -> 03_civicmesh_portal
"""
import http.server
import os
import threading
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITES = [
    (8081, ROOT / "01_forgelink_workshop", "ForgeLink Custom Metalwork Workshop"),
    (8082, ROOT / "01b_steel_supplier_peer", "PampaSteel Wholesale Peer"),
    (8083, ROOT / "02_agentic_spec_auditor", "AgenticSpec Auditor"),
    (8084, ROOT / "03_civicmesh_portal", "CivicMesh Public Portal"),
]

class CORSHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

def start_server(port, directory, label):
    handler = partial(CORSHandler, directory=str(directory))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"  [OK] http://127.0.0.1:{port}/  ->  {label}")
    server.serve_forever()

if __name__ == "__main__":
    print("Starting Open Agentic Web 3-Project Suite (CORS enabled)...")
    threads = []
    for port, directory, label in SITES:
        t = threading.Thread(target=start_server, args=(port, directory, label), daemon=True)
        t.start()
        threads.append(t)
    print("\nPress Ctrl+C to stop all servers.")
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("\nStopped.")
