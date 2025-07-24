let editMode = false;
let draggedCategory = null;
let originalPosition = null;
let shiftPressed = false;
let guideLines = [];
let referenceElement = null;
let connectionListeners = [];
const RESIZE_HANDLE_SIZE = 10;
const MIN_CATEGORY_WIDTH = 200;
const MIN_CATEGORY_HEIGHT = 150;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.toggleEditMode = toggleEditMode;
        window.trackerConfig = await window.electronAPI.getConfig();
        console.log('Configuration chargée:', window.trackerConfig);
        renderTracker(window.trackerConfig);
        
        setInterval(() => {
            updateCheckedImages();
            updateCheckmarks();
        }, 1000);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                shiftPressed = true;
                if (draggedCategory) {
                    
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                shiftPressed = false;
                removeGuideLines();
            }
        });

window.electronAPI.onConfigUpdate((event, config) => {
    window.trackerConfig = config;
    

    renderTracker(config);
    updateBackground(config);
    

    if (config.categoryPositions) {
        applyNewPositions(config.categoryPositions);
    }
    

    if (editMode) {
        setupResizeHandles();
        setupEditMode();
    }
});

        document.getElementById('editorBtn').addEventListener('click', toggleEditMode);




        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            window.electronAPI.openWindow('settings');
        });


        document.getElementById('AboutBtn')?.addEventListener('click', () => {
            window.electronAPI.openWindow('about');
        });


        document.getElementById('connectBtn')?.addEventListener('click', () => {
            window.electronAPI.openWindow('connect');
        });



    } catch (error) {
        console.error('Erreur lors du chargement:', error);
        document.getElementById('trackerContainer').innerHTML = '<p>Erreur de chargement des données</p>';
    }
});



function createGuideLines(element) {
    removeGuideLines();
}

function createIndividualGuideLine(type, position, container) {
    const line = document.createElement('div');
    line.className = `guide-line ${type}`;
    
    if (type === 'horizontal') {
        line.style.top = `${position}px`;
        line.style.left = '0';
        line.style.width = '100%';
        line.style.height = '1px';
    } else {
        line.style.left = `${position}px`;
        line.style.top = '0';
        line.style.width = '1px';
        line.style.height = '100%';
    }
    
    line.style.backgroundColor = 'rgba(98, 0, 234, 0.5)';
    line.style.position = 'absolute';
    line.style.pointerEvents = 'none';
    
    container.appendChild(line);
    guideLines.push(line);
}


function createGuideLine(type, position) {
    const line = document.createElement('div');
    line.className = `guide-line ${type}`;
    line.style[type === 'horizontal' ? 'top' : 'left'] = `${position}px`;
    document.body.appendChild(line);
    return line;
}

function removeGuideLines() {
    guideLines.forEach(line => line.remove());
    guideLines = [];
    referenceElement = null;
}

