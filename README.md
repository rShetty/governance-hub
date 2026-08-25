# Governance Hub

Unified AI governance console for the eight-service backend control plane:

Governance Hub is the only browser-facing product. Hive, Argus, Patroclus,
Relay, Miser, Sentiel, Aegis, and Forge remain backend APIs. All operator
flows — identity, policy, MCP installation, tool invocation, cost, risk,
compliance, supply chain, orchestration, and vault administration — start and
end in the Hub.

| Service | Role |
|---|---|
| **Hive** | Agent runtime & marketplace |
| **Patroclus** | Authorization control plane |
| **Relay** | MCP gateway & tool proxy |
| **Miser** | LLM cost optimization |
| **Sentiel** | Observability, DLP & compliance |
| **Aegis** | Network egress control & attestation |
| **Forge** | Supply chain trust & package signing |
| **Argus** | Human/agent OIDC identity provider |

One responsive dashboard showing live health, latency and deep links into each
service — built as a single fast Rust binary with zero runtime dependencies
beyond the services it monitors.

## Run

```bash
cargo run --release -- /etc/governance-hub/hub.toml
# → http://127.0.0.1:8600
```

Configure service endpoints in `hub.toml` (see sample). Services that are down
render as degraded cards — the board itself stays up.

## Tests

```bash
cargo test
```

Covers: public health endpoint, dashboard render with security headers,
degraded-service reporting, 404s.

## Deploy

See `deploy/` — hardened systemd unit + nginx vhost template with TLS.

## MCP Integration

The Tools view is the single admin surface for the unified capability catalog.

- MCP installs support OAuth 2.0 with **DCR** (dynamic client registration)
  or **CIMD** (pre-registered client credentials). CIMD takes precedence.
- Agent grants are paired with policy-mapping status and guarded invocation.
- Relay exposes stateless JSON MCP transport plus federated search across all
  registered connectors and external MCP servers.
