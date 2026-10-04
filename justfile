set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

port := "3131"
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
    # sweep anything still bound to the port
    lsof -ti tcp:{{port}} | xargs kill 2>/dev/null || true
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

# Lint, typecheck and test
check:
    pnpm check
