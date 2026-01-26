chrome.commands.onCommand.addListener((command) => {
    if (command === "quick-capture") {
        performQuickCapture();
    }
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === "FLASH_ICON") {
        setVisualStatus(request.tabId, request.success);
    }
});

const DEFAULT_ICON = {
    "16": "/icons/icon16.png",
    "48": "/icons/icon48.png",
    "128": "/icons/icon128.png"
}
async function setVisualStatus(tabId, success) {
    const icon = success ? "/icons/success.png" : "/icons/error.png";
    try {
        chrome.action.setIcon({
            path: icon,
            tabId: tabId
        });
        setTimeout(() => {
            try {
                chrome.action.setIcon({
                    tabId: tabId,
                    path: DEFAULT_ICON
                });
            } catch (e) {
                console.warn("Couldn't change icon to original.", e);
            }
        }, 500);
    } catch (e) {
        console.warn("Couldn't change icon.", e);
    }
}
async function performQuickCapture() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    try {
        const data = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" });
        await sendToBackend(data, "");
        await setVisualStatus(tab.id, true);
    } catch (err) {
        console.error(err);
        await setVisualStatus(tab.id, false);
    }
}

async function sendToBackend(data, context) {
    const settings = await chrome.storage.local.get({
        server_port: "18080",
        use_markdown: false
    });
    const payload = {
        ...data,
        context: context,
        markdown: settings.use_markdown,
        timestamp: new Date().toISOString()
    };
    const response = await fetch(`http://localhost:${settings.server_port}/api/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Server error");
}
