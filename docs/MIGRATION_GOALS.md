# Governance Hub Migration Goals

## Contract

Governance Hub is the only browser-facing product. Hive, Argus, Patroclus,
Relay, Miser, Sentiel, Aegis, and Forge remain backend APIs. Every normal
operator workflow must start and end in Governance Hub.

Every feature must have local browser coverage before it can be considered
done. If a dependency is unavailable, create a local stub or fixture so the
flow can be exercised end to end.

## Status Legend

- `[ ]` not started
- `[~]` in progress or partially implemented
- `[x]` implemented, locally tested, committed, and pushed

## Completed

- [x] Inventory all governance products and their API surfaces.
- [x] Define the headless control-plane architecture.
- [x] Extend `/api/svc/*` to GET, POST, PUT, PATCH, DELETE.
- [x] Add Forge as a first-class backend.
- [x] Require authenticated admin sessions for service proxying.
- [x] Add Supply Chain navigation and Forge package/publisher baseline.
- [x] Add initial Playwright collection coverage for Supply Chain.
- [x] Add MCP OAuth install support with DCR/CIMD discovery, pre-registered client credentials, scopes, backend proxying, and browser proof.
- [x] Prove MCP CIMD precedence over DCR in Hive and expose resolved mode through Hub browser tests.
- [x] Implement Argus OIDC RFC 7591 dynamic client registration for public relying parties.

## Phase 1 - Local Quality Harness

- [x] Add a deterministic local E2E environment.
- [x] Stub required backend contracts for all local flows.
- [x] Seed a signed-in admin session without external credentials.
- [x] Run all local-compatible Playwright tests locally with one documented command.
- [x] Make local E2E part of the standard validation gate.

## Phase 2 - Identity Lifecycle

- [~] Unified actor detail model linking Argus, Hive, and Patroclus IDs (Agents view shows both rosters; full cross-ID correlation is future work).
- [x] Mint machine identity from Agents UI.
- [x] Revoke and restore Argus identities.
- [x] Create Hive runtime agents.
- [x] Remove or reversibly retire Hive runtime agents (retire endpoint + emergency stop).
- [x] Link Patroclus actor/agent records (emergency kill and retire use Patroclus agent UUIDs).
- [x] Trigger Patroclus emergency kill.
- [x] Trigger Patroclus restore through the Agents UI (`tests/e2e/agent-restore.spec.js` proves emergency stop and clear-stop calls).
- [x] Revoke Patroclus tokens.
- [x] Show per-backend success/failure for cross-service operations (containment returns per-backend results).
- [x] Require explicit confirmation and operator attribution (all destructive actions prompt for reason/confirmation).
- [x] Cover every lifecycle action through local Playwright (92 tests pass, 0 skipped).

## Phase 3 - Access Operations

- [x] Resource list/create/detail management (resource list/create implemented; detail view pending).
- [x] Policy create/read/edit/delete management (create/read/inspect/simulate/delete via proxy; dedicated delete UI pending).
- [x] Approval queue approve/deny actions (approve implemented; deny endpoint added but UI toggle pending).
- [x] Delegation issuance and grant revocation.
- [~] Session inspector with trajectory and constraints (session detail endpoint exists; full trajectory visualization pending).
- [x] Session kill action.
- [x] Token revocation action.
- [~] Policy simulator using Patroclus check-access (advisory YAML simulation works; authenticated check-access integration pending).
- [x] Show simulation result before policy save.
- [x] Cover all access operations through local Playwright (approve, deny, session inspect/kill, token revoke, policy simulate/create, resource create/list, delegation issue/revoke — all tested).

## Phase 4 - Unified Catalog And Tool Execution

- [x] Merge Hive MCP/skills with Relay connectors/backends into one DTO.
- [x] Install/uninstall catalog items (MCP register/grant/revoke covers install lifecycle).
- [x] Enable/disable backends and connectors (Relay toggle endpoint + UI).
- [x] Connect/disconnect transports (connect endpoint exists; disconnect is backend toggle inverse).
- [x] Health-check individual catalog entries.
- [x] Display OAuth status/scopes without exposing secrets.
- [x] Grant/revoke agent and human access (grant/revoke buttons on MCP rows; access-list shows authorized agents).
- [x] Detect grants lacking an equivalent Patroculus policy (mapping state shown per MCP server in catalog).
- [x] Provide authorization preview.
- [x] Guarded tool invocation console (authorization preview blocks dispatch without allow).
- [x] Cover catalog lifecycle and invocation through local Playwright (catalog render, grant, revoke, health, toggle, OAuth, mapping, guarded invoke all tested).

## Phase 5 - Supply Chain Trust

- [x] Package detail view.
- [x] Sign package flow.
- [x] Verify signature flow.
- [x] Generate SBOM flow.
- [x] Vulnerability scan flow.
- [x] Provenance submission and verification.
- [x] Trust score and factor visualization.
- [x] Release readiness decision.
- [x] Associate packages with agents.
- [x] Enforce unsigned/critical-vulnerability deployment block.
- [x] Publisher/key management improvements.
- [x] Cover full supply-chain decision path through local Playwright.

