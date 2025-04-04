// In-memory store for intercepted responses and requests
let responseData = new Map();
const MAX_RESPONSES = 100; // Limit stored responses to prevent memory issues

// Create context menu item
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "findAPI",
      title: "Find API for selected text",
      contexts: ["selection"]
    });
  });
}

// Create context menu when extension is installed or updated
chrome.runtime.onInstalled.addListener(createContextMenu);

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "findAPI" && info.selectionText) {
    const searchText = info.selectionText.trim();
    let foundApi = null;

    // Search through stored responses
    for (const [url, data] of responseData) {
      if (data.responseBody && data.responseBody.includes(searchText)) {
        // Only generate curl if we have a valid URL and method
        if (url && url !== "undefined" && data.method) {
          foundApi = generateCurlCommand(url, data);
        }
        break;
      }
    }

    // If no API found or invalid data, send "Not found" with server-rendered message
    chrome.tabs.sendMessage(tab.id, {
      action: "showApiResult",
      curl: foundApi || "server-rendered"
    });
  }
});

// Listen for web requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method === "POST" && details.url && details.url !== "undefined") {
      // Store request body for POST requests
      const data = responseData.get(details.url) || {};
      data.requestBody = details.requestBody;
      responseData.set(details.url, data);
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Listen for headers
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.url && details.url !== "undefined") {
      const data = responseData.get(details.url) || {};
      data.method = details.method;
      data.requestHeaders = details.requestHeaders;
      responseData.set(details.url, data);
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

// Listen for response data
chrome.webRequest.onCompleted.addListener(
  async (details) => {
    if (!details.url || details.url === "undefined") return;

    try {
      const data = responseData.get(details.url) || {};
      data.responseHeaders = details.responseHeaders;
      
      // Only fetch response if it's a valid URL
      if (details.url.startsWith('http')) {
        const response = await fetch(details.url);
        const text = await response.text();
        data.responseBody = text;
        
        responseData.set(details.url, data);

        // Limit stored responses
        if (responseData.size > MAX_RESPONSES) {
          const firstKey = responseData.keys().next().value;
          responseData.delete(firstKey);
        }
      }
    } catch (error) {
      console.error('Error capturing response:', error);
    }
  },
  { urls: ["<all_urls>"] }
);

// Generate curl command from request details
function generateCurlCommand(url, details) {
  // Validate required fields
  if (!url || url === "undefined" || !details || !details.method) {
    return null;
  }

  let curl = `curl -X ${details.method} "${url}"`;
  
  // Add headers
  if (details.requestHeaders) {
    details.requestHeaders.forEach(header => {
      if (header.name.toLowerCase() !== 'content-length') {
        curl += ` \\\n  -H "${header.name}: ${header.value}"`;
      }
    });
  }
  
  // Add body if present
  if (details.requestBody && details.requestBody.raw) {
    try {
      const decoder = new TextDecoder();
      const rawData = details.requestBody.raw[0].bytes;
      const bodyText = decoder.decode(rawData);
      curl += ` \\\n  -d '${bodyText}'`;
    } catch (error) {
      console.error('Error processing request body:', error);
    }
  }
  
  return curl;
}

// Clean up old data periodically
setInterval(() => {
  const now = Date.now();
  for (const [url, data] of responseData) {
    if (now - data.timestamp > 30 * 60 * 1000) { // Remove after 30 minutes
      responseData.delete(url);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes