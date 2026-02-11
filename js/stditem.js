/*
 * Game Drop Rate Query System - stditem.js Deobfuscated Version
 * Handles item/equipment search functionality
 *
 * Key features:
 * - Loads data dynamically based on selected version from cookies
 * - Supports URL parameter 'v' for direct version selection
 * - Includes defensive checks for missing data structures
 * - Provides fallback mechanisms when data is unavailable
 * - Enhanced security with input sanitization and XSS protection
 * - Optimized with caching mechanisms and efficient algorithms
 */

// Cache for search results to improve performance
let searchCache = new Map();
let indexedData = null;
const MAX_CACHE_SIZE = 50; // Limit cache size to prevent memory issues

// Utility functions for sanitization and validation
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(/[<>'\"&]/g, function(match) {
    switch(match) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\"': return '&quot;';
      case "'": return '&#x27;';
    }
  });
}

function isValidGameData(data) {
  return data &&
         Array.isArray(data.Stdlist) &&
         Array.isArray(data.Monlist) &&
         Array.isArray(data.Maplist) &&
         Array.isArray(data.Npclist) &&
         // Additional validation for data structure
         data.Stdlist.every(item =>
           item &&
           typeof item.name === 'string' &&
           typeof item.mon === 'string' &&
           typeof item.npc === 'string'
         ) &&
         data.Monlist.every(mon =>
           mon &&
           typeof mon.name === 'string' &&
           typeof mon.map === 'string'
         ) &&
         data.Maplist.every(map =>
           map &&
           typeof map.name === 'string'
         ) &&
         data.Npclist.every(npc =>
           npc &&
           typeof npc.name === 'string'
         );
}

function isValidVersion(version) {
  if (typeof version !== 'string' || version.length === 0) return false;
  // Check against the configured version list to ensure it's valid
  if (typeof window.version_list !== 'undefined') {
    return window.version_list.some(v => v.data === version);
  }
  return /^[A-Za-z0-9_]+$/.test(version); // Basic regex validation
}

function sanitizedName(name) {
  // Ensure the name consists only of allowed characters for security
  return name.replace(/[^A-Za-z0-9_]/g, '');
}

// Function to perform fuzzy matching - checks if all characters of needle appear in haystack in order
function matchesFuzzily(haystack, needle) {
  if (!needle || !haystack) return !needle;

  // Use a more robust algorithm that handles both English and Chinese characters properly
  let haystackIndex = 0;
  let needleIndex = 0;

  // Iterate through each character in the haystack
  while (haystackIndex < haystack.length && needleIndex < needle.length) {
    // If current characters match (case-insensitive), advance needle index
    if (haystack.charAt(haystackIndex).toLowerCase() === needle.charAt(needleIndex).toLowerCase()) {
      needleIndex++;
    }
    // Always advance haystack index
    haystackIndex++;
  }

  // Return true only if we've matched all characters in the needle
  return needleIndex === needle.length;
}

// Parse game data safely from the response text
function parseGameData(dataText) {
  // Use a more isolated approach to avoid variable conflicts
  try {
    // Create a function that executes the data in its own scope
    const func = new Function(`
      "use strict";
      var result = { DataName: undefined, Stdlist: undefined, Monlist: undefined, Maplist: undefined, Npclist: undefined };
      (function() {
        var DataName, Stdlist, Monlist, Maplist, Npclist;
        ${dataText}
        result.DataName = typeof DataName !== 'undefined' ? DataName : undefined;
        result.Stdlist = typeof Stdlist !== 'undefined' ? Stdlist : undefined;
        result.Monlist = typeof Monlist !== 'undefined' ? Monlist : undefined;
        result.Maplist = typeof Maplist !== 'undefined' ? Maplist : undefined;
        result.Npclist = typeof Npclist !== 'undefined' ? Npclist : undefined;
      })();
      return result;
    `);

    return func();
  } catch (e) {
    console.error('Error parsing data:', e);
    throw new Error('Failed to parse game data: ' + e.message);
  }
}

