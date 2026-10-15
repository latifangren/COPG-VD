const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const localeDir = path.join(__dirname, '..', 'module', 'webroot', 'lang');

function readLocale(filename) {
  const source = fs.readFileSync(path.join(localeDir, filename), 'utf8');
  if (filename.endsWith('.json')) return JSON.parse(source);
  const match = source.match(/window\.__I18N_[A-Z_]+\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  assert.ok(match, `${filename} must contain a locale object`);
  return JSON.parse(match[1]);
}

const english = readLocale('en.js');
const englishKeys = Object.keys(english).sort();
const localeFiles = fs.readdirSync(localeDir).filter((file) => file.endsWith('.json') || file.endsWith('.js'));

test('every locale has exactly the English key set and non-empty values', () => {
  assert.ok(localeFiles.includes('en.js'));
  for (const filename of localeFiles) {
    const locale = readLocale(filename);
    const keys = Object.keys(locale).sort();
    assert.deepEqual(keys, englishKeys, `${filename} key set differs from en.js`);
    for (const key of englishKeys) {
      assert.equal(typeof locale[key], 'string', `${filename}:${key} must be a string`);
      assert.notEqual(locale[key].trim(), '', `${filename}:${key} must not be empty`);
    }
  }
});
