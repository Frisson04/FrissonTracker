let categories = [];
let images = [];
let currentEditId = null;
let currentEditType = null;
let gridColumns = 4;

const categoriesList = document.getElementById('categoriesList');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const saveCategoryBtn = document.getElementById('saveCategoryBtn');
const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
const categoryName = document.getElementById('categoryName');
const categoryColor = document.getElementById('categoryColor');
const gridColumnsInput = document.getElementById('gridColumns');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');


async function initUI() {
    const config = await window.electronAPI.getConfig();

    if (!config.categoryPositions) {
        config.categoryPositions = {};
        await window.electronAPI.saveConfig(config);
    }
    
    categories = config.categories || [];
    images = config.items || [];
    gridColumns = config.gridColumns || 4;
    
    renderCategories();
    initBackgroundSettings(); 
}

async function refreshRoomData() {
    if (viewer && viewer.connected) {
        viewer.requestMissingData();
        showAlert('Data refreshed successfully!', 'success');
    } else {
        showAlert('Not connected to server', 'error');
    }
}

function showAlert(message, type = 'error', options = {}) {
  const alertDiv = document.createElement('div');
  alertDiv.style.position = 'fixed';
  alertDiv.style.top = '20px';
  alertDiv.style.left = '50%';
  alertDiv.style.transform = 'translateX(-50%)';
  alertDiv.style.padding = '15px 20px';
  alertDiv.style.backgroundColor = type === 'error' ? '#ff0004' : '#008000';
  alertDiv.style.color = 'white';
  alertDiv.style.borderRadius = '5px';
  alertDiv.style.zIndex = '10000';
  alertDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  alertDiv.style.display = 'flex';
  alertDiv.style.flexDirection = 'column';
  alertDiv.style.alignItems = 'center';
  alertDiv.style.gap = '10px';
  
  alertDiv.innerHTML = `
    <div>${message}</div>
    ${options.confirm ? `
      <div style="display: flex; gap: 10px;">
        <button id="confirmYes" style="padding: 5px 15px; background: #4CAF50; border: none; border-radius: 3px; cursor: pointer;">Yes</button>
        <button id="confirmNo" style="padding: 5px 15px; background: #FF0000 ; border: none; border-radius: 3px; cursor: pointer;">No</button>
      </div>
    ` : ''}
  `;
  
  document.body.appendChild(alertDiv);
  
  if (options.confirm) {
    return new Promise((resolve) => {
      document.getElementById('confirmYes').addEventListener('click', () => {
        alertDiv.remove();
        resolve(true);
      });
      
      document.getElementById('confirmNo').addEventListener('click', () => {
        alertDiv.remove();
        resolve(false);
      });
    });
  } else {
    setTimeout(() => {
      alertDiv.remove();
    }, 3000);
    return Promise.resolve(false);
  }
}

function saveGridSettings() {
    const gridColumnsInput = document.getElementById('gridColumns');
    const newValue = parseInt(gridColumnsInput.value);
    if (newValue >= 1 && newValue <= 10) {
        gridColumns = newValue;
        saveData();
    } else {
        showAlert("Please enter a number between 1 and 10");
        gridColumnsInput.value = gridColumns;
    }
}

function renderCategories() {
    categoriesList.innerHTML = '';
    categories.forEach(category => {
        const div = document.createElement('div');
        div.className = 'category-item';
        div.style.backgroundColor = category.color + '20';
        div.style.borderLeft = `4px solid ${category.color}`;
        
        div.innerHTML = `
            <span>${category.name}</span>
            <div>
                <button onclick="editCategory('${category.id}')">Edit</button>
                <button onclick="deleteCategory('${category.id}')">Delete</button>
            </div>
        `;
        
        categoriesList.appendChild(div);
    });
}


function addCategory() {
    currentEditId = null;
    currentEditType = 'category';
    categoryName.value = '';
    categoryColor.value = '#9900ff';
    document.getElementById('categoryForm').style.display = 'block';
}

function editCategory(id) {
    const category = categories.find(c => c.id === id);
    if (!category) return;
    
    currentEditId = id;
    currentEditType = 'category';
    categoryName.value = category.name;
    categoryColor.value = category.color;
    document.getElementById('imageSize').value = category.imageSize || 80;
    document.getElementById('categoryForm').style.display = 'block';
}

async function saveCategory() {
    let wasEditMode = false;
    const name = categoryName.value.trim();
    const color = categoryColor.value;
    const imageSize = parseInt(document.getElementById('imageSize').value) || 80;
    
    if (!name) {
        showAlert('Please enter a category name');
        return;
    }

    try {
        const config = await window.electronAPI.getFullConfig();
        wasEditMode = config.isEditMode || false;
        
        if (wasEditMode) {
            await window.electronAPI.toggleEditMode();
            await new Promise(resolve => setTimeout(resolve, 100)); 
        }
    } catch (e) {
        console.error('Error checking edit mode:', e);
    }

    const config = await window.electronAPI.getConfig();
    const currentPositions = config.categoryPositions || {};

    if (currentEditId) {
        const index = categories.findIndex(c => c.id === currentEditId);
        if (index !== -1) {
            categories[index] = { ...categories[index], name, color, imageSize };
        }
    } else {
        const newCategoryId = generateId();
        categories.push({
            id: newCategoryId,
            name,
            color,
            imageSize
        });

        currentPositions[newCategoryId] = {
            x: 20,
            y: 20,
            width: 300,
            height: 200
        };
    }

    const configToSave = {
        ...config,
        categories: [...categories],
        categoryPositions: currentPositions
    };

    await window.electronAPI.saveConfig(configToSave);
    window.electronAPI.notifyConfigChange();
    
    document.getElementById('categoryForm').style.display = 'none';
    renderCategories();

    if (wasEditMode) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await window.electronAPI.toggleEditMode();
    }
}
function forceReflow(element) {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            const display = element.style.display;
            element.style.display = 'none';
            element.offsetHeight; 
            element.style.display = display;
            resolve();
        });
    });
}
async function saveDataWithPositions(positions) {
    const config = await window.electronAPI.getConfig();
    const configToSave = {
        ...config,
        categories: categories,
        items: images,
        gridColumns: gridColumns,
        categoryPositions: positions
    };
    
    await window.electronAPI.saveConfig(configToSave);
    window.electronAPI.notifyConfigChange();
}

async function deleteCategory(id) {
  const confirmed = await showAlert(
    'Are you sure you want to delete this category? Any images in this category will become uncategorized.', 
    'warning', 
    { confirm: true }
  );
  
  if (!confirmed) return;
  
  const config = await window.electronAPI.getConfig();
  
  config.categories = config.categories.filter(c => c.id !== id);
  
  config.items.forEach(item => {
    if (item.categoryId === id) {
      item.categoryId = null;
    }
  });
  
  if (config.categoryPositions && config.categoryPositions[id]) {
    delete config.categoryPositions[id];
  }
  
  await window.electronAPI.saveConfig(config);
  window.electronAPI.notifyConfigChange();
  
  renderCategories();
}

async function cancelCurrentEdit() {
  if (currentEditId || (!currentEditId && (document.getElementById('categoryForm').style.display === 'block'))) {
    if (!currentEditId) {
      document.getElementById('categoryForm').style.display = 'none';
      currentEditId = null;
      currentEditType = null;
      return;
    }

    const confirmed = await showAlert(
      'Discard changes?', 
      'warning', 
      { confirm: true }
    );
    
    if (!confirmed) return;
    
    if (document.getElementById('categoryForm').style.display === 'block') {
      document.getElementById('categoryForm').style.display = 'none';
    }
    currentEditId = null;
    currentEditType = null;
  }
}

