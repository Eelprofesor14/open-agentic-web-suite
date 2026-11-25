# Open Agentic Web Suite (MVP Profile 0.2)

[![Open Agentic Web CI](https://github.com/Eelprofesor14/open-agentic-web-suite/actions/workflows/ci.yml/badge.svg)](https://github.com/Eelprofesor14/open-agentic-web-suite/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Eelprofesor14/open-agentic-web-suite?color=20BEFF)](https://github.com/Eelprofesor14/open-agentic-web-suite/releases)


**Author:** [Santiago Zazo](https://github.com/Eelprofesor14) • [LinkedIn](https://www.linkedin.com/in/santiago-zazo) • [Kaggle](https://www.kaggle.com/santiagozazo)

Three interoperable, privacy-first web applications built for the [Open Agentic Web Challenge](https://cognizant-agenticweb.devpost.com/) (Cognizant + MIT NANDA + Mozilla + AWS), achieving full conformance with **Open Agentic Web MVP Profile 0.2**.

## Included Projects

| Project | Local Port | Description |
| :--- | :--- | :--- |
| **`01_forgelink_workshop` + `01b_steel_supplier_peer`** | `:8081` & `:8082` | Parametric metalworking & manufacturing workshop interconnected cross-origin with a wholesale steel supplier peer, featuring Consent Cards, isolated BYOK handling, and explicit human-in-the-loop confirmation. |
| **`02_agentic_spec_auditor`** | `:8083` | Live Open Agentic Web conformance testbench plus reusable open-source validator library (`lib/oaw-validator.mjs`) for both Browser and Node.js CLI. |
| **`03_civicmesh_portal`** | `:8084` | 100% client-side privacy portal for local courses, scholarships, and municipal permits without external data leakage. |

## Quick Start (Local)

```bash
python serve_all.py
```

Then open in your browser:
- ForgeLink Workshop: `http://127.0.0.1:8081`
- Steel Supplier Peer: `http://127.0.0.1:8082`
- Agentic Spec Auditor: `http://127.0.0.1:8083`
- CivicMesh Portal: `http://127.0.0.1:8084`

## License

MIT License — see [LICENSE](LICENSE) for details.
