#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/module/lib/atomic-file.sh"
tmpdir="$ROOT/tests/.atomic-file-test.$$"
mkdir "$tmpdir"
trap 'rm -rf "$tmpdir"' EXIT

target="$tmpdir/config.json"
staged="$tmpdir/config.new"
backup="$tmpdir/config.json.bak"
printf 'old\n' > "$target"
printf 'new\n' > "$staged"

atomic_replace_file "$target" "$staged" "$backup"
[[ "$(cat "$target")" == new ]]
[[ "$(cat "$backup")" == old ]]
[[ ! -e "$target.tmp.$$" ]]

printf 'later\n' > "$staged"
if atomic_replace_file "$target" "$staged" "$tmpdir/missing/config.bak"; then
    echo 'backup failure unexpectedly replaced the target' >&2
    exit 1
fi
[[ "$(cat "$target")" == new ]]
[[ ! -e "$target.tmp.$$" ]]

: > "$staged"
if atomic_replace_file "$target" "$staged" "$backup"; then
    echo 'empty staged content unexpectedly replaced the target' >&2
    exit 1
fi
[[ "$(cat "$target")" == new ]]
