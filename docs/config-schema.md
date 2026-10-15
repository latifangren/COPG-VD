# COPG-VD configuration format

The active configuration is `/data/adb/COPG-VD.json`. The repository example is `module/COPG-VD.json.example`.

## Current shape

The top-level object contains explanatory header entries and a `COPG-VD` object. Fields under `COPG-VD` are optional. Values used by the runtime are strings; this matches the example, the shell reader, and the C++ string-field reader. A missing field is skipped by the device-side consumers. Keep user-added fields when refreshing a profile unless a named migration explicitly removes them.

Example:

```json
{
  "Instructions": "All fields are optional.",
  "COPG-VD": {
    "BRAND": "google",
    "DEVICE": "comet",
    "MODEL": "Pixel example"
  }
}
```

## Compatibility cautions

- Use one occurrence of each key inside `COPG-VD`. The current shell reader selects the first matching occurrence, while C++ parses the object with nlohmann/json; duplicate object keys can therefore yield consumer differences.
- Keep values as JSON strings. Numeric JSON values are not accepted uniformly by every runtime consumer.
- Unknown fields may be retained by the maintainer updater, but that does not mean shell or Zygisk applies them. Verify a field in each consumer before documenting it as supported.
- `ANDROID_VERSION`, `SDK_INT`, `SDK_FULL`, and `CODENAME` describe the ROM and are gated by the configured version policy. Do not assume a build profile overrides them.
- `module/COPG-VD.json.example` can contain provenance/header metadata in addition to the device object; preserve it when editing generated profile content.

This document describes the current contract. It is not yet a machine-enforced JSON Schema. Phase 2 of `PLAN.md` covers field-by-field parity and automated validation.
