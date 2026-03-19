/**
 * SYSTEM LAYER — Core FHIR HTTP Client
 *
 * This module handles the raw HTTP mechanics of communicating with FHIR R4 servers:
 *   - Server configuration (base URLs, auth tokens, patient cohort filters)
 *   - HTTP fetch with timeout, abort, and error handling
 *   - FHIR-specific headers (Accept: application/fhir+json)
 *
 * In production, each server config would include:
 *   - OAuth 2.0 / SMART on FHIR credentials (client_id, client_secret)
 *   - Token endpoint for SMART Backend Services flow
 *   - Scopes: patient/*.read, user/*.read (per Meditech Greenfield spec)
 *
 * MuleSoft equivalent: HTTP Request connector with SMART on FHIR policy
 * applied at the API Gateway level.
 */

import type { FhirServerConfig } from "../fhir-types";

// ─── Server Configuration ────────────────────────────────────────

export const SERVERS: FhirServerConfig[] = [
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

export const FETCH_TIMEOUT = 8000; // 8s — leaves headroom for Vercel 10s limit
export const PATIENTS_PER_SERVER = 10;

export function useMock(): boolean {
  return process.env.FHIR_USE_MOCK === "true";
}

// ─── Core Fetch Helper ───────────────────────────────────────────
//
// In production MuleSoft deployment, this function would be replaced by:
//   - HTTP Request connector → FHIR endpoint
//   - OAuth 2.0 Client Credentials policy (SMART Backend Services)
//   - Automatic token refresh via MuleSoft token manager
//   - Circuit breaker + retry policy at the API Gateway
//

export async function fhirFetch<T>(
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

// ─── Utility ─────────────────────────────────────────────────────

export function parseFilter(filter: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of filter.split("&")) {
    const [k, v] = pair.split("=");
    if (k && v) params[k] = v;
  }
  return params;
}
