/*
 * Game Drop Rate Query System - stditem.js Deobfuscated Version
 * Handles item/equipment search functionality
 *
 * Key features:
 * - Loads data dynamically based on selected version from cookies
 * - Supports URL parameter 'v' for direct version selection
 * - Includes defensive checks for missing data structures
 * - Provides fallback mechanisms when data is unavailable
 */

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
    getEquByKey();
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
      getEquByKey();
    }).fail(function () {
      console.error("Failed to load data for version: " + selectedVersion);
      alert("无法加载数据，请检查版本选择");
    });
  } else {
    alert("请先选择游戏版本");
    window.location.href = "../index.html";
  }
}

// Search for equipment/items based on keyword
function getEquByKey() {
  // Check if Stdlist exists and has data
  if (typeof Stdlist === "undefined" || Stdlist.length === 0) {
    $("#equList").html("没有可用的数据，请检查版本选择");
    return;
  }

  // Get the search keyword from input field
  var keyword = $("#key").val().toLowerCase();

  if (keyword !== "") {
    // Search through Stdlist data to find matching items
    for (let i = 0; i < Stdlist.length; i++) {
      // Check if item name contains the keyword
      if (Stdlist[i].name.toLowerCase().indexOf(keyword) !== -1) {
        // Check if the item has related monsters or NPCs
        if (Stdlist[i].mon !== "-1" || Stdlist[i].npc !== "-1") {
          // Create HTML for the item entry
          let itemHtml =
            '<div class="hove" listId="' +
            i +
            '" monId="' +
            Stdlist[i].mon +
            '"  onclick="getMonByWp(' +
            i +
            ')">' +
            (i + 1) +
            "、" +
            Stdlist[i].name +
            "</div>";
          $("#equList").append(itemHtml);
        }
      }
    }
  } else {
    // Show all items if no keyword provided
    for (let i = 0; i < Stdlist.length; i++) {
      if (Stdlist[i].mon !== "-1" || Stdlist[i].npc !== "-1") {
        let itemHtml =
          '<div class="hove" listId="' +
          i +
          '" monId="' +
          Stdlist[i].mon +
          '"  onclick="getMonByWp(' +
          i +
          ')">' +
          (i + 1) +
          "、" +
          Stdlist[i].name +
          "</div>";
        $("#equList").append(itemHtml);
      }
    }
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

  // 安全地获取物品名称并显示
  let itemName = "";
  if (
    typeof Stdlist !== "undefined" &&
    Stdlist.length > itemId &&
    Stdlist[itemId] &&
    Stdlist[itemId].name
  ) {
    let item = Stdlist[itemId].name;
    itemName = '<span style="color: orangered">' + item + "</span>&emsp;";
  }

  // 移除之前的物品标题（如果存在）
  $("#selectedItemTitle").remove();

  // 修改 #monTitle 内容以与物品名称保持一致
  $("#monTitle").html(
    itemName + " 可以在这些怪物或NPC获取（点击怪物查看地图）"
  );

  // Check if the selected item's monster list is not '-1' (meaning it drops from monsters)
  if (Stdlist[itemId].mon !== "-1") {
    // Get the monster IDs that drop this item
    const monsterIds = Stdlist[itemId].mon.split(",");
    let monsterHtml = "";

    for (let i = 0; i < monsterIds.length; i++) {
      if (monsterIds[i] !== "") {
        // Get the monster name using our function which tries to get it from monlist first
        const monsterName = Monlist[monsterIds[i]].name;
        const monsterMap = Monlist[monsterIds[i]].map;
        // Create monster entry that allows viewing maps when clicked
        monsterHtml +=
          '<div class="hove" listId="' +
          i +
          '" mapId="' +
          monsterMap +
          '" onclick="getMapByMon(' +
          monsterIds[i] +
          ')">' +
          (i + 1) +
          "、" +
          monsterName +
          "</div>";
      }
    }
    $("#monList").html(monsterHtml);
  } else {
    $("#monList").html("该物品不从怪物掉落");
  }

  // Handle NPC data if available
  if (Stdlist[itemId].npc !== "-1") {
    // Show NPC section
    $(".npclink").show();
    const npcIds = Stdlist[itemId].npc.split(",");
    let npcHtml = "";

    for (let i = 0; i < npcIds.length; i++) {
      if (npcIds[i] !== "") {
        // Get the NPC name using our function which tries to get it from npclist first
        const npcName = Npclist[npcIds[i]].name;
        const npcMap = Npclist[npcIds[i]].mname;
        const npcMapPoint = Npclist[npcIds[i]].mxy;
        // Create NPC entry that allows viewing maps when clicked
        npcHtml +=
          '<div class="hove" listId="' +
          i +
          '" npcId="' +
          npcIds[i] +
          '">' +
          (i + 1) +
          "、" +
          npcName +
          "【" +
          npcMap +
          "(" +
          npcMapPoint +
          ")" +
          "】" +
          "</div>";
      }
    }
    $("#npccon").html(npcHtml);
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
    monName = '<span style="color: mediumvioletred">' + mon + "</span>&emsp;";
  }

  $("#mapTitle").html(monName + "所在地图名称（没有地图说明这个怪物不刷出）");

  if (Monlist[monId].map !== "-1") {
    const mapIds = Monlist[monId].map.split(",");
    let mapHtml = "";

    for (let i = 0; i < mapIds.length; i++) {
      if (mapIds[i] !== "") {
        const mapName = Maplist[mapIds[i]].name;
        const mapPath = Maplist[mapIds[i]].path;
        mapHtml +=
          '<div class="hove" listId="' +
          i +
          '" path="' +
          mapPath +
          '" onclick="getPathByMap(' +
          mapIds[i] +
          ')">' +
          (i + 1) +
          "、" +
          mapName +
          "</div>";
      }
    }
    $("#mapList").html(mapHtml);
  } else {
    $("#mapList").html("没有地图刷新");
  }
    
  if(Monlist[monId].bot !== "-1"){
    const monRefrushs = Monlist[monId].bot.split(",");
    let dingshiHtml = "";
    for(let i = 0; i< monRefrushs.length; i++){
      if(monRefrushs[i] !== ""){
        if(dingshiHtml === ""){
          dingshiHtml = monRefrushs[i];
        }
        else{
          dingshiHtml += '<br>' + monRefrushs[i];
        }
      }
    }
    $("#dingshiTitle").html("定时刷新")
    $("#dingshicon").html(dingshiHtml);
    // 显示定时刷新卡片
    $(".layui-card.dingshi").show();
  } else {
    // 如果没有定时刷新信息，隐藏卡片
    $(".layui-card.dingshi").hide();
  }
}


function getPathByMap(mapId){
  $("#mapTransferList").html("");
  let mapTransferListHtml = "";

  // 安全地获取物品名称并显示
  let mapName = "";
  if (
    typeof Maplist !== "undefined" &&
    Maplist.length > mapId &&
    Maplist[mapId] &&
    Maplist[mapId].name
  ) {
    let map = Maplist[mapId].name;
    mapName = '<span style="color: orangered">' + map + "</span>&emsp;";
  }

  $("#mapTransferTitle").html(mapName + "跑图流程（没有信息说明此地图是触发进入）");

  if(Maplist[mapId].npc !== "-1"){
    const npcList = Maplist[mapId].npc.split(",");
    for(let i = 0; i < npcList.length; i++){
      const npcName = Npclist[npcList[i]].name;
      const mapName = Npclist[npcList[i]].mname;
      const mapPoint = Npclist[npcList[i]].mxy;
      const npcInfo = npcName + '【' + mapName + '(' + mapPoint +')' + '】';
      if(mapTransferListHtml !== "") mapTransferListHtml += '<br>';
      mapTransferListHtml += `
        <fieldset class="layui-elem-field">
          <legend>NPC直传</legend>
          <div class="layui-field-box">${npcInfo}</div>
        </fieldset>
      `;
    }
  }
  if(Maplist[mapId].path !== "-1"){
    const pathList = Maplist[mapId].path.split(",");
    for(let i = 0; i < pathList.length; i++){
      if(mapTransferListHtml !== "") mapTransferListHtml += '<br>';
      mapTransferListHtml += `
        <fieldset class="layui-elem-field">
          <legend>跑图路线</legend>
          <div class="layui-field-box">${pathList[i]}</div>
        </fieldset>
      `;
    }
  }
  $("#mapTransferList").html(mapTransferListHtml);
}

// Initialize the page - get all items by default only if data is available
if (typeof Stdlist !== "undefined" && Stdlist.length > 0) {
  getEquByKey();
}
