(function (root) {
    function createExecCommand(getApi, callbackHost) {
        let sequence = 0;

        return function execCommand(command) {
            return new Promise((resolve, reject) => {
                const callbackName = `exec_callback_${Date.now()}_${++sequence}`;
                callbackHost[callbackName] = (errno, stdout, stderr) => {
                    delete callbackHost[callbackName];
                    if (errno === 0) {
                        resolve(stdout || '');
                    } else {
                        reject(stderr || `Command failed with error code ${errno}`);
                    }
                };

                let api;
                try {
                    api = getApi();
                    if (!api || typeof api.exec !== 'function') {
                        throw new Error('KSU API not available');
                    }
                    api.exec(command, '{}', callbackName);
                } catch (error) {
                    delete callbackHost[callbackName];
                    reject(error instanceof Error ? error.message : String(error));
                }
            });
        };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { createExecCommand };
    }
    if (root) root.createExecCommand = createExecCommand;
})(typeof globalThis !== 'undefined' ? globalThis : this);
