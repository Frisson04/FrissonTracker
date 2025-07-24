    document.getElementById('imageSize').addEventListener('change', function() {
        let value = parseInt(this.value);
        if (isNaN(value)) {
            this.value = 80;
        } else if (value < 70) {
            this.value = 70;
        } else if (value > 300) {
            this.value = 300;
        }
    });
        class RoomInfoViewer {
            constructor(serverUrl, game, slotName, password) {
                this.serverUrl = serverUrl;
                this.game = game;
                this.slotName = slotName;
                this.password = password;
                this.uuid = this.generateUUID();
                this.ws = null;
                this.connected = false;
                this.roomInfo = null;
                this.receivedItems = JSON.parse(localStorage.getItem('apReceivedItems')) || [];
                this.checkedLocations = JSON.parse(localStorage.getItem('apCheckedLocations')) || [];
                this.itemIdToName = {};
                this.locationIdToName = {};
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
                if (!this.serverUrl.includes(":")) {
                    displayRoomInfo({ error: "Invalid server address format. Use address:port" });
                    return;
                }
                if (!this.serverUrl.startsWith("ws://") && !this.serverUrl.startsWith("wss://")) {
                    this.serverUrl = "wss://" + this.serverUrl;
                }
                this.ws = new WebSocket(this.serverUrl);
                this.ws.onopen = () => {
                    updateStatus("Connecting...", "connecting");
                    const connectPacket = [{
                        cmd: "Connect",
                        game: this.game,
                        uuid: this.uuid,
                        name: this.slotName,
                        password: this.password,
                        version: { major: 0, minor: 6, build: 2, class: "Version" },
                        tags: ["Frisson", "Tracker", "NoText"],
                        items_handling: 7
                    }];
                    this.ws.send(JSON.stringify(connectPacket));
                    localStorage.setItem('apConnectionSettings', JSON.stringify({
                        serverUrl: this.serverUrl,
                        game: this.game,
                        slotName: this.slotName,
                        password: this.password
                    }));
                };
                this.ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (Array.isArray(msg)) {
                            msg.forEach(packet => {
                                if (packet.cmd === "RoomInfo") this.processRoomInfo(packet);
                                else if (packet.cmd === "Connected") {
                                    this.connected = true;
									this.connectedData = packet;
                                    updateStatus("Connected", "connected");
                                    updateConnectButton(true);
                                    this.requestDataPackages();
                                    this.requestMissingData();
                                }
                                else if (packet.cmd === "ConnectionRefused") {
                                    displayRoomInfo({ error: packet.errors ? packet.errors.join(", ") : "Connection refused" });
                                    updateStatus("Connection refused", "disconnected");
                                    this.disconnect();
                                }
                                else if (packet.cmd === "ReceivedItems") {
                                    this.receivedItems = packet.items || [];
                                    localStorage.setItem('apReceivedItems', JSON.stringify(this.receivedItems));
                                    displayRoomInfo(this.roomInfo);
                                }
                                else if (packet.checked_locations) {
                                    const newLocations = packet.checked_locations;
                                    const mergedLocations = [...new Set([...this.checkedLocations, ...newLocations])];
                                    this.checkedLocations = mergedLocations;
                                    localStorage.setItem('apCheckedLocations', JSON.stringify(this.checkedLocations));
                                    displayRoomInfo(this.roomInfo);
                                }
                                else if (packet.cmd === "DataPackage" && packet.data) {
                                    this.processDataPackage(packet.data);
                                }
                            });
                        }
                    } catch (e) {
                        displayRoomInfo({ error: "Error parsing server response: " + e.message });
                    }
                };
                this.ws.onerror = (event) => {
                    displayRoomInfo({ error: "WebSocket error occurred" });
                    updateStatus("Connection error", "disconnected");
                };
                this.ws.onclose = (event) => {
                    this.connected = false;
                    updateStatus("Disconnected", "disconnected");
                    updateConnectButton(false);
                    if (event.code !== 1000) {
                        displayRoomInfo({ error: `Disconnected: ${event.reason || "Unknown reason"}` });
                    }
                };
            }
            requestMissingData() {
                if (!this.ws || !this.connected) return;
                

                if (this.checkedLocations.length > 0) {
                    this.ws.send(JSON.stringify([{
                        cmd: "LocationChecks",
                        locations: this.checkedLocations
                    }]));
                }
                
                this.ws.send(JSON.stringify([{ cmd: "Get", keys: ["ReceivedItems"] }]));
                this.ws.send(JSON.stringify([{ cmd: "LocationChecks", locations: [] }]));
            }
            
            requestDataPackages() {
                if (!this.ws || !this.connected) return;
                this.ws.send(JSON.stringify([{ cmd: "GetDataPackage", games: this.game ? [this.game] : null }]));
            }
            processDataPackage(data) {
                if (data.games) {
                    Object.entries(data.games).forEach(([gameName, gameData]) => {
                        const prefix = gameName !== this.game ? `[${gameName}] ` : "";
                        if (gameData.item_name_to_id) {
                            Object.entries(gameData.item_name_to_id).forEach(([name, id]) => {
                                this.itemIdToName[id] = prefix + name;
                            });
                        }
                        if (gameData.location_name_to_id) {
                            Object.entries(gameData.location_name_to_id).forEach(([name, id]) => {
                                this.locationIdToName[id] = prefix + name;
                            });
                        }
                    });
                }
                displayRoomInfo(this.roomInfo);
            }
            disconnect() {
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                    this.connected = false;
                    updateStatus("Disconnected", "disconnected");
                    updateConnectButton(false);
                    localStorage.removeItem('apConnectionSettings');
                    localStorage.removeItem('apReceivedItems');
                    localStorage.removeItem('apCheckedLocations');
                }
            }
            processRoomInfo(packet) {
                this.roomInfo = packet;
                this.itemIdToName = {};
                this.locationIdToName = {};
                if (!packet.room_name) packet.room_name = packet.seed_name ? `Seed: ${packet.seed_name}` : "Unnamed Room";
                if (packet.data) {
                    if (packet.data.item_name_to_id) {
                        Object.entries(packet.data.item_name_to_id).forEach(([name, id]) => {
                            this.itemIdToName[id] = name;
                        });
                    }
                    if (packet.data.location_name_to_id) {
                        Object.entries(packet.data.location_name_to_id).forEach(([name, id]) => {
                            this.locationIdToName[id] = name;
                        });
                    }
                }
                if (packet.datapackage?.games) {
                    Object.entries(packet.datapackage.games).forEach(([gameName, gameData]) => {
                        const prefix = gameName !== this.game ? `[${gameName}] ` : "";
                        if (gameData.item_name_to_id) {
                            Object.entries(gameData.item_name_to_id).forEach(([name, id]) => {
                                this.itemIdToName[id] = prefix + name;
                            });
                        }
                        if (gameData.location_name_to_id) {
                            Object.entries(gameData.location_name_to_id).forEach(([name, id]) => {
                                this.locationIdToName[id] = prefix + name;
                            });
                        }
                    });
                }
                displayRoomInfo(packet);
            }
            getItemInfo(itemId) {
                let name = this.itemIdToName[itemId];
                if (!name && this.roomInfo?.datapackage?.games) {
                    for (const gameData of Object.values(this.roomInfo.datapackage.games)) {
                        if (gameData.item_id_to_name?.[itemId]) {
                            name = gameData.item_id_to_name[itemId];
                            break;
                        }
                    }
                }
                return { id: itemId, name: name || `Unknown Item (${itemId})` };
            }
            getLocationInfo(locationId) {
                let name = this.locationIdToName[locationId];
                if (!name && this.roomInfo?.datapackage?.games) {
                    for (const gameData of Object.values(this.roomInfo.datapackage.games)) {
                        if (gameData.location_id_to_name?.[locationId]) {
                            name = gameData.location_id_to_name[locationId];
                            break;
                        }
                    }
                }
                return { id: locationId, name: name || `Unknown Location (${locationId})` };
            }
        }
        let viewer = null;
        function updateStatus(text, className) {
            const statusElement = document.getElementById('status');
            statusElement.textContent = text;
            statusElement.className = `status ${className}`;
        }
        function updateConnectButton(connected) {
            const btn = document.getElementById('connectBtn');
            const connectionForms = document.getElementById('connectionForms');
            const connectionTitle = document.getElementById('connectionTitle');
            
            if (!btn || !connectionForms || !connectionTitle) {
                console.error("Could not find required elements");
                return;
            }

            if (connected) {
                btn.textContent = "DISCONNECT";
                btn.className = "connected";
                connectionForms.style.display = 'none';
                connectionTitle.textContent = "";
            } else {
                btn.textContent = "CONNECT";
                btn.className = "";
                connectionForms.style.display = 'block';
                connectionTitle.textContent = "Connection Settings";
            }
        }
       function displayRoomInfo(info) {
    const roomInfoElement = document.getElementById('roomInfo');
    if (info.error) {
        roomInfoElement.innerHTML = `<span class="important">Error:</span> ${info.error}`;
        return;
    }
    if (!info) {
        roomInfoElement.textContent = "No room information received yet";
        return;
    }

    let html = `
        <div class="room-header">
        </div>`;

    if (viewer) {
        window.electronAPI.getConfig().then(config => {
            const items = config.items || [];
            
            html += `
                <div class="search-container">
                    <input type="text" id="unifiedSearch" placeholder="Search items and locations by name or ID...">
                    <button id="clearSearch">Clear</button>
                </div>

                <h3 class="section-title">Received Items (${viewer.receivedItems.length})</h3>
                <div style="max-height: 400px; overflow-y: auto;">
                    <table class="data-table" id="itemsTable">
                        <thead><tr><th>Image</th><th>ID</th><th>Item Name</th><th>Quantity</th></tr></thead>
                        <tbody>
                            ${viewer.receivedItems.length > 0 ? 
                                Object.entries(viewer.receivedItems.reduce((acc, item) => {
                                    acc[item.item] = (acc[item.item] || 0) + 1;
                                    return acc;
                                }, {})).map(([itemId, quantity]) => {
                                    const itemInfo = viewer.getItemInfo(parseInt(itemId));
                                    const matchingItem = items.find(i => i.id === itemId.toString());
                                    const imageSrc = matchingItem?.src || '';
                                    return `<tr class="clickable-row" data-item-id="${itemId}" data-search-type="item">
                                        <td>${imageSrc ? `<img src="${imageSrc}" class="item-preview">` : ''}</td>
                                        <td class="searchable-id">${itemInfo.id}</td>
                                        <td class="searchable-name">${itemInfo.name}</td>
                                        <td>${quantity}</td>
                                    </tr>`;
                                }).join('') : `<tr><td colspan="4" style="text-align: center;">No items received yet</td></tr>`}
                        </tbody>
                    </table>
                </div>

                <h3 class="section-title">Checked Locations (${viewer.checkedLocations.length})</h3>
                <div style="max-height: 400px; overflow-y: auto;">
                    <table class="data-table" id="locationsTable">
                        <thead><tr><th>Image</th><th>ID</th><th>Location Name</th></tr></thead>
                        <tbody>
                            ${viewer.checkedLocations.length > 0 ? 
                                viewer.checkedLocations.sort((a, b) => a - b).map(locId => {
                                    const locInfo = viewer.getLocationInfo(locId);
                                    const matchingLocation = items.find(item => 
                                        item.checkedLocations?.some(loc => loc.checkId === locId.toString())
                                    );
                                    const checkImage = matchingLocation?.checkedLocations?.find(loc => loc.checkId === locId.toString())?.imageSrc || '';
                                    return `<tr class="clickable-location" data-location-id="${locId}" data-search-type="location">
                                        <td>${checkImage ? `<img src="${checkImage}" class="item-preview">` : ''}</td>
                                        <td class="searchable-id">${locId}</td>
                                        <td class="searchable-name">${locInfo.name}</td>
                                    </tr>`;
                                }).join('') : `<tr><td colspan="3" style="text-align: center;">No locations checked</td></tr>`}
                        </tbody>
                    </table>
                </div>
                <div class="debug">
                </div>`;

            roomInfoElement.innerHTML = html;
            setupClickHandlers();
            setupSearchHandler();
        });
    } else {
        roomInfoElement.innerHTML = html;
    }
}

        function setupSearchHandler() {
    const unifiedSearch = document.getElementById('unifiedSearch');
    if (unifiedSearch) {
        unifiedSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const allRows = document.querySelectorAll('#itemsTable tbody tr, #locationsTable tbody tr');
            
            if (searchTerm === '') {
               
                allRows.forEach(row => row.classList.remove('hidden-row'));
                return;
            }
            
            allRows.forEach(row => {
                const id = row.querySelector('.searchable-id').textContent.toLowerCase();
                const name = row.querySelector('.searchable-name').textContent.toLowerCase();
                if (id.includes(searchTerm) || name.includes(searchTerm)) {
                    row.classList.remove('hidden-row');
                } else {
                    row.classList.add('hidden-row');
                }
            });
        });
        
        document.getElementById('clearSearch').addEventListener('click', function() {
            unifiedSearch.value = '';
            const allRows = document.querySelectorAll('#itemsTable tbody tr, #locationsTable tbody tr');
            allRows.forEach(row => row.classList.remove('hidden-row'));
        });
    }
}

        function setupClickHandlers() {
            document.querySelectorAll('.clickable-row').forEach(row => {
                row.addEventListener('click', () => {
                    const itemId = row.dataset.itemId;
                    openItemSettings(itemId);
                });
            });
            document.querySelectorAll('.clickable-location').forEach(row => {
                row.addEventListener('click', () => {
                    const locationId = row.dataset.locationId;
                    openLocationSettings(locationId);
                });
            });
        }
		function setupSearchHandler() {
    const unifiedSearch = document.getElementById('unifiedSearch');
    if (unifiedSearch) {
        unifiedSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const allRows = document.querySelectorAll('#itemsTable tbody tr, #locationsTable tbody tr');
            
            if (searchTerm === '') {
                allRows.forEach(row => row.classList.remove('hidden-row'));
                return;
            }
            
            allRows.forEach(row => {
                const id = row.querySelector('.searchable-id').textContent.toLowerCase();
                const name = row.querySelector('.searchable-name').textContent.toLowerCase();
                if (id.includes(searchTerm) || name.includes(searchTerm)) {
                    row.classList.remove('hidden-row');
                } else {
                    row.classList.add('hidden-row');
                }
            });
        });
        
        document.getElementById('clearSearch').addEventListener('click', function() {
            unifiedSearch.value = '';
            const allRows = document.querySelectorAll('#itemsTable tbody tr, #locationsTable tbody tr');
            allRows.forEach(row => row.classList.remove('hidden-row'));
        });
    }
}
		
		function setupYamlSearchHandler(restrictionField) {
  const searchInput = restrictionField.querySelector('.search-input');
  const clearBtn = restrictionField.querySelector('.clear-search-btn');
  const grid = restrictionField.querySelector('.slot-data-grid');
  
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    
    if (searchTerm === '') {
      resetSearch();
      return;
    }
    

    grid.querySelectorAll('.slot-data-group, .slot-data-option').forEach(el => {
      el.style.display = 'none';
    });
    
 
    grid.querySelectorAll('.slot-data-option').forEach(option => {
      const text = option.textContent.toLowerCase();
      if (text.includes(searchTerm)) {
        option.style.display = '';
        const group = option.closest('.slot-data-group');
        if (group) {
          group.style.display = '';
          const header = group.querySelector('.group-header');
          const content = group.querySelector('.group-content');
          header.style.display = '';
          header.classList.add('expanded');
          content.style.display = 'block';
        }
      }
    });
    
    grid.querySelectorAll('.group-header').forEach(header => {
      const text = header.textContent.toLowerCase();
      if (text.includes(searchTerm)) {
        const group = header.closest('.slot-data-group');
        group.style.display = '';
        header.style.display = '';
        header.classList.add('expanded');
        group.querySelector('.group-content').style.display = 'block';
      }
    });
  });
  
  function resetSearch() {
    grid.querySelectorAll('.slot-data-group, .slot-data-option').forEach(el => {
      el.style.display = '';
    });
    
    grid.querySelectorAll('.group-header').forEach(header => {
      header.classList.remove('expanded');
      header.nextElementSibling.style.display = 'none';
    });
    
    searchInput.value = '';
  }
  
  clearBtn.addEventListener('click', resetSearch);
}


