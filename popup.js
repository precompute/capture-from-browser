document.addEventListener("DOMContentLoaded", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const contextInput = document.getElementById("context");
    const sendBtn = document.getElementById("capture-btn");
    const statusDot = document.getElementById("status-dot");

    let captureData = null;
    try {
        captureData = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" });
        if (captureData.selection_text) {
            statusDot.style.backgroundColor = "green";
        } else {
            statusDot.style.backgroundColor = "yellow";
        }
    } catch (e) {
            statusDot.style.backgroundColor = "red";
    }

    const handleSend = async () => {
        if (!captureData) return;

        sendBtn.textContent = "Capturing";
        const context = contextInput.value;

        const payload = {
            ...captureData,
            context: context,
            timestamp: new Date().toISOString()
        };

        try {
            const res = await fetch("http://localhost:18080/api/capture", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                sendBtn.textContent = "Saved!";
                sendBtn.style.backgroundColor = "green";
                setTimeout(() => window.close(), 100);
            } else {
                sendBtn.textContent = "Server Error";
                sendBtn.style.backgroundColor = "red";
            }
        } catch (err) {
            sendBtn.textContent = "Connection Failed";
            sendBtn.style.backgroundColor = "red";
        }
    };

    sendBtn.addEventListener("click", handleSend);

    contextInput.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            handleSend();
        }
    });

    contextInput.focus();
});
