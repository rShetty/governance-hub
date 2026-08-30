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

- [x] Unified actor detail model linking Argus, Hive, and Patroclus IDs (`GET /api/bff/actors` unified DTO; Agents view shows Hive/Argus/Patroclus IDs; selectors use Hive IDs, emergency actions use Patroclus IDs — proven by `tests/e2e/identity-correlation.spec.js`).
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

- [x] Resource list/create/detail management (list, create dialog, and detail dialog via `GET /api/bff/access/resources/{id}`).
- [x] Policy create/read/edit/delete management (create wizard, inspect details, and confirmed delete dialog via `DELETE /api/bff/policies/{id}`).
- [x] Approval queue approve/deny actions (approve and deny dialogs with recorded reason and operator attribution).
- [x] Delegation issuance and grant revocation.
- [x] Session inspector with trajectory and constraints (session detail renders a step-by-step trajectory timeline plus scope/quota/budget/expiry constraints).
- [x] Session kill action.
- [x] Token revocation action.
- [x] Policy simulator: draft YAML preview plus authenticated Patroclus check-access against the live policy engine (`POST /api/bff/access/check-access`; wizard shows both decisions).
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
- [x] Normalizers for all eight sources (Patroclus, Miser, Hive, Sentiel, Aegis, Argus, Forge, Relay — each source is canonicalized independently in `activity_feed`, so one degraded backend no longer hides the others).
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

## Migration Status

Governance Hub operator flows are implemented and proven by the local UI
Playwright suite (zero failures, zero skipped). Completed and proven phases:
identity lifecycle and cross-service actor correlation, access operations
(policies, resources, approvals, delegations, sessions, tokens, authenticated
check-access), unified catalog and tool execution, supply chain trust, cost
administration, unified activity, risk and compliance, and backend UI
retirement.

Remaining work before final delivery:
- Verify the production cutover deploy runs land green and spot-check that
  the tailnet-only vhosts are enforced on the VPS (they are installed
  automatically by each service's deploy workflow, gated on `nginx -t`).

Completed since the previous status:
- Production cutover artifacts and automation shipped across all backend
  repos: tailnet-only nginx vhosts committed in hive, relay, patroclus,
  sentiel, argus, forge, and Aegis, and every deploy workflow now installs
  its vhost (`/etc/nginx/sites-available/<svc>.conf`) with an `nginx -t`
  gate before reload, so API/health routes stay up even if a cert is not
  yet provisioned. The deploy runs for hive, patroclus, sentiel, Aegis,
  and argus completed successfully.
- Real-service smoke tests pass locally: all 7 backends plus Miser healthy
  and `npm run test:services` green (9/9).
- Dependency hardening triggered by the cutover runs: relay pins `mcp<2`
  (2.x removed `mcp.server.fastmcp`) with the corresponding test-fake fix,
  and forge bumps `h2` to 0.4.19 (RUSTSEC-2026-0258).
- Modal-based UX is complete for Egress, Cost, Supply Chain, Orchestration,
  Services, and the Security containment flow (shared Modal, PromptDialog,
  WizardModal, and ConfirmDialog components; native confirm()/prompt()/alert()
  calls removed from operator flows).
- Pagination covers Access policies/sessions/resources/approvals, Agents,
  Identities, Cost keys, Supply Chain packages/publishers, Egress
  logs/policies, Orchestration teams/workflows, and Agents delegations. The
  global mobile-hide rule for `table.data` was replaced with a scoped
  `:has(~ .mobile-data-list)` rule so tables without a mobile card view stay
  visible on small screens.

The Production Cutover Checklist below lists operational deployment changes on
individual services; these are infrastructure configuration changes, not
missing Governance Hub functionality.

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
| All | Ensure production admin tokens are set, insecure development flags (`*_INSECURE_DEV=1`) are unset, and docs/metrics are not publicly exposed. Verified: no deploy unit or env template in any repo sets an insecure flag; the flags are opt-in code paths used only by local dev scripts. |

## Phase 9 Inventory

| Service | Frontend-only capabilities found | Cutover |
|---|---|---|
| Hive | Marketplace, agent detail, skills, tasks, teams, workflows, MCP page | Agent/skills/MCP flows ported; teams and workflows created and listed from the Hub Orchestration view (proven by `tests/e2e/orchestration-vault.spec.js`) |
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