function setupImageSelection(restrictionField) {
  const fileInput = restrictionField.querySelector('.image-file-input');
  const urlInput = restrictionField.querySelector('.image-url-input');
  const preview = restrictionField.querySelector('.image-preview');
  
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        preview.innerHTML = `<img src="${event.target.result}" style="max-width: 100px; max-height: 100px;">`;
        urlInput.value = ''; 
      };
      reader.readAsDataURL(file);
    }
  });
  
  urlInput.addEventListener('input', function() {
    const url = this.value.trim();
    if (url.startsWith('http')) {
      preview.innerHTML = `<img src="${url}" style="max-width: 100px; max-height: 100px;" onerror="this.parentElement.innerHTML='Invalid image'">`;
      fileInput.value = ''; 
    } else if (url === '') {
      preview.innerHTML = '';
    }
  });
}
function addYamlRestrictionToForm(path = '', value = '', operator = '==') {
  const container = document.getElementById('yamlRestrictions');
  const fieldId = `yaml-restrict-${Date.now()}`;
  
  const fieldHtml = `
    <div class="yaml-restriction-field" id="${fieldId}">
      <div class="yaml-restriction-grid">
        <button class="slot-data-select-btn" type="button">
          ${path || 'Select Slot Data Property'}
        </button>
        <select class="yaml-operator-select">
          <option value="==" ${operator === '==' ? 'selected' : ''}>Equals (==)</option>
          <option value=">=" ${operator === '>=' ? 'selected' : ''}>Greater or Equal (>=)</option>
          <option value=">" ${operator === '>' ? 'selected' : ''}>Greater Than (>)</option>
          <option value="<=" ${operator === '<=' ? 'selected' : ''}>Less or Equal (<=)</option>
          <option value="<" ${operator === '<' ? 'selected' : ''}>Less Than (<)</option>
          <option value="!=" ${operator === '!=' ? 'selected' : ''}>Not Equal (!=)</option>
        </select>
        <input type="text" class="yaml-value-input" placeholder="Value" value="${value}">
      </div>
      <div class="slot-data-grid-container" style="display: none;">
        <div class="search-container">
          <input type="text" class="search-input" placeholder="Search properties...">
          <button class="clear-search-btn">Clear</button>
        </div>
        <div class="slot-data-grid"></div>
      </div>
      <div class="action-selector">
        <select class="action-select">
          <option value="remove">Remove Item</option>
          <option value="image">Replace Image</option>
        </select>
        <div class="image-options" style="display: none;">
          <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px;">
            <input type="file" class="image-file-input" accept="image/*" style="flex: 1;">
            <span>OR</span>
            <input type="text" class="image-url-input" placeholder="Image URL" style="flex: 1;">
          </div>
          <div class="image-preview" style="margin-top: 10px;"></div>
        </div>
      </div>
      <button type="button" class="remove-check-btn" onclick="document.getElementById('${fieldId}').remove()">Remove</button>
    </div>`;
  
  container.insertAdjacentHTML('beforeend', fieldHtml);
  const newField = document.getElementById(fieldId);
  
  const actionSelect = newField.querySelector('.action-select');
  const imageOptions = newField.querySelector('.image-options');
  
  actionSelect.addEventListener('change', () => {
    imageOptions.style.display = actionSelect.value === 'image' ? 'block' : 'none';
  });
  
  setupImageSelection(newField);
  
  const selectBtn = newField.querySelector('.slot-data-select-btn');
  const gridContainer = newField.querySelector('.slot-data-grid-container');
  
  selectBtn.addEventListener('click', () => {
    gridContainer.style.display = gridContainer.style.display === 'none' ? 'block' : 'none';
    if (gridContainer.style.display === 'block' && !gridContainer.dataset.loaded) {
      populateSlotDataGrid(newField);
      setupYamlSearchHandler(newField);
    }
  });
  
  if (path) {
    setTimeout(() => {
      selectBtn.textContent = path;
      newField.querySelector('.yaml-value-input').value = value;
    }, 100);
  }
}

