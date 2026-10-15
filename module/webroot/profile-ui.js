let profileCatalog = { schemaVersion: 1, presets: [] };
let selectedProfileId = '';

async function loadProfileCatalog() {
    const response = await fetch('presets/catalog.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load built-in presets (${response.status})`);
    const catalog = await response.json();
    if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.presets)) {
        throw new Error('Built-in preset catalog has an unsupported format');
    }
    const ids = new Set();
    catalog.presets.forEach(preset => {
        if (!preset.id || !preset.name || !preset.values || ids.has(preset.id)) {
            throw new Error('Built-in preset catalog contains an invalid or duplicate preset');
        }
        ids.add(preset.id);
    });
    profileCatalog = catalog;
}

function profileList() {
    return COPGVDProfiles.listProfiles(currentConfig, profileCatalog);
}

function syncActiveProfileValues() {
    const activeId = currentConfig[COPGVDProfiles.ACTIVE_KEY];
    if (!activeId || !activeId.startsWith('custom:')) return;
    const saved = currentConfig[COPGVDProfiles.PROFILES_KEY]?.[activeId];
    if (!saved || !saved.values) return;
    saved.values = { ...saved.values, ...currentConfig[COPGVDProfiles.ACTIVE_DATA_KEY] };
}

function openProfilePreviewModal(profileId) {
    const modal = document.getElementById('profile-preview-modal');
    if (!modal) return;
    const profile = profileList().find(item => item.id === profileId);
    if (!profile) return;

    document.getElementById('profile-preview-title').textContent = profile.name;
    const badge = document.getElementById('profile-preview-badge');
    if (badge) {
        badge.textContent = profile.kind === 'builtin' ? 'Built-in Preset' : 'Custom Profile';
    }

    const tbody = document.getElementById('profile-preview-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        const fields = Object.entries(profile.values);
        fields.forEach(([k, v]) => {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = k;
            const td = document.createElement('td');
            td.textContent = v;
            tr.appendChild(th);
            tr.appendChild(td);
            tbody.appendChild(tr);
        });
    }

    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.add('modal-enter');
    });
}

function closeProfilePreviewModal() {
    const modal = document.getElementById('profile-preview-modal');
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.classList.remove('modal-enter');
        content.classList.add('modal-exit');
        setTimeout(() => {
            modal.style.display = 'none';
            content.classList.remove('modal-exit');
        }, 200);
    } else {
        modal.style.display = 'none';
    }
}

function renderProfileManager() {
    const profileSelect = document.getElementById('profile-select');
    const presetSelect = document.getElementById('preset-select');
    if (!profileSelect || !presetSelect) return;

    const profiles = profileList();
    const selectedId = profiles.some(profile => profile.id === selectedProfileId)
        ? selectedProfileId
        : currentConfig[COPGVDProfiles.ACTIVE_KEY];
    selectedProfileId = profiles.some(profile => profile.id === selectedId) ? selectedId : (profiles[0]?.id || '');

    profileSelect.innerHTML = '';
    const categories = {};
    profiles.forEach(profile => {
        const cat = profile.category || (profile.kind === 'builtin' ? 'Built-in Presets' : 'Custom Profiles');
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(profile);
    });
    for (const [catName, catProfiles] of Object.entries(categories)) {
        const group = document.createElement('optgroup');
        group.label = catName;
        catProfiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.kind === 'builtin'
                ? `${profile.name} · ${profile.platform || 'Device'}`
                : `Custom · ${profile.name}`;
            group.appendChild(option);
        });
        profileSelect.appendChild(group);
    }
    profileSelect.value = selectedProfileId;

    presetSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose a built-in device';
    presetSelect.appendChild(placeholder);
    const presetCategories = {};
    profileCatalog.presets.forEach(preset => {
        const cat = preset.category || 'Built-in Presets';
        if (!presetCategories[cat]) presetCategories[cat] = [];
        presetCategories[cat].push(preset);
    });
    for (const [catName, catPresets] of Object.entries(presetCategories)) {
        const group = document.createElement('optgroup');
        group.label = catName;
        catPresets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = `${preset.name} · ${preset.platform || 'Device'}`;
            group.appendChild(option);
        });
        presetSelect.appendChild(group);
    }

    const activeProfile = profiles.find(profile => profile.id === currentConfig[COPGVDProfiles.ACTIVE_KEY]);
    document.getElementById('active-profile-summary').textContent = activeProfile
        ? `Active: ${activeProfile.name}${activeProfile.kind === 'builtin' ? ' (built-in preset)' : ' (custom profile)'}`
        : 'Choose a built-in preset or create a custom profile.';
    const customCount = profiles.filter(profile => profile.kind === 'custom').length;
    document.getElementById('profile-count').textContent = `${profileCatalog.presets.length} presets · ${customCount} custom`;

    const selected = profiles.find(profile => profile.id === selectedProfileId);
    const isCustom = selected?.kind === 'custom';
    document.getElementById('profile-edit').disabled = !isCustom;
    document.getElementById('profile-delete').disabled = !isCustom || selectedProfileId === currentConfig[COPGVDProfiles.ACTIVE_KEY];
    document.getElementById('profile-customize').disabled = !selected;
    const previewBtn = document.getElementById('profile-preview');
    if (previewBtn) previewBtn.disabled = !selected;
    const exportBtn = document.getElementById('profile-export');
    if (exportBtn) exportBtn.disabled = !selected;
}

