# How to Load the Architecture Diagram into Lucidchart

## Option 1: Import SVG (Recommended — preserves layout)

1. Open Lucidchart → create a new document
2. Go to **File → Import Data → Import**
3. Select `architecture-diagram.svg` from this `docs/` folder
4. Lucidchart will import the shapes and text as editable objects
5. You may need to ungroup (right-click → Ungroup) to edit individual elements
6. Recolor using MuleSoft brand colors if needed:
   - Experience Layer: MuleSoft Blue (#00A1DF)
   - Process Layer: MuleSoft Green (#10B981)
   - System Layer: MuleSoft Orange (#F97316)
   - EHR Systems: Neutral (#64748B)

## Option 2: Live Edit in Mermaid.ai (quickest to start)

1. Open this URL in your browser — it loads the full diagram in an editable canvas:
   https://mermaid.ai/live/edit?utm_source=claude_widget&utm_medium=embed&utm_campaign=claude#pako:eNqVVv9um0gQfpWVI1WtrumBjcGOTpEoJo51xnZZKl3VnKIFBmcVArllfTq3qtSHuCe8J-ksEBw43CT8MTaz3ze_Z-2vgyiPYXA22Ap2f0OC91cZwafYhZXC_WPz-WqA0vUX7spxib1ZkKX9yfWvBn9WWPXEXEAkeZ41FtRjz91VgHQn5RmPWEoWmYQ05VvIIiA2fsjfQvHr

2. Edit the Mermaid code if needed
3. Click **Actions → Export as SVG** or **Export as PNG**
4. Import the exported file into Lucidchart (File → Import)

## Option 3: Recreate manually in Lucidchart

Use the 3-layer structure below. Each layer is a Lucidchart container/swimlane.

### Layer 1: Experience API (top — blue)
- One main box: "Clinical Intelligence Agent (AI SDK + Claude Sonnet 4.6)"
- 9 tool boxes underneath: listAllPatients, getPatientConditions, searchConditions, getPatientLabs, searchLabResults, getPatientMedications, getPatientAllergies, identifyCareGaps, discoverFhirServer
- All tools connect down to Process layer

### Layer 2: Process API (middle — green)
- Title: "Clinical Data Federation"
- 4 process boxes: Scatter-Gather, Data Normalization (SNOMED→ICD-10), Patient ID Registry, Care Gap Detection
- Connected left-to-right as a flow

### Layer 3: System API (bottom — orange)
- Two sub-containers: "CareStack System API" and "Meditab System API"
- Each contains 6 resource boxes: Patient, Condition, Observation, MedicationRequest, AllergyIntolerance, CapabilityStatement
- Each system API connects down to its FHIR server

### Layer 4: EHR Systems (basement — gray)
- Two boxes: "CareStack FHIR Server (SMART on FHIR R4)" and "Meditab FHIR Server (SMART on FHIR R4)"

## Diagram Source

The Mermaid source code is in the repo at:
- SVG: `docs/architecture-diagram.svg`
- Source: embedded in the Mermaid.ai URL above

## MuleSoft Color Mapping

| Layer | MuleSoft Role | Hex Color |
|-------|--------------|-----------|
| Experience | Agent/Agentforce Actions | #00A1DF (MuleSoft Blue) |
| Process | API Orchestration | #10B981 (Green) |
| System | FHIR Endpoint Wrappers | #F97316 (Orange) |
| EHR | External Systems | #64748B (Neutral) |
