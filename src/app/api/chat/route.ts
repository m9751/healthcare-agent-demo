import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import {
  getAllPatients,
  getPatientsBySource,
  getConditionsForPatient,
  getConditionsByCode,
  getLabResultsForPatient,
  getLabResultsByCode,
  findCareGaps,
} from "@/lib/mock-data";

export const maxDuration = 30;

/**
 * Healthcare Agent — powered by AI SDK + MuleSoft API tools.
 *
 * In production, each tool would call a real MuleSoft Anypoint endpoint.
 * Right now they call mock data so you can demo without infrastructure.
 *
 * To connect real APIs, replace the `execute` functions with fetch() calls
 * to your MuleSoft CloudHub URLs.
 */
export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: "openai/gpt-5.4",
    system: `You are a Clinical Intelligence Agent powered by MuleSoft integration APIs.
You have access to patient data from TWO separate EHR systems — CareStack and Meditab —
connected through MuleSoft's healthcare integration layer.

Your job is to help clinicians and health system leaders:
- Query patient data across both EHR systems simultaneously
- Identify care gaps (e.g., diabetic patients missing A1c tests)
- Find high-risk patients who need attention
- Provide clinical summaries with data from multiple sources

When answering questions:
1. Always specify which EHR system each piece of data comes from
2. When you find care gaps, explain the clinical significance
3. Use the tools available to query both systems — don't guess at data
4. Present results in clear, organized tables when showing multiple patients
5. Highlight risk levels using clear language (HIGH / MEDIUM / LOW)

Remember: This is a unified view made possible by MuleSoft's API-led connectivity.
Without integration, these two EHR systems would be data silos.`,
    messages,
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
        execute: async ({ source }) => {
          // In production: fetch(`${MULESOFT_BASE}/api/patients?source=${source}`)
          if (source === "CareStack") return getPatientsBySource("CareStack");
          if (source === "Meditab") return getPatientsBySource("Meditab");
          return getAllPatients();
        },
      }),

      getPatientConditions: tool({
        description:
          "Get all diagnoses/conditions for a specific patient from their EHR via MuleSoft FHIR API. Returns ICD-10 codes and descriptions.",
        inputSchema: z.object({
          patientId: z.string().describe("Patient ID (e.g., cs-001 for CareStack, mt-001 for Meditab)"),
        }),
        execute: async ({ patientId }) => {
          // In production: fetch(`${MULESOFT_BASE}/api/conditions?patient=${patientId}`)
          return getConditionsForPatient(patientId);
        },
      }),

      searchConditions: tool({
        description:
          "Search for all patients with a specific diagnosis across both EHR systems. Use ICD-10 codes like E11.9 (diabetes), I10 (hypertension), etc.",
        inputSchema: z.object({
          icd10Code: z.string().describe("ICD-10 diagnosis code (e.g., E11.9 for Type 2 Diabetes)"),
        }),
        execute: async ({ icd10Code }) => {
          // In production: fetch(`${MULESOFT_BASE}/api/conditions?code=${icd10Code}`)
          const matchingConditions = getConditionsByCode(icd10Code);
          const patientIds = [...new Set(matchingConditions.map((c) => c.patientId))];
          const patients = getAllPatients().filter((p) => patientIds.includes(p.id));
          return {
            conditionCode: icd10Code,
            totalPatients: patients.length,
            patients: patients.map((p) => ({
              ...p,
              condition: matchingConditions.find((c) => c.patientId === p.id),
            })),
          };
        },
      }),

      getPatientLabs: tool({
        description:
          "Get lab results for a specific patient from their EHR via MuleSoft FHIR API. Returns LOINC-coded results with values and dates.",
        inputSchema: z.object({
          patientId: z.string().describe("Patient ID"),
        }),
        execute: async ({ patientId }) => {
          // In production: fetch(`${MULESOFT_BASE}/api/observations?patient=${patientId}`)
          return getLabResultsForPatient(patientId);
        },
      }),

      searchLabResults: tool({
        description:
          "Search lab results by LOINC code across both EHR systems. Common codes: 4548-4 (A1c), 2160-0 (Creatinine), 33914-3 (eGFR), 2093-3 (Cholesterol).",
        inputSchema: z.object({
          loincCode: z.string().describe("LOINC code for the lab test"),
        }),
        execute: async ({ loincCode }) => {
          // In production: fetch(`${MULESOFT_BASE}/api/observations?code=${loincCode}`)
          return getLabResultsByCode(loincCode);
        },
      }),

      identifyCareGaps: tool({
        description:
          "Identify patients with care gaps across both EHR systems. Currently checks for diabetic patients missing A1c tests or with poorly controlled diabetes (A1c > 7.5%). This is the key clinical intelligence feature.",
        inputSchema: z.object({
          gapType: z
            .enum(["diabetes-a1c"])
            .optional()
            .describe("Type of care gap to check. Currently supports diabetes A1c gaps."),
        }),
        execute: async () => {
          // In production: fetch(`${MULESOFT_BASE}/api/care-gaps`)
          return findCareGaps();
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
