/*
 * Game Drop Rate Query System - mon.js Deobfuscated Version
 * Handles monster search functionality
 */

// Initialize monster search functionality
$(function () {
  // Set up search button click handler
  $("#search").click(function () {
    // Clear previous results
    $("#monList, #mapList, #mapTransferList, #equList").html("");
    // Search for monsters by keyword
    getMonByKey();
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
    getMonByKey();
  }
});

// Function to load game data based on selected version
function loadGameData() {
  // Get the selected version from cookie or default to first
  var selectedVersion = $.cookie("version_data");

  if (selectedVersion) {
    // Dynamically load the data file for the selected version
    $.getScript("../data/" + selectedVersion + ".js", function () {
      console.log("Data loaded for version: " + selectedVersion);
      // Initialize after data is loaded
      getMonByKey();
    }).fail(function () {
      console.error("Failed to load data for version: " + selectedVersion);
      alert("无法加载数据，请检查版本选择");
    });
  } else {
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
  if (typeof Stdlist === "undefined" || Stdlist.length === 0) {
    $("#equList").html("没有可用的数据，请检查版本选择");
    return;
  }

  // Create monster list if it doesn't exist
  if (typeof Monlist === "undefined" || Monlist.length === 0) {
    Monlist = createMonsterListFromStdlist();
  }

  // Get the search keyword from input field
  var keyword = $("#key").val().toLowerCase();

  if (keyword !== "") {
    // Search through monster list data to find matching monsters
    for (let i = 0; i < Monlist.length; i++) {
      // Check if monster name contains the keyword
      if (Monlist[i].name.toLowerCase().indexOf(keyword) !== -1) {
        // Create HTML for the monster entry
        let monsterHtml =
          '<div class="hove" listId="' +
          i +
          '" onclick="getStdByMon(' +
          i +
          ')">' +
          (i + 1) +
          "、" +
          Monlist[i].name +
          "</div>";
        $("#equList").append(monsterHtml);
      }
    }
  } else {
    // Show all monsters if no keyword provided
    for (let i = 0; i < Monlist.length; i++) {
      let monsterHtml =
        '<div class="hove" listId="' +
        i +
        '" onclick="getStdByMon(' +
        i +
        ')">' +
        (i + 1) +
        "、" +
        Monlist[i].name +
        "</div>";
      $("#equList").append(monsterHtml);
    }
  }
}

// Get items dropped by the selected monster
function getStdByMon(monId) {
  // Clear previous results
  $("#monList, #mapList, #mapTransferList, #mapTitle, #monTitle").html("");

  // Check if Stdlist exists and the monId is valid
  if (typeof Stdlist === "undefined" || Stdlist.length <= 0) {
    $("#monList").html("物品数据不可用");
    return;
  }

  let itemHtml = "";
  if (Monlist[monId].std !== "-1") {
    const itemsByMon = Monlist[monId].std.split(",");
    for (let i = 0; i < itemsByMon.length; i++) {
      const itemName = Stdlist[itemsByMon[i]].name;
      itemHtml += `
            <div name="${itemName}" listid="${i}">${i + 1}、${itemName}</div>
        `;
    }
  }

  if (itemHtml) {
    $("#monList").html(itemHtml);
  } else {
    $("#monList").html("该怪物不掉落任何物品");
  }

  // Get map for the selected monster
  if (typeof Monlist !== "undefined" && Monlist[monId]) {
    // Get the monster name using our function which tries to get it from monlist first
    const monsterName = getMonsterName(Monlist[monId].id);
    let mapHtml = "怪物名称: " + monsterName + "<br>地图信息: 未知";
    $("#mapList").html(mapHtml);
  }

  // Set titles
  $("#monTitle").html("这个怪物爆点啥");
  $("#mapTitle").html("所在地图名称（没有地图说明这个怪物不刷出）");
  $("#mapTransferTitle").html("跑图流程（没有信息说明此地图是触发进入）");
}

// Get map information for selected item
function getMapByStd(stdId) {
  // This function would handle showing maps related to items
  // Implementation details depend on data structure
}

// Get map list for selected map
function getMapList(mapId) {
  // Clear previous results
  $("#mapTransferList").html("");

  if (typeof maplist !== "undefined" && maplist[mapId]) {
    const mapInfo =
      maplist[mapId].name +
      (maplist[mapId].dingshi ? "<br>定时刷新:" + maplist[mapId].dingshi : "");
    if (maplist[mapId].transfer) {
      $("#mapTransferList").html(
        mapInfo + "<br>跑图流程:" + maplist[mapId].transfer
      );
    } else {
      $("#mapTransferList").html(mapInfo);
    }
  } else {
    $("#mapTransferList").html("此功能暂未实现");
  }
}

// Initialize the page - get all monsters by default only if data is available
if (typeof Stdlist !== "undefined" && Stdlist.length > 0) {
  getMonByKey();
}
