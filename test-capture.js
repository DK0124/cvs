(function() {
  'use strict';
  
  let isTestUIVisible = false;
  
  // 測試配置
  const TEST_CONFIG = {
    PROVIDERS: {
      SEVEN: {
        name: '7-11',
        keywords: ['統一超商', '7-ELEVEN', '7-11'],
        patterns: {
          order: /訂單編號[：:]\s*([A-Z0-9]+)/i,
          store: /門市名稱[：:]\s*([^,\n]+)/i
        }
      },
      FAMILY: {
        name: '全家',
        keywords: ['全家便利商店', 'FamilyMart', '全家'],
        patterns: {
          order: /訂單號碼[：:]\s*([A-Z0-9]+)/i,
          store: /店舖名稱[：:]\s*([^,\n]+)/i
        }
      },
      HILIFE: {
        name: '萊爾富',
        keywords: ['萊爾富', 'Hi-Life'],
        patterns: {
          order: /訂單編號[：:]\s*([A-Z0-9]+)/i,
          store: /門市名稱[：:]\s*([^,\n]+)/i
        }
      },
      OKMART: {
        name: 'OK超商',
        keywords: ['OK.', 'OK超商', 'OKmart'],
        patterns: {
          order: /訂單編號[：:]\s*([A-Z0-9]+)/i,
          store: /門市名稱[：:]\s*([^,\n]+)/i
        }
      }
    }
  };
  
  // 監聽來自 popup 的訊息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'activateTestTool') {
      if (!isTestUIVisible) {
        createTestUI();
        isTestUIVisible = true;
      }
      sendResponse({ success: true });
    }
    return true;
  });
  
  // 建立測試UI
  function createTestUI() {
    // 移除舊的測試面板
    const oldPanel = document.getElementById('bv-test-panel');
    if (oldPanel) oldPanel.remove();
    
    const panel = document.createElement('div');
    panel.id = 'bv-test-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 320px;
      background: white;
      border: 2px solid #2196F3;
      border-radius: 8px;
      padding: 20px;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      font-family: Arial, sans-serif;
    `;
    
    panel.innerHTML = `
      <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #2196F3;">
        🚚 物流單截圖測試工具
      </h3>
      <div id="test-status" style="margin: 10px 0; padding: 12px; background: #f0f0f0; border-radius: 6px; font-size: 13px;">
        準備就緒，請點擊偵測按鈕開始
      </div>
      <button id="test-detect" style="width: 100%; padding: 10px; margin: 5px 0; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;">
        🔍 偵測物流單
      </button>
      <button id="test-capture" style="width: 100%; padding: 10px; margin: 5px 0; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;" disabled>
        📸 開始截圖
      </button>
      <button id="test-view" style="width: 100%; padding: 10px; margin: 5px 0; background: #FF9800; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;" disabled>
        👁️ 查看結果
      </button>
      <button id="test-close" style="width: 100%; padding: 10px; margin: 5px 0; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;">
        ❌ 關閉測試工具
      </button>
      <div id="test-results" style="margin-top: 15px; max-height: 250px; overflow-y: auto;"></div>
    `;
    
    document.body.appendChild(panel);
    
    // 綁定事件
    document.getElementById('test-detect').addEventListener('click', detectShippingLabels);
    document.getElementById('test-capture').addEventListener('click', captureAllLabels);
    document.getElementById('test-view').addEventListener('click', viewResults);
    document.getElementById('test-close').addEventListener('click', () => {
      panel.remove();
      isTestUIVisible = false;
    });
    
    // 使面板可拖曳
    makeDraggable(panel);
  }
  
  // 使元素可拖曳
  function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.querySelector('h3').style.cursor = 'move';
    element.querySelector('h3').onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
  
  // 偵測結果存儲
  let detectedLabels = [];
  let capturedImages = [];
  
  // 輔助函數：檢查元素是否包含關鍵字
  function containsKeywords(element, keywords) {
    const text = element.textContent || '';
    return keywords.some(keyword => text.includes(keyword));
  }
  
  // 偵測物流單
  function detectShippingLabels() {
    const status = document.getElementById('test-status');
    const results = document.getElementById('test-results');
    detectedLabels = [];
    
    status.innerHTML = '🔍 正在偵測物流單...';
    status.style.background = '#e3f2fd';
    results.innerHTML = '';
    
    // 取得所有表格
    const tables = document.querySelectorAll('table');
    
    tables.forEach((table, index) => {
      // 檢查每個提供商
      Object.entries(TEST_CONFIG.PROVIDERS).forEach(([key, provider]) => {
        if (containsKeywords(table, provider.keywords)) {
          const text = table.textContent || '';
          const orderMatch = text.match(provider.patterns.order);
          const storeMatch = text.match(provider.patterns.store);
          
          if (orderMatch) {
            detectedLabels.push({
              provider: key,
              providerName: provider.name,
              element: table,
              orderNo: orderMatch[1],
              storeName: storeMatch ? storeMatch[1] : '未知',
              index: index
            });
          }
        }
      });
    });
    
    // 特殊處理：檢查是否為7-11 A4格式（四格）
    check711A4Format();
    
    // 顯示結果
    if (detectedLabels.length > 0) {
      status.innerHTML = `✅ 偵測到 ${detectedLabels.length} 張物流單`;
      status.style.background = '#c8e6c9';
      
      detectedLabels.forEach(label => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 8px; margin: 5px 0; background: #f5f5f5; border-radius: 4px; font-size: 13px; border-left: 3px solid #2196F3;';
        item.innerHTML = `
          <strong style="color: #1976D2;">${label.providerName}</strong> - ${label.orderNo}<br>
          <span style="color: #666; font-size: 12px;">📍 ${label.storeName}</span>
          ${label.is711A4 ? '<span style="color: #f44336; font-size: 11px;"> (A4四格)</span>' : ''}
        `;
        results.appendChild(item);
      });
      
      document.getElementById('test-capture').disabled = false;
    } else {
      status.innerHTML = '❌ 未偵測到物流單';
      status.style.background = '#ffcdd2';
      
      // 顯示頁面資訊幫助除錯
      const debugInfo = document.createElement('div');
      debugInfo.style.cssText = 'margin-top: 10px; padding: 10px; background: #fff3e0; border-radius: 4px; font-size: 12px;';
      debugInfo.innerHTML = `
        <strong>📊 除錯資訊：</strong><br>
        • 找到 ${tables.length} 個表格<br>
        • 頁面URL: ${window.location.hostname}<br>
        • 請確認頁面是否包含物流單
      `;
      results.appendChild(debugInfo);
    }
  }
  
  // 檢查7-11 A4格式
  function check711A4Format() {
    const allElements = document.querySelectorAll('div, td, body');
    
    allElements.forEach(container => {
      const tables = container.querySelectorAll('table');
      const sevenTables = [];
      
      tables.forEach(table => {
        if (containsKeywords(table, TEST_CONFIG.PROVIDERS.SEVEN.keywords)) {
          let isNested = false;
          sevenTables.forEach(existingTable => {
            if (existingTable.contains(table) || table.contains(existingTable)) {
              isNested = true;
            }
          });
          
          if (!isNested) {
            sevenTables.push(table);
          }
        }
      });
      
      if (sevenTables.length === 4) {
        console.log('發現7-11 A4格式，包含4個表格');
        
        detectedLabels.forEach(label => {
          if (label.provider === 'SEVEN' && sevenTables.includes(label.element)) {
            label.is711A4 = true;
            label.container = container;
            label.allTables = sevenTables;
          }
        });
      }
    });
  }
  
  // 截圖所有物流單
  async function captureAllLabels() {
    const status = document.getElementById('test-status');
    capturedImages = [];
    
    try {
      status.innerHTML = '📸 準備截圖...';
      status.style.background = '#e1f5fe';
      
      // html2canvas 已經在 manifest 中載入
      if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas 未載入');
      }
      
      // 處理非A4格式的物流單
      let captureCount = 0;
      const normalLabels = detectedLabels.filter(label => !label.is711A4);
      
      for (const label of normalLabels) {
        captureCount++;
        status.innerHTML = `📸 截圖中... ${captureCount}/${detectedLabels.length}`;
        
        try {
          const canvas = await html2canvas(label.element, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false
          });
          
          capturedImages.push({
            provider: label.providerName,
            orderNo: label.orderNo,
            storeName: label.storeName,
            imageData: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          console.error('截圖失敗:', err);
        }
      }
      
      // 處理7-11 A4格式
      const a4Labels = detectedLabels.filter(label => label.is711A4);
      if (a4Labels.length > 0) {
        status.innerHTML = '📸 處理7-11 A4格式...';
        
        const firstLabel = a4Labels[0];
        const tables = firstLabel.allTables;
        
        for (let i = 0; i < Math.min(4, tables.length); i++) {
          try {
            const canvas = await html2canvas(tables[i], {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              logging: false
            });
            
            capturedImages.push({
              provider: '7-11 (A4格式)',
              orderNo: firstLabel.orderNo,
              storeName: firstLabel.storeName,
              section: i + 1,
              sectionName: ['左上', '右上', '左下', '右下'][i],
              imageData: canvas.toDataURL('image/png'),
              width: canvas.width,
              height: canvas.height,
              timestamp: new Date().toISOString()
            });
          } catch (err) {
            console.error('A4格式截圖失敗:', err);
          }
        }
      }
      
      status.innerHTML = `✅ 截圖完成！共 ${capturedImages.length} 張`;
      status.style.background = '#c8e6c9';
      document.getElementById('test-view').disabled = false;
      
      // 儲存到 chrome.storage
      chrome.storage.local.set({
        testCapturedImages: capturedImages,
        testCaptureTime: new Date().toISOString()
      }, () => {
        console.log('截圖已儲存到 chrome.storage');
      });
      
      // 自動下載
      if (capturedImages.length > 0) {
        setTimeout(() => downloadResults(), 500);
      }
      
    } catch (error) {
      status.innerHTML = `❌ 錯誤: ${error.message}`;
      status.style.background = '#ffcdd2';
      console.error('截圖錯誤:', error);
    }
  }
  
  // 查看結果
  function viewResults() {
    const oldViewer = document.getElementById('bv-test-viewer');
    if (oldViewer) oldViewer.remove();
    
    const viewer = document.createElement('div');
    viewer.id = 'bv-test-viewer';
    viewer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.95);
      z-index: 999999;
      overflow: auto;
      padding: 20px;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;
    
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
    header.innerHTML = `
      <h2 style="margin: 0; color: #2196F3;">📸 截圖結果</h2>
      <button onclick="document.getElementById('bv-test-viewer').remove()" style="padding: 8px 20px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
        關閉
      </button>
    `;
    content.appendChild(header);
    
    capturedImages.forEach((img, index) => {
      const imgContainer = document.createElement('div');
      imgContainer.style.cssText = 'margin: 20px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa;';
      
      imgContainer.innerHTML = `
        <h3 style="margin: 0 0 10px 0; color: #1976D2;">
          ${img.provider} - ${img.orderNo}
        </h3>
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px;">
          <div>
            <p style="margin: 5px 0; font-size: 14px;"><strong>門市:</strong> ${img.storeName}</p>
            ${img.section ? `<p style="margin: 5px 0; font-size: 14px;"><strong>區塊:</strong> ${img.sectionName}</p>` : ''}
            <p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>尺寸:</strong> ${img.width} x ${img.height}px</p>
            <p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>時間:</strong> ${new Date(img.timestamp).toLocaleString()}</p>
          </div>
          <div style="text-align: center;">
            <img src="${img.imageData}" style="max-width: 100%; max-height: 400px; border: 2px solid #ddd; border-radius: 4px;">
          </div>
        </div>
      `;
      
      content.appendChild(imgContainer);
    });
    
    viewer.appendChild(content);
    document.body.appendChild(viewer);
  }
  
  // 下載結果
  function downloadResults() {
    console.log('開始下載截圖...');
    
    capturedImages.forEach((img, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = img.imageData;
        const section = img.section ? `-${img.sectionName}` : '';
        link.download = `${img.provider}_${img.orderNo}${section}_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 300);
    });
    
    // 建立並下載摘要
    const summary = {
      captureTime: new Date().toISOString(),
      url: window.location.href,
      totalImages: capturedImages.length,
      images: capturedImages.map(img => ({
        provider: img.provider,
        orderNo: img.orderNo,
        storeName: img.storeName,
        section: img.section,
        sectionName: img.sectionName,
        size: `${img.width}x${img.height}`
      }))
    };
    
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `物流單摘要_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, capturedImages.length * 300 + 500);
  }
  
  console.log('物流單截圖測試工具已載入，請點擊擴充套件圖示啟動');
  
})();
