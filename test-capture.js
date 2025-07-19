// test-capture-v3.js - 改進版7-11批次列印處理
(function() {
  'use strict';
  
  // 測試配置
  const TEST_CONFIG = {
    PROVIDERS: {
      SEVEN: {
        name: '7-11',
        keywords: ['統一超商', '7-ELEVEN', '7-11', '交貨便'],
        patterns: {
          order: /寄件訂單編號[：:]\s*([A-Z0-9]+)/i,
          store: /取件\s*\n?\s*門市[：:]\s*([^,\n]+)/i,
          recipient: /取件人[：:]\s*([^\n]+)/i,
          barcode: /物流條碼[：:]\s*([A-Z0-9]+)/i
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
  
  // 建立測試UI
  function createTestUI() {
    const oldPanel = document.getElementById('bv-test-panel');
    if (oldPanel) oldPanel.remove();
    
    const panel = document.createElement('div');
    panel.id = 'bv-test-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 350px;
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
        🚚 物流單截圖測試工具 v3
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
      <div id="test-results" style="margin-top: 15px; max-height: 300px; overflow-y: auto;"></div>
    `;
    
    document.body.appendChild(panel);
    
    // 綁定事件
    document.getElementById('test-detect').addEventListener('click', detectShippingLabels);
    document.getElementById('test-capture').addEventListener('click', captureAllLabels);
    document.getElementById('test-view').addEventListener('click', viewResults);
    document.getElementById('test-close').addEventListener('click', () => panel.remove());
    
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
  
  // 偵測物流單 - 改進版
  function detectShippingLabels() {
    const status = document.getElementById('test-status');
    const results = document.getElementById('test-results');
    detectedLabels = [];
    
    status.innerHTML = '🔍 正在偵測物流單...';
    status.style.background = '#e3f2fd';
    results.innerHTML = '';
    
    // 偵測7-11批次列印的特殊結構
    // 方法1: 尋找包含 div_frame 的區塊
    const frames = document.querySelectorAll('.div_frame');
    console.log(`找到 ${frames.length} 個 div_frame`);
    
    if (frames.length > 0) {
      // 這是7-11的批次列印格式
      frames.forEach((frame, index) => {
        const text = frame.textContent || '';
        
        // 提取訂單資訊
        const orderMatch = text.match(TEST_CONFIG.PROVIDERS.SEVEN.patterns.order);
        const storeMatch = text.match(TEST_CONFIG.PROVIDERS.SEVEN.patterns.store);
        const recipientMatch = text.match(TEST_CONFIG.PROVIDERS.SEVEN.patterns.recipient);
        const barcodeMatch = text.match(TEST_CONFIG.PROVIDERS.SEVEN.patterns.barcode);
        
        if (orderMatch) {
          // 找到包含此 frame 的外層容器（用於截圖）
          let container = frame.closest('td > div') || frame.parentElement;
          
          detectedLabels.push({
            provider: 'SEVEN',
            providerName: '7-11',
            element: container,
            frame: frame,
            orderNo: orderMatch[1],
            storeName: storeMatch ? storeMatch[1].trim() : '未知',
            recipient: recipientMatch ? recipientMatch[1].trim() : '未知',
            barcode: barcodeMatch ? barcodeMatch[1] : '',
            index: index,
            isBatchPrint: true
          });
        }
      });
    } else {
      // 方法2: 傳統表格偵測
      const tables = document.querySelectorAll('table');
      
      tables.forEach((table, index) => {
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
                storeName: storeMatch ? storeMatch[1].trim() : '未知',
                index: index,
                isBatchPrint: false
              });
            }
          }
        });
      });
    }
    
    // 顯示結果
    if (detectedLabels.length > 0) {
      status.innerHTML = `✅ 偵測到 ${detectedLabels.length} 張物流單`;
      status.style.background = '#c8e6c9';
      
      // 群組顯示
      const groups = {};
      detectedLabels.forEach(label => {
        const key = label.isBatchPrint ? '7-11 批次列印' : label.providerName;
        if (!groups[key]) groups[key] = [];
        groups[key].push(label);
      });
      
      Object.entries(groups).forEach(([groupName, labels]) => {
        const groupDiv = document.createElement('div');
        groupDiv.style.cssText = 'margin: 10px 0; padding: 10px; background: #e8f5e9; border-radius: 6px;';
        groupDiv.innerHTML = `<strong style="color: #2e7d32;">${groupName} (${labels.length}張)</strong>`;
        results.appendChild(groupDiv);
        
        labels.forEach(label => {
          const item = document.createElement('div');
          item.style.cssText = 'padding: 6px; margin: 4px 0 4px 20px; background: #ffffff; border-radius: 4px; font-size: 12px; border-left: 3px solid #4caf50;';
          item.innerHTML = `
            <strong>${label.orderNo}</strong><br>
            <span style="color: #666;">📍 ${label.storeName}</span>
            ${label.recipient ? `<br><span style="color: #666;">👤 ${label.recipient}</span>` : ''}
            ${label.barcode ? `<br><span style="color: #999; font-size: 11px;">📦 ${label.barcode}</span>` : ''}
          `;
          results.appendChild(item);
        });
      });
      
      document.getElementById('test-capture').disabled = false;
    } else {
      status.innerHTML = '❌ 未偵測到物流單';
      status.style.background = '#ffcdd2';
      
      const debugInfo = document.createElement('div');
      debugInfo.style.cssText = 'margin-top: 10px; padding: 10px; background: #fff3e0; border-radius: 4px; font-size: 12px;';
      debugInfo.innerHTML = `
        <strong>📊 除錯資訊：</strong><br>
        • 找到 ${document.querySelectorAll('.div_frame').length} 個 div_frame<br>
        • 找到 ${document.querySelectorAll('table').length} 個表格<br>
        • 頁面URL: ${window.location.hostname}<br>
        • 請確認頁面是否包含物流單
      `;
      results.appendChild(debugInfo);
    }
  }
  
  // 載入 html2canvas
  async function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      if (typeof html2canvas !== 'undefined') {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = () => {
        console.log('html2canvas 載入成功');
        resolve();
      };
      script.onerror = () => {
        console.error('html2canvas 載入失敗');
        reject(new Error('無法載入 html2canvas'));
      };
      document.head.appendChild(script);
    });
  }
  
  // 截圖所有物流單
  async function captureAllLabels() {
    const status = document.getElementById('test-status');
    capturedImages = [];
    
    try {
      status.innerHTML = '📸 載入截圖函式庫...';
      status.style.background = '#e1f5fe';
      
      await loadHtml2Canvas();
      
      let captureCount = 0;
      const total = detectedLabels.length;
      
      for (const label of detectedLabels) {
        captureCount++;
        status.innerHTML = `📸 截圖中... ${captureCount}/${total}`;
        
        try {
          // 調整截圖選項以獲得更好的品質
          const canvas = await html2canvas(label.element, {
            scale: 3, // 提高解析度
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: label.element.offsetWidth,
            height: label.element.offsetHeight
          });
          
          capturedImages.push({
            provider: label.providerName,
            orderNo: label.orderNo,
            storeName: label.storeName,
            recipient: label.recipient,
            barcode: label.barcode,
            imageData: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
            timestamp: new Date().toISOString(),
            isBatchPrint: label.isBatchPrint
          });
          
          // 短暫延遲避免過載
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (err) {
          console.error(`截圖失敗 ${label.orderNo}:`, err);
          status.innerHTML = `⚠️ 截圖失敗: ${label.orderNo}`;
        }
      }
      
      status.innerHTML = `✅ 截圖完成！共 ${capturedImages.length} 張`;
      status.style.background = '#c8e6c9';
      document.getElementById('test-view').disabled = false;
      
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
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;
    
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
    header.innerHTML = `
      <h2 style="margin: 0; color: #2196F3;">📸 截圖結果預覽</h2>
      <button onclick="document.getElementById('bv-test-viewer').remove()" 
              style="padding: 8px 20px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
        關閉
      </button>
    `;
    content.appendChild(header);
    
    // 以網格方式顯示圖片
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;';
    
    capturedImages.forEach((img, index) => {
      const card = document.createElement('div');
      card.style.cssText = 'border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: #fafafa;';
      
      card.innerHTML = `
        <div style="padding: 15px; background: #f5f5f5; border-bottom: 1px solid #e0e0e0;">
          <h4 style="margin: 0 0 5px 0; color: #1976D2; font-size: 16px;">
            ${img.orderNo}
          </h4>
          <p style="margin: 0; font-size: 13px; color: #666;">
            ${img.provider} - ${img.storeName}
            ${img.recipient ? `<br>收件人: ${img.recipient}` : ''}
          </p>
        </div>
        <div style="padding: 10px; text-align: center; background: white;">
          <img src="${img.imageData}" 
               style="max-width: 100%; max-height: 400px; border: 1px solid #ddd;" 
               onclick="window.open('${img.imageData}', '_blank')">
        </div>
        <div style="padding: 10px; font-size: 11px; color: #999; text-align: center;">
          ${img.width} × ${img.height}px | 點擊查看大圖
        </div>
      `;
      
      grid.appendChild(card);
    });
    
    content.appendChild(grid);
    viewer.appendChild(content);
    document.body.appendChild(viewer);
  }
  
  // 下載結果
  function downloadResults() {
    console.log('開始下載截圖...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    // 批次下載所有圖片
    capturedImages.forEach((img, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = img.imageData;
        link.download = `7-11_${img.orderNo}_${timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 300);
    });
    
    // 建立摘要資訊
    const summary = {
      captureTime: new Date().toISOString(),
      url: window.location.href,
      totalImages: capturedImages.length,
      type: capturedImages[0]?.isBatchPrint ? '7-11批次列印' : '一般物流單',
      images: capturedImages.map(img => ({
        orderNo: img.orderNo,
        provider: img.provider,
        storeName: img.storeName,
        recipient: img.recipient,
        barcode: img.barcode,
        size: `${img.width}×${img.height}px`
      }))
    };
    
    // 下載摘要JSON
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `物流單摘要_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, capturedImages.length * 300 + 500);
  }
  
  // 初始化
  createTestUI();
  console.log('=== 7-11批次列印測試工具 v3 已載入 ===');
  console.log('特點：');
  console.log('- 支援7-11批次列印格式偵測');
  console.log('- 改進截圖品質（3倍解析度）');
  console.log('- 顯示完整物流單資訊');
  console.log('- 網格式預覽介面');
  
})();
