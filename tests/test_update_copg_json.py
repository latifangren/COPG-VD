import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / ".github" / "scripts" / "update_copg_json.py"
SPEC = importlib.util.spec_from_file_location("update_copg_json", SCRIPT)
UPDATER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(UPDATER)


class UpdateCopgJsonTests(unittest.TestCase):
    def test_consumer_fields_are_registered_as_known_config_keys(self):
        shell = (ROOT / "module" / "fingerprint-update.sh").read_text(encoding="utf-8")
        service = (ROOT / "module" / "service.sh").read_text(encoding="utf-8")
        cpp = (ROOT / "zygisk" / "spoof_module.cpp").read_text(encoding="utf-8")
        device_config = (ROOT / "zygisk" / "device_config.hpp").read_text(encoding="utf-8")
        known_match = re.search(r'KNOWN_KEYS="([^"]+)"', shell)
        self.assertIsNotNone(known_match)
        known = set(known_match.group(1).split())

        service_mapping = service.split("<< 'MAPPING'\n", 1)[1].split("\nMAPPING\n", 1)[0]
        service_keys = {line.split("|", 1)[0] for line in service_mapping.splitlines() if "|" in line}
        cpp_keys = set(re.findall(r'device\.(?:value|contains)\("([A-Z_]+)"', cpp + device_config))
        cpp_keys.update(re.findall(r'device\["([A-Z_]+)"\]', cpp + device_config))
        self.assertFalse((set(UPDATER.PROP_MAP) | service_keys | cpp_keys) - known)

    def test_example_runtime_fields_are_strings(self):
        with open(ROOT / "module" / "COPG-VD.json.example", encoding="utf-8") as stream:
            example = json.load(stream)
        self.assertTrue(all(isinstance(value, str) for value in example["COPG-VD"].values()))

    def test_atomic_write_replaces_content_without_leaving_temporary_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text("old", encoding="utf-8")
            UPDATER.atomic_write_text(path, "new")
            self.assertEqual(path.read_text(encoding="utf-8"), "new")
            self.assertEqual([item.name for item in Path(directory).iterdir()], ["config.json"])

    def test_parse_props_keeps_the_first_value_for_duplicate_keys(self):
        blob = (
            b"# first image\nro.product.system_dlkm.brand=Google\n"
            b"ro.product.system_dlkm.device=comet\n\n"
            b"ro.product.system_dlkm.brand=Wrong\n"
        )
        props = UPDATER.parse_props(blob, b"ro.product.system_dlkm.brand=")
        self.assertEqual(props["ro.product.system_dlkm.brand"], "Google")
        self.assertEqual(props["ro.product.system_dlkm.device"], "comet")

    def test_read_json_and_render_json_preserve_duplicate_header_keys(self):
        source = '{"Instructions":"first","Instructions":"second","COPG-VD":{"DEVICE":"comet","CUSTOM":"keep"}}'
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(source, encoding="utf-8")
            header, body = UPDATER.read_json(path)
        rendered = UPDATER.render_json(header, body)
        pairs = json.loads(rendered, object_pairs_hook=lambda values: values)
        self.assertEqual([value for key, value in pairs if key == "Instructions"], ["first", "second"])
        self.assertIn(("CUSTOM", "keep"), next(value for key, value in pairs if key == "COPG-VD"))

    def test_apply_props_refreshes_mapped_fields_and_keeps_custom_values(self):
        body = [("BRAND", "OldBrand"), ("CUSTOM", "keep"), ("BOARD", "custom-board")]
        props = {"ro.product.system_dlkm.brand": "Google"}
        updated, values = UPDATER.apply_props(body, props, {"BOOTLOADER": "unknown"})
        self.assertEqual(dict(updated)["BRAND"], "Google")
        self.assertEqual(dict(updated)["CUSTOM"], "keep")
        self.assertEqual(dict(updated)["BOARD"], "custom-board")
        self.assertEqual(values["BRAND"], "Google")


if __name__ == "__main__":
    unittest.main()
