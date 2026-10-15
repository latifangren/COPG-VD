#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/module/lib/config-json.sh"
tmpdir="$ROOT/tests/.active-config-test.$$"
mkdir "$tmpdir"
trap 'rm -rf "$tmpdir"' EXIT
config="$tmpdir/config.json"
cat > "$config" <<'EOF'
{
  "COPG-VD-Profiles": {
    "custom:other": {
      "DEVICE": "wrong-device",
      "MODEL": "Wrong model"
    }
  },
  "COPG-VD-ActiveProfile": "custom:selected",
  "COPG-VD": {
    "DEVICE": "selected-device",
    "MODEL": "Selected model",
    "FINGERPRINT": "selected/fingerprint"
  },
  "COPG-VD-Settings": {
    "DEVICE": "settings-value"
  }
}
EOF
[[ "$(copgvd_json_active_value "$config" DEVICE)" == selected-device ]]
[[ "$(copgvd_json_active_value "$config" MODEL)" == 'Selected model' ]]
[[ "$(copgvd_json_active_value "$config" FINGERPRINT)" == selected/fingerprint ]]
[[ -z "$(copgvd_json_active_value "$config" MISSING)" ]]