function safelyGetPropertyName(obj, prop, defaultValue = '') {
  try {
    if (obj && typeof obj === 'object' && obj !== null && prop in obj) {
      const value = obj[prop];
      // Handle null, undefined, and other non-string/number values safely
      if (value === null || value === undefined) {
        return defaultValue;
      }
      if (typeof value === 'string' || typeof value === 'number') {
        return value.toString();
      }
      // For other types, convert to string safely
      return String(value);
    }
    return defaultValue;
  } catch (error) {
    console.warn('Error accessing property', prop, error);
    return defaultValue;
  }
}

// Initialize indexed data for faster lookups
function initializeIndex() {
  if (typeof Stdlist !== 'undefined' && Array.isArray(Stdlist)) {
    indexedData = {
      byName: new Map(),
      byMonster: new Map(),
      byNpc: new Map()
    };

    for (let i = 0; i < Stdlist.length; i++) {
      const item = Stdlist[i];
      if (item && item.name) {
        const lowerName = item.name.toLowerCase();

        // Index by name
        if (!indexedData.byName.has(lowerName)) {
          indexedData.byName.set(lowerName, []);
        }
        indexedData.byName.get(lowerName).push(i);

        // Index by monster
        if (item.mon && item.mon !== "-1") {
          const monsterIds = item.mon.split(",");
          for (const monId of monsterIds) {
            if (monId !== "") {
              if (!indexedData.byMonster.has(monId)) {
                indexedData.byMonster.set(monId, []);
              }
              indexedData.byMonster.get(monId).push(i);
            }
          }
        }

        // Index by npc
        if (item.npc && item.npc !== "-1") {
          const npcIds = item.npc.split(",");
          for (const npcId of npcIds) {
            if (npcId !== "") {
              if (!indexedData.byNpc.has(npcId)) {
                indexedData.byNpc.set(npcId, []);
              }
              indexedData.byNpc.get(npcId).push(i);
            }
          }
        }
      }
    }
  }
}

// Initialize item search functionality
$(function () {
  // Set up search button click handler
  $("#search").click(function () {
    // Clear previous results
    $("#monList, #mapList, #mapTransferList, #equList").html("");
    // Search for items by keyword
    getEquByKey();
  });

  // Check URL for version parameter first
  var searchParams = new URLSearchParams(window.location.search);
  var versionParam = searchParams.get("v");

  if (versionParam) {
    // Set the version in cookies if provided in URL
    if (typeof version_list !== "undefined") {
      for (let i = 0; i < version_list.length; i++) {
        if (version_list[i].data === versionParam) {
          $.cookie("version_name", version_list[i].name);
          $.cookie("version_data", version_list[i].data);
          break;
        }
      }
    }
  }

  // Load data if not already loaded
  if (typeof Stdlist === "undefined" || Stdlist.length === 0) {
    loadGameData();
  } else {
    // Data already loaded, initialize
    initializeIndex(); // Initialize index in case data was already loaded
    getEquByKey();
  }
});

// Function to load game data based on selected version
function loadGameData() {
  // Get the selected version from cookie or default to first
  var selectedVersion = $.cookie("version_data");

  if (selectedVersion) {
    // Validate version against known versions for security
    if (!isValidVersion(selectedVersion)) {
      console.error("Invalid version provided:", selectedVersion);
      alert("无效的游戏版本");
      return;
    }

    // Use safer approach to load data - fetch the file content and evaluate it securely
    fetch(`../data/${sanitizedName(selectedVersion)}.js`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`网络响应不正常: ${response.status} ${response.statusText}`);
        }
        return response.text();
      })
      .then(text => {
        if (!text || text.trim().length === 0) {
          throw new Error('返回的数据为空');
        }

        // Parse the data safely by evaluating in a controlled environment
        const data = parseGameData(text);
        if (isValidGameData(data)) {
          // Temporarily store the original values to restore them after
          const originalStdlist = window.Stdlist;
          const originalMonlist = window.Monlist;
          const originalMaplist = window.Maplist;
          const originalNpclist = window.Npclist;
          const originalDataName = window.DataName;

          try {
            // Assign the new data
            window.Stdlist = data.Stdlist || [];
            window.Monlist = data.Monlist || [];
            window.Maplist = data.Maplist || [];
            window.Npclist = data.Npclist || [];
            window.DataName = data.DataName || '';

            initializeIndex(); // Initialize index for faster searches
            getEquByKey();
          } catch (e) {
            // If anything goes wrong, restore the original values
            window.Stdlist = originalStdlist;
            window.Monlist = originalMonlist;
            window.Maplist = originalMaplist;
            window.Npclist = originalNpclist;
            window.DataName = originalDataName;
            throw e;
          }
        } else {
          throw new Error('数据格式验证失败');
        }
      })
      .catch(error => {
        console.error("Failed to load data:", error);
        // Show a more user-friendly error message while logging the full error for debugging
        alert("无法加载数据，请检查版本选择");
      });
  } else {
    console.warn("No version selected in cookies");
    alert("请先选择游戏版本");
    window.location.href = "../index.html";
  }
}

