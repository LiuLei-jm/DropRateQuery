/*
 * Game Drop Rate Query System - npc.js Deobfuscated Version
 * Handles NPC search functionality
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
  if (typeof input !== "string") {
    return "";
  }
  return input.replace(/[<>'\"&]/g, function (match) {
    switch (match) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&#x27;";
    }
  });
}

function isValidGameData(data) {
  return (
    data &&
    Array.isArray(data.Stdlist) &&
    Array.isArray(data.Monlist) &&
    Array.isArray(data.Maplist) &&
    Array.isArray(data.Npclist) &&
    // Additional validation for data structure
    data.Stdlist.every(
      (item) =>
        item &&
        typeof item.name === "string" &&
        typeof item.mon === "string" &&
        typeof item.npc === "string"
    ) &&
    data.Monlist.every(
      (mon) =>
        mon && typeof mon.name === "string" && typeof mon.map === "string"
    ) &&
    data.Maplist.every((map) => map && typeof map.name === "string") &&
    data.Npclist.every((npc) => npc && typeof npc.name === "string")
  );
}

function isValidVersion(version) {
  if (typeof version !== "string" || version.length === 0) return false;
  // Check against the configured version list to ensure it's valid
  if (typeof window.version_list !== "undefined") {
    return window.version_list.some((v) => v.data === version);
  }
  return /^[A-Za-z0-9_]+$/.test(version); // Basic regex validation
}

function sanitizedName(name) {
  // Ensure the name consists only of allowed characters for security
  return name.replace(/[^A-Za-z0-9_]/g, "");
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
    if (
      haystack.charAt(haystackIndex).toLowerCase() ===
      needle.charAt(needleIndex).toLowerCase()
    ) {
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
    console.error("Error parsing data:", e);
    throw new Error("Failed to parse game data: " + e.message);
  }
}

function safelyGetPropertyName(obj, prop, defaultValue = "") {
  try {
    if (obj && typeof obj === "object" && obj !== null && prop in obj) {
      const value = obj[prop];
      // Handle null, undefined, and other non-string/number values safely
      if (value === null || value === undefined) {
        return defaultValue;
      }
      if (typeof value === "string" || typeof value === "number") {
        return value.toString();
      }
      // For other types, convert to string safely
      return String(value);
    }
    return defaultValue;
  } catch (error) {
    console.warn("Error accessing property", prop, error);
    return defaultValue;
  }
}

// Initialize indexed data for faster lookups
function initializeIndex() {
  if (typeof Npclist !== "undefined" && Array.isArray(Npclist)) {
    indexedData = {
      byName: new Map(),
    };

    for (let i = 0; i < Npclist.length; i++) {
      const npc = Npclist[i];
      if (npc && npc.name) {
        const lowerName = npc.name.toLowerCase();

        // Index by name
        if (!indexedData.byName.has(lowerName)) {
          indexedData.byName.set(lowerName, []);
        }
        indexedData.byName.get(lowerName).push(i);
      }
    }
  }
}

// Initialize NPC search functionality
$(function () {
  // Set up search button click handler
  $("#search").click(function () {
    // Clear previous results
    $("#monList, #mapList, #mapTransferList, #equList").html("");
    // Search for NPCs by keyword
    getNpcByKey();
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
    getNpcByKey();
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
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `网络响应不正常: ${response.status} ${response.statusText}`
          );
        }
        return response.text();
      })
      .then((text) => {
        if (!text || text.trim().length === 0) {
          throw new Error("返回的数据为空");
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

            // Set DataName in a safe way to avoid XSS
            if (typeof data.DataName === "string") {
              window.DataName = data.DataName;
            } else {
              window.DataName = "";
            }

            initializeIndex(); // Initialize index for faster searches
            getNpcByKey();
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
          throw new Error("数据格式验证失败");
        }
      })
      .catch((error) => {
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

// Search for NPCs based on keyword
function getNpcByKey() {
  // Check if Npclist exists and has data
  if (
    typeof Npclist === "undefined" ||
    !Array.isArray(Npclist) ||
    Npclist.length === 0
  ) {
    $("#equList").html("没有可用的NPC数据，请检查版本选择");
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
    cacheKey = `npc_fuzzy_${keyword}_${Npclist.length}`;
    if (searchCache.has(cacheKey)) {
      const cachedResult = searchCache.get(cacheKey);
      const container = document.getElementById("equList");
      if (container) {
        container.innerHTML = "";
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
              const npc = Npclist[i];
              if (npc) {
                // Create element for the NPC entry with sanitized content
                const npcDiv = document.createElement("div");
                npcDiv.className = "hove";
                npcDiv.setAttribute("listId", i);
                npcDiv.setAttribute("npcId", npc.id || i);
                // Capture the npcId using closure to ensure correct value even after list updates
                npcDiv.onclick = (function (npcId) {
                  return function () {
                    getByNpc(npcId);
                  };
                })(i);
                npcDiv.textContent = `${i + 1}、${npc.name}`;
                fragment.appendChild(npcDiv);
              }
            } catch (error) {
              console.warn(`Error processing NPC at index ${i}:`, error);
              continue; // Skip this NPC and continue with the next
            }
          }
        }
      }
    } else {
      // Fallback to original search if index is not available
      for (let i = 0; i < Npclist.length; i++) {
        try {
          const npc = Npclist[i];
          // Check if npc and name exist and npc name contains the keyword using fuzzy search
          if (npc && npc.name && typeof npc.name === "string") {
            // Use fuzzy search with case-insensitive matching for both English and Chinese
            const npcNameLower = npc.name.toLowerCase();
            if (matchesFuzzily(npcNameLower, keyword)) {
              // Create element for the NPC entry with sanitized content
              const npcDiv = document.createElement("div");
              npcDiv.className = "hove";
              npcDiv.setAttribute("listId", i);
              npcDiv.setAttribute("npcId", npc.id || i);
              // Capture the npcId using closure to ensure correct value even after list updates
              npcDiv.onclick = (function (npcId) {
                return function () {
                  getByNpc(npcId);
                };
              })(i);
              npcDiv.textContent = `${i + 1}、${npc.name}`;
              fragment.appendChild(npcDiv);
            }
          }
        } catch (error) {
          console.warn(`Error processing NPC at index ${i}:`, error);
          continue; // Skip this NPC and continue with the next
        }
      }
    }
  } else {
    // Show all NPCs if no keyword provided
    for (let i = 0; i < Npclist.length; i++) {
      try {
        const npc = Npclist[i];
        if (npc) {
          const npcDiv = document.createElement("div");
          npcDiv.className = "hove";
          npcDiv.setAttribute("listId", i);
          npcDiv.setAttribute("npcId", npc.id || i);
          // Use direct event binding with closure to ensure proper npcId capture
          (function (index) {
            npcDiv.onclick = function () {
              getByNpc(index);
            };
          })(i);
          npcDiv.textContent = `${i + 1}、${npc.name}`;
          fragment.appendChild(npcDiv);
        }
      } catch (error) {
        console.warn(`Error processing NPC at index ${i}:`, error);
        continue; // Skip this NPC and continue with the next
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
  const container = document.getElementById("equList");
  if (container) {
    container.innerHTML = "";
    container.appendChild(fragment);
  } else {
    console.error("Container element 'equList' not found");
  }
}

// Get details for the selected NPC
function getByNpc(npcId) {
  // Clear previous results
  $(
    "#monList, #mapList, #mapTransferList, #mapTitle, #monTitle, #mapTransferTitle"
  ).html("");

  // Check if Npclist exists and the npcId is valid
  if (typeof Npclist === "undefined" || Npclist.length <= 0) {
    $("#monList").html("NPC数据不可用");
    return;
  }

  // Get the actual NPC from Npclist by index
  let actualNpc = Npclist[npcId];
  if (!actualNpc) {
    $("#monList").html("NPC数据不存在");
    return;
  }

  // Safely get NPC name and display
  let npcName = actualNpc.name || `NPC${npcId}`;
  // Use textContent to prevent XSS, then wrap in span for styling
  const span = document.createElement("span");
  span.style.color = "orangered";
  span.textContent = npcName;
  const npcNameHtml = span.outerHTML + "&emsp;";

  // Update titles with NPC name
  const monTitleContainer = document.getElementById("monTitle");
  monTitleContainer.innerHTML = "";
  monTitleContainer.insertAdjacentHTML("afterbegin", npcNameHtml);
  monTitleContainer.insertAdjacentText(
    "beforeend",
    "NPC消耗物品（没有的话可能是传送NPC）"
  );

  const mapTitleContainer = document.getElementById("mapTitle");
  mapTitleContainer.innerHTML = "";
  mapTitleContainer.insertAdjacentHTML("afterbegin", npcNameHtml);
  mapTitleContainer.insertAdjacentText(
    "beforeend",
    "NPC给与的物品（有可能也是封号）"
  );

  const mapTransferTitleContainer = document.getElementById("mapTransferTitle");
  mapTransferTitleContainer.innerHTML = "";
  mapTransferTitleContainer.insertAdjacentHTML("afterbegin", npcNameHtml);
  mapTransferTitleContainer.insertAdjacentText(
    "beforeend",
    "其他信息（详细信息）"
  );

  // Show items taken by this NPC from Npclist's 'take' field
  let takeHtml = "";
  let takeCount = 0;

  if (actualNpc.take && actualNpc.take !== "-1") {
    const takeItems = actualNpc.take.split(",");
    for (let i = 0; i < takeItems.length; i++) {
      if (takeItems[i] !== "") {
        // If it's an ID, try to get the item name from Stdlist
        const itemId = parseInt(takeItems[i], 10);
        let itemName = takeItems[i]; // Default to the ID itself

        if (
          !isNaN(itemId) &&
          typeof Stdlist !== "undefined" &&
          Stdlist[itemId] &&
          Stdlist[itemId].name
        ) {
          itemName = Stdlist[itemId].name;
        }

        takeHtml += `
                    <div class="hove" listid="${takeCount}">${
          takeCount + 1
        }、${itemName}</div>
                `;
        takeCount++;
      }
    }
  }

  if (takeHtml) {
    $("#monList").html(takeHtml);
  } else {
    $("#monList").html("此NPC没有收取物品信息");
  }

  // Show items given by this NPC from Npclist's 'give' field
  let giveHtml = "";
  let giveCount = 0;

  if (actualNpc.give && actualNpc.give !== "-1") {
    const giveItems = actualNpc.give.split(",");
    for (let i = 0; i < giveItems.length; i++) {
      if (giveItems[i] !== "") {
        // If it's an ID, try to get the item name from Stdlist
        const itemId = parseInt(giveItems[i], 10);
        let itemName = giveItems[i]; // Default to the ID itself

        if (
          !isNaN(itemId) &&
          typeof Stdlist !== "undefined" &&
          Stdlist[itemId] &&
          Stdlist[itemId].name
        ) {
          itemName = Stdlist[itemId].name;
        }

        giveHtml += `
                    <div class="hove" listid="${giveCount}">${
          giveCount + 1
        }、${itemName}</div>
                `;
        giveCount++;
      }
    }
  }

  if (giveHtml) {
    $("#mapList").html(giveHtml);
  } else {
    $("#mapList").html("此NPC没有给予物品信息");
  }

  // Create document fragment for efficient DOM manipulation for map transfer details
  const fragment = document.createDocumentFragment();
  let hasContent = false;

  // Show detailed NPC information: Map information
  if (actualNpc.mname && actualNpc.mname !== "-1") {
    // Create fieldset element for map info
    const fieldset = document.createElement("fieldset");
    fieldset.className = "layui-elem-field";

    const legend = document.createElement("legend");
    legend.textContent = "NPC信息";
    fieldset.appendChild(legend);

    const div = document.createElement("div");
    div.className = "layui-field-box";

    let npcInfo = `所在地图：${actualNpc.mname}
      <br>
      所在坐标：${actualNpc.mxy}
    `;

    div.innerHTML = npcInfo;
    fieldset.appendChild(div);

    if (hasContent) {
      const br = document.createElement("br");
      fragment.appendChild(br);
    }
    fragment.appendChild(fieldset);
    hasContent = true;
  }

  // Show move information (可传地图)
  if (actualNpc.move && actualNpc.move !== "-1") {
    const moveList = actualNpc.move.split(",");
    if (moveList.length > 0) {
      // Create fieldset element for move info
      const fieldset = document.createElement("fieldset");
      fieldset.className = "layui-elem-field";

      const legend = document.createElement("legend");
      legend.textContent = "可传地图";
      fieldset.appendChild(legend);

      const div = document.createElement("div");
      div.className = "layui-field-box";
      var mapNameHtml = "";
      for (let i = 0; i < moveList.length; i++) {
        if (moveList[i] !== "") {
          // If it's an ID, try to get the map name from Maplist
          const mapId = parseInt(moveList[i], 10);
          let mapName = moveList[i]; // Default to the ID itself

          if (
            !isNaN(mapId) &&
            typeof Maplist !== "undefined" &&
            Maplist[mapId] &&
            Maplist[mapId].name
          ) {
            mapName = Maplist[mapId].name;
          }
          if(mapNameHtml !== "")
            mapNameHtml += '<br>';
          mapNameHtml += mapName;
        }
      }
      
      div.innerHTML = mapNameHtml;

      fieldset.appendChild(div);

      if (hasContent) {
        const br = document.createElement("br");
        fragment.appendChild(br);
      }
      fragment.appendChild(fieldset);
      hasContent = true;
    }
  }

  if (!hasContent) {
    const div = document.createElement("div");
    div.textContent = "NPC详细信息: 未知";
    fragment.appendChild(div);
  }

  const container = document.getElementById("mapTransferList");
  container.appendChild(fragment);
}

// Get path information for the selected map (similar to other js files)
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
    const span = document.createElement("span");
    span.style.color = "orangered";
    span.textContent = map;
    mapName = span.outerHTML + "&emsp;";
  }

  // Update mapTransferTitle safely using DOM manipulation
  const mapTransferTitleContainer = document.getElementById("mapTransferTitle");
  mapTransferTitleContainer.innerHTML = "";
  mapTransferTitleContainer.insertAdjacentHTML("afterbegin", mapName);
  mapTransferTitleContainer.insertAdjacentText(
    "beforeend",
    "跑图流程（没有信息说明此地图是触发进入）"
  );

  // Create document fragment for efficient DOM manipulation
  const fragment = document.createDocumentFragment();
  let hasContent = false;

  if (
    typeof Maplist !== "undefined" &&
    Maplist[mapId] &&
    Maplist[mapId].npc &&
    Maplist[mapId].npc !== "-1"
  ) {
    const npcList = Maplist[mapId].npc.split(",");
    for (let i = 0; i < npcList.length; i++) {
      if (npcList[i] !== "") {
        const npcId = parseInt(npcList[i], 10);
        if (!isNaN(npcId) && typeof Npclist !== "undefined" && Npclist[npcId]) {
          const npcName = Npclist[npcId].name || `NPC${npcId}`;
          const mapName = Npclist[npcId].mname || "";
          const mapPoint = Npclist[npcId].mxy || "";

          // Create fieldset element for NPC info
          const fieldset = document.createElement("fieldset");
          fieldset.className = "layui-elem-field";

          const legend = document.createElement("legend");
          legend.textContent = "NPC直传";
          fieldset.appendChild(legend);

          const div = document.createElement("div");
          div.className = "layui-field-box";
          div.textContent = `${npcName}【${mapName}(${mapPoint})】`;
          fieldset.appendChild(div);

          if (hasContent) {
            const br = document.createElement("br");
            fragment.appendChild(br);
          }
          fragment.appendChild(fieldset);
          hasContent = true;
        }
      }
    }
  }
  if (
    typeof Maplist !== "undefined" &&
    Maplist[mapId] &&
    Maplist[mapId].path &&
    Maplist[mapId].path !== "-1"
  ) {
    const pathList = Maplist[mapId].path.split(",");
    for (let i = 0; i < pathList.length; i++) {
      if (pathList[i] !== "") {
        if (hasContent) {
          const br = document.createElement("br");
          fragment.appendChild(br);
        }

        // Create fieldset element for path info
        const fieldset = document.createElement("fieldset");
        fieldset.className = "layui-elem-field";

        const legend = document.createElement("legend");
        legend.textContent = "跑图路线";
        fieldset.appendChild(legend);

        const div = document.createElement("div");
        div.className = "layui-field-box";
        div.textContent = pathList[i];
        fieldset.appendChild(div);

        fragment.appendChild(fieldset);
        hasContent = true;
      }
    }
  }

  const container = document.getElementById("mapTransferList");
  container.appendChild(fragment);
}

// Initialize the page - get all NPCs by default only if data is available
if (typeof Npclist !== "undefined" && Npclist.length > 0) {
  getNpcByKey();
}
