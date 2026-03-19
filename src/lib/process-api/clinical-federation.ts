/**
 * PROCESS API — Clinical Data Federation
 *
 * This is the orchestration layer. It calls System APIs for both EHR systems,
 * normalizes data (SNOMED→ICD-10, FHIR→flat JSON), deduplicates patients,
 * and applies clinical logic (care gap detection, risk scoring).
 *
 * MuleSoft equivalent: A Process API deployed to CloudHub with:
 *   - Base path: /api/v1/clinical
 *   - Inbound: HTTP Listener (called by Experience API)
 *   - Outbound: HTTP Request → CareStack System API + Meditab System API
 *   - DataWeave transformations for SNOMED↔ICD-10 mapping
 *   - Scatter-Gather for parallel EHR queries
 *   - Choice router for patient ID routing (cs-* → CareStack, mt-* → Meditab)
 *   - Error handling: try/catch with mock data fallback
 *
 * Key MuleSoft patterns demonstrated:
 *   - Scatter-Gather: query both EHRs in parallel
 *   - DataWeave: SNOMED→ICD-10 code translation
 *   - Object Store: patient ID cache (prefixed→FHIR ID mapping)
 *   - Choice Router: route by patient ID prefix
 */

import type {
  FhirPatient,
  FhirCondition,
  FhirObservation,
  FhirMedicationRequest,
  FhirAllergyIntolerance,
  FhirServerConfig,
  NormalizedPatient,
  NormalizedCondition,
  NormalizedLabResult,
  NormalizedMedication,
  NormalizedAllergy,
} from "../fhir-types";
import * as carestack from "../system-api/carestack";
import * as meditab from "../system-api/meditab";
import { useMock } from "../system-api/fhir-fetch";
import * as mockData from "../mock-data";

// ─── SNOMED ↔ ICD-10 Mapping (DataWeave equivalent) ─────────────
//
// In MuleSoft: this would be a DataWeave lookup table or an external
// terminology service call (e.g., FHIR $translate operation).

const SNOMED_TO_ICD10: Record<string, { icd10: string; display: string }> = {
  "44054006": { icd10: "E11.9", display: "Type 2 Diabetes Mellitus" },
  "38341003": { icd10: "I10", display: "Essential Hypertension" },
  "195967001": { icd10: "J45.909", display: "Asthma, Unspecified" },
  "431855005": { icd10: "N18.3", display: "Chronic Kidney Disease, Stage 3" },
  "370143000": { icd10: "F32.1", display: "Major Depressive Disorder" },
  "55822004": { icd10: "E78.5", display: "Hyperlipidemia" },
  "84114007": { icd10: "I50.9", display: "Heart Failure, Unspecified" },
  "13645005": { icd10: "J44.1", display: "COPD with Acute Exacerbation" },
  "233604007": { icd10: "I25.10", display: "Coronary Artery Disease" },
  "40930008": { icd10: "I48.91", display: "Atrial Fibrillation" },
  "73211009": { icd10: "E11.9", display: "Diabetes Mellitus" },
  "15777000": { icd10: "E11.65", display: "Diabetes with Hyperglycemia" },
  "46635009": { icd10: "E11.9", display: "Diabetes Mellitus Type 1" },
  "162864005": { icd10: "R73.09", display: "Prediabetes" },
};

const ICD10_TO_SNOMED: Record<string, string> = {};
for (const [snomed, mapping] of Object.entries(SNOMED_TO_ICD10)) {
  ICD10_TO_SNOMED[mapping.icd10] = snomed;
}

// ─── Patient ID Registry (Object Store equivalent) ──────────────
//
// In MuleSoft: this would be an Object Store v2 or Redis cache
// that maps prefixed IDs (cs-abc12345) back to {server, fhirId}.

const patientRegistry = new Map<string, { serverLabel: string; fhirId: string }>();

function registerPatient(prefixedId: string, serverLabel: string, fhirId: string) {
  patientRegistry.set(prefixedId, { serverLabel, fhirId });
}

function lookupPatient(prefixedId: string): { serverLabel: string; fhirId: string } | null {
  return patientRegistry.get(prefixedId) || null;
}

