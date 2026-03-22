# Healthcare Clinical Intelligence Agent

An AI-powered clinical intelligence agent that queries patient data across multiple EHR systems simultaneously through MuleSoft's API-led connectivity layer and FHIR R4.

## What This Demonstrates

A health system has two hospitals on different EHRs. **Flagship Hospital** runs one system, **Community Clinic** (recently acquired) runs another. Clinicians need a unified view across both — without ripping and replacing either EHR.

This demo solves that with three layers:

```
┌─────────────────────────────────────────────────────┐
│  AI Agent (Claude + tool calling)                   │
│  Asks clinical questions, gets unified answers       │
├─────────────────────────────────────────────────────┤
│  Experience API (MuleSoft, CloudHub 2.0)            │
│  Agent-facing tools: patients, conditions, labs,     │
│  medications, allergies, FHIR discovery              │
├─────────────────────────────────────────────────────┤
│  Process API (MuleSoft, CloudHub 2.0)               │
│  Scatter-gather federation, SNOMED→ICD-10 mapping,   │
│  cross-system deduplication                          │
├──────────────────────┬──────────────────────────────┤
│  System API A        │  System API B                │
│  Flagship Hospital   │  Community Clinic             │
│  (FHIR R4 adapter)   │  (FHIR R4 adapter)           │
└──────────────────────┴──────────────────────────────┘
         │                        │
    Any FHIR R4 EHR         Any FHIR R4 EHR
    (Epic, Cerner,          (MEDITECH, athena,
     MEDITECH, etc.)         CareStack, etc.)
```

## Why This Architecture Matters

The System APIs are **generic FHIR R4 adapters**. They call standard FHIR endpoints (`/Patient`, `/Condition`, `/Observation`, `/MedicationRequest`, `/AllergyIntolerance`) that every FHIR R4-compliant EHR exposes.

- **Adding a new EHR** = build one new System API. Zero changes to Process, Experience, or AI layers.
- **Swapping an EHR** = change one URL in `config.properties`. Everything above it works unchanged.
- **The AI agent doesn't know** how many EHRs exist or what brands they are. It calls tools and gets unified answers.

The demo uses two SMART Health IT sandbox FHIR servers (Synthea synthetic patients) to prove the pattern works across multiple systems. In production, these URLs point to real Epic, Cerner, or MEDITECH FHIR endpoints.

## Architecture Components

| Layer | App | What It Does |
|-------|-----|-------------|
| **System** | `carestack-fhir-sys-api` | FHIR R4 adapter for Flagship Hospital — normalizes patient data |
| **System** | `meditab-fhir-sys-api` | FHIR R4 adapter for Community Clinic — identical contract, different EHR |
| **Process** | `clinical-federation-prc-api` | Scatter-gather federation, SNOMED→ICD-10 mapping, unified response |
| **Experience** | `agent-tools-exp-api` | AI-facing tool endpoints, FHIR server discovery |
| **Frontend** | Next.js on Vercel | Chat UI + Slack bot, streams AI responses |

## Live Demo

- **Chat UI:** [healthcare-agent-demo on Vercel](https://healthcare-agent-demo-vzrh.vercel.app)
- **GitHub Pages:** [m9751.github.io/healthcare-agent-demo](https://m9751.github.io/healthcare-agent-demo/)
- **Architecture Blueprint:** [m9751.github.io/healthcare-agent-demo/architecture.html](https://m9751.github.io/healthcare-agent-demo/architecture.html)
- **Slack Bot:** `@Clinical Intelligence Agent` in workspace

## Prerequisites

- **MuleSoft Anypoint Platform** account with CloudHub 2.0 access
- **Maven 3.9+** and **Java 17+**
- **Node.js 18+** for the frontend
- **Vercel** account (for frontend deployment)
- Access to FHIR R4 sandbox (or production FHIR endpoints)

## Build & Deploy

### 1. Clone the repo

```bash
git clone https://github.com/m9751/healthcare-agent-demo.git
cd healthcare-agent-demo
```

### 2. Build the Mule applications

Each app is in `mulesoft/`. Build them in order (System → Process → Experience):

```bash
# System API A — Flagship Hospital
cd mulesoft/carestack-fhir-sys-api
mvn clean package -DskipTests

# System API B — Community Clinic
cd ../meditab-fhir-sys-api
mvn clean package -DskipTests

# Process API — Clinical Federation
cd ../clinical-federation-prc-api
mvn clean package -DskipTests

# Experience API — Agent Tools
cd ../agent-tools-exp-api
mvn clean package -DskipTests
```

### 3. Verify each JAR before deploying

```bash
# Must show mule-artifact.json at both root and META-INF
unzip -l target/<app>-1.0.0-mule-application.jar | grep mule-artifact

# Must show http.port=8081
unzip -p target/<app>-1.0.0-mule-application.jar config.properties | grep port
```

### 4. Deploy to CloudHub 2.0

For each app:
1. Go to **Anypoint Runtime Manager**
2. Click **Deploy Application** (or update existing)
3. Upload the JAR file
4. **Properties tab:** set `http.port` = `8081`
5. Click **Deploy**
6. Wait up to 3 minutes for startup

**Deploy order:** System APIs first, then Process API, then Experience API.

**Critical rules:**
- `http.port=8081` — the ONLY port CloudHub 2.0 exposes
- Single deploy attempt. If it fails, read the logs before redeploying.
- See `DEPLOYMENT_GOVERNANCE.md` for the full checklist.

### 5. Update downstream URLs

After deploying System APIs, update the Process API `config.properties`:

```properties
sysapi.carestack.host=<your-system-api-a-url>.cloudhub.io
sysapi.meditab.host=<your-system-api-b-url>.cloudhub.io
```

After deploying Process API, update Experience API `config.properties`:

```properties
prcapi.clinical.host=<your-process-api-url>.cloudhub.io
```

Rebuild and redeploy each time you change a config.

### 6. Deploy the frontend

```bash
npm install

# Set your Experience API URL
echo "ANYPOINT_EXPERIENCE_API_URL=https://<your-experience-api>.cloudhub.io" > .env.local

vercel --prod
```

### 7. Connect your own EHRs

To point a System API at a real EHR, edit its `config.properties`:

```properties
fhir.server.host=your-ehr-fhir-endpoint.com
fhir.server.port=443
fhir.server.protocol=HTTPS
fhir.server.basePath=/fhir/r4
```

Rebuild, deploy. **No changes needed** to Process API, Experience API, or frontend.

To add a third EHR:
1. Copy any System API directory
2. Update `config.properties` with the new FHIR endpoint
3. Add it to the Process API scatter-gather in `clinical-federation-prc-api.xml`
4. Rebuild and deploy

## Naming Convention

Directory names (`carestack-fhir-sys-api`, `meditab-fhir-sys-api`) are internal artifact identifiers matching the CloudHub deployment. User-facing labels ("Flagship Hospital", "Community Clinic") reflect the demo scenario. When building your own, use names that match your facilities.

## Tech Stack

- **MuleSoft Mule 4** — API-led connectivity, FHIR R4 integration
- **CloudHub 2.0** — Managed runtime
- **FHIR R4 / US Core STU7** — Healthcare interoperability standard
- **AI SDK v6** — Streaming chat with tool calling
- **Claude** — AI model via Vercel AI Gateway
- **Next.js** — Frontend
- **Vercel** — Hosting
- **SMART Health IT Sandbox** — Synthetic FHIR data (Synthea)
