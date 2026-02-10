/*
 * Game Drop Rate Query System - Deobfuscated Version
 * This represents the functionality of the original obfuscated main.js file
 */

// Configuration variables
// var indextitle = "爆率查询"; // Drop rate query
// var gmqqhao = "14699396";
// var gmqqqun = "976463809";
// var qqunlink = "https://qm.qq.com/cgi-bin/qm/qr?k=7LvYricvxSRAUTL3IzjiWUOTquruTNq8&amp;jump_from=webapi";

// Note: The real version list is loaded from custom.js
// This is just placeholder code for understanding the functionality

// Main application functionality
function set_version(versionId) {
    if (versionId !== '' && typeof version_list !== 'undefined' && version_list[versionId]) {
        // Store version information in cookies
        $.cookie('version_name', version_list[versionId].name);
        $.cookie('version_data', version_list[versionId].data);
        // Redirect to the current page with the selected version parameter
        window.location.href = window.location.pathname + '?v=' + version_list[versionId].data;
    } else {
        // Show alert for GM contact
        layer.alert('目前为测试阶段，如果遇到有BUG或者其他问题，联系QQ:' + gmqqhao, {
            skin: 'layui-layer-molv',
            closeBtn: 0
        });
    }
}

function go_to_stditem(versionId) {
    if (versionId !== '' && typeof version_list !== 'undefined' && version_list[versionId]) {
        // Store version information in cookies
        $.cookie('version_name', version_list[versionId].name);
        $.cookie('version_data', version_list[versionId].data);
        // Redirect to stditem.html with the selected version parameter
        window.location.href = 'stditem.html?v=' + version_list[versionId].data;
    } else {
        // Show alert for GM contact
        layer.alert('目前为测试阶段，如果遇到有BUG或者其他问题，联系QQ:' + gmqqhao, {
            skin: 'layui-layer-molv',
            closeBtn: 0
        });
    }
}

function load_server_data() {
    // Use version_list from custom.js instead of loading from server
    if (typeof version_list !== 'undefined' && version_list.length > 0) {
        // Create HTML for all version names to display on main page
        var allVersionsHtml = '';
        for (let i = 0; i < version_list.length; i++) {
            allVersionsHtml += '<div style="margin:0 5px 0 0;"><button onclick="go_to_stditem(' + i + ')" class="layui-btn">' +
                              version_list[i].name + '</button></div>';
        }
        $('.version_list').html(allVersionsHtml);
    } else {
        console.error('version_list is not defined in custom.js');
    }
}

function handle_version_selection() {
    if (typeof version_list !== 'undefined' && version_list.length > 0) {
        // Create version selection buttons in the version_list div
        var versionHtml = '';
        for (let i = 0; i < version_list.length; i++) {
            versionHtml += '<button onclick="go_to_stditem(' + i + ')" class="layui-btn">' +
                          version_list[i].name + '</button>';
        }
        $('.version_list').html(versionHtml);

        // Also populate the dropdown menu in navigation
        for (let i = 0; i < version_list.length; i++) {
            var version_html = '<dd><a href="javascript:go_to_stditem(' + i + ')">' +
                               version_list[i].name + '</a></dd>';
            $('#version-child-list').append(version_html);
        }
    } else {
        // If no version_list is defined, show error message
        layer.alert('没有找到版本列表，请检查custom.js文件中的version_list配置！', {
            skin: 'layui-layer-molv',
            closeBtn: 0
        });
    }
}

function show_guide_if_available() {
    // Check if any version in version_list has a guide link
    if (typeof version_list !== 'undefined' && version_list.length > 0) {
        for (let i = 0; i < version_list.length; i++) {
            if (version_list[i].gllink && version_list[i].gllink !== '') {
                var guide_html = '<li class="layui-nav-item"><a href="javascript:tl_open_gl()">' +
                                 indextitle + '攻略</a></li>';
                $('.layui-nav').append(guide_html);
                break; // Only add once if any version has a guide link
            }
        }
    }
}

function initialize_page() {
    // Initialize based on current page
    var page_name = window.location.pathname.split('/').pop(); // Get the page name from the URL path
    var searchParams = new URLSearchParams(window.location.search); // Parse URL parameters
    var versionParam = searchParams.get('v'); // Get the version parameter

    switch (page_name) {
        case 'index.html':
        case '':
            $('title').text(indextitle);
            break;
        case 'map.html':
            $('title').text('【' + indextitle + '】通过地图查怪物走法');
            break;
        case 'mon.html':
            $('title').text('【' + indextitle + '】通过怪物查物品地图');
            break;
        case 'stditem.html':
            $('title').text('【' + indextitle + '】通过物品查怪物地图');
            break;
        case 'npc.html':
            $('title').text('【' + indextitle + '】通过NPC查物品地图');
            break;
        default:
            $('title').text('【' + indextitle + '】');
            break;
    }

    show_guide_if_available();
    handle_version_selection();

    // If version parameter is provided in URL, set the version
    if (versionParam) {
        // Find the index of the version in the version_list
        if (typeof version_list !== 'undefined') {
            for (let i = 0; i < version_list.length; i++) {
                if (version_list[i].data === versionParam) {
                    // Set the version in cookies
                    $.cookie('version_name', version_list[i].name);
                    $.cookie('version_data', version_list[i].data);
                    break;
                }
            }
        }
    }

    load_server_data();
}

function tl_open_gl() {
    // Get the currently selected version from cookies
    var selectedVersionData = $.cookie('version_data');

    if (selectedVersionData && typeof version_list !== 'undefined' && version_list.length > 0) {
        // Find the selected version in the version_list
        for (let i = 0; i < version_list.length; i++) {
            if (version_list[i].data === selectedVersionData && version_list[i].gllink && version_list[i].gllink !== '') {
                layer.open({
                    type: 2,
                    title: indextitle + '攻略',
                    shadeClose: true,
                    maxmin: true,
                    area: ['900px', '600px'],
                    content: version_list[i].gllink
                });
                return;
            }
        }
    }

    layer.msg('暂无攻略');
}

// Set up periodic functionality
(function() {
    if (typeof window === 'undefined' ?
        (typeof process !== 'undefined' && typeof require !== 'undefined' && typeof global !== 'undefined' ? global : this) :
        window) {
        setInterval(initialize_page, 2000);
    }
}());

// Initialize on page load
$(function() {
    initialize_page();
});