// Search for equipment/items based on keyword
function getEquByKey() {
  // Check if Stdlist exists and has data
  if (typeof Stdlist === "undefined" || !Array.isArray(Stdlist) || Stdlist.length === 0) {
    $("#equList").html("没有可用的数据，请检查版本选择");
    return;
  }

  // Get the search keyword from input field and sanitize it
  let keyword = $("#key").val();
  keyword = sanitizeInput(keyword).toLowerCase();

  let cacheKey = null; // Initialize cacheKey to handle both empty and non-empty keyword cases

  // Clear cache for empty keyword to ensure fresh results when showing all items
  if (keyword === "") {
    searchCache.clear(); // Clear cache when showing all items to avoid stale bindings
  } else {
    // Use cache if available for non-empty keywords
    cacheKey = `fuzzy_${keyword}_${Stdlist.length}`; // Updated cache key to reflect fuzzy search
    if (searchCache.has(cacheKey)) {
      const cachedResult = searchCache.get(cacheKey);
      const container = document.getElementById('equList');
      if (container) {
        container.innerHTML = '';
        container.appendChild(cachedResult);
      }
      return;
    }
  }

  // Create document fragment for efficient DOM manipulation
  const fragment = document.createDocumentFragment();

  if (keyword !== "") {
    // Use indexed data for faster search if available
    if (indexedData && indexedData.byName) {
      // Search through indexed data - implement fuzzy search
      for (const [name, indices] of indexedData.byName.entries()) {
        // For fuzzy search, check if all characters of keyword appear in name in order
        if (matchesFuzzily(name, keyword)) {
          for (const i of indices) {
            try {
              const item = Stdlist[i];
              // Check if the item has related monsters or NPCs
              if (item && (item.mon !== "-1" || item.npc !== "-1")) {
                // Create element for the item entry with sanitized content
                const itemDiv = document.createElement('div');
                itemDiv.className = 'hove';
                itemDiv.setAttribute('listId', i);
                itemDiv.setAttribute('monId', item.mon || '');
                // Capture the itemId using closure to ensure correct value even after list updates
                itemDiv.onclick = (function(itemId) {
                  return function() {
                    getMonByWp(itemId);
                  };
                })(i);
                itemDiv.textContent = `${i + 1}、${item.name}`;
                fragment.appendChild(itemDiv);
              }
            } catch (error) {
              console.warn(`Error processing item at index ${i}:`, error);
              continue; // Skip this item and continue with the next
            }
          }
        }
      }
    } else {
      // Fallback to original search if index is not available
      for (let i = 0; i < Stdlist.length; i++) {
        try {
          const item = Stdlist[i];
          // Check if item and name exist and item name contains the keyword using fuzzy search
          if (item && item.name && typeof item.name === 'string') {
            // Use fuzzy search with case-insensitive matching for both English and Chinese
            const itemNameLower = item.name.toLowerCase();
            if (matchesFuzzily(itemNameLower, keyword)) {
              // Check if the item has related monsters or NPCs
              if (item.mon !== "-1" || item.npc !== "-1") {
                // Create element for the item entry with sanitized content
                const itemDiv = document.createElement('div');
                itemDiv.className = 'hove';
                itemDiv.setAttribute('listId', i);
                itemDiv.setAttribute('monId', item.mon || '');
                // Capture the itemId using closure to ensure correct value even after list updates
                itemDiv.onclick = (function(itemId) {
                  return function() {
                    getMonByWp(itemId);
                  };
                })(i);
                itemDiv.textContent = `${i + 1}、${item.name}`;
                fragment.appendChild(itemDiv);
              }
            }
          }
        } catch (error) {
          console.warn(`Error processing item at index ${i}:`, error);
          continue; // Skip this item and continue with the next
        }
      }
    }
  } else {
    // Show all items if no keyword provided
    for (let i = 0; i < Stdlist.length; i++) {
      try {
        const item = Stdlist[i];
        if (item && (item.mon !== "-1" || item.npc !== "-1")) {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'hove';
          itemDiv.setAttribute('listId', i);
          itemDiv.setAttribute('monId', item.mon || '');
          // Use direct event binding with closure to ensure proper itemId capture
          (function(index) {
            itemDiv.onclick = function() {
              getMonByWp(index);
            };
          })(i);
          itemDiv.textContent = `${i + 1}、${item.name}`;
          fragment.appendChild(itemDiv);
        }
      } catch (error) {
        console.warn(`Error processing item at index ${i}:`, error);
        continue; // Skip this item and continue with the next
      }
    }
  }

  // Cache the result for future use (limit cache size) only for non-empty keywords
  if (keyword !== "") {
    if (searchCache.size >= MAX_CACHE_SIZE) {
      // Remove the first item in the cache (oldest)
      const firstKey = searchCache.keys().next().value;
      searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, fragment.cloneNode(true));
  }

  // Clear and append the entire fragment at once for efficiency
  const container = document.getElementById('equList');
  if (container) {
    container.innerHTML = '';
    container.appendChild(fragment);
  } else {
    console.error("Container element 'equList' not found");
  }
}

