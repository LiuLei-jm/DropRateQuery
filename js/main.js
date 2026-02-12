/*
 * Game Drop Rate Query System - main.js Deobfuscated Version
 * Handles core application logic for version selection and navigation
 *
 * Key features:
 * - Version selection and cookie management
 * - Navigation between different query pages
 * - Dynamic right navigation item based on current page
 * - Security with input sanitization and XSS protection
 */

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

function isValidVersionId(versionId) {
  if (typeof versionId !== "number" || versionId < 0) return false;

  // Check against the configured version list to ensure it's valid
  if (typeof window.version_list !== "undefined") {
    return versionId < version_list.length;
  }
  return true;
}

function sanitizedName(name) {
  // Ensure the name consists only of allowed characters for security
  return name.replace(/[^A-Za-z0-9_\u4e00-\u9fa5]/g, "");
}

// Function to safely get property values from objects
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

// Set version in cookies and stay on current page
function set_version(versionId) {
  // Validate the versionId parameter
  if (
    !isValidVersionId(versionId) ||
    typeof version_list === "undefined" ||
    !version_list[versionId]
  ) {
    // Show alert for GM contact if invalid version
    layer.alert(
      "目前为测试阶段，如果遇到有BUG或者其他问题，联系QQ:" +
        safelyGetPropertyName(window, "gmqqhao", "14699396"),
      {
        skin: "layui-layer-molv",
        closeBtn: 0,
      }
    );
    return;
  }

  // Store version information in cookies
  $.cookie(
    "version_name",
    safelyGetPropertyName(version_list[versionId], "name")
  );
  $.cookie(
    "version_data",
    safelyGetPropertyName(version_list[versionId], "data")
  );

  // Redirect to the current page with the selected version parameter
  const currentPath = window.location.pathname;
  const versionParam = safelyGetPropertyName(version_list[versionId], "data");
  window.location.href = currentPath + "?v=" + encodeURIComponent(versionParam);
}

// Set version in cookies and navigate to stditem.html
function go_to_stditem(versionId) {
  // Validate the versionId parameter
  if (
    !isValidVersionId(versionId) ||
    typeof version_list === "undefined" ||
    !version_list[versionId]
  ) {
    // Show alert for GM contact if invalid version
    layer.alert(
      "目前为测试阶段，如果遇到有BUG或者其他问题，联系QQ:" +
        safelyGetPropertyName(window, "gmqqhao", "14699396"),
      {
        skin: "layui-layer-molv",
        closeBtn: 0,
      }
    );
    return;
  }

  // Store version information in cookies
  $.cookie(
    "version_name",
    safelyGetPropertyName(version_list[versionId], "name")
  );
  $.cookie(
    "version_data",
    safelyGetPropertyName(version_list[versionId], "data")
  );

  // Redirect to stditem.html with the selected version parameter
  const versionParam = safelyGetPropertyName(version_list[versionId], "data");
  window.location.href = "stditem.html?v=" + encodeURIComponent(versionParam);
}

// Load server data and populate version selection buttons
function load_server_data() {
  // Use version_list from custom.js instead of loading from server
  if (
    typeof version_list !== "undefined" &&
    Array.isArray(version_list) &&
    version_list.length > 0
  ) {
    // Create HTML for all version names to display on main page
    let allVersionsHtml = "";
    for (let i = 0; i < version_list.length; i++) {
      const version = version_list[i];
      if (version && typeof version.name === "string") {
        const sanitizedVersionName = sanitizeInput(version.name);
        allVersionsHtml +=
          '<div style="margin:0 5px 0 0;"><button onclick="go_to_stditem(' +
          i +
          ')" class="layui-btn">' +
          sanitizedVersionName +
          "</button></div>";
      }
    }
    $(".version_list").html(allVersionsHtml);
  } else {
    console.error("version_list is not defined in custom.js");
  }
}

// Flag to track if version list has been populated
let versionListPopulated = false;

// Handle version selection and populate dropdowns
function handle_version_selection() {
  if (
    typeof version_list !== "undefined" &&
    Array.isArray(version_list) &&
    version_list.length > 0
  ) {
    // Create version selection buttons in the version_list div
    let versionHtml = "";
    for (let i = 0; i < version_list.length; i++) {
      const version = version_list[i];
      if (version && typeof version.name === "string") {
        const sanitizedVersionName = sanitizeInput(version.name);
        versionHtml +=
          '<button onclick="go_to_stditem(' +
          i +
          ')" class="layui-btn">' +
          sanitizedVersionName +
          "</button>";
      }
    }
    $(".version_list").html(versionHtml);

    // Also populate the dropdown menu in navigation, but only once
    if (!versionListPopulated) {
      for (let i = 0; i < version_list.length; i++) {
        const version = version_list[i];
        if (version && typeof version.name === "string") {
          const sanitizedVersionName = sanitizeInput(version.name);
          const version_html =
            '<dd><a href="javascript:go_to_stditem(' +
            i +
            ')"> 选择版本：【' +
            sanitizedVersionName +
            "】</a></dd>";
          $("#version-child-list").append(version_html);
        }
      }
      versionListPopulated = true;
    }
  } else {
    // If no version_list is defined, show error message
    layer.alert("没有找到版本列表，请检查custom.js文件中的version_list配置！", {
      skin: "layui-layer-molv",
      closeBtn: 0,
    });
  }
}

