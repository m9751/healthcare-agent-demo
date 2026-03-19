/**
 * BACKWARD COMPATIBILITY — re-exports from 3-layer API architecture.
 *
 * This file previously contained all FHIR logic in a single module.
 * It has been refactored into the MuleSoft API-led connectivity pattern:
 *
 *   Experience API  →  agent-tools.ts      (what the agent calls)
 *   Process API     →  clinical-federation.ts  (orchestration + normalization)
 *   System APIs     →  carestack.ts / meditab.ts  (1:1 FHIR endpoint wrappers)
 *
 * This file re-exports everything so existing imports don't break.
 * New code should import from the appropriate layer directly.
 */

export {
  getAllPatients,
  getPatientsBySource,
  getConditionsForPatient,
  getConditionsByCode,
  getLabResultsForPatient,
  getLabResultsByCode,
  getMedicationsForPatient,
  getAllergiesForPatient,
  findCareGaps,
  discoverServer,
  healthCheck,
} from "./experience-api/agent-tools";