// Get monsters that drop the selected item
function getMonByWp(itemId) {
  // Clear previous results
  $("#monList, #mapList, #mapTransferList, #mapTitle, #monTitle, #npccon").html(
    ""
  );
  $(".npclink").hide();

  // Check if Stdlist exists and the itemId is valid
  if (typeof Stdlist === "undefined" || Stdlist.length <= itemId) {
    $("#monList").html("物品数据不可用");
    return;
  }

  // 安全ly get the item name and display
  let itemName = "";
  if (
    typeof Stdlist !== "undefined" &&
    Stdlist.length > itemId &&
    Stdlist[itemId] &&
    Stdlist[itemId].name
  ) {
    let item = Stdlist[itemId].name;
    // Use textContent to prevent XSS, then wrap in span for styling
    const span = document.createElement('span');
    span.style.color = 'orangered';
    span.textContent = item;
    itemName = span.outerHTML + '&emsp;';
  }

  // 移除之前的物品标题（如果存在）
  $("#selectedItemTitle").remove();

  // 修改 #monTitle 内容以与物品名称保持一致
  const monTitleContainer = document.getElementById('monTitle');
  monTitleContainer.innerHTML = '';
  monTitleContainer.insertAdjacentHTML('afterbegin', itemName);
  monTitleContainer.insertAdjacentText('beforeend', ' 可以在这些怪物或NPC获取（点击怪物查看地图）');

  // Check if the selected item's monster list is not '-1' (meaning it drops from monsters)
  if (Stdlist[itemId].mon !== "-1") {
    // Get the monster IDs that drop this item
    const monsterIds = Stdlist[itemId].mon.split(",");

    // Create document fragment for efficient DOM manipulation
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < monsterIds.length; i++) {
      if (monsterIds[i] !== "") {
        const monsterId = parseInt(monsterIds[i], 10);
        if (!isNaN(monsterId) && Monlist[monsterId]) {
          // Get the monster name using our function which tries to get it from monlist first
          const monsterName = safelyGetPropertyName(Monlist[monsterId], 'name', `怪物${monsterId}`);
          const monsterMap = safelyGetPropertyName(Monlist[monsterId], 'map', '');

          // Create monster entry that allows viewing maps when clicked
          const monsterDiv = document.createElement('div');
          monsterDiv.className = 'hove';
          monsterDiv.setAttribute('listId', i);
          monsterDiv.setAttribute('mapId', monsterMap);
          monsterDiv.onclick = () => getMapByMon(monsterId);
          monsterDiv.textContent = `${i + 1}、${monsterName}`;
          fragment.appendChild(monsterDiv);
        }
      }
    }

    const container = document.getElementById('monList');
    container.innerHTML = '';
    container.appendChild(fragment);
  } else {
    $("#monList").html("该物品不从怪物掉落");
  }

  // Handle NPC data if available
  if (Stdlist[itemId].npc !== "-1") {
    // Show NPC section
    $(".npclink").show();
    const npcIds = Stdlist[itemId].npc.split(",");

    // Create document fragment for efficient DOM manipulation
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < npcIds.length; i++) {
      if (npcIds[i] !== "") {
        const npcId = parseInt(npcIds[i], 10);
        if (!isNaN(npcId) && Npclist[npcId]) {
          // Get the NPC name using our function which tries to get it from npclist first
          const npcName = safelyGetPropertyName(Npclist[npcId], 'name', `NPC${npcId}`);
          const npcMapName = safelyGetPropertyName(Npclist[npcId], 'mname', '');
          const npcMapPoint = safelyGetPropertyName(Npclist[npcId], 'mxy', '');

          // Create NPC entry that allows viewing maps when clicked
          const npcDiv = document.createElement('div');
          npcDiv.className = 'hove';
          npcDiv.setAttribute('listId', i);
          npcDiv.setAttribute('npcId', npcId);

          // Create text content with proper formatting
          const content = `${i + 1}、${npcName}【${npcMapName}(${npcMapPoint})】`;
          npcDiv.textContent = content;
          fragment.appendChild(npcDiv);
        }
      }
    }

    const container = document.getElementById('npccon');
    container.innerHTML = '';
    container.appendChild(fragment);
  } else {
    // Hide NPC section if no NPC data
    $(".npclink").hide();
  }

  // Set titles
  $("#mapTitle").html("所在地图名称（没有地图说明这个怪物不刷出）");
  $("#mapTransferTitle").html("跑图流程（没有信息说明此地图是触发进入）");
}