async function setupProfileManager() {
    try {
        await loadProfileCatalog();
        const select = document.getElementById('profile-select');
        select.addEventListener('change', () => {
            selectedProfileId = select.value;
            renderProfileManager();
        });
        document.getElementById('profile-activate').addEventListener('click', async () => {
            try {
                syncActiveProfileValues();
                COPGVDProfiles.activate(currentConfig, selectedProfileId, profileCatalog);
                await saveConfig();
                renderProfileManager();
                renderDeviceList();
                appendToOutput(`Active profile: ${profileList().find(profile => profile.id === selectedProfileId)?.name || selectedProfileId}. Relaunch target apps to apply it.`, 'success');
            } catch (error) {
                appendToOutput(`Could not activate profile: ${error.message}`, 'error');
            }
        });
        document.getElementById('profile-customize').addEventListener('click', () => {
            syncActiveProfileValues();
            const profile = profileList().find(item => item.id === selectedProfileId);
            if (!profile) return;
            const input = document.getElementById('preset-copy-name');
            input.value = `${profile.name} custom`;
            const id = COPGVDProfiles.createCustom(currentConfig, input.value, profile.values, undefined, false);
            selectedProfileId = id;
            saveConfig().then(() => {
                renderProfileManager();
                renderDeviceList();
                openDeviceModal(id);
            }).catch(error => appendToOutput(`Could not save custom profile: ${error.message}`, 'error'));
        });
        document.getElementById('preset-create').addEventListener('click', async () => {
            try {
                syncActiveProfileValues();
                const preset = profileCatalog.presets.find(item => item.id === document.getElementById('preset-select').value);
                if (!preset) throw new Error('Choose a built-in preset first');
                const name = document.getElementById('preset-copy-name').value.trim() || preset.name;
                selectedProfileId = COPGVDProfiles.createCustom(currentConfig, name, preset.values, undefined, false);
                await saveConfig();
                renderProfileManager();
                renderDeviceList();
                openDeviceModal(selectedProfileId);
            } catch (error) {
                appendToOutput(`Could not create profile: ${error.message}`, 'error');
            }
        });
        document.getElementById('profile-new').addEventListener('click', async () => {
            try {
                syncActiveProfileValues();
                const activeId = currentConfig[COPGVDProfiles.ACTIVE_KEY];
                const base = profileList().find(profile => profile.id === activeId) || profileList()[0];
                if (!base) throw new Error('No active profile to copy');
                const name = document.getElementById('preset-copy-name').value.trim() || 'My device profile';
                selectedProfileId = COPGVDProfiles.createCustom(currentConfig, name, base.values, undefined, false);
                await saveConfig();
                renderProfileManager();
                renderDeviceList();
                openDeviceModal(selectedProfileId);
            } catch (error) {
                appendToOutput(`Could not create profile: ${error.message}`, 'error');
            }
        });
        document.getElementById('profile-edit').addEventListener('click', () => {
            const profile = profileList().find(item => item.id === selectedProfileId);
            if (profile?.kind === 'custom') openDeviceModal(profile.id);
        });
        document.getElementById('profile-delete').addEventListener('click', async () => {
            try {
                COPGVDProfiles.removeCustom(currentConfig, selectedProfileId);
                selectedProfileId = currentConfig[COPGVDProfiles.ACTIVE_KEY];
                await saveConfig();
                renderProfileManager();
                renderDeviceList();
            } catch (error) {
                appendToOutput(`Could not delete profile: ${error.message}`, 'error');
            }
        });
        document.getElementById('profile-preview')?.addEventListener('click', () => {
            if (selectedProfileId) openProfilePreviewModal(selectedProfileId);
        });
        document.getElementById('profile-preview-close')?.addEventListener('click', closeProfilePreviewModal);
        document.getElementById('profile-preview-activate')?.addEventListener('click', async () => {
            closeProfilePreviewModal();
            try {
                syncActiveProfileValues();
                COPGVDProfiles.activate(currentConfig, selectedProfileId, profileCatalog);
                await saveConfig();
                renderProfileManager();
                renderDeviceList();
                appendToOutput(`Active profile: ${profileList().find(p => p.id === selectedProfileId)?.name || selectedProfileId}. Relaunch target apps to apply it.`, 'success');
            } catch (error) {
                appendToOutput(`Could not activate profile: ${error.message}`, 'error');
            }
        });
        document.getElementById('profile-export')?.addEventListener('click', () => {
            try {
                const profile = profileList().find(p => p.id === selectedProfileId);
                if (!profile) throw new Error('Select a profile to export');
                const exportData = COPGVDProfiles.exportProfile(currentConfig, selectedProfileId, profileCatalog);
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const safeName = (profile.name || selectedProfileId).replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase();
                a.download = `copg-vd-${safeName}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                appendToOutput(`Profile exported: ${profile.name}`, 'success');
            } catch (error) {
                appendToOutput(`Could not export profile: ${error.message}`, 'error');
            }
        });
        const importBtn = document.getElementById('profile-import-btn');
        const importInput = document.getElementById('profile-import-input');
        importBtn?.addEventListener('click', () => importInput?.click());
        importInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    syncActiveProfileValues();
                    const newId = COPGVDProfiles.importProfile(currentConfig, event.target.result);
                    selectedProfileId = newId;
                    await saveConfig();
                    renderProfileManager();
                    renderDeviceList();
                    const imported = profileList().find(p => p.id === newId);
                    appendToOutput(`Profile imported successfully: ${imported?.name || newId}`, 'success');
                } catch (err) {
                    appendToOutput(`Could not import profile: ${err.message}`, 'error');
                } finally {
                    e.target.value = '';
                }
            };
            reader.readAsText(file);
        });
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('profile-preview-modal');
            if (event.target === modal) closeProfilePreviewModal();
        });
        renderProfileManager();
    } catch (error) {
        document.getElementById('profile-manager-title').textContent = 'Device profiles unavailable';
        document.getElementById('active-profile-summary').textContent = error.message;
    }
}
