document.addEventListener("DOMContentLoaded", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const contextInput = document.getElementById("context");
    const captureButton = document.getElementById("capture-button");
    const markdownButton = document.getElementById("markdown-button");
    const portInput = document.getElementById("port-input");

    let captureData = null;
    let settings = await chrome.storage.local.get({
        server_port: "18080",
        use_markdown: false
    })

    portInput.value = settings.server_port;
    updateMarkdownButton(settings.use_markdown);

    try {
        captureData = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" });
        if (captureData.selection_text) {
            const wordCount = captureData.selection_text.trim().split(/\s+/).length;
            captureButton.textContent = `Capture ${wordCount}w`;
            captureButton.style.color = "green";
        } else {
            captureButton.textContent = "Capture";
            captureButton.style.color = "yellow";
        }
    } catch (e) {
        captureButton.textContent = "N/A";
        captureButton.disabled = true;
        console.error(e);
    }

    portInput.addEventListener("change", () => {
        chrome.storage.local.set({
            server_port: portInput.value
        });
    });

    markdownButton.addEventListener("click", () => {
        settings.use_markdown = !settings.use_markdown;
        chrome.storage.local.set({
            use_markdown: settings.use_markdown
        });
        updateMarkdownButton(settings.use_markdown);
    });

    function updateMarkdownButton(enabled) {
        markdownButton.style.color = enabled ? "green" : "red";
    }

    const handleSend = async () => {
        if (!captureData) return;

        captureButton.textContent = "Capturing";

        const currentSettings = await chrome.storage.local.get({
            server_port: "18080",
            use_markdown: false
        });

        const port = currentSettings.server_port;
        const context = contextInput.value;

        const payload = {
            ...captureData,
            context: context,
            markdown: currentSettings.use_markdown,
            timestamp: new Date().toISOString()
        };

        try {
            const res = await fetch(`http://localhost:${port}/api/capture`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                captureButton.textContent = "Saved!";
                captureButton.style.color = "green";
                chrome.runtime.sendMessage({
                    action: "FLASH_ICON",
                    tabId: tab.id,
                    success: true
                });
                setTimeout(() => window.close(), 100);
            } else {
                captureButton.textContent = "Server Error";
                captureButton.style.color = "red";
                chrome.runtime.sendMessage({
                    action: "FLASH_ICON",
                    tabId: tab.id,
                    success: false
                });
                throw new Error("Is the server up?")
            }
        } catch (err) {
            captureButton.textContent = "Connection Failed";
            captureButton.style.color = "red";
            console.error(err);
        }
    };

    captureButton.addEventListener("click", handleSend);

    contextInput.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            handleSend();
        }
    });

    contextInput.focus();
});
