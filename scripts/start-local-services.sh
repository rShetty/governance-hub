#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}"
LOG_DIR="/tmp/governance-services"
mkdir -p "$LOG_DIR"

start() {
  local name="$1" port="$2" health="$3"; shift 3
  if curl -fsS --max-time 1 "http://127.0.0.1:${port}${health}" >/dev/null 2>&1; then
    echo "${name}: already running"
    return
  fi
  echo "starting ${name}..."
  nohup "$@" >"${LOG_DIR}/${name}.log" 2>&1 &
  echo $! >"/tmp/${name}.pid"
}

wait_for() {
  local name="$1" port="$2" health="$3"
  for _ in $(seq 1 30); do
    curl -fsS --max-time 1 "http://127.0.0.1:${port}${health}" >/dev/null 2>&1 && { echo "${name}: ready"; return; }
    sleep 1
  done
  echo "${name}: failed to become ready (${LOG_DIR}/${name}.log)" >&2
  exit 1
}

start forge 18788 /health "$ROOT/forge/target/release/forge" serve --config "$ROOT/governance-hub/tests/fixtures/forge.toml"
start sentiel 8585 /health env SENTIEL_INSECURE_DEV=1 sh -lc "cd '$ROOT/sentiel' && exec '$ROOT/sentiel/target/release/sentiel' serve"
start aegis 8686 /health env AEGIS_INSECURE_DEV=1 sh -lc "mkdir -p /tmp/governance-services; sed 's#path = \"/var/lib/aegis/aegis.db\"#path = \"/tmp/governance-services/aegis.db\"#' '$ROOT/Aegis/config/aegis.toml' > /tmp/governance-services/aegis-runtime.toml; cd '$ROOT/Aegis' && exec '$ROOT/Aegis/target/release/aegis' serve --config /tmp/governance-services/aegis-runtime.toml"
start miser 8787 /health/live sh -lc "cd '$ROOT/miser' && exec '$ROOT/miser/target/release/miser-gateway'"
start patroclus 8484 /health env PATROCLUS_INSECURE_DEV=1 sh -lc "cd '$ROOT/patroclus' && exec '$ROOT/patroclus/target/release/patroclus' serve --config config.toml"
start argus 8443 /health sh -lc "mkdir -p /tmp/governance-services; sed 's#/var/lib/argus/argus.db#/tmp/governance-services/argus.db#' '$ROOT/argus/argus.toml.example' > /tmp/governance-services/argus-runtime.toml; cd '$ROOT/argus' && exec '$ROOT/argus/target/release/argus' /tmp/governance-services/argus-runtime.toml"

for spec in \
  forge:18788:/health \
  sentiel:8585:/health \
  aegis:8686:/health \
  miser:8787:/health/live \
  patroclus:8484:/health \
  argus:8443:/health; do
  IFS=: read -r name port health <<<"$spec"
  wait_for "$name" "$port" "$health"
done

if [ ! -d "$ROOT/relay/.venv" ]; then
  echo "relay virtualenv missing: $ROOT/relay/.venv" >&2
  exit 1
fi

RELAY_PYTHON="$ROOT/relay/.venv/bin/python"
if "$RELAY_PYTHON" --version 2>&1 | grep -q 'Python 3.14'; then
  echo "relay Python 3.14 is incompatible; trying python3.12..." >&2
  if command -v python3.12 >/dev/null 2>&1; then
    RELAY_PYTHON=$(command -v python3.12)
    if [ ! -d "$ROOT/relay/.venv312" ]; then
      "$RELAY_PYTHON" -m venv "$ROOT/relay/.venv312"
      "$ROOT/relay/.venv312/bin/pip" install -e "$ROOT/relay[dev]" >/dev/null
    fi
    RELAY_PYTHON="$ROOT/relay/.venv312/bin/python"
  else
    echo "python3.12 required to run Relay locally on this machine" >&2
    exit 1
  fi
fi

if ! curl -fsS --max-time 1 http://127.0.0.1:8090/health >/dev/null 2>&1; then
  (
    cd "$ROOT/relay"
    RELAY_SERVER__PORT=8090 \
    PATROCLUS_ENABLED=true \
    PATROCLUS_URL=http://127.0.0.1:8484 \
    RELAY_ALLOW_DEFAULT_SECRET=1 \
    OAUTH__JWT_SECRET_KEY=relay-dev-secret \
    exec "$RELAY_PYTHON" -m gateway.server http
  ) >"$LOG_DIR/relay.log" 2>&1 &
  echo $! >/tmp/relay.pid
fi

for _ in $(seq 1 30); do
  curl -fsS --max-time 1 http://127.0.0.1:8090/health >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 2 http://127.0.0.1:8090/health >/dev/null || { echo "relay failed ($LOG_DIR/relay.log)" >&2; exit 1; }

if [ -x "$ROOT/hive/backend/.venv/bin/uvicorn" ]; then
  UVICORN="$ROOT/hive/backend/.venv/bin/uvicorn"
else
  UVICORN="uvicorn"
fi

if ! curl -fsS --max-time 1 http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  (cd "$ROOT/hive/backend" && exec "$UVICORN" main:app --host 127.0.0.1 --port 8000) >"$LOG_DIR/hive.log" 2>&1 &
  echo $! >/tmp/hive.pid
fi

for _ in $(seq 1 30); do
  curl -fsS --max-time 1 http://127.0.0.1:8000/api/health >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 2 http://127.0.0.1:8000/api/health >/dev/null || { echo "hive failed ($LOG_DIR/hive.log)" >&2; exit 1; }

echo "all services ready"