function populateSlotDataGrid(restrictionField) {
  const grid = restrictionField.querySelector('.slot-data-grid');
  grid.innerHTML = '';
  
  if (!viewer?.connectedData?.slot_data) {
    grid.innerHTML = '<div class="no-data">No slot data available. Connect to Archipelago first.</div>';
    return;
  }
  
  const slotData = viewer.connectedData.slot_data;
  const flattened = flattenObject(slotData);
  

  const groupedProperties = {};
  const ungroupedProperties = [];
  
  Object.entries(flattened).forEach(([path, value]) => {
    const parts = path.split('.');
    if (parts.length > 1) {
      const groupName = parts[0];
      if (!groupedProperties[groupName]) {
        groupedProperties[groupName] = [];
      }
      groupedProperties[groupName].push({
        name: parts.slice(1).join('.'),
        fullPath: path,
        value: value
      });
    } else {
      ungroupedProperties.push({
        name: path,
        fullPath: path,
        value: value
      });
    }
  });

  const groupsContainer = document.createElement('div');
  groupsContainer.className = 'groups-container';
  grid.appendChild(groupsContainer);

  Object.entries(groupedProperties)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([groupName, properties]) => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'slot-data-group';

      const groupHeader = document.createElement('div');
      groupHeader.className = 'group-header';
      groupHeader.textContent = groupName;
      groupHeader.onclick = (e) => {
        e.stopPropagation();
        groupHeader.classList.toggle('expanded');
        groupContent.style.display = groupContent.style.display === 'none' ? 'block' : 'none';
      };

      const groupContent = document.createElement('div');
      groupContent.style.display = 'none';
      groupContent.className = 'group-content';

      properties.forEach(prop => {
        const btn = document.createElement('button');
        btn.className = 'slot-data-option';
        btn.textContent = `${prop.name}: ${JSON.stringify(prop.value)}`;
        btn.onclick = () => {
          restrictionField.querySelector('.slot-data-select-btn').textContent = prop.fullPath;
          restrictionField.querySelector('.yaml-value-input').value = prop.value;
          restrictionField.querySelector('.slot-data-grid-container').style.display = 'none';
        };
        groupContent.appendChild(btn);
      });

      groupDiv.appendChild(groupHeader);
      groupDiv.appendChild(groupContent);
      groupsContainer.appendChild(groupDiv);
    });

 
  const ungroupedContainer = document.createElement('div');
  ungroupedContainer.className = 'ungrouped-container';
  grid.appendChild(ungroupedContainer);

  ungroupedProperties
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(prop => {
      const btn = document.createElement('button');
      btn.className = 'slot-data-option';
      btn.textContent = `${prop.name}: ${JSON.stringify(prop.value)}`;
      btn.onclick = () => {
        restrictionField.querySelector('.slot-data-select-btn').textContent = prop.fullPath;
        restrictionField.querySelector('.yaml-value-input').value = prop.value;
        restrictionField.querySelector('.slot-data-grid-container').style.display = 'none';
      };
      ungroupedContainer.appendChild(btn);
    });

  restrictionField.querySelector('.slot-data-grid-container').dataset.loaded = true;
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

