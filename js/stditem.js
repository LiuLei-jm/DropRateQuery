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
$(function() {
    // Set up search button click handler
    $('#search').click(function() {
        // Clear previous results
        $('#monList, #mapList, #mapTransferList, #equList').html('');
        // Search for items by keyword
        getEquByKey();
    });

    // Check URL for version parameter first
    var searchParams = new URLSearchParams(window.location.search);
    var versionParam = searchParams.get('v');

    if (versionParam) {
        // Set the version in cookies if provided in URL
        if (typeof version_list !== 'undefined') {
            for (let i = 0; i < version_list.length; i++) {
                if (version_list[i].data === versionParam) {
                    $.cookie('version_name', version_list[i].name);
                    $.cookie('version_data', version_list[i].data);
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
        getEquByKey();
    }
});

// Function to load game data based on selected version
function loadGameData() {
    // Get the selected version from cookie or default to first
    var selectedVersion = $.cookie('version_data');

    if (selectedVersion) {
        // Dynamically load the data file for the selected version
        $.getScript('../data/' + selectedVersion + '.js', function() {
            console.log('Data loaded for version: ' + selectedVersion);
            // Initialize after data is loaded
            getEquByKey();
        }).fail(function() {
            console.error('Failed to load data for version: ' + selectedVersion);
            alert('无法加载数据，请检查版本选择');
        });
    } else {
        alert('请先选择游戏版本');
        window.location.href = '../index.html';
    }
}

// Search for equipment/items based on keyword
function getEquByKey() {
    // Check if Stdlist exists and has data
    if (typeof Stdlist === 'undefined' || Stdlist.length === 0) {
        $('#equList').html('没有可用的数据，请检查版本选择');
        return;
    }

    // Get the search keyword from input field
    var keyword = $('#key').val().toLowerCase();

    if (keyword !== '') {
        // Search through Stdlist data to find matching items
        for (let i = 0; i < Stdlist.length; i++) {
            // Check if item name contains the keyword
            if (Stdlist[i].name.toLowerCase().indexOf(keyword) !== -1) {
                // Check if the item has related monsters or NPCs
                if (Stdlist[i].mon !== '-1' || Stdlist[i].npc !== '-1') {
                    // Create HTML for the item entry
                    let itemHtml = '<div class="hove" listId="' + i + '" monId="' + Stdlist[i].mon + '"  onclick="getMonByWp('+i+')">' +
                                  (i+1) + '、' + Stdlist[i].name + '</div>';
                    $('#equList').append(itemHtml);
                }
            }
        }
    } else {
        // Show all items if no keyword provided
        for (let i = 0; i < Stdlist.length; i++) {
            if (Stdlist[i].mon !== '-1' || Stdlist[i].npc !== '-1') {
                let itemHtml = '<div class="hove" listId="' + i + '" monId="' + Stdlist[i].mon + '"  onclick="getMonByWp('+i+')">' +
                              (i+1) + '、' + Stdlist[i].name + '</div>';
                $('#equList').append(itemHtml);
            }
        }
    }
}

// Get monster name by ID, trying to use monlist first if available
function getMonsterName(monId) {
    // First, check if there's a global monlist with actual monster names
    if (typeof Monlist !== 'undefined' && Monlist && Monlist.length > 0) {
        // Search for the monster in the monlist array
        for (let i = 0; i < Monlist.length; i++) {
            // Convert both to strings for comparison to handle type mismatches
            if (String(i) === monId) {
                return Monlist[i].name || ('怪物' + monId);
            }
        }
    }

    // If not found in monlist, return a default name
    return '怪物' + monId;
}

// Get NPC name by ID, trying to use npclist first if available
function getNpcName(npcId) {
    // First, check if there's a global npclist with actual NPC names
    if (typeof Npclist !== 'undefined' && Npclist && Npclist.length > 0) {
        // Search for the NPC in the npclist array
        for (let i = 0; i < Npclist.length; i++) {
            // Convert both to strings for comparison to handle type mismatches
            if (String(i) === String(npcId)) {
                return Npclist[i].name || ('NPC' + npcId);
            }
        }
    }

    // If not found in npclist, return a default name
    return 'NPC' + npcId;
}

function getNpcMap(npcId){
    if(typeof Npclist !== 'undefined' && Npclist && Npclist.length > 0){
        for(let i = 0; i < Npclist.length; i++){
            if(String(i) === String(npcId)){
                return Npclist[i].mname || ('MAP' + npcId);
            }
        }
    }
    return 'MAP' + npcId;
}

function getNpcMapPoint(npcId){
    if(typeof Npclist !== 'undefined' && Npclist && Npclist.length > 0){
        for(let i = 0; i < Npclist.length; i++){
            if(String(i) === String(npcId)){
                return Npclist[i].mxy || ('POINT' + npcId);
            }
        }
    }   
    return 'POINT' + npcId;
}

// Get monsters that drop the selected item
function getMonByWp(itemId) {
    // Clear previous results
    $('#monList, #mapList, #mapTransferList, #mapTitle, #monTitle, #npccon').html('');
    $('.npclink').hide();

    // Check if Stdlist exists and the itemId is valid
    if (typeof Stdlist === 'undefined' || Stdlist.length <= itemId) {
        $('#monList').html('物品数据不可用');
        return;
    }

    // 安全地获取物品名称并显示
    let itemName = '';
    if (typeof Stdlist !== 'undefined' && Stdlist.length > itemId && Stdlist[itemId] && Stdlist[itemId].name) {
       let item = Stdlist[itemId].name;
        itemName = '<span style="color: orangered">'+ item + '</span>&emsp;'
    }

    // 移除之前的物品标题（如果存在）
    $('#selectedItemTitle').remove();

    // 修改 #monTitle 内容以与物品名称保持一致
    $('#monTitle').html(itemName + ' 可以在这些怪物或NPC获取（点击怪物查看地图）');

    // Check if the selected item's monster list is not '-1' (meaning it drops from monsters)
    if (Stdlist[itemId].mon !== '-1') {
        // Get the monster IDs that drop this item
        const monsterIds = Stdlist[itemId].mon.split(',');
        let monsterHtml = '';

        for (let i = 0; i < monsterIds.length; i++) {
            if (monsterIds[i] !== '') {
                // Get the monster name using our function which tries to get it from monlist first
                const monsterName = getMonsterName(monsterIds[i]);
                // Create monster entry that allows viewing maps when clicked
                monsterHtml += '<div class="hove" listId="' + i + '" monId="' + monsterIds[i] + '" onclick="getMapByMon(' + monsterIds[i] + ')">' +
                              (i+1) + '、' + monsterName + '</div>';
            }
        }
        $('#monList').html(monsterHtml);
    } else {
        $('#monList').html('该物品不从怪物掉落');
    }

    // Handle NPC data if available
    if (Stdlist[itemId].npc !== '-1') {
        // Show NPC section
        $('.npclink').show();
        const npcIds = Stdlist[itemId].npc.split(',');
        let npcHtml = '';

        for (let i = 0; i < npcIds.length; i++) {
            if (npcIds[i] !== '') {
                // Get the NPC name using our function which tries to get it from npclist first
                const npcName = getNpcName(npcIds[i]);
                const npcMap = getNpcMap(npcIds[i]);
                const npcMapPoint = getNpcMapPoint(npcIds[i]);
                // Create NPC entry that allows viewing maps when clicked
                npcHtml += '<div class="hove" listId="' + i + '" npcId="' + npcIds[i]  + '" onclick="getMapByNpc(' + npcIds[i] + ')">' +
                          (i+1) + '、' + npcName + '【'+ npcMap + '(' + npcMapPoint + ')' + '】'+ '</div>';
            }
        }
        $('#npccon').html(npcHtml);
    } else {
        // Hide NPC section if no NPC data
        $('.npclink').hide();
    }

    // Set titles
    $('#mapTitle').html('所在地图名称（没有地图说明这个怪物不刷出）');
    $('#mapTransferTitle').html('跑图流程（没有信息说明此地图是触发进入）');
}

// Create monster-to-item mapping for better navigation
function createMonsterToItemMap() {
    if (typeof Stdlist === 'undefined' || Stdlist.length === 0) {
        return {};
    }

    let monsterToItemMap = {};

    for (let i = 0; i < Stdlist.length; i++) {
        // Process monsters that drop this item
        if (Stdlist[i].mon !== '-1') {
            const monsterIds = Stdlist[i].mon.split(',');
            for (let j = 0; j < monsterIds.length; j++) {
                const monId = monsterIds[j];
                if (monId !== '') {
                    if (!monsterToItemMap[monId]) {
                        monsterToItemMap[monId] = [];
                    }
                    monsterToItemMap[monId].push({
                        itemId: i,
                        itemName: Stdlist[i].name,
                        type: Stdlist[i].type
                    });
                }
            }
        }
    }

    return monsterToItemMap;
}

// Get maps for the selected monster
function getMapByMon(monId) {
    // Clear previous results
    $('#mapList, #mapTransferList').html('');

    if (typeof Stdlist !== 'undefined' && Stdlist.length > 0) {
        // Get the monster name using our function which tries to get it from monlist first
        const monsterName = getMonsterName(monId);

        // Create the monster-to-item mapping
        const monsterToItemMap = createMonsterToItemMap();

        let mapHtml = '';
        let routeHtml = '';

        if (monsterToItemMap[monId] && monsterToItemMap[monId].length > 0) {
            // Show items dropped by this monster
            for (let i = 0; i < monsterToItemMap[monId].length; i++) {
                const item = monsterToItemMap[monId][i];
                mapHtml += '<div class="hove" onclick="getMonByWp(' + item.itemId + ')">' +
                          (i + 1) + '、物品: ' + item.itemName + '</div>';
            }

            routeHtml = '怪物名称: ' + monsterName + '<br>此怪物可掉落 ' + monsterToItemMap[monId].length + ' 种物品';
        } else {
            mapHtml = '<div>该怪物暂时没有物品掉落记录</div>';
            routeHtml = '怪物名称: ' + monsterName + '<br>暂时没有相关掉落信息';
        }

        $('#mapList').html(mapHtml);
        $('#mapTransferList').html(routeHtml);
    } else {
        $('#mapList').html('地图信息: 无法获取 - 数据未加载');
        $('#mapTransferList').html('跑图流程: 无法获取 - 数据未加载');
    }
}

// Get map list for selected map
function getMapList(mapId) {
    // Clear previous results
    $('#mapTransferList').html('');

    $('#mapTransferList').html('此功能暂未实现');
}

// Create NPC-to-item mapping for better navigation
function createNpcToItemMap() {
    if (typeof Stdlist === 'undefined' || Stdlist.length === 0) {
        return {};
    }

    let npcToItemMap = {};

    for (let i = 0; i < Stdlist.length; i++) {
        // Process NPCs related to this item
        if (Stdlist[i].npc !== '-1') {
            const npcIds = Stdlist[i].npc.split(',');
            for (let j = 0; j < npcIds.length; j++) {
                const npcId = npcIds[j];
                if (npcId !== '') {
                    if (!npcToItemMap[npcId]) {
                        npcToItemMap[npcId] = [];
                    }
                    npcToItemMap[npcId].push({
                        itemId: i,
                        itemName: Stdlist[i].name,
                        type: Stdlist[i].type
                    });
                }
            }
        }
    }

    return npcToItemMap;
}

// Get maps for selected NPC
function getMapByNpc(npcId) {
    $('#mapList, #mapTransferList').html('');

    if (typeof Stdlist !== 'undefined' && Stdlist.length > 0) {
        // Get the NPC name using our function which tries to get it from npclist first
        const npcName = getNpcName(npcId);

        // Create the NPC-to-item mapping
        const npcToItemMap = createNpcToItemMap();

        let mapHtml = '';
        let routeHtml = '';

        if (npcToItemMap[npcId] && npcToItemMap[npcId].length > 0) {
            // Show items related to this NPC
            for (let i = 0; i < npcToItemMap[npcId].length; i++) {
                const item = npcToItemMap[npcId][i];
                mapHtml += '<div class="hove" onclick="getMonByWp(' + item.itemId + ')">' +
                          (i + 1) + '、物品: ' + item.itemName + '</div>';
            }

            routeHtml = 'NPC名称: ' + npcName +'【' + '】' + '<br>此NPC可提供或需要 ' + npcToItemMap[npcId].length + ' 种物品';
        } else {
            mapHtml = '<div>该NPC暂时没有物品关联记录</div>';
            routeHtml = 'NPC名称: ' + npcName+'【' + '】' + '<br>暂时没有相关物品信息';
        }

        $('#mapList').html(mapHtml);
        $('#mapTransferList').html(routeHtml);
    } else {
        $('#mapList').html('地图信息: 无法获取 - 数据未加载');
        $('#mapTransferList').html('NPC位置信息: 无法获取 - 数据未加载');
    }
}


// Initialize the page - get all items by default only if data is available
if (typeof Stdlist !== 'undefined' && Stdlist.length > 0) {
    getEquByKey();
}