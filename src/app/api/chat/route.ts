import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { z } from "zod";

export const maxDuration = 30;

const ANYPOINT_BASE =
  process.env.ANYPOINT_EXPERIENCE_API_URL ||
  "https://agent-tools-exp-api-sewtob.5sc6y6-1.usa-e2.cloudhub.io";

async function anypointGet(path: string): Promise<unknown> {
  const res = await fetch(`${ANYPOINT_BASE}${path}`);
  if (!res.ok) throw new Error(`Anypoint ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = convertToModelMessages(messages);

  const result = streamText({
    model: "anthropic/claude-sonnet-4.6",
    system: `You are a Clinical Intelligence Agent powered by MuleSoft + SMART on FHIR.
You query real FHIR R4 servers — CareStack and Meditab — through MuleSoft's API-led connectivity layer.

This agent implements the MEDITECH Greenfield Clinical Decision Support (CDS) workflow pattern:
  1. Patient Identification & Context — retrieve patient demographics and encounter context
  2. Retrieve Clinical Data — conditions, observations (labs/vitals), medications, allergies, diagnostic reports
  3. Evaluate Clinical Data — apply decision support rules, identify risks and care gaps
  4. Present CDS Insights — deliver recommendations and alerts to clinicians

MuleSoft handles FHIR server discovery (CapabilityStatement), OAuth/SMART authentication, SNOMED-to-ICD-10
normalization, and cross-system federation. You never touch the FHIR servers directly — MuleSoft is the
integration fabric, connecting any FHIR R4-compliant EHR (MEDITECH Expanse, Epic, Cerner, etc.).

Your job is to help clinicians and health system leaders:
- Query patient data across both EHR systems simultaneously via FHIR R4 US Core STU7 APIs
- Discover FHIR server capabilities (use the discoverFhirServer tool)
- Review patient medications for drug interactions and adherence
- Check patient allergies before prescribing or procedures
- Identify care gaps (e.g., diabetic patients missing A1c tests)
- Find high-risk patients who need attention
- Provide comprehensive clinical summaries with data from multiple sources

When answering questions:
1. Always specify which EHR system each piece of data comes from
2. When reviewing medications, flag potential drug interactions and polypharmacy concerns
3. Always check allergies when medication questions are asked — this is a patient safety requirement
4. When you find care gaps, explain the clinical significance
5. Use the tools available to query both systems — don't guess at data
6. Present results in clear, organized tables when showing multiple patients
7. Highlight risk levels using clear language (HIGH / MEDIUM / LOW)
8. Note that this data comes from synthetic FHIR patients (Synthea) via the SMART Health IT sandbox

Remember: This is a unified view made possible by MuleSoft's API-led connectivity.
Without integration, these two EHR systems would be data silos. MuleSoft normalizes
SNOMED codes, handles FHIR pagination, and presents a unified patient view to this agent.`,
    messages: modelMessages,
    stopWhen: stepCountIs(8),
    tools: {
      listAllPatients: tool({
        description:
          "List all patients across both CareStack and Meditab EHR systems via MuleSoft API. Returns unified patient demographics.",
        inputSchema: z.object({
          source: z
            .enum(["all", "CareStack", "Meditab"])
            .optional()
            .describe("Filter by EHR source system, or 'all' for both"),
        }),
        execute: async () => {
          return anypointGet("/api/v1/agent/patients");
        },
      }),

      getPatientConditions: tool({
        description:
          "Get all diagnoses/conditions for a specific patient from their EHR via MuleSoft FHIR API. Returns ICD-10 codes and descriptions.",
        inputSchema: z.object({
          patientId: z.string().describe("Patient ID (e.g., cs-001 for CareStack, mt-001 for Meditab)"),
        }),
        execute: async ({ patientId }) => {
          return anypointGet(`/api/v1/agent/patients/${encodeURIComponent(patientId)}/conditions`);
        },
      }),

      searchConditions: tool({
        description:
          "Search for all patients with a specific diagnosis across both EHR systems. Use ICD-10 codes like E11.9 (diabetes), I10 (hypertension), etc.",
        inputSchema: z.object({
          icd10Code: z.string().describe("ICD-10 diagnosis code (e.g., E11.9 for Type 2 Diabetes)"),
        }),
        execute: async ({ icd10Code }) => {
          return anypointGet(`/api/v1/agent/conditions?code=${encodeURIComponent(icd10Code)}`);
        },
      }),

      getPatientLabs: tool({
        description:
          "Get lab results for a specific patient from their EHR via MuleSoft FHIR API. Returns LOINC-coded results with values and dates.",
        inputSchema: z.object({
          patientId: z.string().describe("Patient ID"),
        }),
        execute: async ({ patientId }) => {
          return anypointGet(`/api/v1/agent/patients/${encodeURIComponent(patientId)}/observations`);
        },
      }),

      getPatientMedications: tool({
        description:
          "Get all active medications for a specific patient from their EHR via MuleSoft FHIR API. Returns RxNorm-coded medications with dosage instructions. Key for medication reconciliation and drug interaction checks.",
        inputSchema: z.object({
          patientId: z.string().describe("Patient ID (e.g., cs-001 for CareStack, mt-001 for Meditab)"),
        }),
        execute: async ({ patientId }) => {
          return anypointGet(`/api/v1/agent/patients/${encodeURIComponent(patientId)}/medications`);
        },
      }),

      getPatientAllergies: tool({
        description:
          "Get all documented allergies and intolerances for a specific patient from their EHR via MuleSoft FHIR API. Returns substance, criticality, and reaction details. CRITICAL for patient safety — always check before medication recommendations.",
        inputSchema: z.object({
          patientId: z.string().describe("Patient ID (e.g., cs-001 for CareStack, mt-001 for Meditab)"),
        }),
        execute: async ({ patientId }) => {
          return anypointGet(`/api/v1/agent/patients/${encodeURIComponent(patientId)}/allergies`);
        },
      }),

      discoverFhirServer: tool({
        description:
          "Discover FHIR server capabilities via CapabilityStatement (SMART on FHIR auto-discovery). Shows server software, FHIR version, and supported clinical resource types. Demonstrates how MuleSoft auto-discovers any FHIR-compliant EHR.",
        inputSchema: z.object({
          server: z
            .enum(["CareStack", "Meditab", "both"])
            .optional()
            .describe("Which EHR server to discover. Defaults to both."),
        }),
        execute: async () => {
          return anypointGet("/api/v1/agent/discover");
        },
      }),
    },
  });

  const response = result.toUIMessageStreamResponse();
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