function selectSlotDataOption(element, path, currentValue) {
    element.closest('.slot-data-select-container').querySelectorAll('.slot-data-option').forEach(el => {
        el.classList.remove('selected');
    });
    
    element.classList.add('selected');
    
    const editorContainer = element.closest('.yaml-restriction-field').querySelector('.slot-data-value-container');
    editorContainer.innerHTML = `
        <div>
            <h4>Editing:</h4>
            <div><strong>${path}</strong></div>
        </div>
        <div class="value-edit-box">
            <label>Current Value:</label>
            <div style="margin: 5px 0; padding: 5px; background: #3a3a3a; border-radius: 3px;">
                ${currentValue}
            </div>
            <label>New Value:</label>
            <input type="text" class="newSlotDataValue" placeholder="Enter required value">
            <button onclick="updateYamlRestrictionValue(this, '${path}')">Update Value</button>
        </div>`;
}

function updateYamlRestrictionValue(button, path) {
    const newValue = button.parentElement.querySelector('.newSlotDataValue').value;
    const restrictionField = button.closest('.yaml-restriction-field');
    
    try {
        restrictionField.dataset.path = path;
        restrictionField.dataset.value = JSON.parse(newValue);
    } catch {
        restrictionField.dataset.path = path;
        restrictionField.dataset.value = newValue;
    }
    
    const option = restrictionField.querySelector(`.slot-data-option[data-path="${path}"]`);
    if (option) {
        selectSlotDataOption(option, path, escapeHtml(JSON.stringify(restrictionField.dataset.value)));
    }
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.selectSlotDataOption = selectSlotDataOption;
window.updateYamlRestrictionValue = updateYamlRestrictionValue;
        function openItemSettings(itemId) {
    const formHtml = `
        <div class="edit-form-container">
            <div class="edit-form">
                <div class="form-Item group-1">
                    <h3>Edit Item Settings</h3>
                    <input type="hidden" id="editItemId" value="${itemId}">
                    <label for="editItemName">Item Name:
    <span class="help-tooltip">
        <img src="assets/Anotation.png" class="icon">
        <span class="tooltip-text">
            The name that will be displayed for this item in the tracker.
        </span>
    </span>
</label>
                    <input type="text" id="editItemName" value="${viewer.itemIdToName[itemId] || `Item ${itemId}`}">
                    <label for="editItemCategory">Category:
    <span class="help-tooltip">
        <img src="assets/Anotation.png" class="icon">
        <span class="tooltip-text">
            <em>Group this item with others in the same category.</em><br><br>
            Categories help organize your items in the tracker.
        </span>
    </span>
</label>
                    <select id="editItemCategory"><option value="">-- No Category --</option></select>
                    <label for="editItemImage">Image File:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="file" id="editItemImage" accept="image/*" style="flex: 1;">
                        <span>OR</span>
                        <input type="text" id="editItemImageUrl" placeholder="Image URL" style="flex: 1;">
                    </div>
                    <div id="editImagePreview"></div>
                </div>
                                                
                <div class="form-Item group-2">      
              
<label for="editCountMode">Count Mode:
    <span class="help-tooltip">
        <img src="assets/Anotation.png" class="icon">
        <span class="tooltip-text">
            <strong>Counter Mode:</strong> Shows the item count as a number<br><br>
            <strong>Different Images Mode:</strong> Allows displaying distinct images depending on the number of copies owned.<br><br> 
			Perfect for representing object evolutions<br><br>
			like the hookshot in Zelda or progressive upgrades.
        </span>
    </span>
</label>
<select id="editCountMode">
    <option value="counter">Counter</option>
    <option value="images">Different Images</option>
</select>


                    <div id="editImageCountGroup" style="display: none; margin-top: 10px;">
                        <label>Number of images:</label>
                        <input type="number" id="editImageCount" min="1" value="1">
                    </div>
                    <div id="editCountImagesContainer" style="margin-top: 10px;"></div>
                </div>
				
	<div class="form-Item group-3">   			
<h3>Advanced Settings</h3>

                <h4>Add Checked Locations
    <span class="help-tooltip">
        <img src="assets/Anotation.png" class="icon">
        <span class="tooltip-text">
            Associate specific locations with items.<br><br>
            When these locations are checked, the item will show:<br><br>
            - a custom checkmark image if provided<br><br>
			Tips : If you don't know the Location ID. You can use the Checked Location table
        </span>
    </span>
</h4>
                <div id="editCheckedLocations"></div>
                <button type="button" id="addCheckedLocationBtn">Add Checked Location</button>
                <h4>Yaml Restrictions
    <span class="help-tooltip">
        <img src="assets/Anotation.png" class="icon">
        <span class="tooltip-text">
            <strong>ADVANCED SETTINGS</strong><br><br> 
			YAML Restrictions: Define conditions based on your YAML data.<br><br>
            When conditions are met, you can choose to:<br>
            - Remove the item from tracker<br>
            - Replace the item's image<br><br>
            Example: Hide an item when player do not met the required YAML.<br><br>
			Example: In Mario 64, if you set "Greater than 1" for Mario's moveset, the image will only appear when movesets are randomized (value > 1). If movesets aren't randomized (value = 0), the image will be hidden as the value is less than 1.
        </span>
    </span>
</h4>
                <div id="yamlRestrictions"></div>
                <button type="button" id="addYamlRestrictionBtn">Add Yaml Restriction</button>
</div>

                <div class="edit-form-buttons">
                    <button class="save-btn" id="saveItemBtn">Save</button>
                    <button class="cancel-btn" id="cancelEditBtn">Cancel</button>
                </div>
            </div>
        </div>`;
    const formContainer = document.createElement('div');
    formContainer.innerHTML = formHtml;
    document.body.appendChild(formContainer);
    loadItemData(itemId);
    setupEditFormEvents();
}

function loadItemData(itemId) {
    if (!window.electronAPI) return;
    
    window.electronAPI.getConfig().then(config => {
       
        const categorySelect = document.getElementById('editItemCategory');
        categorySelect.innerHTML = '<option value="">-- No Category --</option>';
        config.categories?.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });

     
        const existingItem = config.items?.find(item => item.id === itemId);
        if (!existingItem) return;

       
        document.getElementById('editItemName').value = existingItem.name || viewer.itemIdToName[itemId] || `Item ${itemId}`;
        if (existingItem.categoryId) categorySelect.value = existingItem.categoryId;

        
        if (existingItem.countMode) {
            document.getElementById('editCountMode').value = existingItem.countMode;
            if (existingItem.countMode === 'images') {
                document.getElementById('editImageCountGroup').style.display = 'block';
                document.getElementById('editImageCount').value = existingItem.countImages?.length || 1;
                
                if (existingItem.countImages && existingItem.countImages.length > 0) {
                    existingItem.countImages.forEach((imgSrc, index) => {
                        addEditCountImageField(index, imgSrc);
                    });
                } else {
                    addEditCountImageField(0);
                }
            }
        }

       
        if (existingItem.src) {
            if (existingItem.src.startsWith('http') || existingItem.src.startsWith('data:')) {
                document.getElementById('editItemImageUrl').value = existingItem.src.startsWith('http') ? existingItem.src : '';
                document.getElementById('editImagePreview').innerHTML = `<img src="${existingItem.src}" class="image-preview">`;
            }
        }

        
        if (existingItem.checkedLocations) {
            document.getElementById('editCheckedLocations').innerHTML = '';
            existingItem.checkedLocations.forEach(loc => {
                addCheckedLocationToForm(loc.checkId, loc.imageSrc, loc.order);
            });
        }

       
        if (existingItem.yamlRestrictions) {
            document.getElementById('yamlRestrictions').innerHTML = '';
            existingItem.yamlRestrictions.forEach(restriction => {
                addYamlRestrictionToForm(
                    restriction.path, 
                    restriction.value, 
                    restriction.operator || '=='
                );

             
                const field = document.querySelector('.yaml-restriction-field:last-child');
                if (field) {
                    if (restriction.action) {
                        field.querySelector('.action-select').value = restriction.action;
                        
                        if (restriction.action === 'image' && restriction.imageSrc) {
                            const preview = field.querySelector('.image-preview');
                            const urlInput = field.querySelector('.image-url-input');
                            
                            if (restriction.imageSrc.startsWith('http')) {
                                urlInput.value = restriction.imageSrc;
                                preview.innerHTML = `<img src="${restriction.imageSrc}">`;
                            } 
                            else if (restriction.imageSrc.startsWith('data:')) {
                                preview.innerHTML = `<img src="${restriction.imageSrc}">`;
                            }
                            
                            field.querySelector('.image-options').style.display = 'block';
                        }
                    }
                    
                    if (restriction.operator) {
                        field.querySelector('.yaml-operator-select').value = restriction.operator;
                    }
                }
            });
        }

        document.getElementById('editCountMode').dispatchEvent(new Event('change'));
    });
}