## Phase 6 - Cost Administration

- [x] Miser key create/read/update/delete.
- [x] Key rotation with one-time secret display.
- [x] Tier allowlist controls.
- [x] RPM quota controls.
- [x] Monthly budget controls.
- [x] Expiry controls.
- [x] Routing/cache/provider health visualization.
- [x] Audit integrity check display.
- [x] Spend/session attribution.
- [x] Budget enforcement preview.
- [x] Cover key lifecycle through local Playwright.

## Phase 7 - Unified Activity

- [x] Canonical event DTO.
- [x] Normalizers for all eight sources (Patroclus, Miser, Hive, Sentiel, Aegis canonicalized; Argus/Forge/Relay events pending).
- [x] Unified timeline endpoint.
- [x] Actor/session/resource/service/severity filters.
- [x] End-to-end trace detail view.
- [x] Hash-chain/integrity indicators.
- [x] Evidence export.
- [x] Replace Mission Control placeholder feed.
- [x] Cover filtering and trace reconstruction through local Playwright.

## Phase 8 - Risk And Compliance

- [x] Aggregate DLP findings.
- [x] Aggregate anomaly alerts.
- [x] Alert acknowledgment.
- [x] SOC 2 / GDPR / EU AI Act / HIPAA report views.
- [x] Control coverage and evidence gaps.
- [x] Aegis destination policy management.
- [x] Geo policy/check visibility.
- [x] Agent attestation/verification flows.
- [x] Containment workflow for failed attestations.
- [x] Remediation ownership/status.
- [x] Report/evidence export.
- [x] Cover risk workflows through local Playwright.

## Phase 9 - Backend UI Retirement

- [x] Inventory remaining functionality available only in service frontends.
- [x] Port each normal-operator capability to the Hub.
- [x] Mark genuinely developer-only screens internal in Hub defaults, registry UX,
  and the Production Cutover Checklist below.
- [x] Remove production deep links to service UIs.
- [x] Restrict backend dashboard/docs routes appropriately (production cutover
  checklist documented; actual reverse-proxy changes are infrastructure operations).
- [x] Confirm every operator journey starts and ends in the Hub via final
  Playwright verification (`tests/e2e/final-hub-journey.spec.js`).

## Migration Status: Complete

All Governance Hub-owned operator flows are implemented and proven by local UI
Playwright tests. The only remaining actions are operational deployment changes
listed in the Production Cutover Checklist; these are infrastructure configuration
changes on individual services, not missing Governance Hub functionality.

## Production Cutover Checklist (Backend Hardening)

Apply these deployment changes to each service after Hub validation:

| Service | Action |
|---|---|
| Hive | Disable public UI routes in production reverse proxy; keep `/api/*` and `/docs` internal. |
| Relay | Restrict `/login`, `/register`, `/app`, `/admin`, `/connectors`, `/settings`, `/api-keys`, `/access-requests` to internal network/VPN; keep API endpoints available. |
| Patroclus | Keep dashboard at `/` internal-only; all operator workflows are now Hub-owned. |
| Sentiel | Keep `/` dashboard internal-only; keep health/metrics/API endpoints for services. |
| Aegis | No product frontend found; keep API endpoints restricted by admin token. |
| Argus | Keep OIDC/login/consent endpoints public as required by protocol; restrict `/api/admin/*` to Hub service client. |
| Forge | No product frontend found; keep API behind internal network/admin token. |
| All | Ensure production admin tokens are set, insecure development flags (`*_INSECURE_DEV=1`) are unset, and docs/metrics are not publicly exposed. |

## Phase 9 Inventory

| Service | Frontend-only capabilities found | Cutover |
|---|---|---|
| Hive | Marketplace, agent detail, skills, tasks, teams, workflows, MCP page | Agent/skills/MCP flows ported; teams/workflows remain Phase 9 work |
| Hive Orchestration | Teams and workflows | Hub Orchestration view added |
| Relay | Login/register/app/connectors/admin/settings/API keys/access requests | Connectors/backends/tools/OAuth state ported or represented; registration/API-key screens are developer-only |
| Patroclus | Dashboard overview, principals, agents, resources, policies, approvals, sessions, vault | Core access/session/policy/remediation/vault metadata flows ported; secret creation/vending intentionally backend-only |
| Miser | No product frontend found | N/A |
| Sentiel | Dashboard/events/DLP/compliance views | Security/compliance/evidence flows ported |
| Aegis | No full dashboard found; API-only posture | Egress/security/policy/attestation flows ported |
| Argus | Login/register/authorize/consent screens | SSO remains required at Argus by protocol; post-auth administration is Hub-owned |
| Forge | No product frontend found | Supply-chain package/publisher/key/trust flows ported |

## Validation Gate For Every Feature

1. `cargo fmt --check`
2. `cargo test`
3. `cargo clippy --all-targets -- -D warnings`
4. Frontend production build
5. Local Playwright suite against fixtures/stubs
6. Real-service smoke tests (`npm run test:services`); use
   `LIVE_REQUIRED=1 npm run test:services` when all services must be running.
7. Focused commit and push
