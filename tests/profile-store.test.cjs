const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../module/webroot/profile-store.js');

const catalogPath = path.join(__dirname, '..', 'module', 'webroot', 'presets', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

test('bundled catalog identifies the MIT-licensed reference and has 19 complete preset identities aligned with fingerprints', () => {
  assert.match(catalog.sourceLicense, /MIT/);
  assert.match(fs.readFileSync(path.join(path.dirname(catalogPath), 'NOTICE'), 'utf8'), /OpenSpoof contributors/);
  const ids = catalog.presets.map((preset) => preset.id);
  assert.equal(ids.length, 19);
  assert.equal(new Set(ids).size, ids.length);
  for (const preset of catalog.presets) {
    assert.ok(preset.name);
    assert.ok(preset.category, `${preset.id} missing category`);
    for (const field of ['BRAND', 'DEVICE', 'MANUFACTURER', 'MODEL', 'PRODUCT', 'FINGERPRINT']) {
      assert.equal(typeof preset.values[field], 'string', `${preset.id}:${field}`);
    }
    const fpMatch = preset.values.FINGERPRINT.match(/^([^/]+)\/([^/]+)\/([^:]+):([^/]+)\/([^/]+)\/([^:]+):([^/]+)\/(.+)$/);
    assert.ok(fpMatch, `${preset.id}: FINGERPRINT invalid format (${preset.values.FINGERPRINT})`);
    const [, fpBrand, fpProduct, fpDevice, , fpId, fpIncr] = fpMatch;
    assert.equal(preset.values.BRAND, fpBrand, `${preset.id}: BRAND does not match FINGERPRINT`);
    assert.equal(preset.values.PRODUCT, fpProduct, `${preset.id}: PRODUCT does not match FINGERPRINT`);
    assert.equal(preset.values.DEVICE, fpDevice, `${preset.id}: DEVICE does not match FINGERPRINT`);
    if (preset.values.ID) {
      assert.equal(preset.values.ID, fpId, `${preset.id}: ID does not match FINGERPRINT`);
    }
    if (preset.values.INCREMENTAL) {
      assert.equal(preset.values.INCREMENTAL, fpIncr, `${preset.id}: INCREMENTAL does not match FINGERPRINT`);
    }
  }
});

test('migrates legacy active config into a custom profile and preserves unrelated settings', () => {
  const legacy = {
    Instructions: 'keep',
    'COPG-VD': { BRAND: 'google', DEVICE: 'comet', MODEL: 'Pixel custom' },
    'COPG-VD-Settings': { resetprop: false, lang: 'id' },
  };
  const { config, activeId, migrated } = store.normalizeConfig(legacy);
  assert.equal(migrated, true);
  assert.equal(activeId, 'custom:legacy-current');
  assert.deepEqual(config[store.PROFILES_KEY][activeId].values, legacy['COPG-VD']);
  assert.deepEqual(config['COPG-VD-Settings'], legacy['COPG-VD-Settings']);
  assert.equal(config.Instructions, 'keep');
});

test('activates built-in presets without adding or mutating the bundled preset', () => {
  const state = store.normalizeConfig({ 'COPG-VD': { DEVICE: 'old' } });
  const preset = catalog.presets[0];
  const original = JSON.parse(JSON.stringify(preset.values));
  store.activate(state.config, `builtin:${preset.id}`, catalog);
  assert.deepEqual(state.config['COPG-VD'], original);
  assert.equal(state.config[store.ACTIVE_KEY], `builtin:${preset.id}`);
  assert.deepEqual(preset.values, original);
});

test('customizes, edits, activates, and deletes user profiles while preserving unrelated config', () => {
  const { config } = store.normalizeConfig({
    'COPG-VD': { DEVICE: 'legacy' },
    'COPG-VD-Settings': { autoupdate: true },
  });
  const originalActive = JSON.parse(JSON.stringify(config['COPG-VD']));
  const preset = catalog.presets[0];
  const id = store.createCustom(config, 'Gaming phone', preset.values, undefined, false);
  assert.equal(id, 'custom:gaming-phone');
  assert.notEqual(config[store.ACTIVE_KEY], id);
  assert.deepEqual(config['COPG-VD'], originalActive);
  assert.deepEqual(config[store.PROFILES_KEY][id].values, preset.values);

  const activeBeforeCustomEdit = config[store.ACTIVE_KEY];
  const changed = { ...preset.values, MODEL: 'Edited model' };
  assert.equal(store.createCustom(config, 'Gaming phone v2', changed, id, false), id);
  assert.equal(config[store.PROFILES_KEY][id].values.MODEL, 'Edited model');
  assert.equal(config[store.ACTIVE_KEY], activeBeforeCustomEdit);
  assert.doesNotThrow(() => store.removeCustom(config, id));

  const activeCustomId = store.createCustom(config, 'Active copy', changed);
  assert.throws(() => store.removeCustom(config, activeCustomId), /Select another profile/);
  store.activate(config, `builtin:${catalog.presets[1].id}`, catalog);
  store.removeCustom(config, activeCustomId);
  assert.equal(config[store.PROFILES_KEY][id], undefined);
  assert.deepEqual(config['COPG-VD-Settings'], { autoupdate: true });
});

test('normalizes a missing saved profile for an existing active custom id', () => {
  const { config, migrated } = store.normalizeConfig({
    'COPG-VD-ActiveProfile': 'custom:recovered',
    'COPG-VD': { DEVICE: 'recovered-device', MODEL: 'Recovered' },
  });
  assert.equal(migrated, true);
  assert.equal(config[store.PROFILES_KEY]['custom:recovered'].values.DEVICE, 'recovered-device');
});

test('custom profile names receive collision-safe ids and preserve unknown profile metadata', () => {
  const { config } = store.normalizeConfig({ 'COPG-VD': { DEVICE: 'real' }, customNote: 'preserve' });
  const first = store.createCustom(config, 'My Device', { DEVICE: 'one' });
  const second = store.createCustom(config, 'My Device', { DEVICE: 'two' });
  assert.equal(first, 'custom:my-device');
  assert.equal(second, 'custom:my-device-2');
  assert.equal(config.customNote, 'preserve');
});

test('automatically derives ID, INCREMENTAL, TYPE, TAGS, and DISPLAY from FINGERPRINT when missing', () => {
  const minimal = {
    FINGERPRINT: 'google/marlin/marlin:10/QP1A.191005.007.A3/5972272:user/release-keys',
    MODEL: 'Pixel XL',
  };
  const { config, activeId } = store.normalizeConfig({ 'COPG-VD': minimal });
  const values = config[store.PROFILES_KEY][activeId].values;
  assert.equal(values.BRAND, 'google');
  assert.equal(values.PRODUCT, 'marlin');
  assert.equal(values.DEVICE, 'marlin');
  assert.equal(values.ID, 'QP1A.191005.007.A3');
  assert.equal(values.INCREMENTAL, '5972272');
  assert.equal(values.TYPE, 'user');
  assert.equal(values.TAGS, 'release-keys');
  assert.equal(values.DISPLAY, 'QP1A.191005.007.A3');
});

test('exports and imports standalone profile configurations correctly', () => {
  const { config } = store.normalizeConfig({ 'COPG-VD': { DEVICE: 'test-device', BRAND: 'test-brand' } });
  const exported = store.exportProfile(config, 'builtin:pixel_xl_2016', catalog);
  assert.equal(exported.kind, 'COPG-VD-Profile');
  assert.equal(exported.name, 'Pixel XL (Google Photos Unlimited Original)');
  assert.equal(exported.values.DEVICE, 'marlin');

  const importedId = store.importProfile(config, exported, { name: 'My Imported Pixel' });
  assert.equal(importedId, 'custom:my-imported-pixel');
  assert.equal(config[store.PROFILES_KEY][importedId].values.DEVICE, 'marlin');
  assert.equal(config[store.PROFILES_KEY][importedId].name, 'My Imported Pixel');

  // Import from raw JSON string with activation
  const rawJson = JSON.stringify({ BRAND: 'google', MODEL: 'Pixel 5', FINGERPRINT: 'google/redfin/redfin:14/UP1A.231105.001.B2/11260436:user/release-keys' });
  const rawId = store.importProfile(config, rawJson, { activate: true });
  assert.equal(config[store.ACTIVE_KEY], rawId);
  assert.equal(config['COPG-VD'].MODEL, 'Pixel 5');
  assert.equal(config['COPG-VD'].DEVICE, 'redfin');

  // Rejects invalid payload
  assert.throws(() => store.importProfile(config, 'not a json'), /Invalid JSON format/);
  assert.throws(() => store.importProfile(config, { empty: true }), /does not contain valid device properties/);
});
