class ArchipelagoTracker {
  constructor(serverUrl, game = "", slotName = "WebSlot", password = "") {
    this.serverUrl = serverUrl;
    this.game = game;
    this.slotName = slotName;
    this.password = password;
    this.uuid = this.generateUUID();
    this.ws = null;
    this.connected = false;

    this.onRoomInfo = null;
    this.onConnected = null;
    this.onDisconnected = null;
    this.onError = null;
    this.onMessage = null;
  }

  generateUUID() {
    const chars = "0123456789abcdef";
    let uuid = "";
    for (let i = 0; i < 16; i++) {
      uuid += chars[Math.floor(Math.random() * chars.length)];
    }
    return uuid;
  }

  connect() {
    console.log("Tentative de connexion à:", this.serverUrl);
    this.ws = new WebSocket(this.serverUrl);

    this.ws.onopen = () => {
      console.log("WebSocket connecté");

      const tags = ["Frisson", "Tracker", "NoText"];
      const connectPacket = [{
        cmd: "Connect",
        game: this.game,
        uuid: this.uuid,
        name: this.slotName,
        password: this.password,
        version: { major: 0, minor: 6, build: 2, class: "Version" },
        tags: tags,
        items_handling: 7
      }];

      this.ws.send(JSON.stringify(connectPacket));
    };

this.ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    console.log("Message reçu :", msg);

    if (window.electronAPI) {
      window.electronAPI.sendToMainConsole(msg);
    }

    if (Array.isArray(msg)) {
      msg.forEach(packet => {
        if (packet.cmd === "RoomInfo" && this.onRoomInfo) {
          this.onRoomInfo(packet);
          if (window.electronAPI) {
            window.electronAPI.sendRoomInfo(packet);
          }
        }
        else if (packet.cmd === "Connected" && this.onConnected) {
          this.onConnected(packet);
          if (window.electronAPI && packet.slot_data) {
            window.electronAPI.sendSlotData(packet.slot_data);
          }
        }
        else if (packet.cmd === "Disconnected" && this.onDisconnected) this.onDisconnected(packet);

		
if (packet.cmd === "ReceivedItems" && Array.isArray(packet.items)) {
  packet.items.forEach(item => {
    const itemId = String(item.item);
    const currentCount = receivedItemCounts.get(itemId) || 0;
    receivedItemCounts.set(itemId, currentCount + 1);
    
    if (item.location !== undefined && item.location >= 0) {
      completedChecks.add(item.location);
    }
    
    const trophyInfo = trophyLevels[item.item];
    if (trophyInfo) {
      const imageId = trophyInfo.id;
      syncBestTrophyFromChecked(imageId);
    }
  });
  updateCheckedImages();
  updateCheckmarks();
}
      });

      if (this.onMessage) this.onMessage(msg);
    }
  } catch (e) {
    console.error("Erreur de parsing :", e);
    if (this.onError) this.onError(e);
  }
};

    this.ws.onerror = (event) => {
      console.error("Erreur WebSocket", event);
      if (this.onError) this.onError(event);
    };

    this.ws.onclose = (event) => {
      console.log(`Déconnecté (code ${event.code}, raison: ${event.reason})`);
      this.connected = false;
      if (this.onDisconnected) this.onDisconnected();
    };
  }

disconnect() {
  if (this.ws) {
    this.ws.close();
    this.ws = null;
    this.connected = false;
    if (this.onDisconnected) this.onDisconnected();
    
    localStorage.removeItem('apSlotData');
    receivedItemCounts.clear();
    receivedItemIds.clear();
    completedChecks.clear();
  }
}
}
const receivedItemCounts = new Map();
const receivedItemIds = new Set();
const completedChecks = new Set();

const checkIdToImageId = {};
const itemIdToImageId = {};
const trophyLevels = {};

