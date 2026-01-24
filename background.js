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
        chrome.action.setBadgeText({ text: "OK" });
        chrome.action.setBadgeBackgroundColor({ color: "green" });
    } catch (err) {
        console.error(err);
        chrome.action.setBadgeText({ text: "ERR" });
        chrome.action.setBadgeBackgroundColor({ color: "red" });
    }
    chrome.action.setBadgeText({ text: "" });
}, 1500);
}

async function sendToBackend(data, context) {
    const payload = {
        ...data,
        context: context,
        timestamp: new Date().toISOString()
    };
    const response = await fetch("http://localhost:18080/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Server error");
}
