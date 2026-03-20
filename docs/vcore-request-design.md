# Healthcare Clinical Intelligence — Anypoint Sandbox Request

## What I Need

1. **0.4 vCores allocated to my Sandbox environment** — 4 Micro (0.1) workers for a 3-layer API-led demo
2. **Confirmation that the MCP Connector (v1.3.1) is covered** under my org's Anypoint Platform entitlement, or guidance on how to enable it

## Who

- **Requestor:** Michael Busacca, Enterprise AE, MuleSoft Healthcare
- **Org ID:** `93377cd3-49b6-42f7-bc51-b87965d0a66d`
- **Environment:** Sandbox (`8b53e3b4-18f8-43f5-a8cc-4936ad0ed7dc`)

## What I'm Building

A healthcare clinical intelligence demo that federates FHIR R4 patient data from two EHR systems and exposes it to AI agents (Agentforce, Claude) via the Anypoint MCP Connector. This is a customer-facing demo — I want to show we drink our own champagne.

4 Mule apps, all built and ready to deploy:

```
AI Clients (Agentforce / Claude / Demo UI)
       │
       ▼  MCP Protocol
Experience API + MCP Server          ← 0.1 vCore
       │
       ▼  HTTP
Process API — Clinical Federation    ← 0.1 vCore
       │
       ├──────────────┐
       ▼              ▼
System API         System API        ← 0.1 + 0.1 vCore
CareStack FHIR     Meditab FHIR
       │              │
       ▼              ▼
   FHIR R4 Sandbox (public, no cost)
```

## Resource Breakdown

| App | Layer | Worker | vCores | What it does |
|-----|-------|--------|--------|-------------|
| carestack-fhir-sys-api | System | Micro | 0.1 | HTTP passthrough to FHIR R4 endpoint |
| meditab-fhir-sys-api | System | Micro | 0.1 | Same contract, different EHR |
| clinical-federation-prc-api | Process | Micro | 0.1 | Scatter-Gather, DataWeave SNOMED→ICD-10, Choice Router |
| agent-tools-exp-api | Experience | Micro | 0.1 | 8 agent tools + MCP Connector v1.3.1 |
| **Total** | | | **0.4** | |

## Connectors

| Connector | Version | Licensing question |
|-----------|---------|-------------------|
| HTTP Connector | 1.9.3 | Ships with Mule runtime — no question |
| Object Store Connector | 1.2.2 | Ships with Mule runtime — no question |
| APIkit Module | 1.10.4 | Ships with Mule runtime — no question |
| **MCP Connector** | **1.3.1** | **Published on Exchange as `com.mulesoft.connectors:mule-mcp-connector`. Is this covered under my current entitlement, or does it require a separate enablement?** |

## What I Don't Need

- No Anypoint MQ (synchronous request-reply only)
- No HL7 Connector (FHIR R4 only)
- No external databases
- No Private Spaces or Runtime Fabric (CloudHub 1.0 Micro workers are fine)

## Timeline

All 4 Mule projects are built. Ready to deploy immediately upon vCore allocation.
