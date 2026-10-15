#!/system/bin/sh

copgvd_rom_prop() {
    grep -m 1 "^$2=" "$1" 2>/dev/null | cut -d= -f2-
}

release_or_codename() {
    if [ "$1" = "REL" ] || [ -z "$1" ]; then echo "$2"; else echo "$1"; fi
}

copgvd_version_allowed() {
    COPG_VP_POLICY="$1"
    COPG_VP_FIELD="$2"
    COPG_VP_VALUE="$3"
    COPG_VP_ROM_FILE="$4"

    case "$COPG_VP_POLICY" in
        force) return 0 ;;
        never) return 1 ;;
    esac

    case "$COPG_VP_FIELD" in
        SDK_INT)
            COPG_VP_ROM_SDK=$(copgvd_rom_prop "$COPG_VP_ROM_FILE" ro.build.version.sdk)
            case "$COPG_VP_VALUE$COPG_VP_ROM_SDK" in *[!0-9]*) return 1 ;; esac
            [ "$COPG_VP_VALUE" -le "$COPG_VP_ROM_SDK" ] ;;
        ANDROID_VERSION)
            [ "$COPG_VP_VALUE" = "$(copgvd_rom_prop "$COPG_VP_ROM_FILE" ro.build.version.release)" ] ;;
        CODENAME)
            [ "$COPG_VP_VALUE" = "$(copgvd_rom_prop "$COPG_VP_ROM_FILE" ro.build.version.codename)" ] ;;
        SDK_FULL)
            COPG_VP_ROM_SDK=$(copgvd_rom_prop "$COPG_VP_ROM_FILE" ro.build.version.sdk)
            case "$COPG_VP_VALUE" in "$COPG_VP_ROM_SDK"|"$COPG_VP_ROM_SDK".*) return 0 ;; *) return 1 ;; esac ;;
        *) return 1 ;;
    esac
}
