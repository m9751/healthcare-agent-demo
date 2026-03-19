/**
 * Mock FHIR R4 data simulating two EHR systems connected via MuleSoft.
 *
 * In production, these would be real API calls to:
 *   - MuleSoft Anypoint → CareStack FHIR API
 *   - MuleSoft Anypoint → Meditab FHIR API
 *
 * A developer or SE swaps this file for real fetch() calls to your
 * MuleSoft Cloudhub endpoints when they're ready.
 */

// ─── CareStack Patients ────────────────────────────────────────────
export const careStackPatients = [
  {
    id: "cs-001",
    resourceType: "Patient",
    name: [{ given: ["Maria"], family: "Gonzalez" }],
    birthDate: "1958-03-12",
    gender: "female",
    address: [{ city: "Tampa", state: "FL" }],
    source: "CareStack",
  },
  {
    id: "cs-002",
    resourceType: "Patient",
    name: [{ given: ["James"], family: "Williams" }],
    birthDate: "1972-08-05",
    gender: "male",
    address: [{ city: "Orlando", state: "FL" }],
    source: "CareStack",
  },
  {
    id: "cs-003",
    resourceType: "Patient",
    name: [{ given: ["Linda"], family: "Chen" }],
    birthDate: "1965-11-22",
    gender: "female",
    address: [{ city: "Miami", state: "FL" }],
    source: "CareStack",
  },
  {
    id: "cs-004",
    resourceType: "Patient",
    name: [{ given: ["Robert"], family: "Johnson" }],
    birthDate: "1950-01-30",
    gender: "male",
    address: [{ city: "Jacksonville", state: "FL" }],
    source: "CareStack",
  },
  {
    id: "cs-005",
    resourceType: "Patient",
    name: [{ given: ["Patricia"], family: "Smith" }],
    birthDate: "1980-06-15",
    gender: "female",
    address: [{ city: "St. Petersburg", state: "FL" }],
    source: "CareStack",
  },
];

// ─── Meditab Patients ──────────────────────────────────────────────
export const meditabPatients = [
  {
    id: "mt-001",
    resourceType: "Patient",
    name: [{ given: ["David"], family: "Park" }],
    birthDate: "1962-04-18",
    gender: "male",
    address: [{ city: "Atlanta", state: "GA" }],
    source: "Meditab",
  },
  {
    id: "mt-002",
    resourceType: "Patient",
    name: [{ given: ["Susan"], family: "Martinez" }],
    birthDate: "1975-09-03",
    gender: "female",
    address: [{ city: "Savannah", state: "GA" }],
    source: "Meditab",
  },
  {
    id: "mt-003",
    resourceType: "Patient",
    name: [{ given: ["Michael"], family: "Thompson" }],
    birthDate: "1968-12-10",
    gender: "male",
    address: [{ city: "Charlotte", state: "NC" }],
    source: "Meditab",
  },
  {
    id: "mt-004",
    resourceType: "Patient",
    name: [{ given: ["Karen"], family: "Davis" }],
    birthDate: "1955-07-25",
    gender: "female",
    address: [{ city: "Nashville", state: "TN" }],
    source: "Meditab",
  },
  {
    id: "mt-005",
    resourceType: "Patient",
    name: [{ given: ["Thomas"], family: "Wilson" }],
    birthDate: "1948-02-14",
    gender: "male",
    address: [{ city: "Raleigh", state: "NC" }],
    source: "Meditab",
  },
];

// ─── Conditions (Diagnoses) ────────────────────────────────────────
export const conditions = [
  // CareStack patients
  { patientId: "cs-001", code: "E11.9", display: "Type 2 Diabetes Mellitus", onsetDate: "2019-03-15", source: "CareStack" },
  { patientId: "cs-001", code: "I10", display: "Essential Hypertension", onsetDate: "2018-06-01", source: "CareStack" },
  { patientId: "cs-002", code: "E11.9", display: "Type 2 Diabetes Mellitus", onsetDate: "2021-01-10", source: "CareStack" },
  { patientId: "cs-003", code: "I10", display: "Essential Hypertension", onsetDate: "2017-09-20", source: "CareStack" },
  { patientId: "cs-003", code: "J45.909", display: "Asthma, Unspecified", onsetDate: "2010-04-12", source: "CareStack" },
  { patientId: "cs-004", code: "E11.9", display: "Type 2 Diabetes Mellitus", onsetDate: "2015-07-08", source: "CareStack" },
  { patientId: "cs-004", code: "I10", display: "Essential Hypertension", onsetDate: "2016-11-30", source: "CareStack" },
  { patientId: "cs-004", code: "N18.3", display: "Chronic Kidney Disease, Stage 3", onsetDate: "2022-02-14", source: "CareStack" },
  { patientId: "cs-005", code: "F32.1", display: "Major Depressive Disorder", onsetDate: "2023-05-20", source: "CareStack" },

  // Meditab patients
  { patientId: "mt-001", code: "E11.9", display: "Type 2 Diabetes Mellitus", onsetDate: "2018-08-22", source: "Meditab" },
  { patientId: "mt-001", code: "E78.5", display: "Hyperlipidemia", onsetDate: "2019-01-15", source: "Meditab" },
  { patientId: "mt-002", code: "I10", display: "Essential Hypertension", onsetDate: "2020-03-10", source: "Meditab" },
  { patientId: "mt-003", code: "E11.9", display: "Type 2 Diabetes Mellitus", onsetDate: "2017-06-05", source: "Meditab" },
  { patientId: "mt-003", code: "I10", display: "Essential Hypertension", onsetDate: "2018-09-12", source: "Meditab" },
  { patientId: "mt-004", code: "E11.9", display: "Type 2 Diabetes Mellitus", onsetDate: "2016-04-30", source: "Meditab" },
  { patientId: "mt-004", code: "I10", display: "Essential Hypertension", onsetDate: "2017-02-18", source: "Meditab" },
  { patientId: "mt-004", code: "I50.9", display: "Heart Failure, Unspecified", onsetDate: "2023-01-05", source: "Meditab" },
  { patientId: "mt-005", code: "J44.1", display: "COPD with Acute Exacerbation", onsetDate: "2019-11-20", source: "Meditab" },
  { patientId: "mt-005", code: "E11.9", display: "Type 2 Diabetes Mellitus", onsetDate: "2020-05-10", source: "Meditab" },
];