function checkSnapping(currentElement) {
    if (!shiftPressed || !currentElement) return;
    
    const trackerContainer = document.getElementById('trackerContainer');
    if (!trackerContainer) return;
    
    const containerRect = trackerContainer.getBoundingClientRect();
    const currentRect = currentElement.getBoundingClientRect();
    
    const currentTop = currentRect.top - containerRect.top;
    const currentBottom = currentRect.bottom - containerRect.top;
    const currentLeft = currentRect.left - containerRect.left;
    const currentRight = currentRect.right - containerRect.left;
    
    const referenceElements = [
        ...trackerContainer.querySelectorAll('.category-section'), 
        ...trackerContainer.querySelectorAll('.uncategorized-item')
    ].filter(el => el !== currentElement);

    
    const SNAP_THRESHOLD = 10;
    let hasSnapped = false;

    referenceElements.forEach(refElement => {
        if (hasSnapped) return;
        
        const refRect = refElement.getBoundingClientRect();
        const refTop = refRect.top - containerRect.top;
        const refBottom = refRect.bottom - containerRect.top;
        const refLeft = refRect.left - containerRect.left;
        const refRight = refRect.right - containerRect.left;


        if (Math.abs(currentTop - refTop) < SNAP_THRESHOLD) {
            currentElement.style.top = `${refTop}px`;
            hasSnapped = true;
        } 
        else if (Math.abs(currentBottom - refBottom) < SNAP_THRESHOLD) {
            currentElement.style.top = `${refBottom - currentRect.height}px`;
            hasSnapped = true;
        }
        else if (Math.abs(currentLeft - refLeft) < SNAP_THRESHOLD) {
            currentElement.style.left = `${refLeft}px`;
            hasSnapped = true;
        } 
        else if (Math.abs(currentRight - refRight) < SNAP_THRESHOLD) {
            currentElement.style.left = `${refRight - currentRect.width}px`;
            hasSnapped = true;
        }
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
            

            if (element.classList.contains('category-section')) {
                const grid = element.querySelector('.items-grid');
                if (grid) {
                    const categoryId = element.dataset.categoryId;
                    const category = window.trackerConfig.categories?.find(c => c.id === categoryId);
                    const imageSize = category?.imageSize || 80;
                    const itemWidth = imageSize + 40;
                    const columns = Math.max(1, Math.floor((parseInt(element.style.width) || element.offsetWidth) / itemWidth));
                    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(100px, 1fr))`;
                    
                    grid.style.display = 'none';
                    grid.offsetHeight;
                    grid.style.display = 'grid';
                }
            }
        }
    });
}

function toggleEditMode() {
    editMode = !editMode;
    document.body.classList.toggle('editor-mode', editMode);
    document.getElementById('editorBtn').classList.toggle('editing', editMode);
    
    lockCategories(!editMode);
    
    if (editMode) {
        setupDragHandlers();
        setupResizeHandles();
      
        document.querySelectorAll('.delete-btn, .category-delete-btn').forEach(btn => {
            btn.style.display = 'block';
        });
        document.querySelectorAll('.uncategorized-item').forEach(item => {
            setupDragForUncategorizedItem(item);
            setupResizeForUncategorizedItem(item);
        });
    } else {

        document.querySelectorAll('.resize-handle').forEach(el => el.remove());
        document.querySelectorAll('.delete-btn, .category-delete-btn').forEach(btn => {
            btn.style.display = 'none';
        });
        saveCategoryPositions();
        saveItemPositions();
    }
}

async function deleteCategory(categoryId) {
    const category = window.trackerConfig.categories.find(c => c.id === categoryId);
    if (!category) return;

    const confirmed = confirm(`Are you sure you want to delete the category "${category.name}"?`);
    if (!confirmed) return;


    window.trackerConfig.categories = window.trackerConfig.categories.filter(c => c.id !== categoryId);
    

    if (window.trackerConfig.items) {
        window.trackerConfig.items.forEach(item => {
            if (item.categoryId === categoryId) {
                item.categoryId = null;
            }
        });
    }


    await window.electronAPI.saveConfig(window.trackerConfig);
    window.electronAPI.notifyConfigChange();
}

async function deleteItem(itemId, itemName) {
    const confirmed = confirm(`Are you sure you want to delete the item "${itemName}"?`);
    if (!confirmed) return;


    window.trackerConfig.items = window.trackerConfig.items.filter(item => item.id !== itemId);


    await window.electronAPI.saveConfig(window.trackerConfig);
    window.electronAPI.notifyConfigChange();
}

function setupResizeHandles() {
    document.querySelectorAll('.category-section').forEach(section => {
        section.querySelectorAll('.resize-handle').forEach(handle => handle.remove());
        
        const positions = ['nw', 'ne', 'sw', 'se'];
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${pos}`;
            handle.dataset.position = pos;
            section.appendChild(handle);
            
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                startResize(e, section, pos);
            });
        });
    });
}

