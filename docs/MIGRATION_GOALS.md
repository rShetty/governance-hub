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

## Phase 1 - Local Quality Harness

- [x] Add a deterministic local E2E environment.
- [x] Stub required backend contracts for all local flows.
- [x] Seed a signed-in admin session without external credentials.
- [x] Run all local-compatible Playwright tests locally with one documented command.
- [x] Make local E2E part of the standard validation gate.

## Phase 2 - Identity Lifecycle

- [~] Unified actor detail model linking Argus, Hive, and Patroclus IDs.
- [x] Mint machine identity from Agents UI.
- [x] Revoke and restore Argus identities.
- [x] Create Hive runtime agents.
- [ ] Remove or reversibly retire Hive runtime agents.
- [ ] Link Patroclus actor/agent records.
- [x] Trigger Patroclus emergency kill.
- [ ] Trigger Patroclus restore (requires explicit backend safety approval).
- [x] Revoke Patroclus tokens.
- [ ] Show per-backend success/failure for cross-service operations.
- [ ] Require explicit confirmation and operator attribution.
- [ ] Cover every lifecycle action through local Playwright.

## Phase 3 - Access Operations

- [ ] Resource list/create/detail management.
- [ ] Policy create/read/edit/delete management.
- [ ] Approval queue approve/deny actions.
- [x] Delegation issuance and grant revocation.
- [ ] Session inspector with trajectory and constraints.
- [x] Session kill action.
- [x] Token revocation action.
- [~] Policy simulator using Patroclus check-access.
- [x] Show simulation result before policy save.
- [ ] Cover all access operations through local Playwright.

## Phase 4 - Unified Catalog And Tool Execution

- [~] Merge Hive MCP/skills with Relay connectors/backends into one DTO.
- [ ] Install/uninstall catalog items.
- [~] Enable/disable backends and connectors.
- [ ] Connect/disconnect transports.
- [x] Health-check individual catalog entries.
- [ ] Display OAuth status/scopes without exposing secrets.
- [ ] Grant/revoke agent and human access.
- [~] Detect grants lacking an equivalent Patroculus policy.
- [x] Provide authorization preview.
- [~] Guarded tool invocation console.
- [~] Cover catalog lifecycle and invocation through local Playwright.

## Phase 5 - Supply Chain Trust

- [x] Package detail view.
- [x] Sign package flow.
- [x] Verify signature flow.
- [~] Generate SBOM flow.
- [~] Vulnerability scan flow.
- [~] Provenance submission and verification.
- [~] Trust score and factor visualization.
- [~] Release readiness decision.
- [x] Associate packages with agents.
- [~] Enforce unsigned/critical-vulnerability deployment block.
- [~] Publisher/key management improvements.
- [ ] Cover full supply-chain decision path through local Playwright.

## Phase 6 - Cost Administration

- [~] Miser key create/read/update/delete.
- [~] Key rotation with one-time secret display.
- [ ] Tier allowlist controls.
- [ ] RPM quota controls.
- [ ] Monthly budget controls.
- [ ] Expiry controls.
- [ ] Routing/cache/provider health visualization.
- [ ] Audit integrity check display.
- [ ] Spend/session attribution.
- [x] Budget enforcement preview.
- [~] Cover key lifecycle through local Playwright.

## Phase 7 - Unified Activity

- [x] Canonical event DTO.
- [~] Normalizers for all eight sources.
- [x] Unified timeline endpoint.
- [x] Actor/session/resource/service/severity filters.
- [~] End-to-end trace detail view.
- [~] Hash-chain/integrity indicators.
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
- [~] Port each normal-operator capability to the Hub.
- [ ] Mark genuinely developer-only screens internal.
- [x] Remove production deep links to service UIs.
- [ ] Restrict backend dashboard/docs routes appropriately.
- [ ] Confirm every operator journey starts and ends in the Hub.

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