// ─── Lab Results (Observations) ────────────────────────────────────
export const labResults = [
  // CareStack labs
  { patientId: "cs-001", code: "4548-4", display: "Hemoglobin A1c", value: 8.2, unit: "%", date: "2025-11-15", source: "CareStack" },
  { patientId: "cs-001", code: "4548-4", display: "Hemoglobin A1c", value: 7.8, unit: "%", date: "2025-05-20", source: "CareStack" },
  { patientId: "cs-002", code: "4548-4", display: "Hemoglobin A1c", value: 6.9, unit: "%", date: "2025-09-10", source: "CareStack" },
  { patientId: "cs-004", code: "4548-4", display: "Hemoglobin A1c", value: 9.4, unit: "%", date: "2025-06-01", source: "CareStack" },
  // cs-001 has recent A1c, cs-002 has recent A1c, cs-004 has A1c but high
  // cs-003 has NO A1c (not diabetic, just hypertension)
  // cs-005 has NO A1c (not diabetic)

  { patientId: "cs-001", code: "2160-0", display: "Creatinine", value: 1.1, unit: "mg/dL", date: "2025-11-15", source: "CareStack" },
  { patientId: "cs-004", code: "2160-0", display: "Creatinine", value: 2.3, unit: "mg/dL", date: "2025-06-01", source: "CareStack" },
  { patientId: "cs-004", code: "33914-3", display: "eGFR", value: 38, unit: "mL/min/1.73m2", date: "2025-06-01", source: "CareStack" },

  // Meditab labs
  { patientId: "mt-001", code: "4548-4", display: "Hemoglobin A1c", value: 7.1, unit: "%", date: "2025-10-05", source: "Meditab" },
  { patientId: "mt-003", code: "4548-4", display: "Hemoglobin A1c", value: 8.7, unit: "%", date: "2025-04-12", source: "Meditab" },
  // mt-004 is diabetic but has NO recent A1c — this is a care gap!
  // mt-005 is diabetic but has NO A1c at all — another care gap!

  { patientId: "mt-001", code: "2093-3", display: "Total Cholesterol", value: 245, unit: "mg/dL", date: "2025-10-05", source: "Meditab" },
  { patientId: "mt-004", code: "2093-3", display: "Total Cholesterol", value: 198, unit: "mg/dL", date: "2025-08-20", source: "Meditab" },
];

// ─── Helper functions (simulate MuleSoft API calls) ────────────────

export function getAllPatients() {
  return [...careStackPatients, ...meditabPatients];
}

export function getPatientsBySource(source: "CareStack" | "Meditab") {
  return source === "CareStack" ? careStackPatients : meditabPatients;
}

export function getConditionsForPatient(patientId: string) {
  return conditions.filter((c) => c.patientId === patientId);
}

export function getConditionsByCode(code: string) {
  return conditions.filter((c) => c.code === code);
}

export function getLabResultsForPatient(patientId: string) {
  return labResults.filter((l) => l.patientId === patientId);
}

export function getLabResultsByCode(loincCode: string) {
  return labResults.filter((l) => l.code === loincCode);
}

export function findCareGaps() {
  // Patients with diabetes (E11.9) but no A1c in the last 90 days
  const diabeticPatientIds = [
    ...new Set(conditions.filter((c) => c.code === "E11.9").map((c) => c.patientId)),
  ];

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const gaps = diabeticPatientIds
    .map((pid) => {
      const patient = getAllPatients().find((p) => p.id === pid);
      const a1cResults = labResults
        .filter((l) => l.patientId === pid && l.code === "4548-4")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const lastA1c = a1cResults[0];
      const hasRecentA1c = lastA1c && new Date(lastA1c.date) > ninetyDaysAgo;

      return {
        patient,
        diabetesDiagnosis: conditions.find((c) => c.patientId === pid && c.code === "E11.9"),
        lastA1c: lastA1c || null,
        hasRecentA1c,
        riskLevel: !lastA1c
          ? "HIGH"
          : !hasRecentA1c
            ? "MEDIUM"
            : lastA1c.value > 9
              ? "HIGH"
              : lastA1c.value > 7.5
                ? "MEDIUM"
                : "LOW",
      };
    })
    .filter((g) => !g.hasRecentA1c || (g.lastA1c && g.lastA1c.value > 7.5));

  return gaps;
}
