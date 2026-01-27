chrome.commands.onCommand.addListener((command) => {
    if (command === "quick-capture") {
        performQuickCapture();
    }
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === "SEND_DATA") {
        (async () => {
            try {
                await sendToBackend(request.tabId, request.data, request.context);
                sendResponse({
                    success: true
                });
            } catch(e) {
                sendResponse({
                    success: false,
                    error: e.message
                });
            }
        })();
        return true;
    }
});

const DEFAULT_ICON = {
    "16": "/icons/icon16.png",
    "48": "/icons/icon48.png",
    "128": "/icons/icon128.png"
}
const sleep = (ms) => new Promise((r) => setTimeout(r,ms));
async function setVisualStatus(tabId, status, delay=1000) {
    const icon = status ? "/icons/success.png" :  "/icons/error.png";
    try {
        chrome.action.setIcon({
            path: icon,
            tabId: tabId
        });
        await sleep(delay);
        chrome.action.setIcon({
            tabId: tabId,
            path: DEFAULT_ICON
        });
    } catch (e) {
        console.warn("Couldn't change icon.", e);
    }
}
async function performQuickCapture() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const protocol = new URL(tab.url).protocol;
    if(!['http:', 'https:', 'file:'].includes(protocol)) {
        const captureButton = document.getElementById("capture-button");
        captureButton.disabled = true;
        captureButton.textContent = "Restricted URL";
        return;
    }
    try {
        const data = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" });
        await sendToBackend(tab.id, data, "");
    } catch (err) {
        console.error(err);
        await setVisualStatus(tab.id, false, 5000);
    }
}
async function sendToBackend(tabId, data, context) {
    const {server_port, use_markdown}= await chrome.storage.local.get({
        server_port: "18080",
        use_markdown: false
    });
    const payload = {
        ...data,
        context: context,
        markdown: use_markdown,
        timestamp: new Date().toISOString()
    };
    const response = await fetch(`http://localhost:${server_port}/api/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (response.ok) {
        await setVisualStatus(tabId, true);
    } else {
        throw new Error("Server error");
    }
}
