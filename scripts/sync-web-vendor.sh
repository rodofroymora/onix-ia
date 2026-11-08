#!/usr/bin/env bash
# Copia packages/* → apps/web/vendor/* para que `npm install` funcione en publish.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm --filter @onix/engine --filter @onix/templates --filter @onix/ui --filter @onix/agent --filter @onix/db build

mkdir -p apps/web/vendor
for pkg in engine templates ui agent db; do
  rm -rf "apps/web/vendor/$pkg"
  mkdir -p "apps/web/vendor/$pkg"
  tar -C "packages/$pkg" \
    --exclude=node_modules \
    --exclude=.turbo \
    --exclude=tests \
    -cf - . | tar -C "apps/web/vendor/$pkg" -xf -
done

python3 - <<'PY'
import json
from pathlib import Path
p = Path("apps/web/vendor/db/package.json")
data = json.loads(p.read_text())
deps = data.get("dependencies", {})
for k, v in list(deps.items()):
    if v == "workspace:*":
        deps[k] = f"file:../{k.split('/')[-1]}"
data["dependencies"] = deps
p.write_text(json.dumps(data, indent=2) + "\n")
PY

# vendor/*/tsconfig.json extiende ../../tsconfig.base.json, que resuelve a apps/web/tsconfig.base.json
cp tsconfig.base.json apps/web/tsconfig.base.json

echo "Vendor sync OK → apps/web/vendor"