function updateCheckedImages() {
  const images = document.querySelectorAll('.tracker-image[data-image-id]');
  images.forEach(img => {
    const imageId = img.getAttribute('data-image-id');
    const item = window.trackerConfig.items.find(i => i.id === imageId);
    const isChecked = completedChecksMatchImageId(imageId);
    
    let itemCount = 0;
    receivedItemCounts.forEach((count, itemId) => {
      if (itemId === imageId || itemIdToImageId[itemId] === imageId) {
        itemCount += count;
      }
    });
    

    const container = img.closest('.image-container');
    if (container) {

      container.querySelectorAll('.item-counter').forEach(el => el.remove());
      
      if (itemCount > 0) {
        if (item?.countMode === 'images' && item?.countImages?.length > 0) {

          const imageIndex = Math.min(itemCount - 1, item.countImages.length - 1);
          img.src = item.countImages[imageIndex]; 
          

          container.querySelectorAll('.count-image').forEach(el => el.remove());
        } else if (itemCount > 1 && item?.countMode !== 'images') {

          const counter = document.createElement('div');
          counter.className = 'item-counter';
          counter.textContent = itemCount;
          container.appendChild(counter);
        }
      }
    }
    
    if (isChecked || itemCount > 0) {
      img.classList.add('full-opacity');
    } else {
      img.classList.remove('full-opacity');
    }
  });
}

function completedChecksMatchImageId(imageId) {
  return Object.entries(checkIdToImageId).some(([checkId, mappedId]) =>
    completedChecks.has(Number(checkId)) && mappedId === imageId
  );
}

function syncBestTrophyFromChecked(imageId) {
  let best = null;
  Object.entries(trophyLevels).forEach(([checkId, data]) => {
    if (data.id !== imageId) return;
    if (!completedChecks.has(Number(checkId))) return;
    if (!best || data.level > best.level) best = data;
  });

  if (!best) return;

  const images = document.querySelectorAll(`img[data-image-id="${imageId}"]`);
  images.forEach(img => {
    const container = img.closest('.image-container');
    if (!container) return;

    removeTrophy(container, imageId);
    addTrophy(container, imageId, best.src);
  });
}

function updateCheckmarks() {
  document.querySelectorAll('.tracker-image[data-image-id][data-checked-locations]').forEach(img => {
    try {
      const checkedLocs = JSON.parse(img.dataset.checkedLocations);
      const imageId = img.dataset.imageId;
      const container = img.closest('.image-container');
      
      if (!container) return;

      
      container.querySelectorAll('.checkmark-image').forEach(el => el.remove());

      let highestPriorityCheck = null;
      checkedLocs.forEach(loc => {
        const checkId = Number(loc.checkId);
        if (completedChecks.has(checkId)) {
          const currentOrder = Number(loc.order) || 0;
          if (!highestPriorityCheck || currentOrder > highestPriorityCheck.order) {
            highestPriorityCheck = {
              checkId,
              imageSrc: loc.imageSrc,
              order: currentOrder
            };
          }
        }
      });

      if (highestPriorityCheck && highestPriorityCheck.imageSrc) {
        const checkmark = document.createElement('img');
        checkmark.src = highestPriorityCheck.imageSrc;
        checkmark.className = 'checkmark-image';
        checkmark.dataset.imageId = imageId;
        checkmark.dataset.checkId = highestPriorityCheck.checkId;
        
       
        checkmark.style.position = "absolute";
        checkmark.style.bottom = "5px";
        checkmark.style.right = "5px";
        checkmark.style.width = "24px";
        checkmark.style.height = "24px";
        checkmark.style.pointerEvents = "none";
        checkmark.style.zIndex = "10";
        
        container.appendChild(checkmark);
      }

    } catch (e) {
      console.error("Error processing checked locations", e);
    }
	updateCheckedImages
  });

  const trophyImageIds = new Set(Object.values(trophyLevels).map(t => t.id));
  
  trophyImageIds.forEach(imageId => {
    let bestTrophy = null;
    
  
    Object.entries(trophyLevels).forEach(([checkId, trophyData]) => {
      const numericCheckId = Number(checkId);
      if (trophyData.id !== imageId) return;
      if (!completedChecks.has(numericCheckId)) return;
      if (!bestTrophy || trophyData.level > bestTrophy.level) {
        bestTrophy = {
          ...trophyData,
          checkId: numericCheckId
        };
      }
    });

    document.querySelectorAll(`img[data-image-id="${imageId}"]`).forEach(img => {
      const container = img.closest('.image-container');
      if (!container) return;

      container.querySelectorAll('.trophy-image').forEach(el => el.remove());

      if (bestTrophy) {
        const trophy = document.createElement('img');
        trophy.src = bestTrophy.src;
        trophy.className = 'trophy-image';
        trophy.dataset.imageId = imageId;
        trophy.dataset.checkId = bestTrophy.checkId;
        
        trophy.style.position = "absolute";
        trophy.style.top = "0";
        trophy.style.left = "0";
        trophy.style.width = "50px";
        trophy.style.height = "50px";
        trophy.style.pointerEvents = "none";
        trophy.style.zIndex = "5";
        
        container.appendChild(trophy);
      }
    });
  });

  updateCheckedImages();
}


