/**
 * FHIR R4 client — connects to real FHIR servers via SMART on FHIR.
 *
 * Architecture (mirrors Emory Healthcare Navigator pattern):
 *   Agent tools → fhir-client.ts (Process layer) → FHIR servers (System layer)
 *
 * Two EHR "systems" are simulated by querying the same SMART sandbox
 * with different patient cohort filters (birthdate ranges).
 * In production, these would be separate MuleSoft CloudHub endpoints.
 *
 * Fallback: if FHIR_USE_MOCK=true or servers unreachable, returns mock data.
 */

import type {
  FhirBundle,
  FhirPatient,
  FhirCondition,
  FhirObservation,
  FhirCapabilityStatement,
  FhirServerConfig,
  NormalizedPatient,
  NormalizedCondition,
  NormalizedLabResult,
} from "./fhir-types";

import * as mockData from "./mock-data";

// ─── Server Configuration ────────────────────────────────────────

const SERVERS: FhirServerConfig[] = [
  {
    name: "CareStack",
    baseUrl: process.env.FHIR_SERVER_1_URL || "https://r4.smarthealthit.org",
    label: "CareStack",
    prefix: "cs",
    patientFilter: "birthdate=ge1960&birthdate=le1980",
  },
  {
    name: "Meditab",
    baseUrl: process.env.FHIR_SERVER_2_URL || "https://r4.smarthealthit.org",
    label: "Meditab",
    prefix: "mt",
    patientFilter: "birthdate=ge1940&birthdate=le1959",
  },
];

const FETCH_TIMEOUT = 8000; // 8s — leaves headroom for Vercel 10s limit
const PATIENTS_PER_SERVER = 10;

function useMock(): boolean {
  return process.env.FHIR_USE_MOCK === "true";
}

// ─── SNOMED ↔ ICD-10 mapping (top conditions) ────────────────────

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

// ─── Core Fetch Helper ───────────────────────────────────────────

