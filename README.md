# Governance Hub

Unified AI governance console across the six-project governance stack:

| Service | Role |
|---|---|
| **Hive** | Agent runtime & marketplace |
| **Patroclus** | Authorization control plane |
| **Relay** | MCP gateway & tool proxy |
| **Miser** | LLM cost optimization |
| **Sentiel** | Observability, DLP & compliance |
| **Aegis** | Network egress control & attestation |

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
