# Healthcare Clinical Intelligence Agent

Unified patient data across any number of EHR systems — queryable by AI in under 3 seconds.

## The Outcome

A clinician asks: *"Show me all patients across all three facilities."*

The agent queries three separate EHR systems in parallel — a dental PMS, a community hospital, and a generic FHIR server — normalizes the data, and returns a unified answer with source facility, diagnosis codes, and care gap flags. The clinician doesn't know or care which EHR each facility runs.

**What this eliminates:**
- Logging into multiple EHR systems to get a complete patient picture
- Care gaps that hide in the seams between systems
- 12-18 month integration timelines for each new EHR connection
- Custom integration code for non-FHIR systems (MuleSoft handles the translation)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  AI Agent                                           │
│  Natural language → unified clinical answers         │
├─────────────────────────────────────────────────────┤
│  Experience API        (agent-tools-exp-api)        │
│  Tool endpoints: patients, conditions, labs,         │
│  medications, allergies, FHIR discovery              │
├─────────────────────────────────────────────────────┤
│  Process API           (clinical-federation-prc-api)│
│  3-EHR scatter-gather, code normalization,           │
│  cross-system deduplication                          │
├────────────────┬────────────────┬────────────────────┤
│  System API    │  System API    │  System API         │
│  CareStack     │  FHIR R4       │  MEDITECH           │
│  Dental PMS    │  Standard      │  Expanse            │
│  (REST → FHIR) │  Adapter       │  (OAuth + FHIR)     │
└────────────────┴────────────────┴────────────────────┘
       │                 │                  │
  CareStack API    Any FHIR R4 EHR    MEDITECH Greenfield
  (proprietary)    (configurable)      (US Core STU6)
```

### Three Integration Patterns, One Uniform Contract

| System API | Target EHR | API Type | Auth | DataWeave | Demo Story |
|-----------|-----------|----------|------|-----------|------------|
| `carestack-fhir-sys-api` | CareStack Dental PMS | Proprietary REST (49 endpoints) | 3-header API key | Heavy — translates custom JSON → FHIR | Non-FHIR system normalized into the federation |
| `fhir-r4-standard-adapter` | Any FHIR R4 server | FHIR R4 passthrough | Configurable | None — pure passthrough | Plug-and-play for any compliant EHR |
| `meditech-fhir-sys-api` | MEDITECH Expanse | FHIR R4 US Core STU6 | OAuth 2.0 (rotating refresh tokens) | Light — Bundle wrapper | Real EHR with production-grade auth |

The Process API doesn't know or care about these differences. It gets FHIR Bundles from all three.

## What Changes vs. What Doesn't

| When you need to... | What changes | What stays the same | Effort |
|---------------------|-------------|-------------------|--------|
| **Add a FHIR facility** | Copy `fhir-r4-standard-adapter`, change one URL | Process API, Experience API, AI Agent, frontend | Hours |
| **Add a non-FHIR system** | New System API with DataWeave transforms | Process API, Experience API, AI Agent, frontend | ~2 weeks |
| **Swap an EHR vendor** | One URL in config | Everything above the System API | Hours |
| **Add a clinical capability** | One tool in the Experience API | System APIs, Process API | Days |
| **Scale to 10 facilities** | 10 System APIs (same contract) | Process API scatter-gather, Experience API, AI Agent | Linear, not exponential |

## Accelerator Coverage

74% of the integration patterns map to existing MuleSoft Healthcare Accelerator v2.24 assets — pre-built, production-grade, and maintained:

| What the Accelerator provides | What's net-new in this implementation |
|------------------------------|--------------------------------------|
| FHIR R4 US Core API templates (Patient, Condition, Observation, Medication, Allergy) | AI agent tool endpoints (8 flows) |
| EHR system API templates (Epic, Cerner, MEDITECH) | Scatter-gather federation logic |
| SNOMED→ICD-10 DataWeave mappings | CareStack proprietary REST → FHIR transforms |
| OAuth/SMART on FHIR auth modules | MEDITECH rotating refresh token management |
| CDS Services hooks | Streaming chat frontend + Slack bot |

The Accelerator handles the interoperability plumbing. This implementation adds the intelligence layer on top.

## Demo Data

- **FHIR R4 Standard Adapter** connects to the **SMART Health IT public FHIR R4 sandbox** — synthetic patients from Synthea (Boston Children's Hospital / MITRE)
- **MEDITECH System API** connects to **MEDITECH Greenfield Workspace** — sandbox with test patient Sarai Mccall (cardiac profile: CHF, angina, HTN, obesity, old MI, 10 medications)
- **CareStack System API** returns synthetic dental data via its CapabilityStatement (sandbox keys pending NDA)

### Current Federation Output

```
21 patients from 3 EHRs:
  Flagship Hospital:            10 patients (FHIR sandbox cohort 1960-1980)
  Community Clinic:             10 patients (FHIR sandbox cohort 1940-1959)
  MEDITECH Community Hospital:   1 patient  (Sarai Mccall — real MEDITECH Expanse)
