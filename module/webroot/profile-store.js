(function (root) {
    'use strict';

    const ACTIVE_KEY = 'COPG-VD-ActiveProfile';
    const PROFILES_KEY = 'COPG-VD-Profiles';
    const ACTIVE_DATA_KEY = 'COPG-VD';
    const LEGACY_ID = 'custom:legacy-current';
    const RUNTIME_FIELDS = new Set(['BRAND','DEVICE','MANUFACTURER','MODEL','FINGERPRINT','PRODUCT','BOOTLOADER','BOARD','HARDWARE','DISPLAY','ID','HOST','INCREMENTAL','TIMESTAMP','PREVIEW_SDK','USER','SDK_FINGERPRINT','UUID','SECURITY_PATCH','ANDROID_VERSION','SDK_INT','SDK_FULL','CODENAME','TAGS','TYPE','ODM_SKU','SKU']);
    const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const clone = value => JSON.parse(JSON.stringify(value));

    function fillDerivedFields(clean) {
        if (typeof clean.FINGERPRINT === 'string') {
            const match = clean.FINGERPRINT.match(/^([^/]+)\/([^/]+)\/([^:]+):([^/]+)\/([^/]+)\/([^:]+):([^/]+)\/(.+)$/);
            if (match) {
                const [, fpBrand, fpProduct, fpDevice, , fpId, fpIncr, fpType, fpTags] = match;
                if (!clean.BRAND && fpBrand) clean.BRAND = fpBrand;
                if (!clean.PRODUCT && fpProduct) clean.PRODUCT = fpProduct;
                if (!clean.DEVICE && fpDevice) clean.DEVICE = fpDevice;
                if (!clean.ID && fpId) clean.ID = fpId;
                if (!clean.INCREMENTAL && fpIncr) clean.INCREMENTAL = fpIncr;
                if (!clean.TYPE && fpType) clean.TYPE = fpType;
                if (!clean.TAGS && fpTags) clean.TAGS = fpTags;
                if (!clean.DISPLAY && clean.ID) clean.DISPLAY = clean.ID;
            }
        }
        return clean;
    }

    function cleanValues(values) {
        if (!isObject(values)) throw new TypeError('Profile values must be an object');
        const clean = {};
        Object.keys(values).forEach((key) => {
            const value = values[key];
            if ((RUNTIME_FIELDS.has(key) || /^[A-Z][A-Z0-9_]*$/.test(key)) && typeof value === 'string' && value !== '') {
                clean[key] = value;
            }
        });
        return fillDerivedFields(clean);
    }
    function normalizeConfig(input) {
        if (!isObject(input)) throw new TypeError('Config must be a JSON object');
        const config = clone(input);
        if (!isObject(config[PROFILES_KEY])) config[PROFILES_KEY] = {};
        if (!isObject(config[ACTIVE_DATA_KEY])) config[ACTIVE_DATA_KEY] = {};

        let migrated = false;
        let activeId = typeof config[ACTIVE_KEY] === 'string' ? config[ACTIVE_KEY] : '';
        if (!activeId) {
            const existing = config[PROFILES_KEY][LEGACY_ID];
            const current = clone(config[ACTIVE_DATA_KEY]);
            config[PROFILES_KEY][LEGACY_ID] = {
                name: current.MODEL || current.DEVICE || 'Imported active profile',
                kind: 'custom',
                values: cleanValues(current)
            };
            activeId = LEGACY_ID;
            config[ACTIVE_KEY] = activeId;
            migrated = true;
            if (isObject(existing) && isObject(existing.values)) {
                config[PROFILES_KEY][LEGACY_ID].values = cleanValues({ ...clone(existing.values), ...current });
            }
        } else if (activeId.startsWith('custom:')) {
            const selected = config[PROFILES_KEY][activeId];
            if (isObject(selected) && isObject(selected.values)) {
                selected.values = { ...clone(selected.values), ...cleanValues(config[ACTIVE_DATA_KEY]) };
            } else {
                const current = cleanValues(config[ACTIVE_DATA_KEY]);
                config[PROFILES_KEY][activeId] = {
                    name: current.MODEL || current.DEVICE || 'Recovered active profile',
                    kind: 'custom',
                    values: current
                };
                migrated = true;
            }
        }
        return { config, activeId, migrated };
    }

    function listProfiles(config, catalog) {
        const builtins = Array.isArray(catalog?.presets) ? catalog.presets : [];
        const custom = isObject(config?.[PROFILES_KEY]) ? config[PROFILES_KEY] : {};
        return [
            ...builtins.map(profile => ({
                id: `builtin:${profile.id}`,
                name: profile.name,
                kind: 'builtin',
                category: profile.category || 'General',
                platform: profile.platform || '',
                values: profile.values
            })),
            ...Object.entries(custom).filter(([, profile]) => isObject(profile) && isObject(profile.values)).map(([id, profile]) => ({
                id,
                name: profile.name || id,
                kind: 'custom',
                category: 'Custom profiles',
                platform: 'Custom profile',
                values: profile.values
            }))
        ];
    }

    function activate(config, profileId, catalog) {
        const profile = listProfiles(config, catalog).find(item => item.id === profileId);
        if (!profile) throw new Error(`Unknown profile: ${profileId}`);
        config[ACTIVE_DATA_KEY] = cleanValues(profile.values);
        config[ACTIVE_KEY] = profileId;
        return config;
    }

    function createCustom(config, name, values, updateId, activateProfile = true) {
        const label = String(name || '').trim();
        if (!label) throw new Error('Enter a profile name');
        values = cleanValues(values);
        const profiles = config[PROFILES_KEY] ||= {};
        let id = updateId;
        if (id && (!id.startsWith('custom:') || !profiles[id])) throw new Error('Only an existing custom profile can be edited');
        if (!id) {
            const slug = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'profile';
            id = `custom:${slug}`;
            let suffix = 2;
            while (profiles[id]) id = `custom:${slug}-${suffix++}`;
        }
        profiles[id] = { name: label, kind: 'custom', values: clone(values) };
        if (activateProfile) {
            config[ACTIVE_DATA_KEY] = clone(values);
            config[ACTIVE_KEY] = id;
        }
        return id;
    }

    function removeCustom(config, profileId) {
        if (!profileId || !profileId.startsWith('custom:') || !isObject(config[PROFILES_KEY]) || !config[PROFILES_KEY][profileId]) {
            throw new Error('Only a saved custom profile can be deleted');
        }
        if (config[ACTIVE_KEY] === profileId) throw new Error('Select another profile before deleting the active profile');
        delete config[PROFILES_KEY][profileId];
        return config;
    }

    function exportProfile(config, profileId, catalog) {
        const profile = listProfiles(config, catalog).find(item => item.id === profileId);
        if (!profile) throw new Error(`Unknown profile: ${profileId}`);
        return {
            schemaVersion: 1,
            kind: 'COPG-VD-Profile',
            name: profile.name,
            platform: profile.platform || '',
            category: profile.category || 'Custom profiles',
            values: clone(profile.values)
        };
    }

    function importProfile(config, payload, options = {}) {
        let data = payload;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                throw new Error('Invalid JSON format for profile import');
            }
        }
        if (!isObject(data)) throw new TypeError('Import payload must be a JSON object');

        let values = null;
        let name = '';

        if (isObject(data.values)) {
            values = data.values;
            name = data.name;
        } else if (isObject(data[ACTIVE_DATA_KEY])) {
            values = data[ACTIVE_DATA_KEY];
            name = data.Instructions || values.MODEL || values.DEVICE || 'Imported Config';
        } else {
            values = data;
            name = data.MODEL || data.DEVICE || 'Imported Profile';
        }

        const cleaned = cleanValues(values);
        if (Object.keys(cleaned).length === 0) {
            throw new Error('Imported profile does not contain valid device properties');
        }

        const profileName = String(options.name || name || cleaned.MODEL || cleaned.DEVICE || 'Imported Profile').trim();
        const activateAfterImport = Boolean(options.activate);
        return createCustom(config, profileName, cleaned, undefined, activateAfterImport);
    }

    const api = { ACTIVE_KEY, PROFILES_KEY, ACTIVE_DATA_KEY, fillDerivedFields, normalizeConfig, listProfiles, activate, createCustom, removeCustom, exportProfile, importProfile };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.COPGVDProfiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
