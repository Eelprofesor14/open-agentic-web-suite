# Open Agentic Web Challenge — Suite de 3 Proyectos Completos

Todos los proyectos cumplen con la especificación oficial **Worldwide Agentic Web MVP Profile 0.2** (`cognizant-ai-labs/agentic-web`): manifiesto `agent-manifest.json`, red multi-agente Neuro SAN en `.network.json`, `links.json`, runtime en navegador con **BYOK** (Mozilla Otari / OpenRouter / OpenAI / Ollama), confirmación humana en acciones irreversibles, tarjeta de consentimiento cross-origin y traza observable en vivo.

## 1. Cómo correr los 3 proyectos en tu PC en 30 segundos

1. Descomprimí el ZIP en una carpeta de tu PC.
2. Abrí una terminal en esa carpeta y ejecutá:
   ```bash
   python3 serve_all.py
   ```
3. Abrí en tu navegador:
   - **Proyecto 1 (Taller + Proveedor Cross-Origin):** `https://Eelprofesor14.github.io/open-agentic-web-suite/01_forgelink_workshop/` (y el peer en `https://Eelprofesor14.github.io/open-agentic-web-suite/01b_steel_supplier_peer/`)
   - **Proyecto 2 (AgenticSpec Auditor + Librería `lib/oaw-validator.mjs`):** `https://Eelprofesor14.github.io/open-agentic-web-suite/02_agentic_spec_auditor/`
   - **Proyecto 3 (CivicMesh Portal Client-Side):** `https://Eelprofesor14.github.io/open-agentic-web-suite/03_civicmesh_portal/`
4. Cada sitio arranca en **Zero-Key Local Simulator** para probarlo al instante, y desde el botón **⚙ AI Model Settings (BYOK)** podés pegar una API key de Mozilla Otari o OpenRouter para correrlo con un LLM real en vivo.

## 2. Cómo publicar gratis con HTTPS + CORS (Cloudflare Pages / Netlify / GitHub Pages)

Cada carpeta (`01_forgelink_workshop`, `01b_steel_supplier_peer`, `02_agentic_spec_auditor`, `03_civicmesh_portal`) es **100% autónoma** e incluye el archivo `_headers` con `Access-Control-Allow-Origin: *`.
- **Opción más rápida (Netlify Drop o Cloudflare Pages):** arrastrás cada carpeta para obtener su URL HTTPS pública al instante.
- **Importante para Proyecto 1 al pasar a producción:** una vez publicada `01b_steel_supplier_peer` (ej. `https://pampasteel.pages.dev`), reemplazá `https://Eelprofesor14.github.io/open-agentic-web-suite/01b_steel_supplier_peer` por tu URL HTTPS pública en `01_forgelink_workshop/agent-manifest.json`, `links.json`, `forgelink_workshop.network.json` e `index.html`.

## 3. Guion cronometrado (< 2 minutos) para el video en YouTube (requisito de Devpost)

> Recordatorio oficial de Devpost: el video debe durar **menos de 2 minutos**, mostrar el proyecto corriendo en el navegador y tener **tu propia voz** explicándolo (no voz generada por IA).

- **0:00 – 0:20 (Problema):** "Hi, I'm Santiago. Today small workshops and local services can't afford cloud agent backends or per-token API bills. With the Open Agentic Web MVP 0.2, we run multi-agent networks directly in the visitor's browser using static hosting and BYOK."
- **0:20 – 0:55 (Demo en vivo):** Mostrás `agent-manifest.json` y el widget en el navegador; disparás una consulta real (ej. cotizar un portón 3.2m x 2.1m en ForgeLink o auditar una URL en AgenticSpec Auditor) y señalás el panel **Observable Execution Trace**.
- **0:55 – 1:25 (Seguridad y Cross-Origin):** Mostrás la **Consent Card** cross-origin (o el diálogo de confirmación humana antes de la acción irreversible) destacando que la API key BYOK y `sly_data` nunca se envían al sitio peer.
- **1:25 – 1:45 (Cierre e Impacto):** "Zero backend servers, 100% open-source Apache-2.0, and reusable via our standalone `oaw-validator.mjs` module. Thanks for watching!"