```

## CloudHub 2.0 Deployment

All 5 apps running on Anypoint CloudHub 2.0 Shared Space (Mule 4.11.2, Micro replicas):

| App | Layer | CloudHub URL |
|-----|-------|-------------|
| `agent-tools-exp-api` | Experience | `agent-tools-exp-api-sewtob.5sc6y6-1.usa-e2.cloudhub.io` |
| `clinical-federation-prc-api` | Process | `clinical-federation-prc-api-sewtob.5sc6y6-4.usa-e2.cloudhub.io` |
| `carestack-fhir-sys-api` | System | `carestack-fhir-sys-api-sewtob.5sc6y6-1.usa-e2.cloudhub.io` |
| `fhir-r4-standard-adapter` | System | `fhir-r4-standard-adapter-sewtob.5sc6y6-1.usa-e2.cloudhub.io` |
| `meditech-fhir-sys-api` | System | `meditech-fhir-sys-api-sewtob.5sc6y6-2.usa-e2.cloudhub.io` |

Anypoint Visualizer auto-discovers the topology from live traffic.

## Try It

- **Chat UI:** [healthcare-agent-demo-vzrh.vercel.app](https://healthcare-agent-demo-vzrh.vercel.app)
- **Architecture Blueprint:** [m9751.github.io/healthcare-agent-demo/architecture.html](https://m9751.github.io/healthcare-agent-demo/architecture.html)
- **Slack Bot:** `@Clinical Intelligence Agent`

## Build Your Own

### Prerequisites

- MuleSoft Anypoint Platform with CloudHub 2.0
- Maven 3.9+, Java 17+
- Node.js 18+, Vercel account
- FHIR R4 endpoint (sandbox or production)

### 1. Build

```bash
# System APIs (one per facility)
cd mulesoft/carestack-fhir-sys-api && mvn clean package -DskipTests
cd ../fhir-r4-standard-adapter && mvn clean package -DskipTests
cd ../meditech-fhir-sys-api && mvn clean package -DskipTests

# Process API (federation layer)
cd ../clinical-federation-prc-api && mvn clean package -DskipTests

# Experience API (AI tool layer)
cd ../agent-tools-exp-api && mvn clean package -DskipTests
```

### 2. Verify

```bash
# JAR structure — must show mule-artifact.json
unzip -l target/<app>-1.0.0-mule-application.jar | grep mule-artifact

