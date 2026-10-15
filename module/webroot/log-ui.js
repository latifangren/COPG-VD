let logcatRunning = false;
let lastLogcatSnapshot = '';
let logcatBaselinePending = false;

async function startLogcat(e) {
    if (e) e.stopPropagation();
    if (logcatRunning) return;

    try {
        appendToOutput(t('msg_100'), 'info');
        logcatRunning = true;
        document.getElementById('start-logcat').style.display = 'none';
        document.getElementById('stop-logcat').style.display = 'inline-block';
        document.getElementById('log-content').classList.remove('collapsed');
        document.querySelector('#settings-log-section .toggle-icon').classList.add('expanded');

        lastLogcatSnapshot = '';
        logcatBaselinePending = true;
        readLogcat();
    } catch (error) {
        appendToOutput(t('msg_080', { error }), 'error');
        stopLogcat();
    }
}

async function readLogcat() {
    if (!logcatRunning) return;

    try {
        const logs = await execCommand("logcat -d -s COPG-VD");
        const newLines = getNewLogcatLines(lastLogcatSnapshot, logs, logcatBaselinePending);
        if (logs) lastLogcatSnapshot = logs;
        logcatBaselinePending = false;
        newLines.forEach(line => {
            let logType = 'info';
            if (line.includes(' E ') || line.includes('ERROR')) logType = 'error';
            else if (line.includes(' W ') || line.includes('WARN')) logType = 'warning';
            appendToOutput(line.trim(), logType);
        });

        if (logcatRunning) {
            setTimeout(readLogcat, 250);
        }
    } catch (error) {
        appendToOutput(t('msg_089', { error }), 'error');
        stopLogcat();
    }
}

function stopLogcat(e) {
    if (e) e.stopPropagation();
    if (!logcatRunning) return;

    logcatRunning = false;
    try {
        lastLogcatSnapshot = '';
        logcatBaselinePending = false;
        appendToOutput(t('msg_090'), 'info');
    } catch (error) {
        appendToOutput(t('msg_062', { error }), 'error');
    } finally {
        document.getElementById('start-logcat').style.display = 'inline-block';
        document.getElementById('stop-logcat').style.display = 'none';
        showSaveLogPopup();
    }
}
