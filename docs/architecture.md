# COPG-VD architecture

## Runtime data flow

```text
Install/upgrade
  module/customize.sh
    ├─ installs module files
    ├─ creates /data/adb/COPG-VD.json from the example only when absent
    └─ maintains module policy flags

Boot
  module/service.sh + module/lib/version-policy.sh
    ├─ syncs policy flags and reads the ROM baseline from /system/build.prop
    ├─ reads /data/adb/COPG-VD.json and applies mapped resetprop values
    └─ starts module/fingerprint-update.sh boot asynchronously after boot completion
       └─ uses shared version policy and atomic replacement for updates, then asks
          service.sh --props-only to re-apply properties

App specialization
  zygisk/spoof_module.cpp + zygisk/device_config.hpp + zygisk/device_info.hpp
    ├─ parses /data/adb/COPG-VD.json into DeviceInfo
    ├─ reads ROM version and module version policy
    └─ applies selected android.os.Build and Build.VERSION fields through JNI

WebUI
  module/webroot/index.html + command-bridge.js + logcat-buffer.js + log-ui.js + info-tabs.js + scripts.js
    └─ invokes root commands through the KSU JavaScript bridge
       and edits the shared config and module settings

Maintainer update
  .github/scripts/update_copg_json.py
    ├─ retrieves build metadata and reads needed props using HTTP range requests
    └─ refreshes the example JSON and its README JSON block

Release build
  .github/workflows/COPG-VD.yml
    ├─ builds Zygisk libraries for arm64-v8a, armeabi-v7a, and x86_64
    └─ packages module contents; version metadata originates in module/module.prop
```

## Boundaries

- `module/service.sh` owns boot-time property application and the ROM-based version policy.
- `zygisk/spoof_module.cpp` owns Java `Build` field application and reads the same config independently.
- `module/fingerprint-update.sh` owns device-side update, migration, and analysis commands; shared shell behavior lives in `module/lib/`.
- `.github/scripts/update_copg_json.py` is a maintainer/CI tool; it is not a runtime dependency on the Android device.
- The WebUI calls privileged commands through the injected root-manager bridge. Treat values from file pickers and editable fields as untrusted command input.

The shell, C++, Python, and WebUI each have their own key handling today. Changes to config fields must be checked across these consumers until a generated shared contract is implemented and verified.
