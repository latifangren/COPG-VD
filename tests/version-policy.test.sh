#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/module/lib/version-policy.sh"
tmpdir="$ROOT/tests/.version-policy-test.$$"
mkdir "$tmpdir"
trap 'rm -rf "$tmpdir"' EXIT
rom_props="$tmpdir/build.prop"
cat > "$rom_props" <<'EOF'
ro.build.version.release=16
ro.build.version.codename=REL
ro.build.version.sdk=35
EOF

! copgvd_version_allowed never SDK_INT 34 "$rom_props"
copgvd_version_allowed force SDK_INT 40 "$rom_props"
copgvd_version_allowed rom SDK_INT 34 "$rom_props"
! copgvd_version_allowed rom SDK_INT 36 "$rom_props"
! copgvd_version_allowed rom SDK_INT invalid "$rom_props"
copgvd_version_allowed rom ANDROID_VERSION 16 "$rom_props"
! copgvd_version_allowed rom ANDROID_VERSION 15 "$rom_props"
copgvd_version_allowed rom CODENAME REL "$rom_props"
copgvd_version_allowed rom SDK_FULL 35.2 "$rom_props"
! copgvd_version_allowed rom SDK_FULL 36.0 "$rom_props"
! copgvd_version_allowed rom unknown x "$rom_props"
[[ "$(release_or_codename REL 16)" == 16 ]]
[[ "$(release_or_codename beta 17)" == beta ]]
[[ "$(release_or_codename '' 18)" == 18 ]]
