set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

port := "3131"
api_port := "3132"
pidfile := ".varatlas.pid"
logfile := ".varatlas.log"

default:
    @just --list

# Start varatlas in the background (dev mode)
on:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f {{pidfile}} ] && kill -0 "$(cat {{pidfile}})" 2>/dev/null; then
        echo "varatlas already running (pid $(cat {{pidfile}})) → http://localhost:{{port}}"
        exit 0
    fi
    [ -d node_modules ] || pnpm install
    nohup pnpm dev > {{logfile}} 2>&1 &
    echo $! > {{pidfile}}
    echo "varatlas on → http://localhost:{{port}}  (pid $(cat {{pidfile}}), logs: just logs)"

# Stop varatlas
off:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -f {{pidfile}} ]; then
        pid="$(cat {{pidfile}})"
        pkill -P "$pid" 2>/dev/null || true
        kill "$pid" 2>/dev/null || true
        rm -f {{pidfile}}
    fi
    # sweep anything still bound to the UI or API port
    lsof -ti tcp:{{port}},{{api_port}} | xargs kill 2>/dev/null || true
    echo "varatlas off"

# Restart
restart: off on

# Is it running?
status:
    #!/usr/bin/env bash
    if [ -f {{pidfile}} ] && kill -0 "$(cat {{pidfile}})" 2>/dev/null; then
        echo "running (pid $(cat {{pidfile}})) → http://localhost:{{port}}"
    else
        echo "stopped"
    fi

# Tail the server log
logs:
    tail -f {{logfile}}

# Run in foreground (dev)
dev:
    pnpm dev

# Production build + start (foreground)
prod:
    pnpm build && pnpm start

# Build the container image locally (published images: ghcr.io/scenr-io/varatlas)
image:
    docker build -t varatlas:local .

# Run the container image on localhost (uses GITLAB_TOKEN from your shell, if set)
container:
    docker run --rm -p 127.0.0.1:{{port}}:3131 -e GITLAB_TOKEN varatlas:local

# Everything CI checks: formatting, lint, types, tests with coverage, dead code
check:
    pnpm check

# Format all files
format:
    pnpm format

# Unit, component and integration tests
test:
    pnpm test

# Browser tests against a production build in demo mode
e2e:
    pnpm build && pnpm test:e2e
