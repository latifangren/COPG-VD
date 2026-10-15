# Feature and optimization evaluation

## Recommended order

1. **Diagnostics UI:** strongest first candidate. The project already has updater `analyze` output and persistent status/log files, so diagnostics can surface evidence already available without changing the device-profile format. First make the analyzer output machine-readable and distinguish missing data or command failure from a healthy result.
2. **Import/export:** moderate value, low schema impact. The WebUI already has backup/restore and a file picker; improve validation, preview, and rollback there before adding another profile format or cloud path.
3. **Multiple global profiles:** useful for users switching devices, but requires a profile directory, active-profile rule, migration, and backup semantics. Define those before changing runtime consumers.
4. **Structured logs:** useful for diagnostics and support, but adds retention and privacy choices. First bound current log output and define rotation/fields; do not add another unbounded log file.
5. **Fingerprint freshness metadata:** useful only with trusted provenance and an explicit policy for unavailable or stale remote data. Keep this separate from claims that a profile passes external integrity checks.
6. **Per-app profiles, cloud sync, attestation-driven auto-revert, and TEE/KeyMint integration:** defer as separate architecture/security decisions; current runtime reads one global config and has no per-package dispatch.

## Optimization evidence

The WebUI log poll now waits 250 ms between snapshots and does not clear Android's shared log buffer. This is a correctness and polling-rate change; no CPU or battery improvement is claimed because no device baseline was measured.

The maintainer updater now replaces generated files atomically. No runtime or CI duration claim is made. Measure updater duration, boot-time module overhead, package size, and build duration on a fixed device/toolchain before considering further performance work.

## Decision needed before building a new feature

Diagnostics UI is the recommended next feature. The other candidates remain backlog until its scope is accepted; profile selection per app is not part of the global-profile option.
