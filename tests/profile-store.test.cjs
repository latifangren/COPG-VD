const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../module/webroot/profile-store.js');

const catalogPath = path.join(__dirname, '..', 'module', 'webroot', 'presets', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

test('bundled catalog identifies the MIT-licensed reference and has 16 complete preset identities', () => {
  assert.match(catalog.sourceLicense, /MIT/);
  assert.match(fs.readFileSync(path.join(path.dirname(catalogPath), 'NOTICE'), 'utf8'), /OpenSpoof contributors/);
  const ids = catalog.presets.map((preset) => preset.id);
  assert.equal(ids.length, 16);
  assert.equal(new Set(ids).size, ids.length);
  for (const preset of catalog.presets) {
    assert.ok(preset.name);
    for (const field of ['BRAND', 'DEVICE', 'MANUFACTURER', 'MODEL', 'PRODUCT', 'FINGERPRINT']) {
      assert.equal(typeof preset.values[field], 'string', `${preset.id}:${field}`);
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