function removeTrophy(container, imageId) {
  const existing = container.querySelector(`.trophy-image[data-image-id="${imageId}"]`);
  if (existing) existing.remove();
}

function addTrophy(container, imageId, src) {
  const trophy = document.createElement('img');
  trophy.src = src;
  trophy.classList.add('trophy-image');
  trophy.dataset.imageId = imageId;
  trophy.style.position = "absolute";
  trophy.style.top = "0px";
  trophy.style.left = "0px";
  trophy.style.width = "50px";
  trophy.style.height = "50px";
  trophy.style.pointerEvents = "none";

  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  container.appendChild(trophy);
}

function removeCheckmark(container, imageId) {
  const existing = container.querySelector(`.checkmark-image[data-image-id="${imageId}"]`);
  if (existing) existing.remove();
}

function addCheckmarkOnImage(img, src) {
  const container = img.closest('.image-container');
  if (!container) return;

  removeCheckmark(container, img.dataset.imageId);

  const checkmark = document.createElement('img');
  checkmark.src = src;
  checkmark.classList.add('checkmark-image');
  checkmark.dataset.imageId = img.dataset.imageId;
  checkmark.style.position = "absolute";
  
  checkmark.style.bottom = "5px";
  checkmark.style.left = "5px";
  
  checkmark.style.width = "30px";
  checkmark.style.height = "30px";
  checkmark.style.pointerEvents = "none";
  checkmark.style.zIndex = "10";

  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  container.appendChild(checkmark);
}
function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}


let tracker = null;

function initializeConnection(data) {
  const { serverUrl, playerName, password } = data;
    
  tracker = new ArchipelagoTracker(serverUrl, "", playerName, password);

  tracker.onRoomInfo = (info) => console.log("RoomInfo:", info);
tracker.onConnected = (packet) => {
  console.log("✅ Connected!");
  tracker.connected = true;
  updateButtonState(true);
  
  if (packet.slot_data) {
    const flattenedData = flattenObject(packet.slot_data);
    localStorage.setItem('apSlotData', JSON.stringify(flattenedData));
    updateItemsVisibility();
    
    if (window.electronAPI) {
      window.electronAPI.sendSlotData(packet.slot_data);
    }
  }
};
  tracker.onDisconnected = () => {
    console.log("❌ Disconnected");
    tracker.connected = false;
    updateButtonState(false);
  };
  tracker.onError = (err) => {
    console.error("Error:", err);
    alert(`Connection error: ${err.message || err}`);
  };
  tracker.onMessage = (msg) => console.log("Message received:", msg);

  tracker.connect();
}

if (window.electronAPI) {

  window.electronAPI.receiveConnectData((event, data) => {
    initializeConnection(data);
  });

  document.getElementById("connectBtn").addEventListener("click", () => {
    window.electronAPI.openConnectWindow();
  });
} else {

  document.getElementById("connectBtn").addEventListener("click", () => {
    document.getElementById("connectModal").style.display = "block";
  });

  document.getElementById("connectConfirm").addEventListener("click", () => {
    let serverUrl = document.getElementById("ipInput").value.trim();
    if (!serverUrl.startsWith("ws://") && !serverUrl.startsWith("wss://")) {
      serverUrl = "wss://" + serverUrl;
    }

    const playerName = document.getElementById("nameInput").value.trim();
    const password = document.getElementById("passwordInput").value.trim();

    if (!serverUrl || !playerName) {
      alert("Please fill in both server address and player name.");
      return;
    }

    initializeConnection({ serverUrl, playerName, password });
    document.getElementById("connectModal").style.display = "none";
  });
}

function updateButtonState(connected) {
  const btn = document.getElementById("connectBtn");
  if (!btn) return;

  if (connected) {
    btn.textContent = "CONNECTED";
    btn.style.backgroundColor = "#00aa00";
    btn.onclick = () => {
      if (tracker && tracker.connected) {
        tracker.disconnect();
        updateButtonState(false);
      }
    };
  } else {
    btn.textContent = "CONNECT TO ARCHIPELAGO";
    btn.style.backgroundColor = "#6200ea";
    btn.onclick = () => {
      window.electronAPI.openConnectWindow();
    };
  }
}

setInterval(() => {
  if (tracker && tracker.connected) {
    updateCheckedImages();
    updateCheckmarks();
  }
}, 10000);