// ─── Normalization Functions (DataWeave transforms) ──────────────

function normalizePatient(p: FhirPatient, server: FhirServerConfig): NormalizedPatient {
  const name = p.name?.[0];
  const addr = p.address?.[0];
  return {
    id: `${server.prefix}-${p.id.slice(0, 8)}`,
    resourceType: "Patient",
    name: [{ given: name?.given || ["Unknown"], family: name?.family || "Unknown" }],
    birthDate: p.birthDate || "Unknown",
    gender: p.gender || "unknown",
    address: [{ city: addr?.city || "Unknown", state: addr?.state || "Unknown" }],
    source: server.label,
  };
}

function normalizeCondition(c: FhirCondition, server: FhirServerConfig, patientId: string): NormalizedCondition {
  const coding = c.code?.coding?.[0];
  const snomedCode = coding?.code || "";
  const mapping = SNOMED_TO_ICD10[snomedCode];
  return {
    patientId,
    code: mapping?.icd10 || snomedCode,
    display: mapping?.display || coding?.display || c.code?.text || "Unknown",
    onsetDate: c.onsetDateTime?.slice(0, 10) || "Unknown",
    source: server.label,
  };
}

function normalizeLabResult(o: FhirObservation, server: FhirServerConfig, patientId: string): NormalizedLabResult {
  const coding = o.code?.coding?.[0];
  return {
    patientId,
    code: coding?.code || "Unknown",
    display: coding?.display || o.code?.text || "Unknown",
    value: o.valueQuantity?.value ?? 0,
    unit: o.valueQuantity?.unit || "",
    date: o.effectiveDateTime?.slice(0, 10) || "Unknown",
    source: server.label,
  };
}

function normalizeMedication(m: FhirMedicationRequest, server: FhirServerConfig, patientId: string): NormalizedMedication {
  const coding = m.medicationCodeableConcept?.coding?.[0];
  return {
    patientId,
    name: coding?.display || m.medicationCodeableConcept?.text || "Unknown",
    code: coding?.code || "Unknown",
    status: m.status || "unknown",
    dosage: m.dosageInstruction?.[0]?.text || "Not specified",
    dateWritten: m.authoredOn?.slice(0, 10) || "Unknown",
    source: server.label,
  };
}

function normalizeAllergy(a: FhirAllergyIntolerance, server: FhirServerConfig, patientId: string): NormalizedAllergy {
  const coding = a.code?.coding?.[0];
  const reaction = a.reaction?.[0];
  const manifestation = reaction?.manifestation?.[0];
  return {
    patientId,
    substance: coding?.display || a.code?.text || "Unknown",
    category: a.category?.[0] || "unknown",
    criticality: a.criticality || "unknown",
    status: a.clinicalStatus?.coding?.[0]?.code || "unknown",
    reaction: manifestation?.coding?.[0]?.display || manifestation?.text || "Not documented",
    recordedDate: a.recordedDate?.slice(0, 10) || "Unknown",
    source: server.label,
  };
}

// ─── Helper: resolve patient to system API ──────────────────────
//
// MuleSoft equivalent: Choice Router
//   - cs-* prefix → route to CareStack System API
//   - mt-* prefix → route to Meditab System API

type SystemAPI = typeof carestack;

