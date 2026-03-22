# Healthcare Clinical Intelligence Agent

Unified patient data across any number of EHR systems — queryable by AI in under 3 seconds.

## The Outcome

A clinician asks: *"Show me all diabetic patients across both hospitals."*

The agent queries two separate EHR systems in parallel, normalizes the data, and returns a unified answer — with source facility, diagnosis codes, and care gap flags. The clinician doesn't know or care which EHR each hospital runs.

**What this eliminates:**
- Logging into multiple EHR systems to get a complete patient picture
- Care gaps that hide in the seams between systems
- 12-18 month integration timelines for each new EHR connection

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  AI Agent                                           │
│  Natural language → unified clinical answers         │
├─────────────────────────────────────────────────────┤
│  Experience API                                     │
│  Tool endpoints: patients, conditions, labs,         │
│  medications, allergies, FHIR discovery              │
├─────────────────────────────────────────────────────┤
│  Process API                                        │
│  Parallel federation, code normalization,            │
│  cross-system deduplication                          │
├──────────────────────┬──────────────────────────────┤
│  System API A        │  System API B                │
│  Flagship Hospital   │  Community Clinic             │
│  (FHIR R4)           │  (FHIR R4)                   │
└──────────────────────┴──────────────────────────────┘
         │                        │
    Any FHIR R4 EHR         Any FHIR R4 EHR
```

## What Changes vs. What Doesn't

The System APIs use **standard FHIR R4 endpoints** — the same interface every compliant EHR exposes (Epic, Cerner, MEDITECH, athenahealth, etc.).

| When you need to... | What changes | What stays the same | Effort |
|---------------------|-------------|-------------------|--------|
| **Add a new facility** | One new System API | Process API, Experience API, AI Agent, frontend | ~2 weeks |
| **Swap an EHR vendor** | One URL in config | Everything above the System API | Hours |
| **Add a clinical capability** | One tool in the Experience API | System APIs, Process API | Days |
| **Scale to 10 facilities** | 10 System APIs (same contract) | Process API, Experience API, AI Agent | Linear, not exponential |

## Accelerator Coverage

74% of the integration patterns map to existing MuleSoft Healthcare Accelerator v2.24 assets — pre-built, production-grade, and maintained:

| What the Accelerator provides | What's net-new in this implementation |
|------------------------------|--------------------------------------|
| FHIR R4 US Core API templates (Patient, Condition, Observation, Medication, Allergy) | AI agent tool endpoints (8 flows) |
| EHR system API templates (Epic, Cerner, MEDITECH) | Scatter-gather federation logic |
| SNOMED→ICD-10 DataWeave mappings | Experience API contract |
| OAuth/SMART on FHIR auth modules | Slack bot integration |
| CDS Services hooks | Streaming chat frontend |

The Accelerator handles the interoperability plumbing. This implementation adds the intelligence layer on top.

## Try It

- **Chat UI:** [healthcare-agent-demo-vzrh.vercel.app](https://healthcare-agent-demo-vzrh.vercel.app)
- **Architecture Blueprint:** [m9751.github.io/healthcare-agent-demo/architecture.html](https://m9751.github.io/healthcare-agent-demo/architecture.html)
- **Slack Bot:** `@Clinical Intelligence Agent`

Data shown is synthetic (Synthea via SMART Health IT sandbox). In production, these same APIs point to your EHR FHIR endpoints.

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
cd ../meditab-fhir-sys-api && mvn clean package -DskipTests

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

### 4. Wire the layers

Each layer's `config.properties` points to the layer below it:

```properties
# Process API → System APIs
sysapi.carestack.host=<system-api-a>.cloudhub.io
sysapi.meditab.host=<system-api-b>.cloudhub.io

# Experience API → Process API
prcapi.clinical.host=<process-api>.cloudhub.io
```

### 5. Deploy the frontend

```bash
npm install
echo "ANYPOINT_EXPERIENCE_API_URL=https://<experience-api>.cloudhub.io" > .env.local
vercel --prod
```

### 6. Connect your EHRs

Point any System API at your FHIR R4 endpoint:

```properties
fhir.server.host=your-ehr-fhir-endpoint.com
fhir.server.port=443
fhir.server.protocol=HTTPS
fhir.server.basePath=/fhir/r4
```

Rebuild, deploy. No changes to Process API, Experience API, or frontend.

**Add a third facility:** Copy any System API, change the FHIR URL, add it to the Process API scatter-gather. Rebuild. Everything above it works unchanged.

## Compatible FHIR R4 EHR Systems

Any EHR that exposes FHIR R4 endpoints works with this architecture. The System APIs call standard FHIR resources — no vendor-specific code.

| EHR | FHIR R4 Sandbox | Auth | Notes |
|-----|----------------|------|-------|
| **Epic** | `fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4` | OAuth/SMART | Register via [Epic Showroom](https://fhir.epic.com/). Largest US EHR market share |
| **Oracle Health (Cerner)** | `fhir-open.cerner.com/r4/{tenant-id}` | Open sandbox available | [Open sandbox docs](https://fhir.cerner.com/millennium/r4/) |
| **MEDITECH Expanse** | `greenfield.meditech.com/explorer` | OAuth/SMART | [Greenfield Portal](https://greenfield.meditech.com/) — FHIR R4 US Core STU7 |
| **CareStack** | Customer-provisioned | OAuth | FHIR R4 compliant — no public sandbox |
| **athenahealth** | Customer-provisioned | OAuth | [Developer portal](https://developer.athenahealth.com/) — FHIR R4 APIs |
| **Allscripts/Veradigm** | Customer-provisioned | OAuth | FHIR R4 via FHIRPoint |
| **eClinicalWorks** | Customer-provisioned | OAuth | FHIR R4 compliant |
| **NextGen Healthcare** | Customer-provisioned | OAuth | FHIR R4 via Mirth |
| **SMART Health IT** | `r4.smarthealthit.org` | Open | **Used in this demo** — Synthea synthetic patients |

This demo uses the SMART Health IT sandbox (`r4.smarthealthit.org`) — an open FHIR R4 server with synthetic patient data. To connect a production EHR, replace the FHIR URL in the System API's `config.properties`. The System API contract is identical regardless of which EHR is behind it.

## Implementation Notes

Directory names (`carestack-fhir-sys-api`, `meditab-fhir-sys-api`) are artifact identifiers from the reference deployment. User-facing labels ("Flagship Hospital", "Community Clinic") represent the demo scenario. Rename to match your facilities.

## Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Integration | MuleSoft Mule 4, CloudHub 2.0 | API-led connectivity, FHIR R4 federation |
| Standards | FHIR R4, US Core STU7, SMART on FHIR | EHR-agnostic interoperability |
| Terminology | SNOMED CT → ICD-10-CM (DataWeave) | Cross-system code normalization |
| AI | Claude, Vercel AI Gateway, AI SDK v6 | Natural language clinical queries |
| Frontend | Next.js, Vercel | Chat UI, Slack bot, streaming responses |
| Test Data | SMART Health IT Sandbox (Synthea) | Synthetic FHIR patients |
