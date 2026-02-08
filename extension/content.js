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

    // ** Handle badge
    // Check only mouseup to keep extension lightweight.
    let badgeActive = false;
    const checkSelection = () => {
      const sActive = window.getSelection().toString() ? true : false;
      if (badgeActive !== sActive) {
        badgeActive = sActive;
        chrome.runtime.sendMessage({ action: "SELECTION_BADGE", sActive: sActive });
      }
    };
    //When clicking on a selection, the selection disappears after mouseup.
    //Hence, delay the hook (the browser takes <50ms, hopefully)
    document.addEventListener("mouseup", () => setTimeout(checkSelection, 50));
      // ** Send response
    sendResponse({
      source_url: window.location.href,
      page_title: document.title,
      selection_text: selectedText,
      selection_html: selectedHtml
    });
  }
});
