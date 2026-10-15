(function (root) {
    function splitLines(value) {
        return String(value || '').split(/\r?\n/).filter(Boolean);
    }

    function getNewLogcatLines(previousSnapshot, currentSnapshot, baselineOnly) {
        const current = splitLines(currentSnapshot);
        if (baselineOnly) return [];
        const previous = splitLines(previousSnapshot);
        if (previous.length === 0) return current;

        const growing = previous.length <= current.length &&
            previous.every((line, index) => line === current[index]);
        if (growing) return current.slice(previous.length);

        const maxOverlap = Math.min(previous.length, current.length);
        for (let overlap = maxOverlap; overlap > 0; overlap--) {
            let matches = true;
            for (let index = 0; index < overlap; index++) {
                if (previous[previous.length - overlap + index] !== current[index]) {
                    matches = false;
                    break;
                }
            }
            if (matches) return current.slice(overlap);
        }

        return current;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { getNewLogcatLines };
    }
    if (root) root.getNewLogcatLines = getNewLogcatLines;
})(typeof globalThis !== 'undefined' ? globalThis : this);
