// * Popup (GUI)
document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const contextTextArea = document.getElementById("context");
  const previewTextArea = document.getElementById("preview");
  const captureButton = document.getElementById("capture-button");
  const previewButton = document.getElementById("preview-button");
  const markdownButton = document.getElementById("markdown-button");
  const portInput = document.getElementById("port-input");
  const captureLogTable = document.getElementById("capture-log-table");
  const captureLogTableBody = document.getElementById("capture-log-table-body");
  const protocol = new URL(tab.url).protocol;
  // ** Check for invalid URLs
  if(!['http:', 'https:', 'file:'].includes(protocol)) {
    captureButton.disabled = true;
    captureButton.textContent = "Restricted URL";
    return;
  }

  // ** Close Popup on tab change
  chrome.tabs.onActivated.addListener(() => {
    window.close();
  })

  // ** Load data from local storage
  let settings = await chrome.storage.local.get({
    saved_server_port: "18080",
    use_markdown: false,
    show_preview: true,
    saved_context: ""
  })

  portInput.value = settings.saved_server_port;
  contextTextArea.value = settings.saved_context;
  updateMarkdownButton(settings.use_markdown);
  updatePreviewButton(settings.show_preview);
  updatePreviewTextArea(settings.show_preview);

  // *** Save inputarea text
  const saveContextInput = () => {
    chrome.storage.local.set({
      saved_context: contextTextArea.value
    });
  };
  contextTextArea.addEventListener("blur", saveContextInput);
  window.addEventListener("blur", saveContextInput);

  // *** Validate and save port
  function validPort(val) {
    const port = parseInt(val, 10);
    return !isNaN(port) && port > 0 && port <= 65535;
  }
  portInput.addEventListener("input", () => {
    const valid = validPort(portInput.value);
    portInput.style.backgroundColor = valid ? "var(--bg)" : "rgba(255,0,0,0.1)";
    if (valid) {
      chrome.storage.local.set({
        saved_server_port: portInput.value
      });
    }
  });

  // *** Save and show Markdown status
  markdownButton.addEventListener("click", () => {
    settings.use_markdown = !settings.use_markdown;
    chrome.storage.local.set({
      use_markdown: settings.use_markdown
    });
    updateMarkdownButton(settings.use_markdown);
  });
  function updateMarkdownButton(enabled) {
    markdownButton.style.color = enabled ? "var(--c1)" : "var(--c2)";
    markdownButton.textContent = enabled ? "✔Markdown" : "✘Markdown";
  }

  // *** Save and show Preview status
  previewButton.addEventListener('click', () => {
    settings.show_preview = !settings.show_preview;
    chrome.storage.local.set({
      show_preview: settings.show_preview
    });
    updatePreviewTextArea(settings.show_preview);
    updatePreviewButton(settings.show_preview);
  });
  function updatePreviewTextArea(enabled) {
    previewTextArea.style.display = enabled ? 'block' : 'none';
  }
  function updatePreviewButton(enabled) {
    previewButton.style.color = enabled ? "var(--c1)" : "var(--c2)";
    previewButton.textContent = enabled ? "✔Preview" : "✘Preview";
  }

  // *** Render and display log
  async function renderActionLog() {
    const {action_log} = await chrome.storage.local.get({action_log: []});
    if (action_log.length === 0) {
      captureLogTable.style.display = "none";
      return;
    }
    captureLogTable.style.display = "table";
    captureLogTableBody.replaceChildren();
    const currentTime = Date.now();
    action_log.forEach(z => {
      const row = document.createElement("tr");
      const serverStatus = z.status ? "✔" : "✘";
      const timesince = (() => {
        const t = (currentTime - new Date(z.timestamp)) / 1000;
        if (t<60) return t.toFixed(1) + "s";
        if (t<3600) return (t/60).toFixed(1) + "m";
        if (t<86400) return (t/3600).toFixed(1) + "h";
        return (t/86400).toFixed(1) + "d";
      })();
      const pageTitle = z.pageTitle;

      let domain = "";
      let pageURL = z.url ? z.url : "Blank URL!";
      try {
        domain = z.url ? new URL(z.url).hostname : "Unknown";
      } catch (e) { // unlikely to happen.  Keeping it in because of a bug during testing (invalid localstorage state)
        domain = "Blank URL!";
        pageURL = "Blank URL!";
      }

      const makeCell = (t, c, ti = "") => {
        const td = document.createElement("td");
        td.textContent = t;
        td.className = c;
        td.title = ti;
        row.appendChild(td);
      };
      makeCell(serverStatus,
               z.status ? "capturelogrow-status-success" : "capturelogrow-status-error",
               z.status ? "Successful!" : "Error!");
      makeCell(timesince, "capturelogrow-timesince", new Date(z.timestamp).toLocaleString());
      makeCell(pageTitle, "capturelogrow-pagetitle", z.pageTitle);
      makeCell(domain, "capturelogrow-domain", pageURL);
      makeCell(z.wordCountSelection,
               z.wordCountSelection > 0 ? "capturelogrow-wordcountselection" : "capturelogrow-wordcountselectionzero",
               `Selected ${z.wordCountSelection} words.`);
      makeCell(z.wordCountContext,
               z.wordCountContext > 0 ? "capturelogrow-wordcountcontext" : "capturelogrow-wordcountcontextzero",
               `Entered ${z.wordCountContext} words.`);
      captureLogTableBody.appendChild(row);
    });
  }
  await renderActionLog();

  // *** Calculate word count
  const wordCount = (str) => str.trim() ? str.trim().split(/\s+/).length : 0;
  const updateCaptureButton = () => {
    const selectCount = wordCount(previewTextArea.value);
    const contextCount = wordCount(contextTextArea.value);
    captureButton.textContent = `Capture (${selectCount} + ${contextCount})w`;
    captureButton.style.color = (selectCount + contextCount) > 0 ? "var(--c1)" : "yellow";
  };
  contextTextArea.addEventListener("input", updateCaptureButton);
  previewTextArea.addEventListener("input", updateCaptureButton);

  // ** Get Data from page
  let captureData = null;
  try {
    captureData = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" });
    contextTextArea.placeholder = "Context Input Area";
    if (captureData?.selection_text) {
      previewTextArea.value = captureData.selection_text;
      previewTextArea.style.backgroundColor = "var(--c1-dim)";
      previewTextArea.style.minHeight = "8em";
    } else {
      previewTextArea.value = "";
      previewTextArea.placeholder = "Nothing Selected.";
      previewTextArea.style.backgroundColor = "var(--c2-dim)";
      previewTextArea.style.minHeight = "1em";
    }
    updateCaptureButton();
  } catch (e) {
    captureButton.textContent = "Capture Unavailable.";
    captureButton.disabled = true;
    contextTextArea.placeholder = "";
    previewTextArea.value = "";
    previewTextArea.placeholder = "Capture Unavailable.";
    previewTextArea.style.backgroundColor = "var(--c2-dim)";
    previewTextArea.style.minHeight = "1em";
    console.error(e);
  }

  // ** Send Data
  const handleSend = async () => {
    if (!captureData) return;
    captureData.selection_text = previewTextArea.value;
    captureButton.disabled = true;
    chrome.runtime.sendMessage({
      action: "SEND_DATA",
      tabId: tab.id,
      tabUrl: tab.url,
      data: captureData,
      context: contextTextArea.value
    }, (response) => {
      captureButton.disabled = false;
      if (response?.success) {
        contextTextArea.value = "";
        chrome.storage.local.remove("saved_context");
        window.close();
      } else {
        captureButton.textContent = "Server Error";
        captureButton.style.color = "var(--c2)";
      }
    });
  };

  // *** Keybinds for sending data
  captureButton.addEventListener("click", handleSend);

  previewTextArea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSend();
    }
  });

  contextTextArea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSend();
    }
  });

  contextTextArea.focus();
});