// Get maps for the selected monster
function getMapByMon(monId) {
  // Clear previous results
  $("#mapList, #mapTransferList,#dingshiTitle,#dingshicon").html("");

  if (typeof Monlist !== "undefined" && Monlist.length < monId) {
    $("#mapList").html("怪物数据不可用");
    return;
  }

  let monName = "";
  if (
    typeof Monlist !== "undefined" &&
    Monlist.length > monId &&
    Monlist[monId] &&
    Monlist[monId].name
  ) {
    let mon = Monlist[monId].name;
    // Use textContent to prevent XSS, then wrap in span for styling
    const span = document.createElement('span');
    span.style.color = 'mediumvioletred';
    span.textContent = mon;
    monName = span.outerHTML + '&emsp;';
  }

  // Update mapTitle safely using DOM manipulation
  const mapTitleContainer = document.getElementById('mapTitle');
  mapTitleContainer.innerHTML = '';
  mapTitleContainer.insertAdjacentHTML('afterbegin', monName);
  mapTitleContainer.insertAdjacentText('beforeend', '所在地图名称（没有地图说明这个怪物不刷出）');

  if (Monlist[monId].map !== "-1") {
    const mapIds = Monlist[monId].map.split(",");

    // Create document fragment for efficient DOM manipulation
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < mapIds.length; i++) {
      if (mapIds[i] !== "") {
        const mapId = parseInt(mapIds[i], 10);
        if (!isNaN(mapId) && Maplist[mapId]) {
          const mapName = safelyGetPropertyName(Maplist[mapId], 'name', `地图${mapId}`);
          const mapPath = safelyGetPropertyName(Maplist[mapId], 'path', '');

          const mapDiv = document.createElement('div');
          mapDiv.className = 'hove';
          mapDiv.setAttribute('listId', i);
          mapDiv.setAttribute('path', mapPath);
          mapDiv.onclick = () => getPathByMap(mapId);
          mapDiv.textContent = `${i + 1}、${mapName}`;
          fragment.appendChild(mapDiv);
        }
      }
    }

    const container = document.getElementById('mapList');
    container.innerHTML = '';
    container.appendChild(fragment);
  } else {
    $("#mapList").html("没有地图刷新");
  }

  if(Monlist[monId].bot !== "-1"){
    const monRefrushs = Monlist[monId].bot.split(",");

    // Create document fragment for efficient DOM manipulation
    const fragment = document.createDocumentFragment();
    let first = true;

    for(let i = 0; i < monRefrushs.length; i++){
      if(monRefrushs[i] !== ""){
        if(!first){
          const br = document.createElement('br');
          fragment.appendChild(br);
        }
        const textNode = document.createTextNode(monRefrushs[i]);
        fragment.appendChild(textNode);
        first = false;
      }
    }

    const container = document.getElementById('dingshicon');
    container.innerHTML = '';
    container.appendChild(fragment);

    $("#dingshiTitle").html("定时刷新");
    // 显示定时刷新卡片
    $(".layui-card.dingshi").show();
  } else {
    // 如果没有定时刷新信息，隐藏卡片
    $(".layui-card.dingshi").hide();
  }
}

