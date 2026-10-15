#!/system/bin/sh

ATOMIC_WRITE_TMP=""

atomic_replace_file() {
    atomic_target="$1"
    atomic_staged="$2"
    atomic_backup="$3"
    [ -f "$atomic_target" ] && [ -s "$atomic_staged" ] || return 1

    ATOMIC_WRITE_TMP="${atomic_target}.tmp.$$"
    [ ! -e "$ATOMIC_WRITE_TMP" ] || { ATOMIC_WRITE_TMP=""; return 1; }
    cp -p "$atomic_target" "$ATOMIC_WRITE_TMP" || {
        rm -f "$ATOMIC_WRITE_TMP"
        ATOMIC_WRITE_TMP=""
        return 1
    }
    cat "$atomic_staged" > "$ATOMIC_WRITE_TMP" || {
        rm -f "$ATOMIC_WRITE_TMP"
        ATOMIC_WRITE_TMP=""
        return 1
    }
    [ -s "$ATOMIC_WRITE_TMP" ] || {
        rm -f "$ATOMIC_WRITE_TMP"
        ATOMIC_WRITE_TMP=""
        return 1
    }
    cp -p "$atomic_target" "$atomic_backup" 2>/dev/null || {
        rm -f "$ATOMIC_WRITE_TMP"
        ATOMIC_WRITE_TMP=""
        return 1
    }
    chmod 0644 "$ATOMIC_WRITE_TMP" 2>/dev/null || {
        rm -f "$ATOMIC_WRITE_TMP"
        ATOMIC_WRITE_TMP=""
        return 1
    }
    chcon u:object_r:system_file:s0 "$ATOMIC_WRITE_TMP" 2>/dev/null || :
    mv -f "$ATOMIC_WRITE_TMP" "$atomic_target" || {
        rm -f "$ATOMIC_WRITE_TMP"
        ATOMIC_WRITE_TMP=""
        return 1
    }
    ATOMIC_WRITE_TMP=""
    return 0
}