function startResize(e, element, position) {
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = parseInt(element.style.width) || element.offsetWidth;
    const startHeight = parseInt(element.style.height) || element.offsetHeight;
    const startLeft = parseInt(element.style.left) || element.offsetLeft;
    const startTop = parseInt(element.style.top) || element.offsetTop;
    
    function onMouseMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        if (position.includes('e')) {
            newWidth = Math.max(MIN_CATEGORY_WIDTH, startWidth + dx);
        }
        if (position.includes('w')) {
            newWidth = Math.max(MIN_CATEGORY_WIDTH, startWidth - dx);
            newLeft = startLeft + dx;
        }
        if (position.includes('s')) {
            newHeight = Math.max(MIN_CATEGORY_HEIGHT, startHeight + dy);
        }
        if (position.includes('n')) {
            newHeight = Math.max(MIN_CATEGORY_HEIGHT, startHeight - dy);
            newTop = startTop + dy;
        }
        
        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;
        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
        
        updateGridLayout(element, newWidth);
    }
    
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveCategoryPositions();
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function updateGridLayout(section, newWidth) {
    const grid = section.querySelector('.items-grid');
    if (!grid) return;
    
    const categoryId = section.dataset.categoryId;
    const category = window.trackerConfig.categories?.find(c => c.id === categoryId);
    const imageSize = category?.imageSize || 80;
    
    const itemContentWidth = imageSize + 40;
    const columns = Math.max(1, Math.floor(newWidth / itemContentWidth));
    
    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(100px, 1fr)`;
    
    const images = grid.querySelectorAll('.tracker-image');
    images.forEach(img => {
        img.style.width = `${imageSize}px`;
        img.style.height = `${imageSize}px`;
    });
    
    grid.style.display = 'none';
    grid.offsetHeight;
    grid.style.display = 'grid';
}
function setupDragForUncategorizedItem(item) {
    item.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('delete-btn')) {
            return;
        }
        startDragItem(e);
    });
    item.style.cursor = 'move';
}

function setupResizeForUncategorizedItem(item) {
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle resize-se';
    resizeHandle.style.position = 'absolute';
    resizeHandle.style.bottom = '0';
    resizeHandle.style.right = '0';
    resizeHandle.style.cursor = 'nwse-resize';
    
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startResizeItem(e, item);
    });
    
    item.appendChild(resizeHandle);
}

function startDragItem(e) {
    if (!editMode) return;
    if (e.target.classList.contains('resize-handle')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const item = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(item.style.left) || 0;
    const startTop = parseInt(item.style.top) || 0;
    
    function onMouseMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = startLeft + dx;
        const newTop = startTop + dy;
        
        item.style.left = `${newLeft}px`;
        item.style.top = `${newTop}px`;
        
        if (shiftPressed) {
            checkSnapping(item);
        }
    }
    
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveItemPositions();
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function startResizeItem(e, item) {
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = parseInt(item.style.width) || item.offsetWidth;
    const startHeight = parseInt(item.style.height) || item.offsetHeight;
    
    function onMouseMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newWidth = Math.max(80, startWidth + dx);
        const newHeight = Math.max(80, startHeight + dy);
        
        item.style.width = `${newWidth}px`;
        item.style.height = `${newHeight}px`;
    }
    
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveItemPositions();
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function saveItemPositions() {
    const trackerContainer = document.getElementById('trackerContainer');
    const config = window.trackerConfig;
    
    document.querySelectorAll('.uncategorized-item').forEach(item => {
        const itemId = item.dataset.itemId;
        const rect = item.getBoundingClientRect();
        const containerRect = trackerContainer.getBoundingClientRect();
        
        if (!config.itemPositions) config.itemPositions = {};
        config.itemPositions[itemId] = {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height
        };
    });
    
    window.electronAPI.saveConfig(config);
}
function setupDragHandlers() {
    const categorySections = document.querySelectorAll('.category-section');
    
    categorySections.forEach(section => {
        section.removeEventListener('mousedown', startDrag);
        section.addEventListener('mousedown', startDrag);
    });
}

function setupEditMode() {
    const trackerContainer = document.getElementById('trackerContainer');
    const categorySections = trackerContainer.querySelectorAll('.category-section');
    
    categorySections.forEach(section => {
        section.addEventListener('mousedown', startDrag);
        section.style.position = 'absolute';
        
        const categoryId = section.querySelector('.category-title').textContent;
        const savedPosition = window.trackerConfig.categoryPositions?.[categoryId];
        if (savedPosition) {
            section.style.left = `${savedPosition.x}px`;
            section.style.top = `${savedPosition.y}px`;
        } else {
            const rect = section.getBoundingClientRect();
            section.style.left = `${rect.left}px`;
            section.style.top = `${rect.top}px`;
        }
    });
}
function createGuideLines(element) {
    if (!element) return;
    
    removeGuideLines();
    
    const trackerContainer = document.getElementById('trackerContainer');
    if (!trackerContainer) return;
    
    const containerRect = trackerContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    

    const guidesContainer = document.createElement('div');
    guidesContainer.id = 'guides-container';
    guidesContainer.style.position = 'absolute';
    guidesContainer.style.top = '0';
    guidesContainer.style.left = '0';
    guidesContainer.style.width = '100%';
    guidesContainer.style.height = '100%';
    guidesContainer.style.pointerEvents = 'none';
    guidesContainer.style.zIndex = '10000';
    trackerContainer.appendChild(guidesContainer);

   
    const referenceElements = [
        ...trackerContainer.querySelectorAll('.category-section'), 
        ...trackerContainer.querySelectorAll('.uncategorized-item')
    ].filter(el => el !== element);


    const elementTop = elementRect.top - containerRect.top;
    const elementBottom = elementRect.bottom - containerRect.top;
    const elementLeft = elementRect.left - containerRect.left;
    const elementRight = elementRect.right - containerRect.left;

   
    createIndividualGuideLine('horizontal', elementTop, guidesContainer);
    createIndividualGuideLine('horizontal', elementBottom, guidesContainer);
    createIndividualGuideLine('vertical', elementLeft, guidesContainer);
    createIndividualGuideLine('vertical', elementRight, guidesContainer);


    referenceElements.forEach(refElement => {
        const refRect = refElement.getBoundingClientRect();
        const refTop = refRect.top - containerRect.top;
        const refBottom = refRect.bottom - containerRect.top;
        const refLeft = refRect.left - containerRect.left;
        const refRight = refRect.right - containerRect.left;

       
        const PROXIMITY_THRESHOLD = 20;


        if (Math.abs(refTop - elementTop) < PROXIMITY_THRESHOLD || 
            Math.abs(refTop - elementBottom) < PROXIMITY_THRESHOLD) {
            createIndividualGuideLine('horizontal', refTop, guidesContainer);
        }

        if (Math.abs(refBottom - elementTop) < PROXIMITY_THRESHOLD || 
            Math.abs(refBottom - elementBottom) < PROXIMITY_THRESHOLD) {
            createIndividualGuideLine('horizontal', refBottom, guidesContainer);
        }

        if (Math.abs(refLeft - elementLeft) < PROXIMITY_THRESHOLD || 
            Math.abs(refLeft - elementRight) < PROXIMITY_THRESHOLD) {
            createIndividualGuideLine('vertical', refLeft, guidesContainer);
        }

        if (Math.abs(refRight - elementLeft) < PROXIMITY_THRESHOLD || 
            Math.abs(refRight - elementRight) < PROXIMITY_THRESHOLD) {
            createIndividualGuideLine('vertical', refRight, guidesContainer);
        }
    });
}

function updateGuidePositions(element) {
    if (!element || guideLines.length === 0) return;
    
    const trackerContainer = document.getElementById('trackerContainer');
    const containerRect = trackerContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
   
    const top = elementRect.top - containerRect.top;
    const bottom = elementRect.bottom - containerRect.top;
    const left = elementRect.left - containerRect.left;
    const right = elementRect.right - containerRect.left;
    

    guideLines[0].style.top = `${top}px`;      
    guideLines[1].style.top = `${bottom}px`;   
    guideLines[2].style.left = `${left}px`;    
    guideLines[3].style.left = `${right}px`;   
}
function createGuideLine(type) {
    const line = document.createElement('div');
    line.className = `guide-line ${type}`;
    line.style.position = 'absolute';
    
    if (type === 'horizontal') {
        line.style.height = '1px';
        line.style.width = '100%';
        line.style.left = '0';
    } else {
        line.style.width = '1px';
        line.style.height = '100%';
        line.style.top = '0';
    }
    
    document.getElementById('trackerContainer').appendChild(line);
    return line;
}

function removeGuideLines() {
    guideLines.forEach(line => line.remove());
    guideLines = [];
    referenceElement = null;
}

function checkSnapping(currentElement) {
    if (!shiftPressed || !currentElement) return;
    
    const trackerContainer = document.getElementById('trackerContainer');
    if (!trackerContainer) return;
    
    const containerRect = trackerContainer.getBoundingClientRect();
    const currentRect = currentElement.getBoundingClientRect();
    
    const currentTop = currentRect.top - containerRect.top;
    const currentBottom = currentRect.bottom - containerRect.top;
    const currentLeft = currentRect.left - containerRect.left;
    const currentRight = currentRect.right - containerRect.left;
    const currentCenterX = currentLeft + (currentRight - currentLeft)/2;
    const currentCenterY = currentTop + (currentBottom - currentTop)/2;
    
    const referenceElements = [
        ...trackerContainer.querySelectorAll('.category-section'), 
        ...trackerContainer.querySelectorAll('.uncategorized-item')
    ].filter(el => el !== currentElement);

    const SNAP_THRESHOLD = 10;
    let snapX = false;
    let snapY = false;

    referenceElements.forEach(refElement => {
        const refRect = refElement.getBoundingClientRect();
        const refTop = refRect.top - containerRect.top;
        const refBottom = refRect.bottom - containerRect.top;
        const refLeft = refRect.left - containerRect.left;
        const refRight = refRect.right - containerRect.left;
        const refCenterX = refLeft + (refRight - refLeft)/2;
        const refCenterY = refTop + (refBottom - refTop)/2;

        if (!snapX) {
            if (Math.abs(currentLeft - refLeft) < SNAP_THRESHOLD) {
                currentElement.style.left = `${refLeft}px`;
                snapX = true;
            } 
            else if (Math.abs(currentRight - refRight) < SNAP_THRESHOLD) {
                currentElement.style.left = `${refRight - currentRect.width}px`;
                snapX = true;
            }
            else if (Math.abs(currentCenterX - refCenterX) < SNAP_THRESHOLD) {
                currentElement.style.left = `${refCenterX - currentRect.width/2}px`;
                snapX = true;
            }
        }

        if (!snapY) {
            if (Math.abs(currentTop - refTop) < SNAP_THRESHOLD) {
                currentElement.style.top = `${refTop}px`;
                snapY = true;
            } 
            else if (Math.abs(currentBottom - refBottom) < SNAP_THRESHOLD) {
                currentElement.style.top = `${refBottom - currentRect.height}px`;
                snapY = true;
            }
            else if (Math.abs(currentCenterY - refCenterY) < SNAP_THRESHOLD) {
                currentElement.style.top = `${refCenterY - currentRect.height/2}px`;
                snapY = true;
            }
        }
    });
}


function startDrag(e) {
    if (!editMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    draggedCategory = e.currentTarget;
    originalPosition = {
        x: parseInt(draggedCategory.style.left) || 0,
        y: parseInt(draggedCategory.style.top) || 0
    };
    
    const shiftX = e.clientX - originalPosition.x;
    const shiftY = e.clientY - originalPosition.y;
    
    function moveAt(clientX, clientY) {
        draggedCategory.style.left = `${clientX - shiftX}px`;
        draggedCategory.style.top = `${clientY - shiftY}px`;
        
        if (shiftPressed) {
            checkSnapping(draggedCategory);
        }
    }
    
    function onMouseMove(e) {
        moveAt(e.clientX, e.clientY);
    }
    
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        draggedCategory = null;
        currentDragHandler = null;
    }
    
    currentDragHandler = onMouseMove;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function lockCategories(lock = true) {
    document.querySelectorAll('.category-section').forEach(section => {
        if (lock) {
            section.style.pointerEvents = 'none';
            section.style.userSelect = 'none';
            section.style.cursor = 'default';
        } else {
            section.style.pointerEvents = 'auto';
            section.style.userSelect = 'auto';
            section.style.cursor = 'move';
        }
    });
}

function saveCategoryPositions() {
    const trackerContainer = document.getElementById('trackerContainer');
    const categorySections = trackerContainer.querySelectorAll('.category-section');
    const categoryPositions = {};
    
    categorySections.forEach(section => {
        const categoryId = section.dataset.categoryId;
        const rect = section.getBoundingClientRect();
        const containerRect = trackerContainer.getBoundingClientRect();
        
        categoryPositions[categoryId] = {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height
        };
    });
    
    window.trackerConfig.categoryPositions = categoryPositions;
    window.electronAPI.saveConfig(window.trackerConfig);
}

function applyBackground(config) {
    if (config.backgroundImage) {
        document.documentElement.style.setProperty('--background-image', `url('${config.backgroundImage}')`);
    } else {
        document.documentElement.style.removeProperty('--background-image');
    }
}

function updateBackground(config) {
    const body = document.body;
    
    if (config.backgroundType === 'color') {
        body.style.background = config.backgroundColor;
        body.style.setProperty('--background-image', 'none');
    } 
    else if (config.backgroundType === 'gradient') {
        const gradient = `linear-gradient(${config.gradientAngle}deg, ${config.gradientStart}, ${config.gradientEnd})`;
        body.style.background = gradient;
        body.style.setProperty('--background-image', 'none');
    } 
    else {
        body.style.background = 'none';
        body.style.setProperty('--background-image', `url('${config.backgroundImage}')`);
    }
}
function createUncategorizedItem(item, config, container, savedPositions) {
    const itemContainer = document.createElement('div');
    itemContainer.className = 'uncategorized-item';
    itemContainer.dataset.itemId = item.id;
    itemContainer.style.position = 'absolute';
    itemContainer.style.border = '2px solid #666';
    itemContainer.style.borderRadius = '8px';
    itemContainer.style.padding = '10px';
    itemContainer.style.backgroundColor = '#333';
    itemContainer.style.boxSizing = 'border-box';
    itemContainer.style.display = 'flex';
    itemContainer.style.flexDirection = 'column';
    itemContainer.style.alignItems = 'center';
    itemContainer.style.justifyContent = 'center';
    itemContainer.style.zIndex = '10';
	    itemContainer.style.overflow = 'hidden';
    itemContainer.style.wordWrap = 'break-word'; 
    itemContainer.style.maxWidth = '100%'; 

    const position = savedPositions[item.id] || {
        x: Math.random() * (container.clientWidth - 150),
        y: Math.random() * (container.clientHeight - 150),
        width: 120,
        height: 120
    };

    applyCategoryPosition(itemContainer, position, container);

    const deleteItemBtn = document.createElement('button');
    deleteItemBtn.className = 'delete-btn';
    deleteItemBtn.innerHTML = 'X';
    deleteItemBtn.title = 'Delete item';
    deleteItemBtn.style.position = 'absolute';
    deleteItemBtn.style.top = '5px';
    deleteItemBtn.style.right = '5px';
    deleteItemBtn.style.display = editMode ? 'block' : 'none';
    deleteItemBtn.style.zIndex = '20'; 
    deleteItemBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(item.id, item.name);
    });


    const imgContainer = document.createElement('div');
    imgContainer.className = 'image-container';
    imgContainer.style.width = '100%';
    imgContainer.style.height = '100%';

    const img = document.createElement('img');
    img.className = 'tracker-image';
    img.src = item.src;
    img.dataset.imageId = item.id;
    img.alt = item.name || 'Item';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';

    if (item.checkedLocations?.length > 0) {
        img.dataset.checkedLocations = JSON.stringify(item.checkedLocations);
    }

    imgContainer.appendChild(img);
    itemContainer.appendChild(deleteItemBtn);
    itemContainer.appendChild(imgContainer);

    if (item.name) {
        const name = document.createElement('div');
        name.className = 'item-name';
        name.textContent = item.name;
        name.style.marginTop = '5px';
        name.style.textAlign = 'center';
        itemContainer.appendChild(name);
    }

    container.appendChild(itemContainer);


    if (editMode) {
        setupDragForUncategorizedItem(itemContainer);
        setupResizeForUncategorizedItem(itemContainer);
    }
}

function checkYamlRestrictions(item) {
  if (!item.yamlRestrictions || item.yamlRestrictions.length === 0) {
    return { action: 'show', image: null };
  }

  const slotData = JSON.parse(localStorage.getItem('apSlotData')) || {};
  let finalAction = { action: 'show', image: null };

  item.yamlRestrictions.forEach(restriction => {
    const actualValue = getNestedProperty(slotData, restriction.path);
    if (actualValue === undefined) return;

    const conditionMet = compareValues(actualValue, restriction.value, restriction.operator);

    if (!conditionMet && restriction.action === 'image') {
      finalAction = { action: 'replace', image: restriction.imageSrc };
    } else if (!conditionMet && restriction.action === 'remove') {
      finalAction = { action: 'hide' };
    }
  });

  return finalAction;
}

function compareValues(actual, expected, operator) {
  switch (operator) {
    case '>': return actual > expected;
    case '>=': return actual >= expected;
    case '<': return actual < expected;
    case '<=': return actual <= expected;
    case '!=': return actual != expected;
    case '==':
    default: return actual == expected;
  }
}
function resetTrackerState() {
  document.querySelectorAll('.tracker-image').forEach(img => {
    img.style.opacity = '1';
    if (img.dataset.originalSrc) {
      img.src = img.dataset.originalSrc;
    }
  });

  if (window.trackerConfig) {
    window.trackerConfig.items?.forEach(item => {
      if (item.checkedLocations) {
        item.checkedLocations = [];
      }
    });
  }


  localStorage.removeItem('apReceivedItems');
  localStorage.removeItem('apCheckedLocations');
  localStorage.removeItem('apSlotData');


  if (window.trackerConfig) {
    renderTracker(window.trackerConfig);
  }
}


window.resetTrackerState = resetTrackerState;
function getNestedProperty(obj, path) {
  return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
}

function updateItemsVisibility() {
  if (!tracker || !tracker.connected) return;

  const config = window.trackerConfig;
  const categoryVisibility = {};

  document.querySelectorAll('.uncategorized-item, .item-container').forEach(itemElement => {
    const itemId = itemElement.dataset.itemId;
    const item = config.items.find(i => i.id === itemId);
    if (!item) return;

    const img = itemElement.querySelector('img');
    if (!img) return;

    const originalStyles = {
      display: itemElement.style.display,
      position: itemElement.style.position,
      left: itemElement.style.left,
      top: itemElement.style.top,
      width: itemElement.style.width,
      height: itemElement.style.height,
      transform: itemElement.style.transform,
      margin: itemElement.style.margin
    };

    const result = item.yamlRestrictions ? checkYamlRestrictions(item) : { action: 'show' };

    switch (result.action) {
      case 'replace':
        img.src = result.image;
        Object.assign(itemElement.style, originalStyles);
        break;
      case 'hide':
        itemElement.style.display = 'none';
        break;
      case 'show':
      default:
        img.src = item.src;
        Object.assign(itemElement.style, originalStyles);
        break;
    }

    if (item.categoryId) {
      categoryVisibility[item.categoryId] = categoryVisibility[item.categoryId] || 
        (result.action !== 'hide');
    }
  });

  document.querySelectorAll('.category-section').forEach(section => {
    const categoryId = section.dataset.categoryId;
    section.style.display = categoryVisibility[categoryId] ? '' : 'none';
  });
}
function renderTracker(config) {
    const trackerContainer = document.getElementById('trackerContainer');
    if (!trackerContainer) return;
    applyBackground(config);

    const currentState = {};
    document.querySelectorAll('.category-section, .uncategorized-item').forEach(element => {
        const rect = element.getBoundingClientRect();
        const containerRect = trackerContainer.getBoundingClientRect();
        currentState[element.dataset.itemId || element.dataset.categoryId] = {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height
        };
    });

    trackerContainer.innerHTML = '';

    if (!config || !config.categories || !config.items) {
        console.error('Configuration invalide:', config);
        trackerContainer.innerHTML = '<p>Aucune donnée disponible</p>';
        return;
    }

    const itemsByCategory = {};
    config.items.forEach(item => {
        const categoryId = item.categoryId || 'uncategorized';
        if (!itemsByCategory[categoryId]) itemsByCategory[categoryId] = [];
        itemsByCategory[categoryId].push(item);
    });


    config.categories.forEach(category => {
        if (category.imageSize === undefined) {
            category.imageSize = 80;
        }
        if (itemsByCategory[category.id]?.length > 0) {
            createCategorySection(category, itemsByCategory[category.id], config, trackerContainer, currentState);
        }
    });


    if (itemsByCategory['uncategorized']?.length > 0) {
        itemsByCategory['uncategorized'].forEach(item => {
            createUncategorizedItem(item, config, trackerContainer, currentState);
        });
    }
	
  updateItemsVisibility();
    updateCheckedImages();
    if (editMode) {
        setupEditMode();
    } else {
        lockCategories(true);
    }
}

function createCategorySection(category, items, config, container, savedPositions) {
    if (!items || items.length === 0) return;

    const section = document.createElement('div');
    section.className = 'category-section';
    section.style.borderColor = category.color || '#9900ff';
    section.dataset.categoryId = category.id;
    section.style.position = 'absolute';
    section.style.margin = '0';
    section.style.boxSizing = 'border-box';

    const position = savedPositions[category.id] || 
                    config.categoryPositions?.[category.id] || 
                    { x: Math.random() * 100, y: Math.random() * 100 };

    applyCategoryPosition(section, position, container);


    const title = document.createElement('h2');
    title.className = 'category-title';
    title.textContent = category.name;
    
    const deleteCategoryBtn = document.createElement('button');
    deleteCategoryBtn.className = 'category-delete-btn';
    deleteCategoryBtn.innerHTML = 'X';
    deleteCategoryBtn.title = 'Delete category';
    deleteCategoryBtn.style.display = editMode ? 'block' : 'none'; 
    deleteCategoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCategory(category.id);
    });
    
    section.appendChild(title);
    section.appendChild(deleteCategoryBtn);


    const grid = document.createElement('div');
    grid.className = 'items-grid';
    
    const imageSize = category?.imageSize || 80;
    const itemContentWidth = imageSize + 40;
    const availableWidth = position.width || 400;
    const columns = Math.max(1, Math.floor(availableWidth / itemContentWidth));
    
    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(100px, 1fr))`;
    grid.style.width = '100%';


    items.forEach(item => {
        const itemContainer = document.createElement('div');
        itemContainer.className = 'item-container';
        itemContainer.dataset.itemId = item.id;


 const deleteItemBtn = document.createElement('button');
        deleteItemBtn.className = 'delete-btn';
        deleteItemBtn.innerHTML = 'X';
        deleteItemBtn.title = 'Delete item';
        deleteItemBtn.style.display = editMode ? 'block' : 'none'; 
        deleteItemBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteItem(item.id, item.name);
        });

        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container';

        const img = document.createElement('img');
        img.className = 'tracker-image';
        img.src = item.src;
        img.dataset.imageId = item.id;
        img.alt = item.name || 'Item';
        img.style.width = `${imageSize}px`;
        img.style.height = `${imageSize}px`;

        itemContainer.style.height = `${imageSize + 40}px`;

        if (item.checkedLocations?.length > 0) {
            img.dataset.checkedLocations = JSON.stringify(item.checkedLocations);
        }

        imgContainer.appendChild(img);
        itemContainer.appendChild(deleteItemBtn);
        itemContainer.appendChild(imgContainer);

        if (item.name) {
            const name = document.createElement('div');
            name.className = 'item-name';
            name.textContent = item.name;
            itemContainer.appendChild(name);
        }

        grid.appendChild(itemContainer);
    });

    section.appendChild(grid);
    container.appendChild(section);
}

function captureCurrentPositions() {
    const trackerContainer = document.getElementById('trackerContainer');
    if (!trackerContainer) return {};
    
    const positions = {};
    const containerRect = trackerContainer.getBoundingClientRect();
    
    document.querySelectorAll('.category-section').forEach(section => {
        const categoryId = section.dataset.categoryId;
        const rect = section.getBoundingClientRect();
        
        positions[categoryId] = {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height
        };
    });
    
    document.querySelectorAll('.uncategorized-item').forEach(item => {
        const itemId = item.dataset.itemId;
        const rect = item.getBoundingClientRect();
        
        positions[itemId] = {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height
        };
    });
    
    return positions;
}

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