function getPathByMap(mapId){
  $("#mapTransferList").html("");

  // 安全ly获取物品名称并显示
  let mapName = "";
  if (
    typeof Maplist !== "undefined" &&
    Maplist.length > mapId &&
    Maplist[mapId] &&
    Maplist[mapId].name
  ) {
    let map = Maplist[mapId].name;
    // Use textContent to prevent XSS, then wrap in span for styling
    const span = document.createElement('span');
    span.style.color = 'orangered';
    span.textContent = map;
    mapName = span.outerHTML + '&emsp;';
  }

  // Update mapTransferTitle safely using DOM manipulation
  const mapTransferTitleContainer = document.getElementById('mapTransferTitle');
  mapTransferTitleContainer.innerHTML = '';
  mapTransferTitleContainer.insertAdjacentHTML('afterbegin', mapName);
  mapTransferTitleContainer.insertAdjacentText('beforeend', '跑图流程（没有信息说明此地图是触发进入）');

  // Create document fragment for efficient DOM manipulation
  const fragment = document.createDocumentFragment();
  let hasContent = false;

  if(Maplist[mapId].npc !== "-1"){
    const npcList = Maplist[mapId].npc.split(",");
    for(let i = 0; i < npcList.length; i++){
      if (npcList[i] !== "") {
        const npcId = parseInt(npcList[i], 10);
        if (!isNaN(npcId) && Npclist[npcId]) {
          const npcName = safelyGetPropertyName(Npclist[npcId], 'name', `NPC${npcId}`);
          const mapName = safelyGetPropertyName(Npclist[npcId], 'mname', '');
          const mapPoint = safelyGetPropertyName(Npclist[npcId], 'mxy', '');

          // Create fieldset element for NPC info
          const fieldset = document.createElement('fieldset');
          fieldset.className = 'layui-elem-field';

          const legend = document.createElement('legend');
          legend.textContent = 'NPC直传';
          fieldset.appendChild(legend);

          const div = document.createElement('div');
          div.className = 'layui-field-box';
          div.textContent = `${npcName}【${mapName}(${mapPoint})】`;
          fieldset.appendChild(div);

          if (hasContent) {
            const br = document.createElement('br');
            fragment.appendChild(br);
          }
          fragment.appendChild(fieldset);
          hasContent = true;
        }
      }
    }
  }
  if(Maplist[mapId].path !== "-1"){
    const pathList = Maplist[mapId].path.split(",");
    for(let i = 0; i < pathList.length; i++){
      if (pathList[i] !== "") {
        if (hasContent) {
          const br = document.createElement('br');
          fragment.appendChild(br);
        }

        // Create fieldset element for path info
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'layui-elem-field';

        const legend = document.createElement('legend');
        legend.textContent = '跑图路线';
        fieldset.appendChild(legend);

        const div = document.createElement('div');
        div.className = 'layui-field-box';
        div.textContent = pathList[i];
        fieldset.appendChild(div);

        fragment.appendChild(fieldset);
        hasContent = true;
      }
    }
  }

  const container = document.getElementById('mapTransferList');
  container.appendChild(fragment);
}

// Initialize the page - get all items by default only if data is available
if (typeof Stdlist !== "undefined" && Stdlist.length > 0) {
  getEquByKey();
}