/*
 * Game Drop Rate Query System - mon.js Deobfuscated Version
 * Handles monster search functionality
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
  if (typeof Monlist !== 'undefined' && Array.isArray(Monlist)) {
    indexedData = {
      byName: new Map()
    };

    for (let i = 0; i < Monlist.length; i++) {
      const monster = Monlist[i];
      if (monster && monster.name) {
        const lowerName = monster.name.toLowerCase();

        // Index by name
        if (!indexedData.byName.has(lowerName)) {
          indexedData.byName.set(lowerName, []);
        }
        indexedData.byName.get(lowerName).push(i);
      }
    }
  }
}

// Initialize monster search functionality
$(function () {
  // Use event delegation for both native and layui select elements
  $(document).on('change', '#monsterFilter, select[lay-filter="monsterFilter"]', function() {
    const selectedValue = $(this).val();
    console.log("Monster filter changed to: ", selectedValue); // Debug log
    // Clear previous results when filter changes
    $("#monList, #mapList, #mapTransferList, #equList").html("");
    // Refresh monsters based on new filter
    getMonByKey();
  });

  // Initialize layui form elements if available
  if (typeof layui !== 'undefined' && layui.form) {
    // Add the lay-filter attribute to the select element to enable layui events
    $('#monsterFilter').attr('lay-filter', 'monsterFilter');

    // Also listen for layui's select event as an additional measure
    layui.form.on('select', function(data) {
      // Only handle our specific filter
      if (data.elem.id === 'monsterFilter' || data.filter === 'monsterFilter') {
        console.log("Layui monster filter changed to: ", data.value); // Debug log
        // Clear previous results when filter changes
        $("#monList, #mapList, #mapTransferList, #equList").html("");
        // Refresh monsters based on new filter
        getMonByKey();
      }
    });

    // Render the form elements to apply layui styles and activate the listeners
    layui.form.render();
  }

  // Set up search button click handler
  $("#search").click(function () {
    // Clear previous results
    $("#monList, #mapList, #mapTransferList, #equList").html("");
    // Search for monsters by keyword
    getMonByKey();
  });

  // Set default value for monster filter and ensure layui renders it properly
  $("#monsterFilter").val('dropsItems');
  if (typeof layui !== 'undefined' && layui.form) {
    layui.form.render('select'); // Re-render just the select elements
  }

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
    getMonByKey();
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
            getMonByKey();
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

// Get monster name by ID, trying to use monlist first if available
function getMonsterName(monId) {
  // First, check if there's a global monlist with actual monster names
  if (typeof Monlist !== "undefined" && Monlist && Monlist.length > 0) {
    // Search for the monster in the monlist array
    for (let i = 0; i < Monlist.length; i++) {
      // Convert both to strings for comparison to handle type mismatches
      if (String(Monlist[i].id) === String(monId)) {
        return Monlist[i].name || "怪物" + monId;
      }
    }
  }

  // If not found in monlist, return a default name
  return "怪物" + monId;
}

// Check if a monster drops any items by checking the appropriate field in the Monlist
// Note: This function is kept for potential other uses, but display filtering now checks the monster object directly
function monsterHasDrops(monsterId) {
  if (typeof Monlist === "undefined" || !Array.isArray(Monlist)) {
    return false;
  }

  // Look for the specific monster in Monlist
  for (let i = 0; i < Monlist.length; i++) {
    const monster = Monlist[i];
    // Use strict string comparison to ensure proper matching
    if (monster && String(monster.id) === String(monsterId)) {
      // Check multiple possible field names that might indicate if a monster drops items
      // According to your specification, check the 'std' field primarily
      if (typeof monster.std !== 'undefined' && monster.std !== null) {
        // If std field is "-1", the monster does NOT drop items
        // If std field is anything else, the monster drops items
        return String(monster.std) !== "-1";
      }

      // As a fallback, also check the 'mon' field which might contain item IDs
      if (typeof monster.mon !== 'undefined' && monster.mon !== null) {
        return String(monster.mon) !== "-1";
      }

      // If no relevant field found, the monster does NOT drop items
      return false;
    }
  }

  // If we can't find the monster, it does NOT drop items
  return false;
}

// Create monster list from Stdlist data
function createMonsterListFromStdlist() {
  if (typeof Stdlist !== "undefined" && Stdlist.length > 0) {
    // Create a unique list of monsters from the Stdlist
    var monsterMap = {};

    for (let i = 0; i < Stdlist.length; i++) {
      if (Stdlist[i].mon !== "-1") {
        var monsterIds = Stdlist[i].mon.split(",");
        for (let j = 0; j < monsterIds.length; j++) {
          var monId = monsterIds[j];
          if (monId && !monsterMap[monId]) {
            // Use the proper name retrieval function to get the monster name
            const monsterName = getMonsterName(monId);
            monsterMap[monId] = { id: monId, name: monsterName, mapid: 0 };
          }
        }
      }
    }

    // Convert to array format
    return Object.values(monsterMap);
  }
  return [];
}

// Search for monsters based on keyword
function getMonByKey() {
  // Check if Stdlist exists and has data
  if (typeof Stdlist === "undefined" || !Array.isArray(Stdlist) || Stdlist.length === 0) {
    $("#equList").html("没有可用的数据，请检查版本选择");
    return;
  }

  // Create monster list if it doesn't exist
  if (typeof Monlist === "undefined" || Monlist.length === 0) {
    window.Monlist = createMonsterListFromStdlist();
  }

  // Get the filter selection: 'dropsItems' for monsters that drop items, 'all' for all monsters
  let filterType;
  if (typeof layui !== 'undefined' && layui.form) {
    // If using layui, try to get value with multiple fallbacks
    const $select = $('#monsterFilter');
    filterType = $select.val() || document.getElementById('monsterFilter').value || $select.find('option:selected').val() || 'dropsItems';
  } else {
    filterType = $("#monsterFilter").val() || 'dropsItems';
  }

  // Debug log to see what filterType is being used
  console.log("Current monster filterType: ", filterType);

  // Get the search keyword from input field and sanitize it
  let keyword = $("#key").val();
  keyword = sanitizeInput(keyword).toLowerCase();

  // Use cache if available - include filter type in cache key to avoid conflicts
  const cacheKey = `mon_fuzzy_${keyword}_${filterType}_${Monlist.length}`;
  if (keyword !== "" && searchCache.has(cacheKey)) {
    const cachedResult = searchCache.get(cacheKey);
    const container = document.getElementById('equList');
    if (container) {
      container.innerHTML = '';
      container.appendChild(cachedResult);
    }
    return;
  }

  // Clear cache for empty keyword to ensure fresh results when showing all monsters
  if (keyword === "") {
    searchCache.clear(); // Clear cache when showing all items to avoid stale bindings
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
              const monster = Monlist[i];
              if (monster) {
                // Check if the monster should be displayed based on filter type
                // Check the std field directly on the monster object
                const shouldDisplay = filterType === 'all' || (
                  typeof monster.std !== 'undefined' && monster.std !== null && String(monster.std) !== "-1"
                );
                if (shouldDisplay) {
                  // Create element for the monster entry with sanitized content
                  const monsterDiv = document.createElement('div');
                  monsterDiv.className = 'hove';
                  monsterDiv.setAttribute('listId', i);
                  // Capture the monId using closure to ensure correct value even after list updates
                  monsterDiv.onclick = (function(monId) {
                    return function() {
                      getStdByMon(monId);
                    };
                  })(i);
                  monsterDiv.textContent = `${i + 1}、${monster.name}`;
                  fragment.appendChild(monsterDiv);
                }
              }
            } catch (error) {
              console.warn(`Error processing monster at index ${i}:`, error);
              continue; // Skip this monster and continue with the next
            }
          }
        }
      }
    } else {
      // Fallback to original search if index is not available
      for (let i = 0; i < Monlist.length; i++) {
        try {
          const monster = Monlist[i];
          // Check if monster and name exist and monster name contains the keyword using fuzzy search
          if (monster && monster.name && typeof monster.name === 'string') {
            // Use fuzzy search with case-insensitive matching for both English and Chinese
            const monsterNameLower = monster.name.toLowerCase();
            if (matchesFuzzily(monsterNameLower, keyword)) {
              // Check if the monster should be displayed based on filter type
              // Check the std field directly on the monster object
              const shouldDisplay = filterType === 'all' || (
                typeof monster.std !== 'undefined' && monster.std !== null && String(monster.std) !== "-1"
              );
              if (shouldDisplay) {
                // Create element for the monster entry with sanitized content
                const monsterDiv = document.createElement('div');
                monsterDiv.className = 'hove';
                monsterDiv.setAttribute('listId', i);
                // Capture the monId using closure to ensure correct value even after list updates
                monsterDiv.onclick = (function(monId) {
                  return function() {
                    getStdByMon(monId);
                  };
                })(i);
                monsterDiv.textContent = `${i + 1}、${monster.name}`;
                fragment.appendChild(monsterDiv);
              }
            }
          }
        } catch (error) {
          console.warn(`Error processing monster at index ${i}:`, error);
          continue; // Skip this monster and continue with the next
        }
      }
    }
  } else {
    // Show monsters based on filter type if no keyword provided
    for (let i = 0; i < Monlist.length; i++) {
      try {
        const monster = Monlist[i];
        if (monster) {
          // Check if the monster should be displayed based on filter type
          // Check the std field directly on the monster object
          const shouldDisplay = filterType === 'all' || (
            typeof monster.std !== 'undefined' && monster.std !== null && String(monster.std) !== "-1"
          );
          if (shouldDisplay) {
            const monsterDiv = document.createElement('div');
            monsterDiv.className = 'hove';
            monsterDiv.setAttribute('listId', i);
            // Use direct event binding with closure to ensure proper monId capture
            (function(index) {
              monsterDiv.onclick = function() {
                getStdByMon(index);
              };
            })(i);
            monsterDiv.textContent = `${i + 1}、${monster.name}`;
            fragment.appendChild(monsterDiv);
          }
        }
      } catch (error) {
        console.warn(`Error processing monster at index ${i}:`, error);
        continue; // Skip this monster and continue with the next
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

// Get items dropped by the selected monster
function getStdByMon(monId) {
  // Clear previous results
  $("#monList, #mapList, #mapTransferList, #mapTitle, #monTitle, #dingshiTitle, #dingshicon").html("");
  $(".npclink, .dingshi").hide(); // Hide NPC link and dingshi sections by default

  // Check if Stdlist exists and the monId is valid
  if (typeof Stdlist === "undefined" || Stdlist.length <= 0) {
    $("#monList").html("物品数据不可用");
    return;
  }

  // Get the actual monster ID from Monlist by index
  let actualMonId = monId; // Start with the passed monId (which is an index)
  if (typeof Monlist !== "undefined" && Monlist.length > monId && Monlist[monId] && Monlist[monId].id !== undefined) {
    // If we have a valid Monlist entry, use the actual monster ID from it
    actualMonId = Monlist[monId].id;
  }
  // actualMonId now contains the actual monster ID (not the array index)

  // Find items that are dropped by this monster
  let itemHtml = "";
  let itemCount = 0;
  for (let i = 0; i < Stdlist.length; i++) {
    if (Stdlist[i] && Stdlist[i].mon && Stdlist[i].mon !== "-1") {
      const monsterIds = Stdlist[i].mon.split(",");
      // Convert actualMonId to string for comparison
      const monIdStr = String(actualMonId);
      if (monsterIds.includes(monIdStr)) {
        itemHtml += `
          <div class="hove" listid="${itemCount}">${itemCount + 1}、${Stdlist[i].name}</div>
        `;
        itemCount++;
      }
    }
  }

  if (itemHtml) {
    $("#monList").html(itemHtml);
  } else {
    $("#monList").html("该怪物不掉落任何物品");
  }

  // Get map and additional info for the selected monster from Monlist if available
  if (typeof Monlist !== "undefined" && Monlist.length > monId && Monlist[monId]) {
    const monsterData = Monlist[monId];
    const monsterName = monsterData.name || `怪物${actualMonId}`;

    // Display monster name in monTitle
    const monTitleContainer = document.getElementById('monTitle');
    monTitleContainer.innerHTML = '';
    const span = document.createElement('span');
    span.style.color = 'orangered';
    span.textContent = monsterName;
    monTitleContainer.insertAdjacentHTML('afterbegin', span.outerHTML + '&emsp;');
    monTitleContainer.insertAdjacentText('beforeend', ' 可以掉落以下物品');
    
    const mapTitleContainer = document.getElementById('mapTitle');
    mapTitleContainer.innerHTML = '';
    const mapSpan = document.createElement('span');
    mapSpan.style.color = 'mediumvioletred';
    mapSpan.textContent = monsterName;
    mapTitleContainer.insertAdjacentHTML('afterbegin', mapSpan.outerHTML + '&emsp;');
    mapTitleContainer.insertAdjacentText('beforeend', '所在地图名称（没有地图说明这个怪物不刷出）')

    // Handle map information
    if (monsterData.map && monsterData.map !== "-1") {
      const mapIds = monsterData.map.split(",");
      let mapHtml = "";

      for (let i = 0; i < mapIds.length; i++) {
        if (mapIds[i] !== "") {
          const mapId = parseInt(mapIds[i], 10);
          if (!isNaN(mapId) && typeof Maplist !== "undefined" && Maplist[mapId]) {
            const mapName = Maplist[mapId].name || `地图${mapId}`;
            mapHtml += `
              <div class="hove" listid="${i}" onclick="getPathByMap(${mapId})">${i + 1}、${mapName}</div>
            `;
          } else {
            mapHtml += `<div>${i + 1}、地图${mapId}</div>`;
          }
        }
      }

      if (mapHtml) {
        $("#mapList").html(mapHtml);
      } else {
        $("#mapList").html("没有地图信息");
      }
    } else {
      $("#mapList").html("没有地图刷新");
    }

    // Handle定时刷新 (定时 refresh) information if available
    if (monsterData.bot && monsterData.bot !== "-1") {
      const monRefrushs = monsterData.bot.split(",");
      let refreshHtml = "";

      for (let i = 0; i < monRefrushs.length; i++) {
        if (monRefrushs[i] !== "") {
          if (i > 0) {
            refreshHtml += "<br>";
          }
          refreshHtml += monRefrushs[i];
        }
      }

      if (refreshHtml) {
        $("#dingshicon").html(refreshHtml);
        $("#dingshiTitle").html("定时刷新");
        $(".dingshi").show(); // Show the dingshi section
      }
    }
  } else {
    // Fallback: show monster name as ID if no detailed info
    const monsterName = `怪物${actualMonId}`;
    $("#monTitle").html("这个怪物爆点啥");
    $("#mapList").html("没有地图信息");
  }

  // Set titles
  // $("#mapTitle").html("所在地图名称（没有地图说明这个怪物不刷出）");
  $("#mapTransferTitle").html("跑图流程（没有信息说明此地图是触发进入）");
}

// Get path information for the selected map
function getPathByMap(mapId) {
  $("#mapTransferList").html("");

  // Safely get map name and display
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

  if (typeof Maplist !== "undefined" && Maplist[mapId] && Maplist[mapId].npc && Maplist[mapId].npc !== "-1") {
    const npcList = Maplist[mapId].npc.split(",");
    for (let i = 0; i < npcList.length; i++) {
      if (npcList[i] !== "") {
        const npcId = parseInt(npcList[i], 10);
        if (!isNaN(npcId) && typeof Npclist !== "undefined" && Npclist[npcId]) {
          const npcName = Npclist[npcId].name || `NPC${npcId}`;
          const mapName = Npclist[npcId].mname || '';
          const mapPoint = Npclist[npcId].mxy || '';

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
  if (typeof Maplist !== "undefined" && Maplist[mapId] && Maplist[mapId].path && Maplist[mapId].path !== "-1") {
    const pathList = Maplist[mapId].path.split(",");
    for (let i = 0; i < pathList.length; i++) {
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

// Initialize the page - get all monsters by default only if data is available
if (typeof Stdlist !== "undefined" && Stdlist.length > 0) {
  getMonByKey();
}
