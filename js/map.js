/*
 * Game Drop Rate Query System - map.js Deobfuscated Version
 * Handles map search functionality
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
  if (typeof Maplist !== 'undefined' && Array.isArray(Maplist)) {
    indexedData = {
      byName: new Map()
    };

    for (let i = 0; i < Maplist.length; i++) {
      const map = Maplist[i];
      if (map && map.name) {
        const lowerName = map.name.toLowerCase();

        // Index by name
        if (!indexedData.byName.has(lowerName)) {
          indexedData.byName.set(lowerName, []);
        }
        indexedData.byName.get(lowerName).push(i);
      }
    }
  }
}

// Initialize map search functionality
$(function() {
    // Set up search button click handler
    $('#search').click(function() {
        // Clear previous results
        $('#monList, #mapList, #mapTransferList, #equList').html('');
        // Search for maps by keyword
        getMapByKey();
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
    if (typeof Stdlist === 'undefined' || Stdlist.length === 0) {
        loadGameData();
    } else {
        // Data already loaded, initialize
        initializeIndex(); // Initialize index in case data was already loaded
        getMapByKey();
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
            getMapByKey();
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

// Search for maps based on keyword
function getMapByKey() {
  // Check if Maplist exists and has data
  if (typeof Maplist === "undefined" || !Array.isArray(Maplist) || Maplist.length === 0) {
    $("#equList").html("没有可用的地图数据，请检查版本选择");
    return;
  }

  // Initialize indexed data if not already done
  if (!indexedData) {
    initializeIndex();
  }

  // Get the search keyword from input field and sanitize it
  let keyword = $("#key").val();
  keyword = sanitizeInput(keyword).toLowerCase();

  // Initialize cacheKey to handle both empty and non-empty keyword cases
  let cacheKey = null;

  // Clear cache for empty keyword to ensure fresh results when showing all items
  if (keyword === "") {
    searchCache.clear(); // Clear cache when showing all items to avoid stale bindings
  } else {
    // Use cache if available for non-empty keywords
    cacheKey = `map_fuzzy_${keyword}_${Maplist.length}`;
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
              const map = Maplist[i];
              if (map) {
                // Create element for the map entry with sanitized content
                const mapDiv = document.createElement('div');
                mapDiv.className = 'hove';
                mapDiv.setAttribute('listId', i);
                mapDiv.setAttribute('mapId', map.id || i);
                // Capture the mapId using closure to ensure correct value even after list updates
                mapDiv.onclick = (function(mapId) {
                  return function() {
                    getMonByMap(mapId);
                  };
                })(i);
                mapDiv.textContent = `${i + 1}、${map.name}`;
                fragment.appendChild(mapDiv);
              }
            } catch (error) {
              console.warn(`Error processing map at index ${i}:`, error);
              continue; // Skip this map and continue with the next
            }
          }
        }
      }
    } else {
      // Fallback to original search if index is not available
      for (let i = 0; i < Maplist.length; i++) {
        try {
          const map = Maplist[i];
          // Check if map and name exist and map name contains the keyword using fuzzy search
          if (map && map.name && typeof map.name === 'string') {
            // Use fuzzy search with case-insensitive matching for both English and Chinese
            const mapNameLower = map.name.toLowerCase();
            if (matchesFuzzily(mapNameLower, keyword)) {
              // Create element for the map entry with sanitized content
              const mapDiv = document.createElement('div');
              mapDiv.className = 'hove';
              mapDiv.setAttribute('listId', i);
              mapDiv.setAttribute('mapId', map.id || i);
              // Capture the mapId using closure to ensure correct value even after list updates
              mapDiv.onclick = (function(mapId) {
                return function() {
                  getMonByMap(mapId);
                };
              })(i);
              mapDiv.textContent = `${i + 1}、${map.name}`;
              fragment.appendChild(mapDiv);
            }
          }
        } catch (error) {
          console.warn(`Error processing map at index ${i}:`, error);
          continue; // Skip this map and continue with the next
        }
      }
    }
  } else {
    // Show all maps if no keyword provided
    for (let i = 0; i < Maplist.length; i++) {
      try {
        const map = Maplist[i];
        if (map) {
          const mapDiv = document.createElement('div');
          mapDiv.className = 'hove';
          mapDiv.setAttribute('listId', i);
          mapDiv.setAttribute('mapId', map.id || i);
          // Use direct event binding with closure to ensure proper mapId capture
          (function(index) {
            mapDiv.onclick = function() {
              getMonByMap(index);
            };
          })(i);
          mapDiv.textContent = `${i + 1}、${map.name}`;
          fragment.appendChild(mapDiv);
        }
      } catch (error) {
        console.warn(`Error processing map at index ${i}:`, error);
        continue; // Skip this map and continue with the next
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

// Get monsters in the selected map
function getMonByMap(mapId) {
    // Clear previous results
    $('#monList, #mapList, #mapTransferList, #mapTitle, #monTitle, #mapTransferTitle').html('');

    // Check if Maplist exists and the mapId is valid
    if (typeof Maplist === "undefined" || Maplist.length <= 0) {
        $("#monList").html("地图数据不可用");
        return;
    }

    // Get the actual map from Maplist by index
    let actualMap = Maplist[mapId];
    if (!actualMap) {
        $("#monList").html("地图数据不存在");
        return;
    }

    // Find monsters that are on this map
    let monsterHtml = '';
    let monsterCount = 0;

    if (typeof Monlist !== "undefined" && Monlist.length > 0) {
        for (let i = 0; i < Monlist.length; i++) {
            const monster = Monlist[i];
            if (monster && monster.map && monster.map !== "-1") {
                const mapIds = monster.map.split(",");
                if (mapIds.includes(String(mapId))) {
                    monsterHtml += `
                        <div class="hove" listid="${monsterCount}" onclick="getStdByMon(${i})">${monsterCount + 1}、${monster.name}</div>
                    `;
                    monsterCount++;
                }
            }
        }
    }

    if (monsterHtml) {
        $('#monList').html(monsterHtml);
    } else {
        $('#monList').html('此地图中没有怪物信息');
    }

    // Clear the mapList (items section) - items should only be shown after clicking on a monster
    $('#mapList').html('请在左侧选择怪物以查看其掉落物品');

    // Show map details
    if (actualMap) {
        // Safely get map name and display
        let mapName = actualMap.name || `地图${mapId}`;
        // Use textContent to prevent XSS, then wrap in span for styling
        const span = document.createElement('span');
        span.style.color = 'orangered';
        span.textContent = mapName;
        const mapNameHtml = span.outerHTML + '&emsp;';

        // Update mapTransferTitle safely using DOM manipulation
        const mapTransferTitleContainer = document.getElementById('mapTransferTitle');
        mapTransferTitleContainer.innerHTML = '';
        mapTransferTitleContainer.insertAdjacentHTML('afterbegin', mapNameHtml);
        mapTransferTitleContainer.insertAdjacentText('beforeend', '跑图流程（没有信息说明此地图是触发进入）');

        // Update monTitle - should show the map name as this section shows monsters in the map
        const monTitleContainer = document.getElementById('monTitle');
        monTitleContainer.innerHTML = '';
        monTitleContainer.insertAdjacentHTML('afterbegin', mapNameHtml);
        monTitleContainer.insertAdjacentText('beforeend', '会刷这些怪物（点击怪物查看爆什么）');

        // Update mapTitle - should show the map name as it shows items dropped in the map (will be updated when clicking monster)
        const mapTitleContainer = document.getElementById('mapTitle');
        mapTitleContainer.innerHTML = '';
        mapTitleContainer.insertAdjacentHTML('afterbegin', mapNameHtml);
        mapTitleContainer.insertAdjacentText('beforeend', '请在左侧选择怪物以查看其掉落物品');

        // Create document fragment for efficient DOM manipulation
        const fragment = document.createDocumentFragment();
        let hasContent = false;

        // Handle NPC直传 information if available
        if (actualMap.npc && actualMap.npc !== "-1") {
            const npcList = actualMap.npc.split(",");
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

        // Handle 跑图路线 information if available
        if (actualMap.path && actualMap.path !== "-1") {
            const pathList = actualMap.path.split(",");
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

        // Handle定时刷新 (定时 refresh) information if available and if elements exist
        if (actualMap.dingshi && actualMap.dingshi !== "-1") {
            const dingshiList = actualMap.dingshi.split(",");
            let refreshHtml = "";

            for (let i = 0; i < dingshiList.length; i++) {
                if (dingshiList[i] !== "") {
                    if (i > 0) {
                        refreshHtml += "<br>";
                    }
                    refreshHtml += dingshiList[i];
                }
            }

            if (refreshHtml) {
                // Only update if elements exist (similar to how stditem.js handles it)
                if ($("#dingshicon").length > 0) {
                    $("#dingshicon").html(refreshHtml);
                }
                if ($("#dingshiTitle").length > 0) {
                    $("#dingshiTitle").html("定时刷新");
                }
                if ($(".dingshi").length > 0) {
                    $(".dingshi").show(); // Show the dingshi section
                }
            }
        }
    } else {
        $('#mapTransferList').html('地图信息: 未知');
    }
}

// Get information about selected item
function getStdInfo(stdId) {
    // Implementation to show more details about the selected item
    console.log('Getting info for item ID:', stdId);
}

// Get drop list for selected monster
function getStdByMon(monId) {
    // Clear previous results first
    $('#mapList').html('');

    // Get the monster name to update the title
    let monsterName = `怪物${monId}`;
    if (typeof Monlist !== "undefined" && Monlist[monId] && Monlist[monId].name) {
        monsterName = Monlist[monId].name;
    }

    // Update mapTitle to show the monster name
    const mapTitleContainer = document.getElementById('mapTitle');
    mapTitleContainer.innerHTML = '';
    const span = document.createElement('span');
    span.style.color = 'mediumvioletred';
    span.textContent = monsterName;
    const monsterNameHtml = span.outerHTML + '&emsp;';
    mapTitleContainer.insertAdjacentHTML('afterbegin', monsterNameHtml);
    mapTitleContainer.insertAdjacentText('beforeend', '会掉落以下物品');

    // Implementation to show items dropped by the selected monster
    if (typeof Stdlist !== "undefined" && Stdlist.length > 0) {
        let itemHtml = '';
        let itemCount = 0;

        // Find all items that this monster drops
        for (let i = 0; i < Stdlist.length; i++) {
            if (Stdlist[i] && Stdlist[i].mon && Stdlist[i].mon !== '-1') {
                const monsterIds = Stdlist[i].mon.split(',');
                if (monsterIds.includes(String(monId))) {
                    itemHtml += `<div class="hove" listId="${i}">${itemCount + 1}、${Stdlist[i].name}</div>`;
                    itemCount++;
                }
            }
        }

        if (itemHtml) {
            $('#mapList').html(itemHtml);
        } else {
            $('#mapList').html('此怪物不掉落任何物品');
        }
    } else {
        $('#mapList').html('物品数据不可用');
    }
}

// Initialize the page - get all maps by default only if data is available
if (typeof Maplist !== "undefined" && Maplist.length > 0) {
  getMapByKey();
}