function setupEditFormEvents() {
    document.getElementById('editCountMode').addEventListener('change', function() {
        const group = document.getElementById('editImageCountGroup');
        group.style.display = this.value === 'images' ? 'block' : 'none';
        
        if (this.value === 'images') {
            handleEditCountImages();
        }
    });
    
    document.getElementById('editImageCount').addEventListener('input', handleEditCountImages);
    
    document.getElementById('editItemImage').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                document.getElementById('editImagePreview').innerHTML = `<img src="${event.target.result}" class="image-preview">`;
            };
            reader.readAsDataURL(file);
        }
    });
    
    document.getElementById('addYamlRestrictionBtn').addEventListener('click', () => addYamlRestrictionToForm());
    document.getElementById('addCheckedLocationBtn').addEventListener('click', () => addCheckedLocationToForm());
    document.getElementById('saveItemBtn').addEventListener('click', saveItemSettings);
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
        document.querySelector('.edit-form-container').remove();
    });
}

        function addCheckedLocationToForm(checkId = '', imageSrc = '', order = 0) {
    const container = document.getElementById('editCheckedLocations');
    const fieldId = `check-${Date.now()}`;
    const isUrl = imageSrc.startsWith('http');
    
    const fieldHtml = `
        <div class="checked-location-field" id="${fieldId}">
            <label>Check ID:</label>
            <input type="text" value="${checkId}" placeholder="Location ID">
            <label>Order:</label>
            <input type="number" value="${order}" placeholder="Display order">
            <label>Checkmark Image:</label>
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                <input type="file" accept="image/*" class="check-image-input" style="flex: 1;">
                <span>OR</span>
                <input type="text" class="check-image-url" placeholder="Image URL" 
                       value="${isUrl ? imageSrc : ''}" style="flex: 1;">
            </div>
            <div class="check-image-preview">
                ${imageSrc ? `<img src="${imageSrc}" style="max-width: 50px; max-height: 50px;">` : ''}
            </div>
            <button type="button" class="remove-check-btn" onclick="document.getElementById('${fieldId}').remove()">Remove</button>
        </div>`;
    
    container.insertAdjacentHTML('beforeend', fieldHtml);
    const newField = document.getElementById(fieldId);
    
    newField.querySelector('.check-image-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const preview = newField.querySelector('.check-image-preview');
                preview.innerHTML = `<img src="${event.target.result}" style="max-width: 50px; max-height: 50px;">`;
                newField.querySelector('.check-image-url').value = '';
            };
            reader.readAsDataURL(file);
        }
    });
    
    newField.querySelector('.check-image-url').addEventListener('input', function() {
        const url = this.value.trim();
        const preview = newField.querySelector('.check-image-preview');
        
        if (url.startsWith('http')) {
            const img = new Image();
            img.onload = function() {
                preview.innerHTML = `<img src="${url}" style="max-width: 50px; max-height: 50px;">`;
                newField.querySelector('.check-image-input').value = '';
            };
            img.onerror = function() {
                preview.innerHTML = 'Image invalide';
            };
            img.src = url;
        } else if (url === '') {
            preview.innerHTML = '';
        }
    });
}

        function handleEditCountImages() {
            const container = document.getElementById('editCountImagesContainer');
            const currentFields = container.querySelectorAll('.count-image-item');
            const currentCount = currentFields.length;
            const newCount = parseInt(document.getElementById('editImageCount').value) || 0;
            
            const currentImages = [];
            currentFields.forEach(field => {
                const img = field.querySelector('img');
                if (img) currentImages.push(img.src);
            });
            
            container.innerHTML = '';
            
          
            for (let i = 0; i < newCount; i++) {
                addEditCountImageField(i, currentImages[i] || '');
            }
        }