function getSystemForPatient(patientId: string): { api: SystemAPI; config: FhirServerConfig; fhirId: string } | null {
  // Check registry first (populated by getAllPatients)
  const cached = lookupPatient(patientId);
  if (cached) {
    const isCS = cached.serverLabel === "CareStack";
    return {
      api: isCS ? carestack : meditab,
      config: isCS ? carestack.serverConfig : meditab.serverConfig,
      fhirId: cached.fhirId,
    };
  }

  // Fallback: infer from prefix, use truncated ID
  if (patientId.startsWith("cs-")) {
    return { api: carestack, config: carestack.serverConfig, fhirId: patientId.slice(3) };
  }
  if (patientId.startsWith("mt-")) {
    return { api: meditab, config: meditab.serverConfig, fhirId: patientId.slice(3) };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// FEDERATED OPERATIONS (called by Experience API)
//
// Each function below implements the Scatter-Gather pattern:
//   1. Call both System APIs (CareStack + Meditab)
//   2. Normalize responses (SNOMED→ICD-10, flat JSON)
//   3. Merge into unified result set
//   4. Fall back to mock data on failure
// ═══════════════════════════════════════════════════════════════════

export async function getAllPatients(): Promise<NormalizedPatient[]> {
  if (useMock()) return mockData.getAllPatients() as NormalizedPatient[];

  try {
    const results: NormalizedPatient[] = [];

    // Scatter-Gather: query both EHR systems in parallel
    const [csBundleResult, mtBundleResult] = await Promise.allSettled([
      carestack.fetchPatients(),
      meditab.fetchPatients(),
    ]);

    const csBundle = csBundleResult.status === "fulfilled" ? csBundleResult.value : null;
    const mtBundle = mtBundleResult.status === "fulfilled" ? mtBundleResult.value : null;

    if (csBundle?.entry) {
      for (const entry of csBundle.entry) {
        const normalized = normalizePatient(entry.resource, carestack.serverConfig);
        registerPatient(normalized.id, "CareStack", entry.resource.id);
        results.push(normalized);
      }
    }
    if (mtBundle?.entry) {
      for (const entry of mtBundle.entry) {
        const normalized = normalizePatient(entry.resource, meditab.serverConfig);
        registerPatient(normalized.id, "Meditab", entry.resource.id);
        results.push(normalized);
      }
    }

    if (results.length === 0) throw new Error("No patients returned from FHIR servers");
    return results;
  } catch (err) {
    console.warn("FHIR getAllPatients failed, falling back to mock:", err);
    return mockData.getAllPatients() as NormalizedPatient[];
  }
}

export async function getPatientsBySource(source: "CareStack" | "Meditab"): Promise<NormalizedPatient[]> {
  if (useMock()) return mockData.getPatientsBySource(source) as NormalizedPatient[];

  const api = source === "CareStack" ? carestack : meditab;
  const config = source === "CareStack" ? carestack.serverConfig : meditab.serverConfig;

  try {
    const bundle = await api.fetchPatients();
    const results: NormalizedPatient[] = [];
    if (bundle?.entry) {
      for (const entry of bundle.entry) {
        const normalized = normalizePatient(entry.resource, config);
        registerPatient(normalized.id, source, entry.resource.id);
        results.push(normalized);
      }
    }
    return results;
  } catch {
    return mockData.getPatientsBySource(source) as NormalizedPatient[];
  }
}

export async function getConditionsForPatient(patientId: string): Promise<NormalizedCondition[]> {
  if (useMock()) return mockData.getConditionsForPatient(patientId);

  const system = getSystemForPatient(patientId);
  if (!system) return mockData.getConditionsForPatient(patientId);

  try {
    const bundle = await system.api.fetchConditions(system.fhirId);
    if (!bundle?.entry) return [];
    return bundle.entry.map((e) => normalizeCondition(e.resource, system.config, patientId));
  } catch {
    return mockData.getConditionsForPatient(patientId);
  }
}

export async function getConditionsByCode(code: string): Promise<NormalizedCondition[]> {
  if (useMock()) return mockData.getConditionsByCode(code);

  const snomedCode = ICD10_TO_SNOMED[code];
  const searchCode = snomedCode ? `http://snomed.info/sct|${snomedCode}` : code;

  try {
    const results: NormalizedCondition[] = [];

    const [csResult, mtResult] = await Promise.allSettled([
      carestack.fetchConditionsByCode(searchCode),
      meditab.fetchConditionsByCode(searchCode),
    ]);

    const processBundle = (result: PromiseSettledResult<ReturnType<typeof carestack.fetchConditionsByCode> extends Promise<infer T> ? T : never>, config: FhirServerConfig) => {
      if (result.status !== "fulfilled" || !result.value?.entry) return;
      for (const entry of result.value.entry) {
        const ref = entry.resource.subject?.reference?.split("/").pop() || "";
        const prefixedId = `${config.prefix}-${ref.slice(0, 8)}`;
        results.push(normalizeCondition(entry.resource, config, prefixedId));
      }
    };

    processBundle(csResult, carestack.serverConfig);
    processBundle(mtResult, meditab.serverConfig);
    return results;
  } catch {
    return mockData.getConditionsByCode(code);
  }
}

export async function getLabResultsForPatient(patientId: string): Promise<NormalizedLabResult[]> {
  if (useMock()) return mockData.getLabResultsForPatient(patientId);

  const system = getSystemForPatient(patientId);
  if (!system) return mockData.getLabResultsForPatient(patientId);

  try {
    const bundle = await system.api.fetchObservations(system.fhirId);
    if (!bundle?.entry) return [];
    return bundle.entry
      .filter((e) => e.resource.valueQuantity?.value != null)
      .map((e) => normalizeLabResult(e.resource, system.config, patientId));
  } catch {
    return mockData.getLabResultsForPatient(patientId);
  }
}

export async function getLabResultsByCode(loincCode: string): Promise<NormalizedLabResult[]> {
  if (useMock()) return mockData.getLabResultsByCode(loincCode);

  try {
    const results: NormalizedLabResult[] = [];

    const [csResult, mtResult] = await Promise.allSettled([
      carestack.fetchObservationsByCode(loincCode),
      meditab.fetchObservationsByCode(loincCode),
    ]);

    const processBundle = (result: PromiseSettledResult<Awaited<ReturnType<typeof carestack.fetchObservationsByCode>>>, config: FhirServerConfig) => {
      if (result.status !== "fulfilled" || !result.value?.entry) return;
      for (const entry of result.value.entry) {
        if (entry.resource.valueQuantity?.value == null) continue;
        const ref = entry.resource.subject?.reference?.split("/").pop() || "";
        const prefixedId = `${config.prefix}-${ref.slice(0, 8)}`;
        results.push(normalizeLabResult(entry.resource, config, prefixedId));
      }
    };

    processBundle(csResult, carestack.serverConfig);
    processBundle(mtResult, meditab.serverConfig);
    return results;
  } catch {
    return mockData.getLabResultsByCode(loincCode);
  }
}

export async function getMedicationsForPatient(patientId: string): Promise<NormalizedMedication[]> {
  if (useMock()) return mockData.getMedicationsForPatient(patientId);

  const system = getSystemForPatient(patientId);
  if (!system) return mockData.getMedicationsForPatient(patientId);

  try {
    const bundle = await system.api.fetchMedications(system.fhirId);
    if (!bundle?.entry) return [];
    return bundle.entry.map((e) => normalizeMedication(e.resource, system.config, patientId));
  } catch {
    return mockData.getMedicationsForPatient(patientId);
  }
}

export async function getAllergiesForPatient(patientId: string): Promise<NormalizedAllergy[]> {
  if (useMock()) return mockData.getAllergiesForPatient(patientId);

  const system = getSystemForPatient(patientId);
  if (!system) return mockData.getAllergiesForPatient(patientId);

  try {
    const bundle = await system.api.fetchAllergies(system.fhirId);
    if (!bundle?.entry) return [];
    return bundle.entry.map((e) => normalizeAllergy(e.resource, system.config, patientId));
  } catch {
    return mockData.getAllergiesForPatient(patientId);
  }
}

// ─── Care Gap Detection (Clinical Logic) ────────────────────────
//
// MuleSoft equivalent: DataWeave transformation + Choice Router
// This would be a separate flow within the Process API that:
//   1. Queries diabetic patients across both systems (Scatter-Gather)
//   2. For each, checks A1c recency and value
//   3. Classifies risk level (HIGH / MEDIUM / LOW)

export async function findCareGaps() {
  if (useMock()) return mockData.findCareGaps();

  try {
    const diabeticConditions = await getConditionsByCode("E11.9");
    const uniquePatientIds = [...new Set(diabeticConditions.map((c) => c.patientId))];

    if (uniquePatientIds.length === 0) return mockData.findCareGaps();

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const gaps = [];
    for (const pid of uniquePatientIds.slice(0, 15)) {
      const labs = await getLabResultsForPatient(pid);
      const a1cResults = labs
        .filter((l) => l.code === "4548-4")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const lastA1c = a1cResults[0] || null;
      const hasRecentA1c = lastA1c && new Date(lastA1c.date) > ninetyDaysAgo;

      const riskLevel = !lastA1c
        ? "HIGH"
        : !hasRecentA1c
          ? "MEDIUM"
          : lastA1c.value > 9
            ? "HIGH"
            : lastA1c.value > 7.5
              ? "MEDIUM"
              : "LOW";

      if (!hasRecentA1c || (lastA1c && lastA1c.value > 7.5)) {
        const allPatients = await getAllPatients();
        const patient = allPatients.find((p) => p.id === pid);
        gaps.push({
          patient: patient || { id: pid, name: [{ given: ["Unknown"], family: "Unknown" }], source: "Unknown" },
          diabetesDiagnosis: diabeticConditions.find((c) => c.patientId === pid),
          lastA1c,
          hasRecentA1c,
          riskLevel,
        });
      }
    }

    return gaps.length > 0 ? gaps : mockData.findCareGaps();
  } catch {
    return mockData.findCareGaps();
  }
}

// ─── Server Discovery (federated) ───────────────────────────────

export async function discoverServers(target: string = "both") {
  const results = [];

  const shouldQueryCS = target === "both" || target.toLowerCase() === "carestack";
  const shouldQueryMT = target === "both" || target.toLowerCase() === "meditab";

  if (shouldQueryCS) {
    const cap = await carestack.fetchCapabilityStatement();
    if (cap) {
      const resources = cap.rest?.[0]?.resource?.map((r) => r.type) || [];
      results.push({
        name: "CareStack",
        baseUrl: carestack.serverConfig.baseUrl,
        software: cap.software?.name || "Unknown",
        softwareVersion: cap.software?.version || "Unknown",
        fhirVersion: cap.fhirVersion || "Unknown",
        totalResourceTypes: resources.length,
        clinicalResources: resources.filter((r) =>
          ["Patient", "Condition", "Observation", "MedicationRequest", "AllergyIntolerance", "Appointment", "Encounter", "Procedure"].includes(r)
        ),
        status: "connected",
      });
    } else {
      results.push({ name: "CareStack", baseUrl: carestack.serverConfig.baseUrl, status: "unreachable" });
    }
  }

  if (shouldQueryMT) {
    const cap = await meditab.fetchCapabilityStatement();
    if (cap) {
      const resources = cap.rest?.[0]?.resource?.map((r) => r.type) || [];
      results.push({
        name: "Meditab",
        baseUrl: meditab.serverConfig.baseUrl,
        software: cap.software?.name || "Unknown",
        softwareVersion: cap.software?.version || "Unknown",
        fhirVersion: cap.fhirVersion || "Unknown",
        totalResourceTypes: resources.length,
        clinicalResources: resources.filter((r) =>
          ["Patient", "Condition", "Observation", "MedicationRequest", "AllergyIntolerance", "Appointment", "Encounter", "Procedure"].includes(r)
        ),
        status: "connected",
      });
    } else {
      results.push({ name: "Meditab", baseUrl: meditab.serverConfig.baseUrl, status: "unreachable" });
    }
  }

  return results;
}

// ─── Health Check ───────────────────────────────────────────────

export async function healthCheck() {
  if (useMock()) {
    return { carestack: { status: "mock" }, meditab: { status: "mock" }, usingMock: true };
  }

  const [csCap, mtCap] = await Promise.allSettled([
    carestack.fetchCapabilityStatement(),
    meditab.fetchCapabilityStatement(),
  ]);

  return {
    carestack: csCap.status === "fulfilled" && csCap.value
      ? { status: "connected", version: csCap.value.software?.version, fhirVersion: csCap.value.fhirVersion }
      : { status: "unreachable" },
    meditab: mtCap.status === "fulfilled" && mtCap.value
      ? { status: "connected", version: mtCap.value.software?.version, fhirVersion: mtCap.value.fhirVersion }
      : { status: "unreachable" },
    usingMock: false,
  };
}