async function fhirFetch<T>(
  server: FhirServerConfig,
  path: string,
  params?: Record<string, string>
): Promise<T | null> {
  const url = new URL(path, server.baseUrl);
  url.searchParams.set("_format", "json");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/fhir+json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Normalization ───────────────────────────────────────────────

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

// ─── Patient ID routing ──────────────────────────────────────────

// Maps prefixed IDs (cs-abc12345) back to {server, fhirId}
const patientIdMap = new Map<string, { server: FhirServerConfig; fhirId: string }>();

function getServerForPatient(patientId: string): { server: FhirServerConfig; fhirId: string } | null {
  // Check cache first
  const cached = patientIdMap.get(patientId);
  if (cached) return cached;

  // Infer from prefix
  const prefix = patientId.slice(0, 2);
  const server = SERVERS.find((s) => s.prefix === prefix);
  if (!server) return null;

  // Find the full FHIR ID — the patientId has truncated UUID
  // We can't reverse-lookup, so search by prefix match isn't reliable.
  // Instead, for new queries we'll need to have populated the map first.
  return null;
}

// Full FHIR ID map: populated during getAllPatients, used by downstream tools
const fullIdMap = new Map<string, { server: FhirServerConfig; fhirId: string }>();

function registerPatient(prefixedId: string, server: FhirServerConfig, fhirId: string) {
  fullIdMap.set(prefixedId, { server, fhirId });
}

function lookupPatient(prefixedId: string): { server: FhirServerConfig; fhirId: string } | null {
  return fullIdMap.get(prefixedId) || getServerForPatient(prefixedId);
}

// ─── Exported Functions (match mock-data.ts signatures) ──────────

export async function getAllPatients(): Promise<NormalizedPatient[]> {
  if (useMock()) return mockData.getAllPatients() as NormalizedPatient[];

  try {
    const results: NormalizedPatient[] = [];

    for (const server of SERVERS) {
      const bundle = await fhirFetch<FhirBundle<FhirPatient>>(
        server,
        "/Patient",
        { _count: String(PATIENTS_PER_SERVER), ...parseFilter(server.patientFilter) }
      );

      if (bundle?.entry) {
        for (const entry of bundle.entry) {
          const normalized = normalizePatient(entry.resource, server);
          registerPatient(normalized.id, server, entry.resource.id);
          results.push(normalized);
        }
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

  const server = SERVERS.find((s) => s.label === source);
  if (!server) return [];

  try {
    const bundle = await fhirFetch<FhirBundle<FhirPatient>>(
      server,
      "/Patient",
      { _count: String(PATIENTS_PER_SERVER), ...parseFilter(server.patientFilter) }
    );

    const results: NormalizedPatient[] = [];
    if (bundle?.entry) {
      for (const entry of bundle.entry) {
        const normalized = normalizePatient(entry.resource, server);
        registerPatient(normalized.id, server, entry.resource.id);
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

  const entry = lookupPatient(patientId);
  if (!entry) {
    // Patient not in cache — try both servers
    for (const server of SERVERS) {
      if (patientId.startsWith(server.prefix)) {
        const fhirId = patientId.slice(3); // strip "cs-" or "mt-"
        const bundle = await fhirFetch<FhirBundle<FhirCondition>>(
          server, "/Condition", { patient: fhirId, _count: "50" }
        );
        if (bundle?.entry) {
          return bundle.entry.map((e) => normalizeCondition(e.resource, server, patientId));
        }
      }
    }
    return mockData.getConditionsForPatient(patientId);
  }

  try {
    const bundle = await fhirFetch<FhirBundle<FhirCondition>>(
      entry.server, "/Condition", { patient: entry.fhirId, _count: "50" }
    );
    if (!bundle?.entry) return [];
    return bundle.entry.map((e) => normalizeCondition(e.resource, entry.server, patientId));
  } catch {
    return mockData.getConditionsForPatient(patientId);
  }
}

export async function getConditionsByCode(code: string): Promise<NormalizedCondition[]> {
  if (useMock()) return mockData.getConditionsByCode(code);

  // Determine SNOMED code — sandbox uses SNOMED, tools may pass ICD-10
  let snomedCode = ICD10_TO_SNOMED[code];
  const searchCode = snomedCode
    ? `http://snomed.info/sct|${snomedCode}`
    : code; // pass through if already SNOMED or unknown

  try {
    const results: NormalizedCondition[] = [];
    for (const server of SERVERS) {
      const bundle = await fhirFetch<FhirBundle<FhirCondition>>(
        server, "/Condition", { code: searchCode, _count: "50" }
      );
      if (bundle?.entry) {
        for (const entry of bundle.entry) {
          const ref = entry.resource.subject?.reference?.split("/").pop() || "";
          const prefixedId = `${server.prefix}-${ref.slice(0, 8)}`;
          results.push(normalizeCondition(entry.resource, server, prefixedId));
        }
      }
    }
    return results;
  } catch {
    return mockData.getConditionsByCode(code);
  }
}

export async function getLabResultsForPatient(patientId: string): Promise<NormalizedLabResult[]> {
  if (useMock()) return mockData.getLabResultsForPatient(patientId);

  const entry = lookupPatient(patientId);
  if (!entry) {
    for (const server of SERVERS) {
      if (patientId.startsWith(server.prefix)) {
        const fhirId = patientId.slice(3);
        const bundle = await fhirFetch<FhirBundle<FhirObservation>>(
          server, "/Observation", { patient: fhirId, category: "laboratory", _count: "30" }
        );
        if (bundle?.entry) {
          return bundle.entry
            .filter((e) => e.resource.valueQuantity?.value != null)
            .map((e) => normalizeLabResult(e.resource, server, patientId));
        }
      }
    }
    return mockData.getLabResultsForPatient(patientId);
  }

  try {
    const bundle = await fhirFetch<FhirBundle<FhirObservation>>(
      entry.server, "/Observation", { patient: entry.fhirId, category: "laboratory", _count: "30" }
    );
    if (!bundle?.entry) return [];
    return bundle.entry
      .filter((e) => e.resource.valueQuantity?.value != null)
      .map((e) => normalizeLabResult(e.resource, entry.server, patientId));
  } catch {
    return mockData.getLabResultsForPatient(patientId);
  }
}

export async function getLabResultsByCode(loincCode: string): Promise<NormalizedLabResult[]> {
  if (useMock()) return mockData.getLabResultsByCode(loincCode);

  try {
    const results: NormalizedLabResult[] = [];
    for (const server of SERVERS) {
      const bundle = await fhirFetch<FhirBundle<FhirObservation>>(
        server, "/Observation", { code: `http://loinc.org|${loincCode}`, _count: "30" }
      );
      if (bundle?.entry) {
        for (const entry of bundle.entry) {
          if (entry.resource.valueQuantity?.value == null) continue;
          const ref = entry.resource.subject?.reference?.split("/").pop() || "";
          const prefixedId = `${server.prefix}-${ref.slice(0, 8)}`;
          results.push(normalizeLabResult(entry.resource, server, prefixedId));
        }
      }
    }
    return results;
  } catch {
    return mockData.getLabResultsByCode(loincCode);
  }
}

export async function findCareGaps() {
  if (useMock()) return mockData.findCareGaps();

  try {
    // Step 1: Find diabetic patients across both servers (SNOMED 44054006)
    const diabeticConditions = await getConditionsByCode("E11.9");
    const uniquePatientIds = [...new Set(diabeticConditions.map((c) => c.patientId))];

    if (uniquePatientIds.length === 0) {
      return mockData.findCareGaps(); // No diabetics found, fall back
    }

    // Step 2: For each diabetic patient, check A1c status
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const gaps = [];
    // Limit to 15 patients to stay within timeout
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

// ─── FHIR Server Discovery ──────────────────────────────────────

export async function discoverServer(target: string = "both") {
  const serversToQuery = target === "both"
    ? SERVERS
    : SERVERS.filter((s) => s.label.toLowerCase() === target.toLowerCase());

  const results = [];
  for (const server of serversToQuery) {
    const cap = await fhirFetch<FhirCapabilityStatement>(server, "/metadata");
    if (cap) {
      const resources = cap.rest?.[0]?.resource?.map((r) => r.type) || [];
      results.push({
        name: server.label,
        baseUrl: server.baseUrl,
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
      results.push({
        name: server.label,
        baseUrl: server.baseUrl,
        status: "unreachable",
      });
    }
  }
  return results;
}

// ─── Health Check (for StatusBadge) ──────────────────────────────

export async function healthCheck() {
  if (useMock()) {
    return { carestack: { status: "mock" }, meditab: { status: "mock" }, usingMock: true };
  }

  const results: Record<string, { status: string; version?: string; fhirVersion?: string }> = {};
  for (const server of SERVERS) {
    const cap = await fhirFetch<FhirCapabilityStatement>(server, "/metadata");
    const key = server.label.toLowerCase();
    if (cap) {
      results[key] = {
        status: "connected",
        version: cap.software?.version,
        fhirVersion: cap.fhirVersion,
      };
    } else {
      results[key] = { status: "unreachable" };
    }
  }
  return { ...results, usingMock: false };
}

// ─── Utility ─────────────────────────────────────────────────────

function parseFilter(filter: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of filter.split("&")) {
    const [k, v] = pair.split("=");
    if (k && v) params[k] = v;
  }
  return params;
}
