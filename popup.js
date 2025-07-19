document.getElementById('activate').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'activateTestTool' }, (response) => {
    if (response && response.success) {
      window.close();
    }
  });
});

document.getElementById('close').addEventListener('click', () => {
  window.close();
});
