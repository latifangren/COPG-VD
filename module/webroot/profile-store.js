(function (root) {
    'use strict';

    const ACTIVE_KEY = 'COPG-VD-ActiveProfile';
    const PROFILES_KEY = 'COPG-VD-Profiles';
    const ACTIVE_DATA_KEY = 'COPG-VD';
    const LEGACY_ID = 'custom:legacy-current';
    const RUNTIME_FIELDS = new Set(['BRAND','DEVICE','MANUFACTURER','MODEL','FINGERPRINT','PRODUCT','BOOTLOADER','BOARD','HARDWARE','DISPLAY','ID','HOST','INCREMENTAL','TIMESTAMP','PREVIEW_SDK','USER','SDK_FINGERPRINT','UUID','SECURITY_PATCH','ANDROID_VERSION','SDK_INT','SDK_FULL','CODENAME','TAGS','TYPE','ODM_SKU','SKU']);
    const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const clone = value => JSON.parse(JSON.stringify(value));

    function cleanValues(values) {
        if (!isObject(values)) throw new TypeError('Profile values must be an object');
        const clean = {};
        Object.keys(values).forEach((key) => {
            const value = values[key];
            if ((RUNTIME_FIELDS.has(key) || /^[A-Z][A-Z0-9_]*$/.test(key)) && typeof value === 'string' && value !== '') {
                clean[key] = value;
            }
        });
        return clean;
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
            ...builtins.map(profile => ({ id: `builtin:${profile.id}`, name: profile.name, kind: 'builtin', platform: profile.platform || '', values: profile.values })),
            ...Object.entries(custom).filter(([, profile]) => isObject(profile) && isObject(profile.values)).map(([id, profile]) => ({
                id,
                name: profile.name || id,
                kind: 'custom',
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

    const api = { ACTIVE_KEY, PROFILES_KEY, ACTIVE_DATA_KEY, normalizeConfig, listProfiles, activate, createCustom, removeCustom };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.COPGVDProfiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
