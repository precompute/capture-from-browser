chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_SELECTION") {

        const selection = window.getSelection();
        let selectedHtml = "";
        let selectedText = selection.toString();

        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = document.createElement("div");
            container.appendChild(range.cloneContents());
            selectedHtml = container.innerHTML;
        }

        sendResponse({
            source_url: window.location.href,
            page_title: document.title,
            selection_text: selectedText,
            selection_html: selectedHtml
        });
    }
});
