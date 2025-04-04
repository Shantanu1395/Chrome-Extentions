// Function to show toast notification
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      border-radius: 4px;
      color: white;
      background-color: ${isError ? '#ff4444' : '#4CAF50'};
      z-index: 10000;
      font-family: Arial, sans-serif;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
  
  // Function to copy text to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy text:', err);
      return false;
    }
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "showApiResult") {
      // Check if we have a valid curl command (not null, undefined, or special messages)
      if (request.curl && request.curl !== "Not found" && request.curl !== "undefined" && request.curl !== "server-rendered") {
        // Valid API found - copy to clipboard and show green toast
        copyToClipboard(request.curl).then(success => {
          if (success) {
            showToast(`API found and copied to clipboard: ${request.curl}`);
          } else {
            showToast(`API found: ${request.curl}`);
          }
        });
      } else {
        // Handle different error cases
        const message = request.curl === "server-rendered" 
          ? "API not found, probably server rendered content"
          : "No API found for this text";
        showToast(message, true);
      }
    }
  });
  