// * Popup (GUI)
document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const contextInput = document.getElementById("context");
  const captureButton = document.getElementById("capture-button");
  const markdownButton = document.getElementById("markdown-button");
  const portInput = document.getElementById("port-input");
  const captureLog = document.getElementById("capture-log");
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
    saved_context: ""
  })

  portInput.value = settings.saved_server_port;
  contextInput.value = settings.saved_context;
  updateMarkdownButton(settings.use_markdown);

  // *** Save inputarea text
  const saveContextInput = () => {
    chrome.storage.local.set({
      saved_context: contextInput.value
    });
  };
  contextInput.addEventListener("blur", saveContextInput);
  window.addEventListener("blur", saveContextInput);

  // *** Validate and save port
  function validPort(val) {
    const port = parseInt(val, 10);
    return !isNaN(port) && port > 0 && port <= 65535;
  }
  portInput.addEventListener("input", () => {
    const valid = validPort(portInput.value);
    portInput.style.backgroundColor = valid ? "black" : "rgba(255,0,0,0.1)";
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
    markdownButton.style.color = enabled ? "green" : "red";
    markdownButton.textContent = enabled ? "✔Markdown" : "✘Markdown";
  }

  // *** Render and display log
  async function renderActionLog() {
    const {action_log} = await chrome.storage.local.get({action_log: []});
    if (action_log.length === 0) return;
    captureLog.replaceChildren();
    const currentTime = Date.now();
    action_log.forEach(z => {
      const line = document.createElement("div");
      line.className = 'capturelogline';
      const serverStatus = z.status ? "✔" : "✘";
      const timesince = (() => {
        const t = (currentTime - new Date(z.timestamp)) / 1000;
        if (t<60) return t.toFixed(1) + "s";
        if (t<3600) return (t/60).toFixed(1) + "m";
        if (t<86400) return (t/3600).toFixed(1) + "h";
        return (t/86400).toFixed(1) + "d";
      })().padStart(6, "\u00A0");
      const domain = new URL(z.url).hostname;
      const makeSpan = (t, c) => {
        const span = document.createElement("span");
        span.textContent = t;
        span.className = c;
        line.appendChild(span);
      };
      makeSpan(serverStatus, z.status ? "capturelogline-status-success" : "capturelogline-status-error");
      makeSpan(timesince, "capturelogline-timesince");
      makeSpan(z.pageTitle, "capturelogline-pagetitle");
      makeSpan(domain, "capturelogline-domain");
      makeSpan(`${z.wordCountSelection}S`, "capturelogline-wordcountselection");
      makeSpan(`${z.wordCountContext}C`, "capturelogline-wordcountcontext");
      captureLog.appendChild(line);
    });
  }
  await renderActionLog();
  // ** Get Data from page
  let captureData = null;
  try {
    captureData = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" });
    if (captureData?.selection_text) {
      const wordCount = captureData.selection_text.trim().split(/\s+/).length;
      captureButton.textContent = `Capture ${wordCount}w`;
      captureButton.style.color = "green";
    } else {
      captureButton.textContent = "Capture";
      captureButton.style.color = "yellow";
    }
  } catch (e) {
    captureButton.textContent = "No Capture Data";
    captureButton.disabled = true;
    console.error(e);
  }

  // ** Send Data
  const handleSend = async () => {
    if (!captureData) return;
    captureButton.disabled = true;
    chrome.runtime.sendMessage({
      action: "SEND_DATA",
      tabId: tab.id,
      tabUrl: tab.url,
      data: captureData,
      context: contextInput.value
    }, (response) => {
      captureButton.disabled = false;
      if (response?.success) {
        contextInput.value = "";
        chrome.storage.local.remove("saved_context");
        window.close();
      } else {
        captureButton.textContent = "Server Error";
        captureButton.style.color = "red";
      }
    });
  };

  // *** Keybinds for sending data
  captureButton.addEventListener("click", handleSend);

  contextInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSend();
    }
  });

  contextInput.focus();
});
