/**
 * FHIR R4 type definitions — minimal, only fields we consume.
 * Full spec: https://hl7.org/fhir/R4/
 */

// ─── FHIR Server Config ─────────────────────────────────────────
export interface FhirServerConfig {
  name: string;
  baseUrl: string;
  label: string; // "CareStack" | "Meditab"
  prefix: string; // "cs" | "mt" — patient ID prefix
  patientFilter: string; // query params to scope cohort
}

// ─── FHIR Bundle (search results wrapper) ────────────────────────
export interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  link?: Array<{ relation: string; url: string }>;
  entry?: Array<{ resource: T }>;
}

// ─── FHIR Patient ────────────────────────────────────────────────
export interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: Array<{ given?: string[]; family?: string }>;
  birthDate?: string;
  gender?: string;
  address?: Array<{ city?: string; state?: string }>;
}

// ─── FHIR Condition ──────────────────────────────────────────────
export interface FhirCondition {
  resourceType: "Condition";
  id: string;
  subject?: { reference?: string };
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  onsetDateTime?: string;
  clinicalStatus?: { coding?: Array<{ code?: string }> };
}

// ─── FHIR Observation (labs/vitals) ──────────────────────────────
export interface FhirObservation {
  resourceType: "Observation";
  id: string;
  subject?: { reference?: string };
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  valueQuantity?: { value?: number; unit?: string };
  effectiveDateTime?: string;
  category?: Array<{
    coding?: Array<{ system?: string; code?: string }>;
  }>;
}

// ─── FHIR CapabilityStatement ────────────────────────────────────
export interface FhirCapabilityStatement {
  resourceType: "CapabilityStatement";
  software?: { name?: string; version?: string };
  fhirVersion?: string;
  rest?: Array<{
    resource?: Array<{ type: string }>;
  }>;
}

// ─── Normalized types (what tools return to the agent) ───────────
export interface NormalizedPatient {
  id: string;
  resourceType: "Patient";
  name: Array<{ given: string[]; family: string }>;
  birthDate: string;
  gender: string;
  address: Array<{ city: string; state: string }>;
  source: string;
}

export interface NormalizedCondition {
  patientId: string;
  code: string;
  display: string;
  onsetDate: string;
  source: string;
}

export interface NormalizedLabResult {
  patientId: string;
  code: string;
  display: string;
  value: number;
  unit: string;
  date: string;
  source: string;
}
