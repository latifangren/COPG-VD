# Device presets and saved profiles

## User flow

The WebUI ships with a local catalog of 16 built-in device presets in `module/webroot/presets/catalog.json`. The catalog is available offline and is attributed in the adjacent `NOTICE` file. It adapts device/build identity fields from the MIT-licensed OpenSpoof v0.2.0 `module/devices.conf`; unrelated app targeting, native hooks, identifiers, CPU presets, and OpenSpoof UI code are not included.

Built-in presets are read-only. Users can activate one directly, create an editable custom copy from any preset, create a copy of the active profile, edit saved custom profiles, and delete inactive custom profiles. Changes to one copy do not modify a bundled preset or other saved profile.

## Storage and compatibility

The runtime still reads one active device object from `COPG-VD` in `/data/adb/COPG-VD.json`. Two additive top-level keys keep the profile catalog and selection in that same file:

- `COPG-VD-Profiles`: named user-created profiles, each with a name, kind, and `values` object.
- `COPG-VD-ActiveProfile`: selected built-in or custom profile ID.

Opening an old config without these keys imports its current `COPG-VD` values as a custom profile and marks it active. Settings, instructions, and other top-level config entries are retained. Switching profiles copies only string identity fields into the runtime `COPG-VD` object; the existing shell and Zygisk readers continue to use that object. Runtime config writes use a same-directory temporary file and rename.

A selected custom profile's stored values are refreshed from the active runtime object when loaded or before switching/copying, so updater changes to the active profile are retained. The built-in catalog remains separate and unchanged.

## Preset provenance and limits

The included catalog has 16 device/build identity presets. The values are adapted from the reference device catalog and are not a claim that every firmware field is current or verified on a physical phone. Check device/build provenance before using a preset. Presets currently contain build identity only; they do not bring OpenSpoof's per-app mappings or native hook data into COPG-VD.

Profiles remain global because COPG-VD's resetprop and Java `Build` implementation consume one global runtime config. Per-app selection would require a separate runtime design and is not part of this change.
