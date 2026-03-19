/**
 * SYSTEM API — CareStack EHR
 *
 * Direct FHIR R4 endpoint wrapper for the CareStack EHR system.
 * Each function maps 1:1 to a FHIR resource endpoint.
 *
 * MuleSoft equivalent: A dedicated System API deployed to CloudHub
 * with the following configuration:
 *   - Base path: /api/v1/carestack
 *   - Auth: SMART Backend Services (client credentials + JWT assertion)
 *   - Scopes: patient/*.read, user/*.read
 *   - Rate limiting: per Meditech Greenfield Quotas & Rate Limiting spec
 *   - FHIR endpoint: v2/uscore/STU7/{Resource}/
 *
 * In production, this file becomes a MuleSoft Mule application with:
 *   - HTTP Listener (inbound)
 *   - HTTP Request connector (outbound → CareStack FHIR server)
 *   - SMART on FHIR OAuth policy
 *   - Error handler with circuit breaker
 */

import type {
  FhirBundle,
  FhirPatient,
  FhirCondition,
  FhirObservation,
  FhirMedicationRequest,
  FhirAllergyIntolerance,
  FhirCapabilityStatement,
  FhirServerConfig,
} from "../fhir-types";
import { SERVERS, fhirFetch, parseFilter, PATIENTS_PER_SERVER } from "./fhir-fetch";

const SERVER: FhirServerConfig = SERVERS[0]; // CareStack

// ─── Patient ────────────────────────────────────────────────────

export async function fetchPatients(): Promise<FhirBundle<FhirPatient> | null> {
  return fhirFetch<FhirBundle<FhirPatient>>(
    SERVER,
    "/Patient",
    { _count: String(PATIENTS_PER_SERVER), ...parseFilter(SERVER.patientFilter) }
  );
}

// ─── Condition ──────────────────────────────────────────────────

export async function fetchConditions(patientFhirId: string): Promise<FhirBundle<FhirCondition> | null> {
  return fhirFetch<FhirBundle<FhirCondition>>(
    SERVER, "/Condition", { patient: patientFhirId, _count: "50" }
  );
}

export async function fetchConditionsByCode(snomedOrSearchCode: string): Promise<FhirBundle<FhirCondition> | null> {
  return fhirFetch<FhirBundle<FhirCondition>>(
    SERVER, "/Condition", { code: snomedOrSearchCode, _count: "50" }
  );
}

// ─── Observation (Labs / Vitals) ────────────────────────────────

export async function fetchObservations(patientFhirId: string): Promise<FhirBundle<FhirObservation> | null> {
  return fhirFetch<FhirBundle<FhirObservation>>(
    SERVER, "/Observation", { patient: patientFhirId, category: "laboratory", _count: "30" }
  );
}

export async function fetchObservationsByCode(loincCode: string): Promise<FhirBundle<FhirObservation> | null> {
  return fhirFetch<FhirBundle<FhirObservation>>(
    SERVER, "/Observation", { code: `http://loinc.org|${loincCode}`, _count: "30" }
  );
}

// ─── MedicationRequest ──────────────────────────────────────────

export async function fetchMedications(patientFhirId: string): Promise<FhirBundle<FhirMedicationRequest> | null> {
  return fhirFetch<FhirBundle<FhirMedicationRequest>>(
    SERVER, "/MedicationRequest", { patient: patientFhirId, _count: "30" }
  );
}

// ─── AllergyIntolerance ─────────────────────────────────────────

export async function fetchAllergies(patientFhirId: string): Promise<FhirBundle<FhirAllergyIntolerance> | null> {
  return fhirFetch<FhirBundle<FhirAllergyIntolerance>>(
    SERVER, "/AllergyIntolerance", { patient: patientFhirId, _count: "30" }
  );
}

// ─── CapabilityStatement (Server Discovery) ─────────────────────

export async function fetchCapabilityStatement(): Promise<FhirCapabilityStatement | null> {
  return fhirFetch<FhirCapabilityStatement>(SERVER, "/metadata");
}

// ─── Export server config for Process layer ─────────────────────

export { SERVER as serverConfig };
