// * Get Content from the page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_SELECTION") {

      // ** Get HTML
    const selection = window.getSelection();
    let selectedHtml = "";
    let selectedText = selection.toString();

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = document.createElement("div");
      container.appendChild(range.cloneContents());
      // ** un-relativize paths
      container.querySelectorAll('a').forEach(z => {z.href = z.href;});
      container.querySelectorAll('img').forEach(z => {z.src = z.src;});
      selectedHtml = container.innerHTML;
    }

      // ** Send response
    sendResponse({
      source_url: window.location.href,
      page_title: document.title,
      selection_text: selectedText,
      selection_html: selectedHtml
    });
  }
});
