/*
 * Game Drop Rate Query System - map.js Deobfuscated Version
 * Handles map search functionality
 */

// Initialize map search functionality
$(function() {
    // Set up search button click handler
    $('#search').click(function() {
        // Clear previous results
        $('#monList, #mapList, #mapTransferList, #equList').html('');
        // Search for maps by keyword
        getMapByKey();
    });

    // Load data if not already loaded
    if ((typeof maplist === 'undefined' || maplist.length === 0) && (typeof Stdlist !== 'undefined' && Stdlist.length > 0)) {
        // Create the missing data structures from Stdlist
        maplist = createMapListFromStdlist();
        getMapByKey();
    } else if (typeof Stdlist === 'undefined' || Stdlist.length === 0) {
        loadGameData();
    } else {
        // Data already loaded, initialize
        maplist = createMapListFromStdlist();
        getMapByKey();
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
            maplist = createMapListFromStdlist();
            getMapByKey();
        }).fail(function() {
            console.error('Failed to load data for version: ' + selectedVersion);
            alert('无法加载数据，请检查版本选择');
        });
    } else {
        alert('请先选择游戏版本');
        window.location.href = '../index.html';
    }
}

// Create map list from Stdlist data
function createMapListFromStdlist() {
    // Since we don't have explicit map data, we'll create a basic structure based on monster info
    // This is a simplified approach since we don't have complete map data
    return [{ id: 0, name: '未知地图', dingshi: '', transfer: '' }];
}

// Create monster list from Stdlist data
function createMonsterListFromStdlist() {
    if (typeof Stdlist !== 'undefined' && Stdlist.length > 0) {
        // Create a unique list of monsters from the Stdlist
        var monsterMap = {};

        for (let i = 0; i < Stdlist.length; i++) {
            if (Stdlist[i].mon !== '-1') {
                var monsterIds = Stdlist[i].mon.split(',');
                for (let j = 0; j < monsterIds.length; j++) {
                    var monId = monsterIds[j];
                    if (monId && !monsterMap[monId]) {
                        // For now, we'll just store the ID, ideally this would reference a proper monster data structure
                        monsterMap[monId] = { id: monId, name: '怪物' + monId, mapid: 0 };
                    }
                }
            }
        }

        // Convert to array format
        return Object.values(monsterMap);
    }
    return [];
}

// Search for maps based on keyword
function getMapByKey() {
    // Create map list if it doesn't exist
    if (typeof maplist === 'undefined' || maplist.length === 0) {
        if (typeof Stdlist !== 'undefined' && Stdlist.length > 0) {
            maplist = createMapListFromStdlist();
        } else {
            $('#equList').html('没有可用的地图数据');
            return;
        }
    }

    // Get the search keyword from input field
    var keyword = $('#key').val().toLowerCase();

    if (keyword !== '') {
        // Search through map list data to find matching maps
        for (let i = 0; i < maplist.length; i++) {
            // Check if map name contains the keyword
            if (maplist[i].name.toLowerCase().indexOf(keyword) !== -1) {
                // Create HTML for the map entry
                let mapHtml = '<div class="hove" listId="' + i + '" mapId="' + maplist[i].id + '" onclick="getMonByMap('+i+')">' +
                             (i+1) + '、' + maplist[i].name + '</div>';
                $('#equList').append(mapHtml);
            }
        }
    } else {
        // Show all maps if no keyword provided
        for (let i = 0; i < maplist.length; i++) {
            let mapHtml = '<div class="hove" listId="' + i + '" mapId="' + maplist[i].id + '" onclick="getMonByMap('+i+')">' +
                         (i+1) + '、' + maplist[i].name + '</div>';
            $('#equList').append(mapHtml);
        }
    }
}

// Get monsters in the selected map
function getMonByMap(mapId) {
    // Clear previous results
    $('#monList, #mapList, #mapTransferList, #mapTitle, #monTitle').html('');

    // Create monster list if it doesn't exist
    if (typeof monlist === 'undefined' || monlist.length === 0) {
        if (typeof Stdlist !== 'undefined' && Stdlist.length > 0) {
            monlist = createMonsterListFromStdlist();
        }
    }

    if (typeof monlist !== 'undefined' && monlist !== null) {
        let monsterHtml = '';

        // Find all monsters in this map (simplified since we don't have exact mapping)
        // Since we don't have explicit map information for monsters, we'll show a message
        $('#monList').html('此地图中的怪物信息: 未知');
    } else {
        $('#monList').html('此地图中的怪物信息: 未知');
    }

    // Show items dropped in this map (if available)
    if (typeof Stdlist !== 'undefined' && Stdlist !== null) {
        let itemHtml = '';

        // Since we don't have exact map-monster-item relationships, we'll use a simplified approach
        // For now, show all items if we have data
        for (let i = 0; i < Stdlist.length; i++) {
            if (Stdlist[i].mon !== '-1') {
                // Check if any of the monsters that drop this item are on this map
                // This is a simplified check since we don't have exact map information
                itemHtml += '<div class="hove" listId="' + i + '" onclick="getStdInfo('+i+')">' +
                          (itemHtml.split('<div class="hove"').length) + '、' + Stdlist[i].name + '</div>';
            }
        }
        $('#mapList').html(itemHtml);
    } else {
        $('#mapList').html('此地图的物品信息: 未知');
    }

    // Show map details
    if (typeof maplist !== 'undefined' && maplist[mapId]) {
        const mapInfo = maplist[mapId].name + (maplist[mapId].dingshi ? '<br>定时刷新:'+maplist[mapId].dingshi : '') +
                       (maplist[mapId].transfer ? '<br>跑图流程:' + maplist[mapId].transfer : '');
        $('#mapTransferList').html(mapInfo);
    } else {
        $('#mapTransferList').html('地图信息: 未知');
    }

    // Set titles
    $('#monTitle').html('怪物列表');
    $('#mapTitle').html('爆率列表');
    $('#mapTransferTitle').html('跑图流程（没有信息说明此地图是触发进入）');
}

// Get information about selected item
function getStdInfo(stdId) {
    // Implementation to show more details about the selected item
    console.log('Getting info for item ID:', stdId);
}

// Get drop list for selected monster
function getStdByMon(monId) {
    // Implementation to show items dropped by the selected monster
    if (typeof stdlist !== 'undefined' && stdlist !== null) {
        let itemHtml = '';

        // Find all items that this monster drops
        for (let i = 0; i < stdlist.length; i++) {
            if (stdlist[i].mon !== '-1') {
                const monsterIds = stdlist[i].mon.split(',');
                for (let j = 0; j < monsterIds.length; j++) {
                    if (monsterIds[j] == monlist[monId].id) {
                        itemHtml += '<div class="hove" listId="' + i + '" onclick="getStdInfo('+i+')">' +
                                   (itemHtml.split('<div class="hove"').length) + '、' + stdlist[i].name + '</div>';
                        break;
                    }
                }
            }
        }
        $('#monList').html(itemHtml);
    }
}

// Initialize the page - get all maps by default
getMapByKey();