# Port — must be 8081 (only port CloudHub 2.0 exposes)
unzip -p target/<app>-1.0.0-mule-application.jar config.properties | grep port
```

### 3. Deploy to CloudHub 2.0

Upload each JAR to Anypoint Runtime Manager. Set `http.port=8081` in Properties. Deploy in order: System APIs → Process API → Experience API. See `DEPLOYMENT_GOVERNANCE.md` for the full checklist.

**MEDITECH OAuth setup:** After deploying `meditech-fhir-sys-api`, seed the OAuth token once:
1. Complete the MEDITECH Greenfield OAuth browser flow to get a refresh token
2. Call: `curl -X POST https://<meditech-app>.cloudhub.io/api/v1/meditech/seed-token -H "Content-Type: text/plain" -d "<refresh_token>"`
3. The app auto-refreshes every 14 minutes from that point on

**CareStack setup:** Set three Protected Properties in Runtime Manager: `CARESTACK_VENDOR_KEY`, `CARESTACK_ACCOUNT_KEY`, `CARESTACK_ACCOUNT_ID`

### 4. Wire the layers

Each layer's `config.properties` points to the layer below it:

```properties
# Process API → System APIs
sysapi.carestack.host=<carestack-system-api>.cloudhub.io
sysapi.meditab.host=<fhir-adapter>.cloudhub.io
sysapi.meditech.host=<meditech-system-api>.cloudhub.io

# Experience API → Process API
prcapi.clinical.host=<process-api>.cloudhub.io
```

### 5. Deploy the frontend

```bash
npm install
echo "ANYPOINT_EXPERIENCE_API_URL=https://<experience-api>.cloudhub.io" > .env.local
vercel --prod
```

### 6. Add your own EHRs

**FHIR R4 EHR (e.g., Epic, Cerner):** Copy `fhir-r4-standard-adapter`, change the FHIR URL in `config.properties`. Add to Process API scatter-gather. Rebuild and deploy.

**Non-FHIR system:** Copy `carestack-fhir-sys-api` as a template. Write DataWeave transforms for the target API's data model. The contract to the Process API stays the same — FHIR Bundles.

## Compatible EHR Systems

| EHR | Type | Integration Pattern | Notes |
|-----|------|-------------------|-------|
| **Epic** | FHIR R4 | `fhir-r4-standard-adapter` | Largest US EHR. [Epic Showroom](https://fhir.epic.com/) |
| **Oracle Health (Cerner)** | FHIR R4 | `fhir-r4-standard-adapter` | [Open sandbox](https://fhir.cerner.com/millennium/r4/) |
| **MEDITECH Expanse** | FHIR R4 + OAuth | `meditech-fhir-sys-api` | **Live in this demo.** [Greenfield Portal](https://greenfield.meditech.com/) |
| **CareStack** | Proprietary REST | `carestack-fhir-sys-api` | **DataWeave transforms built.** 49 endpoints, 92 schemas |
| **athenahealth** | FHIR R4 | `fhir-r4-standard-adapter` | [Developer portal](https://developer.athenahealth.com/) |
| **Allscripts/Veradigm** | FHIR R4 | `fhir-r4-standard-adapter` | FHIR R4 via FHIRPoint |
| **eClinicalWorks** | FHIR R4 | `fhir-r4-standard-adapter` | FHIR R4 compliant |
| **NextGen Healthcare** | FHIR R4 | `fhir-r4-standard-adapter` | FHIR R4 via Mirth |
| **SMART Health IT** | FHIR R4 | `fhir-r4-standard-adapter` | **Used in this demo** — Synthea synthetic patients |

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Integration | MuleSoft Mule 4, CloudHub 2.0 | API-led connectivity, FHIR R4 federation |
| Standards | FHIR R4, US Core STU6/STU7, SMART on FHIR | EHR-agnostic interoperability |
| Terminology | SNOMED CT → ICD-10-CM (DataWeave) | Cross-system code normalization |
| AI | Claude, Vercel AI Gateway, AI SDK v6 | Natural language clinical queries |
| Frontend | Next.js, Vercel | Chat UI, Slack bot, streaming responses |
| Test Data | SMART Health IT Sandbox + MEDITECH Greenfield | Synthetic + real EHR sandbox patients |
| Observability | Anypoint Visualizer | Auto-discovered API topology |
