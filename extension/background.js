// * Background Service
// ** Listeners
// *** Quick Capture
chrome.commands.onCommand.addListener((command) => {
  if (command === "quick-capture") {
    performQuickCapture();
  }
});
// *** Requests
// **** Requests for sending data to the backend
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if(request.action === "SEND_DATA") {
    (async () => {
      try {
        await sendToBackend(request.tabId, request.tabUrl, request.data, request.context);
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
  // **** Change Badge according to state
  if (request.action === "SELECTION_BADGE") {
    const tabId = sender.tab.id;
    if (request.sActive) {
      chrome.action.setBadgeText({ tabId: tabId, text: "++" });
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#1979EA" });
    } else {
      chrome.action.setBadgeText({ tabId: tabId, text: "" });
    }
    return false;
  }
});

// ** Manage icons according to state
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

// ** Functions
// *** Log Actions to LocalStorage
async function logActions(payload, status) {
  const {action_log} = await chrome.storage.local.get({action_log: []});
  const wordCountSelection = payload.selection_text ? payload.selection_text.trim().split(/\s+/).length : 0;
  const wordCountContext = payload.context ? payload.context.trim().split(/\s+/).length : 0;
  const logEntry = {
    timestamp: payload.timestamp,
    status: status,
    pageTitle: payload.page_title,
    url: payload.source_url,
    wordCountSelection: wordCountSelection,
    wordCountContext: wordCountContext
  };
  await chrome.storage.local.set({
    action_log: [logEntry, ...action_log].slice(0, 50)
  });
}
// *** Perform Quick Capture
async function performQuickCapture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const data = await chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" });
    await sendToBackend(tab.id, tab.url, data, "");
  } catch (err) {
    console.error(err);
    await setVisualStatus(tab.id, false, 5000);
  }
}
// *** Send Data to Backend
async function sendToBackend(tabId, tabUrl, data, context) {
  const protocol = new URL(tabUrl).protocol;
  if(!['http:', 'https:', 'file:'].includes(protocol)) {
    return;
  }
  const {saved_server_port, use_markdown}= await chrome.storage.local.get({
    saved_server_port: "18080",
    use_markdown: false
  });
  const currentTimestamp = new Date().toISOString();
  const payload = {
    ...data,
    context: context,
    markdown: use_markdown,
    timestamp: currentTimestamp
  };
  const response = await fetch(`http://localhost:${saved_server_port}/api/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (response?.ok) {
    await logActions(payload, true);
    await setVisualStatus(tabId, true);
  } else {
    await logActions(payload, false);
    console.warn(response);
    throw new Error("Server error");
  }
}