function addEditCountImageField(index, imgSrc = '') {
    const container = document.getElementById('editCountImagesContainer');
    const div = document.createElement('div');
    div.className = 'count-image-item';
    div.innerHTML = `
        <label>Item ${index + 1}:</label>
        <input type="file" class="count-image-file" data-index="${index}" accept="image/*" style="flex: 1;">
        <input type="text" class="count-image-url" data-index="${index}" placeholder="Image URL" style="flex: 1;" value="${imgSrc.startsWith('http') ? imgSrc : ''}">
        <div class="count-image-preview" data-index="${index}">
            ${imgSrc ? `<img src="${imgSrc}" style="max-width: 50px; max-height: 50px;">` : ''}
        </div>
    `;
    container.appendChild(div);
   
    div.querySelector('.count-image-file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        const index = this.getAttribute('data-index');
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const preview = document.querySelector(`.count-image-preview[data-index="${index}"]`);
                preview.innerHTML = `<img src="${event.target.result}" style="max-width: 50px; max-height: 50px;">`;
                div.querySelector('.count-image-url').value = '';
            };
            reader.readAsDataURL(file);
        }
    });
    
    div.querySelector('.count-image-url').addEventListener('input', function() {
        const url = this.value.trim();
        const index = this.getAttribute('data-index');
        if (url.startsWith('http')) {
            const img = new Image();
            img.onload = function() {
                const preview = document.querySelector(`.count-image-preview[data-index="${index}"]`);
                preview.innerHTML = `<img src="${url}" style="max-width: 50px; max-height: 50px;">`;
                div.querySelector('.count-image-file').value = '';
            };
            img.onerror = function() {
                const preview = document.querySelector(`.count-image-preview[data-index="${index}"]`);
                preview.innerHTML = 'Image invalide';
            };
            img.src = url;
        } else if (url === '') {
            const preview = document.querySelector(`.count-image-preview[data-index="${index}"]`);
            preview.innerHTML = '';
        }
    });
}

