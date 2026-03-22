# Healthcare Agent Demo — CloudHub 2.0 Deployment Governance

**Last updated:** 2026-03-21
**Owner:** Michael Busacca
**Environment:** Sandbox (Cloudhub-US-East-2)

---

## Architecture Overview

4 Mule apps deployed to CloudHub 2.0 Shared Space, following 3-layer API-led architecture:

| Layer | App | Port | vCores | Connectors |
|-------|-----|------|--------|------------|
| Experience | agent-tools-exp-api | 8081 | 0.1 | HTTP, APIKit, MCP v1.3.1 |
| Process | clinical-federation-prc-api | 8081 | 0.1 | HTTP |
| System | carestack-fhir-sys-api | 8081 | 0.1 | HTTP |
| System | meditab-fhir-sys-api | 8081 | 0.1 | HTTP |

**Total vCore usage:** 0.4

---

## Lessons Learned (2026-03-21 Deploy Session)

### 1. CloudHub 2.0 Only Exposes Port 8081

**Problem:** config.properties had `http.port=8084` and `mcp.port=8085`. App crash-looped with Exit code 1, Restart count 6.

**Root cause:** CloudHub 2.0 only exposes port 8081 to the public endpoint. Any other port causes the app to start but remain unreachable, eventually getting killed by the health check.

**Fix:** Set `http.port=8081` in config.properties. MCP and HTTP listeners must share the same port on CloudHub.

**Rule:** ALL Mule apps targeting CloudHub 2.0 MUST use `http.port=8081`. No exceptions. Local development can use any port — override via system property `-Dhttp.port=8084`.

### 2. Never Use Self-Referencing Property Placeholders

**Problem:** Changed config to `http.port=${http.port}` thinking CloudHub would override it. This created a circular reference — Mule tried to resolve `${http.port}` from config.properties, found `${http.port}`, infinite loop.

**Root cause:** Mule property resolution reads config.properties first. A property cannot reference itself.

**Fix:** Hardcode `http.port=8081` for CloudHub. Use CloudHub Properties tab only for values that differ between environments (API keys, hostnames).

**Rule:** NEVER write `property.name=${property.name}` in config.properties. It's a circular reference.

### 3. MCP and HTTP Listeners Share a Single Port on CloudHub

**Problem:** Originally designed with separate ports — HTTP on 8084, MCP on 8085. CloudHub only exposes one port.

**Fix:** Both MCP Server and HTTP Listener use the same `HTTP_Listener_config` on port 8081. The MCP endpoint lives at `/mcp` on the same listener.

**Rule:** On CloudHub 2.0, all inbound listeners MUST share port 8081. Design flows with path-based routing, not port-based.

### 4. Rapid Delete/Redeploy Cycles Corrupt Cluster State

**Problem:** Multiple rapid delete → redeploy → resize → delete cycles caused orphaned Kubernetes pods, stale replicas, and a `MountVolume.SetUp failed for volume "mulelicense"` error.

**Root cause:** CloudHub 2.0's Kubernetes orchestrator needs time to clean up terminated pods and release secrets. Rapid cycling creates race conditions.

**Fix:** After deleting an app, wait at least 2 minutes before redeploying. If you see license mount errors, wait 5+ minutes.

**Rule:** After deleting a CloudHub 2.0 app, wait a MINIMUM of 2 minutes before redeploying the same app name. If infrastructure errors appear, wait 10 minutes.

### 5. Anypoint Studio Import Uses "Anypoint Studio project from File System"

**Problem:** No Maven import wizard in Anypoint Studio's Import dialog.

**Fix:** File → Import → Anypoint Studio → "Anypoint Studio project from File System" → browse to project root containing pom.xml.

**Rule:** To import a Maven-based Mule project into Anypoint Studio, use "Anypoint Studio project from File System" — not a Maven-specific wizard.

### 6. Finder Navigation for Hidden Directories

**Problem:** `~/repos/` not visible in Finder's default view.

**Fix:** In any Finder/file dialog, press `Cmd + Shift + G` and paste the full path (e.g., `/Users/mbusacca/repos/healthcare-agent-demo/mulesoft/agent-tools-exp-api`).

**Rule:** Always use `Cmd + Shift + G` (Go to Folder) when navigating to paths outside Desktop/Documents/Downloads.

### 7. vCore Allocation Awareness

**Problem:** Bumped agent-tools-exp-api to 0.5 vCores while 3 other apps were running at 0.1 each. Total 0.8 vCores may have exceeded Sandbox allocation.

**Fix:** Keep all apps at 0.1 vCores in Sandbox. The MCP Connector works on 0.1 — the crash was caused by the port misconfiguration, not memory.

**Rule:** Monitor total vCore usage. Sandbox allocations are limited. Check current usage before resizing: `list_applications` shows all running apps.

---

## Deployment Checklist

Before deploying ANY Mule app to CloudHub 2.0:

- [ ] `http.port=8081` in config.properties (not 8084, not `${http.port}`)
- [ ] All listeners use port 8081 (HTTP + MCP share the same listener)
- [ ] `mvn clean package -DskipTests` succeeds locally
- [ ] No circular property references in config.properties
- [ ] Total vCore usage across all Sandbox apps stays within allocation
- [ ] If redeploying after a delete, wait 2+ minutes
- [ ] Outbound hosts point to correct CloudHub URLs (check `.5sc6y6-X.usa-e2.cloudhub.io` suffixes)

## Deploy Commands (CLI)

```bash
# Build
cd ~/repos/healthcare-agent-demo/mulesoft/agent-tools-exp-api
mvn clean package -DskipTests

# Deploy (via MCP tool)
# deploy_mule_application(appName="agent-tools-exp-api", projectPath="...", environmentName="Sandbox")

# Check status
# list_applications(environmentName="Sandbox", appName="agent-tools-exp-api")
```

## App Endpoints

| App | Public URL |
|-----|-----------|
| agent-tools-exp-api | https://agent-tools-exp-api-sewtob.5sc6y6-1.usa-e2.cloudhub.io |
| carestack-fhir-sys-api | https://carestack-fhir-sys-api-sewtob.5sc6y6-1.usa-e2.cloudhub.io |
| clinical-federation-prc-api | https://clinical-federation-prc-api-sewtob.5sc6y6-4.usa-e2.cloudhub.io |
| meditab-fhir-sys-api | https://meditab-fhir-sys-api-sewtob.5sc6y6-1.usa-e2.cloudhub.io |

## Config Properties Reference

```properties
# MANDATORY for CloudHub 2.0
http.port=8081
mcp.port=8081

# Downstream Process API
prcapi.clinical.host=clinical-federation-prc-api-sewtob.5sc6y6-4.usa-e2.cloudhub.io
prcapi.clinical.port=443
prcapi.clinical.protocol=HTTPS
prcapi.clinical.basePath=/api/v1/clinical
```
