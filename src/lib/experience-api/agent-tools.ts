/**
 * EXPERIENCE API — Agent Tool Interface
 *
 * This is the topmost layer that the AI agent calls directly.
 * Each exported function maps 1:1 to an agent tool definition in route.ts.
 *
 * The Experience API's job is simple:
 *   1. Accept agent-friendly parameters (patient IDs, codes, filter strings)
 *   2. Call the Process API (clinical-federation.ts)
 *   3. Return agent-friendly JSON (flat, readable, no FHIR nesting)
 *
 * MuleSoft equivalent: An Experience API deployed to CloudHub with:
 *   - Base path: /api/v1/agent
 *   - Inbound: HTTP Listener (called by Agentforce / AI agent)
 *   - Outbound: HTTP Request → Process API (Clinical Federation)
 *   - RAML/OAS spec defining the agent tool contract
 *   - Rate limiting per consumer (agent instance)
 *   - API autodiscovery registered in API Manager
 *
 * In the Agentforce context (Phase 3):
 *   - Each function below becomes an Agentforce Action
 *   - The Action's input/output schema matches the tool's inputSchema/output
 *   - MuleSoft Agent Fabric publishes these as MCP-compatible tools
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
  discoverServers as discoverServer,
  healthCheck,
} from "../process-api/clinical-federation";
