function setupInfoPopup() {
    const versionText = document.getElementById('version-text');
    versionText.addEventListener('click', () => {
        showPopup('info-popup');
        loadMarkdownContent();

        setTimeout(() => {
            setInfoTabHeights();
            document.querySelectorAll('.info-tab-content').forEach(tab => {
                if (tab.id === 'info-about') {
                    tab.scrollTop = 0;
                } else {
                    const markdownContainer = tab.querySelector('.markdown-container');
                    if (markdownContainer) {
                        markdownContainer.scrollTop = 0;
                    }
                }
            });
        }, 100);
    });

    document.querySelector('.close-info-btn').addEventListener('click', () => {
        closePopup('info-popup');
    });

    document.querySelectorAll('.info-tab-nav .tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            activateInfoTab(tabId);
        });
    });

    const infoPopup = document.getElementById('info-popup');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const displayStyle = infoPopup.style.display;
                if (displayStyle === 'flex') {
                    setTimeout(() => {
                        setInfoTabHeights();
                    }, 50);
                }
            }
        });
    });
    observer.observe(infoPopup, { attributes: true });
}

function setInfoTabHeights() {
    const tabContainer = document.querySelector('.info-tab-container');
    if (!tabContainer) return;

    const containerHeight = tabContainer.clientHeight;
    document.querySelectorAll('.info-tab-content').forEach(tab => {
        tab.style.height = containerHeight + 'px';
        if (tab.id === 'info-about') {
            tab.style.overflowY = 'auto';
            tab.style.overflowX = 'hidden';
        } else {
            const markdownContainer = tab.querySelector('.markdown-container');
            if (markdownContainer) {
                markdownContainer.style.height = '100%';
                markdownContainer.style.overflowY = 'auto';
                markdownContainer.style.overflowX = 'auto';
            }
        }
    });
}

function activateInfoTab(tabId) {
    document.querySelectorAll('.info-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.info-tab-nav .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeTab = document.getElementById(tabId);
    const activeBtn = document.querySelector(`.info-tab-nav .tab-btn[data-tab="${tabId}"]`);

    if (activeTab && activeBtn) {
        activeTab.classList.add('active');
        activeBtn.classList.add('active');

        setTimeout(() => {
            setInfoTabHeights();
            if (tabId === 'info-about') {
                activeTab.scrollTop = 0;
            } else {
                const markdownContainer = activeTab.querySelector('.markdown-container');
                if (markdownContainer) {
                    markdownContainer.scrollTop = 0;
                    markdownContainer.scrollLeft = 0;
                }
            }
        }, 50);
    }
}