async function saveItemSettings() {
    const itemId = document.getElementById('editItemId').value;
    const itemName = document.getElementById('editItemName').value;
    const categoryId = document.getElementById('editItemCategory').value;
    const countMode = document.getElementById('editCountMode').value;
    const imageFile = document.getElementById('editItemImage').files[0];
    const imageUrl = document.getElementById('editItemImageUrl').value.trim();
    const checkedLocations = [];
    const yamlRestrictions = [];

    document.querySelectorAll('.yaml-restriction-field').forEach(field => {
        const path = field.querySelector('.slot-data-select-btn').textContent;
        const operator = field.querySelector('.yaml-operator-select').value;
        const value = field.querySelector('.yaml-value-input').value;
        const action = field.querySelector('.action-select').value;
        
        if (path && path !== 'Select Slot Data Property') {
            const restriction = {
                path: path,
                operator: operator,
                value: value,
                action: action
            };
            
            if (action === 'image') {
                const fileInput = field.querySelector('.image-file-input');
                const urlInput = field.querySelector('.image-url-input');
                const preview = field.querySelector('.image-preview img');
                
                if (fileInput.files[0]) {
                    restriction.imageSrc = URL.createObjectURL(fileInput.files[0]);
                } else if (urlInput.value.startsWith('http')) {
                    restriction.imageSrc = urlInput.value;
                } else if (preview?.src) {
                    restriction.imageSrc = preview.src;
                }
            }
            
            yamlRestrictions.push(restriction);
        }
    });

    document.querySelectorAll('.checked-location-field').forEach(field => {
        const checkId = field.querySelector('input[type="text"]').value;
        const order = field.querySelector('input[type="number"]').value;
        const img = field.querySelector('.check-image-preview img');
        
        if (checkId) {
            checkedLocations.push({ 
                checkId, 
                imageSrc: img ? img.src : '', 
                order: parseInt(order) || 0 
            });
        }
    });
    
    const countImagesData = [];
    if (countMode === 'images') {
        document.querySelectorAll('#editCountImagesContainer .count-image-preview img').forEach(img => {
            countImagesData.push(img.src);
        });
    }
    
    try {
        const config = await window.electronAPI.getConfig();
        let item = config.items?.find(item => item.id === itemId);
        
        if (!item) {
            item = { id: itemId };
            config.items = config.items || [];
            config.items.push(item);
        }
        
        item.name = itemName;
        item.categoryId = categoryId || null;
        item.countMode = countMode;
        item.countImages = countMode === 'images' ? countImagesData : undefined;
        item.checkedLocations = checkedLocations.length > 0 ? checkedLocations : undefined;
        item.yamlRestrictions = yamlRestrictions.length > 0 ? yamlRestrictions : undefined;
        
        if (imageFile) {
            item.src = await readFileAsDataURL(imageFile);
        } else if (imageUrl) {
            try {
                new URL(imageUrl); 
                item.src = imageUrl;
            } catch (e) {
                alert("Please enter a valid URL");
                return;
            }
        } else if (!item.src) {
            alert("Please select an image for the item");
            return;
        }
        
        await window.electronAPI.saveConfig(config);
        window.electronAPI.notifyConfigChange();
        
        document.querySelector('.edit-form-container').remove();
        
    } catch (error) {
        console.error("Error saving item settings:", error);
        alert("An error occurred while saving. Check console for details.");
    }
}
function refreshImages() {
  const config = window.trackerConfig;
  
  document.querySelectorAll('img.tracker-image').forEach(img => {
    const itemId = img.dataset.imageId;
    const item = config.items.find(i => i.id === itemId);
    if (!item) return;

    const result = item.yamlRestrictions ? checkYamlRestrictions(item) : { action: 'show' };
    
    if (result.action === 'replace') {
      img.src = result.image;
    } else if (result.action === 'show') {
      img.src = item.src;
    }
  });
}

