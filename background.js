chrome.commands.onCommand.addListener((command) => {
    if (command === "quick-capture") {
        performQuickCapture();
    }
});

async function performQuickCapture() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    try {
        const data = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" });
        await sendToBackend(data, "");
        chrome.action.setBadgeText({text: "OK", tabID: tab.id});
        chrome.action.setBadgeBackgroundColor({color: "green", tabID: tab.id});
    } catch (err) {
        console.error(err);
        chrome.action.setBadgeText({ text: "ERR", tabID: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "red", tabID: tab.id });
    }
    setTimeout(() => {
        chrome.action.setBadgeText({ text: "", tabID: tab.id });
    }, 1500);
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
