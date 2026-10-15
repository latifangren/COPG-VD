# Testing and CI

## Host-side checks

Run these commands from the repository root:

```sh
node --check module/webroot/scripts.js
node --check module/webroot/command-bridge.js
node --check module/webroot/logcat-buffer.js
node --check module/webroot/log-ui.js
node --check module/webroot/info-tabs.js
node --test tests/*.test.cjs
sh -n module/customize.sh
sh -n module/service.sh
sh -n module/fingerprint-update.sh
sh -n module/lib/atomic-file.sh
sh -n module/lib/version-policy.sh
bash -n .github/scripts/version.sh
bash tests/atomic-file.test.sh
bash tests/version-policy.test.sh
python -m unittest discover -s tests -p 'test_*.py' -v
```

The JavaScript tests cover concurrent root-command callbacks, bridge failures and cleanup, and incremental log snapshots without clearing the shared Android log buffer. Python tests cover selected updater parsing, profile preservation, and atomic writes using local temporary files; they do not fetch factory images.

`.github/workflows/tests.yml` runs these host-side checks for pushes and pull requests. `.github/workflows/build-artifact.yml` builds the three Zygisk ABIs and uploads an installable module ZIP on pushes, pull requests, and manual dispatches; its token is read-only and it does not publish a release. Device-side shell behavior, JNI field application, SELinux labels, root-manager API behavior, and boot timing are not established by these host tests.

## Android build and integration

`.github/workflows/COPG-VD.yml` manually builds `arm64-v8a`, `armeabi-v7a`, and `x86_64` libraries, assembles the module zip, and can publish a release when requested. Verify changes to boot, resetprop, Zygisk, or the root-manager bridge on a test device/emulator before release. Record the Android version, root manager, ABI, operation performed, and observed result.