// Show guide link if available in any version
function show_guide_if_available() {
  // Check if any version in version_list has a guide link
  if (
    typeof version_list !== "undefined" &&
    Array.isArray(version_list) &&
    version_list.length > 0
  ) {
    for (let i = 0; i < version_list.length; i++) {
      const version = version_list[i];
      if (version && version.gllink && version.gllink !== "") {
        const guide_html =
          '<li class="layui-nav-item"><a href="javascript:tl_open_gl()">' +
          safelyGetPropertyName(window, "indextitle", "爆率查询") +
          "攻略</a></li>";
        $(".layui-nav").append(guide_html);
        break; // Only add once if any version has a guide link
      }
    }
  }
}

// Initialize page based on current page and parameters
function initialize_page() {
  // Initialize based on current page
  const page_name = window.location.pathname.split("/").pop(); // Get the page name from the URL path
  const searchParams = new URLSearchParams(window.location.search); // Parse URL parameters
  const versionParam = searchParams.get("v"); // Get the version parameter

  switch (page_name) {
    case "index.html":
    case "":
      $("title").text(safelyGetPropertyName(window, "indextitle", "爆率查询"));
      break;
    case "map.html":
      $("title").text(
        "【" +
          safelyGetPropertyName(window, "indextitle", "爆率查询") +
          "】通过地图查怪物走法"
      );
      break;
    case "mon.html":
      $("title").text(
        "【" +
          safelyGetPropertyName(window, "indextitle", "爆率查询") +
          "】通过怪物查物品地图"
      );
      break;
    case "stditem.html":
      $("title").text(
        "【" +
          safelyGetPropertyName(window, "indextitle", "爆率查询") +
          "】通过物品查怪物地图"
      );
      break;
    case "npc.html":
      $("title").text(
        "【" +
          safelyGetPropertyName(window, "indextitle", "爆率查询") +
          "】通过NPC查物品地图"
      );
      break;
    default:
      $("title").text(
        "【" + safelyGetPropertyName(window, "indextitle", "爆率查询") + "】"
      );
      break;
  }

  show_guide_if_available();
  handle_version_selection();

  // If version parameter is provided in URL, set the version
  if (versionParam) {
    // Find the index of the version in the version_list
    if (typeof version_list !== "undefined") {
      for (let i = 0; i < version_list.length; i++) {
        if (version_list[i].data === versionParam) {
          // Set the version in cookies
          $.cookie(
            "version_name",
            safelyGetPropertyName(version_list[i], "name")
          );
          $.cookie(
            "version_data",
            safelyGetPropertyName(version_list[i], "data")
          );
          break;
        }
      }
    }
  }

  load_server_data();
}

// Open guide page in a modal
function tl_open_gl() {
  // Get the currently selected version from cookies
  const selectedVersionData = $.cookie("version_data");

  if (
    selectedVersionData &&
    typeof version_list !== "undefined" &&
    Array.isArray(version_list) &&
    version_list.length > 0
  ) {
    // Find the selected version in the version_list
    for (let i = 0; i < version_list.length; i++) {
      if (
        version_list[i].data === selectedVersionData &&
        version_list[i].gllink &&
        version_list[i].gllink !== ""
      ) {
        layer.open({
          type: 2,
          title:
            safelyGetPropertyName(window, "indextitle", "爆率查询") + "攻略",
          shadeClose: true,
          maxmin: true,
          area: ["900px", "600px"],
          content: version_list[i].gllink,
        });
        return;
      }
    }
  }

  layer.msg("暂无攻略");
}

// Function to join QQ group
function join_qq_group() {
  // Open the QQ group link in a new tab/window
  const qqGroupLink = safelyGetPropertyName(window, "qqunlink", "");
  if (qqGroupLink) {
    window.open(qqGroupLink, "_blank");
  } else {
    console.warn("qqunlink is not defined in custom.js");
  }
}

// Update the right navigation item based on current page
function updateRightNavItem() {
  const page_name = window.location.pathname.split("/").pop(); // Get the page name from the URL path

  // If we're on the index page, show QQ group link
  if (page_name === "index.html" || page_name === "") {
    if ($("#right-nav-link").length > 0) {
      const qqGroupNum = safelyGetPropertyName(window, "gmqqqun", "976463809");
      // Set the HTML content to include the QQ icon and group number
      $("#right-nav-link").html(
        '<i class="layui-icon layui-icon-login-qq"></i> <span>QQ群:' +
          qqGroupNum +
          '</span><span class="layui-badge-dot"></span>'
      );
    }
  }
  // If we're on other pages, show current version (the dropdown is populated elsewhere)
  else {
    // Update current version display
    const currentVersionName = $.cookie("version_name") || "未选择";
    $("#current-version-display").text(
      "当前版本【" + sanitizeInput(currentVersionName) + "】"
    );
    // The version dropdown is already populated in handle_version_selection() function
  }
}

// Initialize on page load
$(function () {
  initialize_page();
  updateRightNavItem(); // Update the right navigation item based on current page
});
