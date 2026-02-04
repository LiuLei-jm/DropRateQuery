/*
 * Game Drop Rate Query System - npc.js Deobfuscated Version
 * Handles NPC search functionality
 */

// Initialize NPC search functionality
$(function() {
    // Set up search button click handler
    $('#search').click(function() {
        // Clear previous results
        $('#monList, #mapList, #mapTransferList, #equList').html('');
        // Search for NPCs by keyword
        getNpcByKey();
    });

    // Load data if not already loaded
    if ((typeof Npclist === 'undefined' || Npclist.length === 0) && (typeof Stdlist !== 'undefined' && Stdlist.length > 0)) {
        // Create the missing data structures from Stdlist
        Npclist = createNpcListFromStdlist();
        getNpcByKey();
    } else if (typeof Stdlist === 'undefined' || Stdlist.length === 0) {
        loadGameData();
    } else {
        // Data already loaded, initialize
        Npclist = createNpcListFromStdlist();
        getNpcByKey();
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
            Npclist = createNpcListFromStdlist();
            getNpcByKey();
        }).fail(function() {
            console.error('Failed to load data for version: ' + selectedVersion);
            alert('无法加载数据，请检查版本选择');
        });
    } else {
        alert('请先选择游戏版本');
        window.location.href = '../index.html';
    }
}

// Create NPC list from Stdlist data
function createNpcListFromStdlist() {
    // Since we don't have explicit NPC data in this format, we'll create a basic structure
    // This is a simplified approach since we don't have complete NPC data
    return [{ id: 0, name: '未知NPC', mapid: 0, consumes: '', rewards: '' }];
}

// Search for NPCs based on keyword
function getNpcByKey() {
    // Create NPC list if it doesn't exist
    if (typeof Npclist === 'undefined' || Npclist.length === 0) {
        if (typeof Stdlist !== 'undefined' && Stdlist.length > 0) {
            Npclist = createNpcListFromStdlist();
        } else {
            $('#equList').html('没有可用的NPC数据');
            return;
        }
    }

    // Get the search keyword from input field
    var keyword = $('#key').val().toLowerCase();

    if (keyword !== '') {
        // Search through NPC list data to find matching NPCs
        for (let i = 0; i < Npclist.length; i++) {
            // Check if NPC name contains the keyword
            if (Npclist[i].name.toLowerCase().indexOf(keyword) !== -1) {
                // Create HTML for the NPC entry
                let npcHtml = '<div class="hove" listId="' + i + '" npcId="' + Npclist[i].id + '" onclick="getByNpc('+i+')">' +
                             (i+1) + '、' + Npclist[i].name + '</div>';
                $('#equList').append(npcHtml);
            }
        }
    } else {
        // Show all NPCs if no keyword provided
        for (let i = 0; i < Npclist.length; i++) {
            let npcHtml = '<div class="hove" listId="' + i + '" npcId="' + Npclist[i].id + '" onclick="getByNpc('+i+')">' +
                         (i+1) + '、' + Npclist[i].name + '</div>';
            $('#equList').append(npcHtml);
        }
    }
}

// Get details for the selected NPC
function getByNpc(npcId) {
    // Clear previous results
    $('#monList, #mapList, #mapTransferList, #mapTitle, #monTitle').html('');

    // Show NPC consumption items (if available)
    if (typeof Npclist !== 'undefined' && Npclist[npcId] && Npclist[npcId].consumes) {
        let consumeHtml = Npclist[npcId].consumes || '无消耗';
        $('#monList').html(consumeHtml);
    } else {
        $('#monList').html('无消耗');
    }

    // Show NPC reward items (if available)
    if (typeof Npclist !== 'undefined' && Npclist[npcId] && Npclist[npcId].rewards) {
        let rewardHtml = Npclist[npcId].rewards || '无奖励';
        $('#mapList').html(rewardHtml);
    } else {
        $('#mapList').html('无奖励');
    }

    // Get map for the selected NPC
    if (typeof Npclist !== 'undefined' && Npclist[npcId] && Npclist[npcId].mapid) {
        let mapHtml = '地图信息: 未知 (ID: ' + Npclist[npcId].mapid + ')';
        $('#mapTransferList').html(mapHtml);
    } else {
        $('#mapTransferList').html('地图信息: 未知');
    }

    // Set titles
    $('#monTitle').html('NPC消耗物品（没有的话可能是传送NPC）');
    $('#mapTitle').html('NPC给与的物品（有可能也是封号）');
    $('#mapTransferTitle').html('其他信息（详细信息）');
}

// Initialize the page - get all NPCs by default
getNpcByKey();