function saveData() {
    const currentConfig = window.trackerConfig || {
        gridColumns: 4,
        categories: [],
        items: [],
        categoryPositions: {}
    };

    const trackerContainer = document.getElementById('trackerContainer');
    const currentPositions = {};
    
    if (trackerContainer) {
        const containerRect = trackerContainer.getBoundingClientRect();
        document.querySelectorAll('.category-section').forEach(section => {
            const rect = section.getBoundingClientRect();
            currentPositions[section.dataset.categoryId] = {
                x: rect.left - containerRect.left,
                y: rect.top - containerRect.top
            };
        });
    }

    const configToSave = {
        gridColumns: gridColumns,
        categories: categories.map(category => ({
            id: category.id,
            name: category.name,
            color: category.color,
        })),
        items: images.map(item => ({
            id: item.id,
            name: item.name,
            src: item.src,
            categoryId: item.categoryId,
            checkedLocations: item.checkedLocations || [],
            countMode: item.countMode || 'counter',
            countImages: item.countImages || []
        })),
        categoryPositions: {
            ...currentConfig.categoryPositions, 
            ...currentPositions               
        }
    };

    window.electronAPI.saveConfig(configToSave).then(success => {
        if (success) {

            window.trackerConfig = configToSave;
            

            window.electronAPI.notifyConfigChange();
            

            console.log('Positions sauvegardées:', configToSave.categoryPositions);
        } else {
            console.error('Erreur lors de la sauvegarde');
        }
    });
}
function ensureTrackerContainer() {
    const trackerContainer = document.getElementById('trackerContainer');
    if (!trackerContainer) return;
    
    trackerContainer.style.position = 'relative';
    trackerContainer.style.width = '100%';
    trackerContainer.style.minHeight = '100vh';
    trackerContainer.style.overflow = 'hidden';
}

function captureCurrentPositions() {
    const trackerContainer = document.getElementById('trackerContainer');
    if (!trackerContainer) return {};
    
    const containerRect = trackerContainer.getBoundingClientRect();
    const positions = {};
    
    document.querySelectorAll('.category-section').forEach(section => {
        const categoryId = section.dataset.categoryId;
        const rect = section.getBoundingClientRect();
        
        positions[categoryId] = {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top
        };
    });
    
    return positions;
}
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}