setInterval(refreshImages, 5000);
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
        function finalizeSave(config) {
            window.electronAPI.saveConfig(config).then(success => {
                if (success) {
                    window.electronAPI.notifyConfigChange();
                    if (viewer && viewer.roomInfo) {
                        displayRoomInfo(viewer.roomInfo);
                    }
                    document.querySelector('.edit-form-container').remove();
                } else {
                    alert("Error saving settings!");
                }
            });
        }

        function openLocationSettings(locationId) {
            if (!window.electronAPI) {
                alert("Location ID: " + locationId);
                return;
            }
            window.electronAPI.getConfig().then(config => {
                const images = config.items || [];
                if (images.length === 0) {
                    alert("No images available. Please create some items first.");
                    return;
                }
                
                let existingLink = null;
                images.forEach(img => {
                    if (img.checkedLocations) {
                        const loc = img.checkedLocations.find(l => l.checkId === locationId);
                        if (loc) existingLink = { imageId: img.id, order: loc.order };
                    }
                });
                const dialogHtml = `
                    <div class="edit-form-container">
                        <div class="edit-form">
                            <h3>Link Location ${locationId}</h3>
                            <label>Select Image:</label>
                            <select id="linkImageSelect">
                                ${images.map(img => 
                                    `<option value="${img.id}" ${existingLink?.imageId === img.id ? 'selected' : ''}>
                                        ${img.name || 'Item'} (ID: ${img.id})
                                    </option>`
                                ).join('')}
                            </select>
                            <label>Order:</label>
                            <input type="number" id="linkOrder" value="${existingLink?.order || 0}">
                            <label>Checkmark Image (optional):</label>
                                        <div style="display: flex; gap: 10px; align-items: center;">
                <input type="file" id="linkCheckImage" accept="image/*" style="flex: 1;">
                <span>OR</span>
                <input type="text" id="linkCheckImageUrl" placeholder="Image URL" style="flex: 1;" 
                       value="${existingLink?.imageSrc?.startsWith('http') ? existingLink.imageSrc : ''}">
            </div>
                            <div class="edit-form-buttons">
                                <button class="save-btn" id="confirmLinkBtn">Link Location</button>
                                <button class="cancel-btn" id="cancelLinkBtn">Cancel</button>
                            </div>
                        </div>
                    </div>`;
                
                const dialog = document.createElement('div');
                dialog.innerHTML = dialogHtml;
                document.body.appendChild(dialog);
                document.getElementById('confirmLinkBtn').addEventListener('click', () => {
    const imageId = document.getElementById('linkImageSelect').value;
    const order = document.getElementById('linkOrder').value;
    const imageFile = document.getElementById('linkCheckImage').files[0];
    const imageUrl = document.getElementById('linkCheckImageUrl').value.trim();
    
    if (imageFile) {
        const reader = new FileReader();
        reader.onload = function(event) {
            saveLocationLink(locationId, imageId, order, event.target.result);
            dialog.remove();
        };
        reader.readAsDataURL(imageFile);
    } else if (imageUrl) {
        try {
            new URL(imageUrl);
            saveLocationLink(locationId, imageId, order, imageUrl);
            dialog.remove();
        } catch (e) {
            showAlert("Please enter a valid URL");
            return;
        }
    } else {
        saveLocationLink(locationId, imageId, order, '');
        dialog.remove();
    }
});

document.getElementById('linkCheckImage').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('linkCheckImagePreview').innerHTML = 
                `<img src="${event.target.result}" style="max-width: 50px; max-height: 50px;">`;
            document.getElementById('linkCheckImageUrl').value = '';
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('linkCheckImageUrl').addEventListener('input', function() {
    const url = this.value.trim();
    const preview = document.getElementById('linkCheckImagePreview');
    
    if (url.startsWith('http')) {
        const img = new Image();
        img.onload = function() {
            preview.innerHTML = `<img src="${url}" style="max-width: 50px; max-height: 50px;">`;
            document.getElementById('linkCheckImage').value = '';
        };
        img.onerror = function() {
            preview.innerHTML = 'Invalid image';
        };
        img.src = url;
    } else if (url === '') {
        preview.innerHTML = '';
    }
});
                document.getElementById('cancelLinkBtn').addEventListener('click', () => {
                    dialog.remove();
                });
            });
        }

        function saveLocationLink(locationId, imageId, order, imageSrc) {
            window.electronAPI.getConfig().then(config => {
                const item = config.items?.find(item => item.id === imageId);
                if (!item) return;
                
                item.checkedLocations = item.checkedLocations || [];
                item.checkedLocations = item.checkedLocations.filter(loc => loc.checkId !== locationId);
                item.checkedLocations.push({ checkId: locationId, imageSrc, order: parseInt(order) || 0 });
                window.electronAPI.saveConfig(config).then(success => {
                    if (success) {
                        window.electronAPI.notifyConfigChange();
                        if (viewer && viewer.roomInfo) {
                            displayRoomInfo(viewer.roomInfo);
                        }
                        document.querySelector('.edit-form-container').remove();
                    } else {
                        alert("Error linking location!");
                    }
                });
            });
        }

        document.addEventListener('DOMContentLoaded', () => {
            const savedSettings = localStorage.getItem('apConnectionSettings');
            if (savedSettings) {
                const { serverUrl, game, slotName, password } = JSON.parse(savedSettings);
                document.getElementById('serverInput').value = serverUrl;
                document.getElementById('playerInput').value = slotName;
                document.getElementById('gameInput').value = game || '';
                document.getElementById('passwordInput').value = password || '';
                viewer = null;
            }
            
            document.getElementById('connectBtn').addEventListener('click', () => {
                if (viewer && viewer.connected) {
                    viewer.disconnect();
                    return;
                }
                let serverUrl = document.getElementById('serverInput').value.trim();
                const playerName = document.getElementById('playerInput').value.trim();
                const game = document.getElementById('gameInput').value.trim();
                const password = document.getElementById('passwordInput').value.trim();
                if (!serverUrl || !playerName) {
                    displayRoomInfo({ error: "Please fill in both server address and player name" });
                    return;
                }
                viewer = new RoomInfoViewer(serverUrl, game, playerName, password);
                viewer.connect();
            });
            
            document.getElementById('refreshBtn').addEventListener('click', () => {
                if (viewer && viewer.connected && viewer.roomInfo) {
                    displayRoomInfo(viewer.roomInfo);
                } else {
                    displayRoomInfo({ error: "Not connected or no room info available" });
                }
            });

            setupSearchHandlers();
        });

        window.editCategory = editCategory;
        window.deleteCategory = deleteCategory;
		
		
		async function initBackgroundSettings() {
    const config = await window.electronAPI.getConfig();
    
    document.getElementById('bgType').value = config.backgroundType || 'image';
    toggleBgOptions(config.backgroundType || 'image');
    
    if (config.backgroundType === 'color') {
        document.getElementById('bgColor').value = config.backgroundColor || '#000000';
    } 
    else if (config.backgroundType === 'gradient') {
        document.getElementById('gradientStart').value = config.gradientStart || '#000000';
        document.getElementById('gradientEnd').value = config.gradientEnd || '#1e90ff';
        document.getElementById('gradientAngle').value = config.gradientAngle || 135;
        document.getElementById('angleValue').textContent = `${config.gradientAngle || 135}°`;
    } 
    else { 
        const bgUrl = config.backgroundImage || 'https://xmple.com/wallpaper/highlight-black-linear-gradient-blue-2560x1440-c2-000000-1e90ff-l-67-a-225-f-21.svg';
        document.getElementById('bgImageUrl').value = bgUrl.startsWith('http') ? bgUrl : '';
        updateBgPreview(bgUrl);
    }
    
    document.getElementById('bgType').addEventListener('change', function() {
        toggleBgOptions(this.value);
    });
    
    document.getElementById('gradientAngle').addEventListener('input', function() {
        document.getElementById('angleValue').textContent = `${this.value}°`;
    });
    
    document.getElementById('bgImageFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                updateBgPreview(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
    
    document.getElementById('bgImageUrl').addEventListener('input', function() {
        if (this.value.startsWith('http')) {
            updateBgPreview(this.value);
        }
    });
    
    document.getElementById('saveBgBtn').addEventListener('click', saveBackground);
}

function toggleBgOptions(type) {
    document.getElementById('bgImageOptions').style.display = type === 'image' ? 'block' : 'none';
    document.getElementById('bgColorOptions').style.display = type === 'color' ? 'block' : 'none';
    document.getElementById('bgGradientOptions').style.display = type === 'gradient' ? 'block' : 'none';
}

function updateBgPreview(value) {
    const preview = document.getElementById('bgImagePreview');
    const bgType = document.getElementById('bgType').value;
    
    if (bgType === 'image') {
        preview.innerHTML = value ? `<img src="${value}">` : '';
    } else if (bgType === 'color') {
        preview.innerHTML = `<div style="width: 100%; height: 50px; background: ${value};"></div>`;
    } else { 
        const start = document.getElementById('gradientStart').value;
        const end = document.getElementById('gradientEnd').value;
        const angle = document.getElementById('gradientAngle').value;
        preview.innerHTML = `<div style="width: 100%; height: 50px; background: linear-gradient(${angle}deg, ${start}, ${end});"></div>`;
    }
}

async function saveBackground() {
    const bgType = document.getElementById('bgType').value;
    const config = await window.electronAPI.getConfig();
    
    config.backgroundType = bgType;
    
    if (bgType === 'image') {
        const fileInput = document.getElementById('bgImageFile');
        const urlInput = document.getElementById('bgImageUrl');
        
        if (fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function(event) {
                config.backgroundImage = event.target.result;
                saveBgToConfig(config);
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else if (urlInput.value.startsWith('http')) {
            config.backgroundImage = urlInput.value;
            saveBgToConfig(config);
        } else {
            showAlert('Please select an image file or enter a valid URL');
        }
    } 
    else if (bgType === 'color') {
        config.backgroundColor = document.getElementById('bgColor').value;
        saveBgToConfig(config);
    } 
    else { 
        config.gradientStart = document.getElementById('gradientStart').value;
        config.gradientEnd = document.getElementById('gradientEnd').value;
        config.gradientAngle = parseInt(document.getElementById('gradientAngle').value);
        saveBgToConfig(config);
    }
}

async function saveBgToConfig(config) {
    await window.electronAPI.saveConfig(config);
    window.electronAPI.notifyConfigChange();
    showAlert('Background saved successfully!', 'success');
    
    if (config.backgroundType === 'image') {
        updateBgPreview(config.backgroundImage);
    } else if (config.backgroundType === 'color') {
        updateBgPreview(config.backgroundColor);
    } else { 
        updateBgPreview();
    }
}