async function exportSettings() {

    const windowSize = await window.electronAPI.getWindowSize();
  

  const config = await window.electronAPI.getFullConfig();
    

    const exportData = {
        ...config,
		windowSize,
        categoryDimensions: config.categoryPositions, 
        items: await Promise.all(config.items.map(async item => {
            if (item.src && item.src.startsWith('data:')) {
                return item;
            }
            
            try {
                const response = await fetch(item.src);
                const blob = await response.blob();
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
                return { ...item, src: base64 };
            } catch (e) {
                console.error('Failed to convert image to base64:', e);
                return item;
            }
        }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tracker-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const importData = JSON.parse(await file.text());
    
    if (!importData.categories || !importData.items) {
      throw new Error('Invalid file format: missing categories or items');
    }

    const confirmed = await showAlert(
      'This will overwrite your current configuration. Continue?', 
      'warning', 
      { confirm: true }
    );
    
    if (!confirmed) return;

    let wasEditMode = false;
    try {
      const config = await window.electronAPI.getFullConfig();
      wasEditMode = config.isEditMode || false;
      
      if (wasEditMode) {
        await window.electronAPI.toggleEditMode();
      }
    } catch (e) {
      console.error('Error checking edit mode:', e);
    }


    if (importData.categories) {
      importData.categories.forEach(category => {
        if (category.imageSize === undefined) {
          category.imageSize = 80; 
        }
      });
    }


    const finalConfig = {
      ...importData,
      categoryPositions: {
        ...importData.categoryPositions,
        ...(importData.categoryDimensions || {})
      }
    };


    delete finalConfig.categoryDimensions;


    await window.electronAPI.saveConfig(finalConfig);
    

    if (importData.windowSize) {
      await window.electronAPI.setWindowSize(importData.windowSize);
    }

    window.electronAPI.notifyConfigChange();
    
    showAlert('Import successful!', 'success');
    

    if (wasEditMode) {
      setTimeout(async () => {
        await window.electronAPI.toggleEditMode();
      }, 1000);
    }
    
    event.target.value = '';
    
  } catch (error) {
    console.error('Import error:', error);
    showAlert('Import failed: ' + error.message);
  }
}
window.electronAPI.onConfigUpdate((event, config) => {
    if (config.categoryPositions) {
        applyNewPositions(config.categoryPositions);
    }
});
function applyCategoryPosition(element, position, container) {
    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
    

    if (position.width) {
        element.style.width = `${position.width}px`;
    }
    if (position.height) {
        element.style.height = `${position.height}px`;
    }


    requestAnimationFrame(() => {
        const maxX = container.clientWidth - element.offsetWidth;
        const maxY = container.clientHeight - element.offsetHeight;
        
        if (position.x > maxX) element.style.left = `${maxX}px`;
        if (position.y > maxY) element.style.top = `${maxY}px`;
        if (position.x < 0) element.style.left = '0px';
        if (position.y < 0) element.style.top = '0px';
    });
}
function applyNewPositions(positions) {
    const trackerContainer = document.getElementById('trackerContainer');
    if (!trackerContainer) return;

    Object.entries(positions).forEach(([id, pos]) => {
        const element = document.querySelector(`.category-section[data-category-id="${id}"]`) || 
                       document.querySelector(`.uncategorized-item[data-item-id="${id}"]`);
        
        if (element) {
            element.style.left = `${pos.x}px`;
            element.style.top = `${pos.y}px`;
            
            if (pos.width) {
                element.style.width = `${pos.width}px`;
            }
            if (pos.height) {
                element.style.height = `${pos.height}px`;
            }
            
            requestAnimationFrame(() => {
                element.style.display = 'none';
                element.offsetHeight;
                element.style.display = '';
            });
        }
    });
}
async function resetAllSettings() {
  const confirmed = await showAlert(
    'Are you sure you want to reset ALL settings? This cannot be undone!', 
    'warning', 
    { confirm: true }
  );
  
  if (!confirmed) return;
  
  const defaultConfig = {
    gridColumns: 4,
    categories: [],
    items: []
  };
  
  window.electronAPI.saveConfig(defaultConfig).then(success => {
    if (success) {
      window.electronAPI.notifyConfigChange();
      showAlert('All settings have been reset', 'success');
	  displayRoomInfo(viewer.roomInfo);
      initUI();
    }
  });
}


exportBtn.addEventListener('click', exportSettings);
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', importSettings);
addCategoryBtn.addEventListener('click', addCategory);
saveCategoryBtn.addEventListener('click', saveCategory);
cancelCategoryBtn.addEventListener('click', () => cancelCurrentEdit());
document.getElementById('resetAllBtn')?.addEventListener('click', resetAllSettings);
document.getElementById('gridColumns')?.addEventListener('change', saveGridSettings);
document.getElementById('refreshBtn').addEventListener('click', refreshRoomData);

if (gridColumnsInput) {
    gridColumnsInput.addEventListener('change', saveGridSettings);
}

window.electronAPI.onConfigUpdate(async (event, config) => {
    categories = config.categories || [];
    images = config.items || [];
    gridColumns = config.gridColumns || 4;
    
    if (gridColumnsInput) {
        gridColumnsInput.value = gridColumns;
    }
    
    renderCategories();
    
    if (config.categoryPositions) {
        await new Promise(resolve => setTimeout(resolve, 50)); 
        applyNewPositions(config.categoryPositions);
    }
});

initUI();

window.editCategory = editCategory;
window.deleteCategory = deleteCategory;