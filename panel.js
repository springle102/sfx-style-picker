const gradientCore = require("./gradient-core.js");
const glowCore = require("./glow-core.js");
const licensing = require("./licensing.js");
const { core } = require("photoshop");

// ══════════════════════════════════════════════
// APPLICATION STATE
// ══════════════════════════════════════════════

let currentMode = "gradient"; // "gradient" or "glow"

let gradientState = {
  analyzedStops: [],
  angle: 90, // default 90 degrees
  enableStroke: true,
  strokeColorHex: "#FFFFFF",
  strokeSizeValue: 5,
  opacity: 100
};

let glowState = {
  color: null,
  opacity: 100, // default 100%
  size: 10,
  spread: 0,
  range: 50,
  scanStart: 3,
  scanEnd: 9
};

// ══════════════════════════════════════════════
// DOM ELEMENTS
// ══════════════════════════════════════════════

// Tabs
const tabGradient = document.getElementById("tab-gradient");
const tabGlow = document.getElementById("tab-glow");

// Pick & Apply Buttons
const btnPick = document.getElementById("btn-pick");
const btnPickText = document.getElementById("btn-pick-text");
const btnApply = document.getElementById("btn-apply");
const statusBar = document.getElementById("status-bar");

// Preview Elements
const gradientPreviewWrapper = document.getElementById("gradient-preview-wrapper");
const glowPreviewWrapper = document.getElementById("glow-preview-wrapper");
const gradientPreviewBar = document.getElementById("gradient-preview-bar");
const gradientStopsList = document.getElementById("gradient-stops-preview-list");
const glowPreviewCircle = document.getElementById("glow-preview-circle");

// Mode specific sections
const gradientControls = document.getElementById("gradient-controls");
const glowControls = document.getElementById("glow-controls");

// Gradient Inputs
const selectGradientType = document.getElementById("select-gradient-type");
const angleDial = document.getElementById("angle-dial");
const angleDialNeedle = document.getElementById("angle-dial-needle");
const inputAngle = document.getElementById("input-angle");
const valAngle = document.getElementById("val-angle");
const strokeControlsRow = document.getElementById("stroke-controls-row");
const strokeColorSwatch = document.getElementById("stroke-color-swatch");
const strokeSize = document.getElementById("stroke-size");
const chkStrokeEnable = document.getElementById("chk-stroke-enable");
const sliderGradientOpacity = document.getElementById("slider-gradient-opacity");
const valGradientOpacity = document.getElementById("val-gradient-opacity");

// Glow Inputs
const sliderScanStart = document.getElementById("slider-scan-start");
const valScanStart = document.getElementById("val-scan-start");
const sliderScanEnd = document.getElementById("slider-scan-end");
const valScanEnd = document.getElementById("val-scan-end");
const sliderGlowSize = document.getElementById("slider-glow-size");
const valGlowSize = document.getElementById("val-glow-size");
const sliderGlowSpread = document.getElementById("slider-glow-spread");
const valGlowSpread = document.getElementById("val-glow-spread");
const sliderGlowRange = document.getElementById("slider-glow-range");
const valGlowRange = document.getElementById("val-glow-range");
const sliderGlowOpacity = document.getElementById("slider-glow-opacity");
const valGlowOpacity = document.getElementById("val-glow-opacity");
const glowColorSwatch = document.getElementById("glow-color-swatch");
const glowColorHex = document.getElementById("glow-color-hex");

// ══════════════════════════════════════════════
// UI RENDERING & SYNC HELPERS
// ══════════════════════════════════════════════

function showStatus(message, type = "idle") {
  statusBar.innerText = message;
  statusBar.className = `status-bar status-${type}`;
}

function switchMode(mode) {
  currentMode = mode;
  
  if (mode === "gradient") {
    tabGradient.classList.add("active");
    tabGlow.classList.remove("active");
    
    btnPickText.innerText = "Pick Gradient";
    
    gradientPreviewWrapper.classList.add("active");
    glowPreviewWrapper.classList.remove("active");
    
    gradientControls.classList.add("active");
    glowControls.classList.remove("active");
    
    // Enable/disable Apply button based on gradient data availability
    btnApply.disabled = gradientState.analyzedStops.length === 0;
  } else {
    tabGradient.classList.remove("active");
    tabGlow.classList.add("active");
    
    btnPickText.innerText = "Pick Glow Color";
    
    gradientPreviewWrapper.classList.remove("active");
    glowPreviewWrapper.classList.add("active");
    
    gradientControls.classList.remove("active");
    glowControls.classList.add("active");
    
    // Enable/disable Apply button based on glow color availability
    btnApply.disabled = glowState.color === null;
  }
}

// ── Gradient Preview & UI Update ──

function renderGradientPreviewBarOnly() {
  const validStops = gradientState.analyzedStops.filter(stop => stop.selected !== false);
  let previewStops = [...validStops];

  if (previewStops.length === 0) {
    gradientPreviewBar.style.background = "#333333";
  } else {
    if (previewStops.length === 1) {
      previewStops = [
        { color: [...previewStops[0].color], pos: 0.0 },
        { color: [...previewStops[0].color], pos: 1.0 }
      ];
    } else {
      // Rescale positions to fill 0% - 100%
      const minPos = previewStops[0].pos;
      const maxPos = previewStops[previewStops.length - 1].pos;
      const range = maxPos - minPos || 1;
      previewStops = previewStops.map(stop => ({
        color: [...stop.color],
        pos: (stop.pos - minPos) / range
      }));
    }

    const gradientStr = previewStops
      .map(stop => `${gradientCore.rgbToHex(...stop.color)} ${Math.round(stop.pos * 100)}%`)
      .join(", ");

    gradientPreviewBar.style.background = `linear-gradient(90deg, ${gradientStr})`;
  }
}

function renderGradientStopsList() {
  gradientStopsList.innerHTML = "";
  
  if (gradientState.analyzedStops.length === 0) {
    gradientStopsList.innerHTML = `
      <li class="instructions" style="text-align: center; list-style: none; margin: 0; padding: 8px 0; width: 100%;">
        Chưa có dữ liệu màu. Hãy chọn vùng màu và bấm phân tích.
      </li>
    `;
    return;
  }

  gradientState.analyzedStops.forEach((stop, index) => {
    const hex = gradientCore.rgbToHex(...stop.color);
    const percent = Math.round(stop.pos * 100);
    const isChecked = stop.selected !== false ? "checked" : "";

    const li = document.createElement("li");
    li.className = "stop-item";
    li.innerHTML = `
      <div class="stop-left">
        <input type="checkbox" class="stop-checkbox" data-index="${index}" ${isChecked} />
        <span class="stop-color-indicator" data-index="${index}" style="background-color: ${hex}; cursor: pointer;"></span>
        <span class="stop-color-text" data-index="${index}" style="cursor: pointer; font-weight: 500;">Stop ${index + 1}: ${hex.toUpperCase()}</span>
      </div>
      <div class="stop-right">${percent}%</div>
    `;
    gradientStopsList.appendChild(li);
  });
}

function updateAngleUI(angle) {
  gradientState.angle = angle;
  valAngle.innerText = angle;
  inputAngle.value = angle;
  
  const cssRotation = 90 - angle;
  angleDialNeedle.style.transform = `rotate(${cssRotation}deg)`;
}

function updateStrokeUI() {
  if (chkStrokeEnable) {
    chkStrokeEnable.checked = gradientState.enableStroke;
  }
  
  if (gradientState.enableStroke) {
    strokeControlsRow.classList.remove("disabled");
    strokeSize.removeAttribute("disabled");
  } else {
    strokeControlsRow.classList.add("disabled");
    strokeSize.setAttribute("disabled", "true");
  }
  
  strokeColorSwatch.style.backgroundColor = gradientState.strokeColorHex;
  strokeColorSwatch.setAttribute("data-hex", gradientState.strokeColorHex);
  
  strokeSize.value = gradientState.strokeSizeValue;
}

function updateGradientOpacityUI() {
  sliderGradientOpacity.value = gradientState.opacity;
  valGradientOpacity.innerText = `${gradientState.opacity}%`;
}

function renderFullGradientUI() {
  renderGradientPreviewBarOnly();
  renderGradientStopsList();
  updateAngleUI(gradientState.angle);
  updateStrokeUI();
  updateGradientOpacityUI();
}

// ── Glow Preview & UI Update ──

function renderGlowPreview() {
  if (glowState.color) {
    const { r, g, b } = glowState.color;
    const size = glowState.size;
    const spread = glowState.spread;
    const opacity = glowState.opacity / 100;
    
    // Scale size and spread for visually pleasing UXP preview rendering
    const cssBlur = Math.min(25, size * 0.15 + 1); 
    const cssSpread = Math.min(15, spread * 0.1); 
    
    // Set circle background to the picked color instead of solid white
    // to clearly show the picked color
    glowPreviewCircle.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    glowPreviewCircle.style.boxShadow = `0 0 ${cssBlur}px ${cssSpread}px rgba(${r}, ${g}, ${b}, ${opacity})`;
    
    const hex = glowCore.rgbToHex(r, g, b);
    if (glowColorSwatch) glowColorSwatch.style.backgroundColor = hex;
    if (glowColorHex) glowColorHex.innerText = hex.toUpperCase();
  } else {
    glowPreviewCircle.style.backgroundColor = "#444444";
    glowPreviewCircle.style.boxShadow = "none";
    if (glowColorSwatch) glowColorSwatch.style.backgroundColor = "#444444";
    if (glowColorHex) glowColorHex.innerText = "Chưa chọn";
  }
}

function renderGlowUI() {
  renderGlowPreview();
  
  sliderScanStart.value = glowState.scanStart;
  valScanStart.innerText = `${glowState.scanStart} px`;
  
  sliderScanEnd.value = glowState.scanEnd;
  valScanEnd.innerText = `${glowState.scanEnd} px`;
  
  sliderGlowSize.value = glowState.size;
  valGlowSize.innerText = `${glowState.size} px`;
  
  sliderGlowSpread.value = glowState.spread;
  valGlowSpread.innerText = `${glowState.spread}%`;
  
  sliderGlowRange.value = glowState.range;
  valGlowRange.innerText = `${glowState.range}%`;
  
  sliderGlowOpacity.value = glowState.opacity;
  valGlowOpacity.innerText = `${glowState.opacity}%`;
}

// ══════════════════════════════════════════════
// STATE EVENT BINDINGS
// ══════════════════════════════════════════════

// Tabs Event
tabGradient.addEventListener("click", () => switchMode("gradient"));
tabGlow.addEventListener("click", () => switchMode("glow"));

// Angle Dial Drag Logic
let isDraggingAngle = false;

function getAngleFromEvent(e) {
  const rect = angleDial.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;

  const angleRad = Math.atan2(-dy, dx);
  let angleDeg = Math.round(angleRad * (180 / Math.PI));
  angleDeg = ((angleDeg % 360) + 360) % 360;
  return angleDeg;
}

angleDial.addEventListener("mousedown", (e) => {
  isDraggingAngle = true;
  updateAngleUI(getAngleFromEvent(e));
  e.preventDefault();
});

window.addEventListener("mousemove", (e) => {
  if (!isDraggingAngle) return;
  updateAngleUI(getAngleFromEvent(e));
});

window.addEventListener("mouseup", () => {
  isDraggingAngle = false;
});

// Angle Inputs Event
inputAngle.addEventListener("input", (e) => {
  let val = parseInt(e.target.value, 10);
  if (isNaN(val)) return;
  if (val < 0) val = 0;
  if (val > 360) val = 360;
  gradientState.angle = val;
  valAngle.innerText = val;
  
  const cssRotation = 90 - val;
  angleDialNeedle.style.transform = `rotate(${cssRotation}deg)`;
});

inputAngle.addEventListener("change", (e) => {
  let val = parseInt(e.target.value, 10);
  if (isNaN(val)) val = 90;
  if (val < 0) val = 0;
  if (val > 360) val = 360;
  updateAngleUI(val);
});

// Select Gradient Type Style
selectGradientType.addEventListener("change", (e) => {
  const angleGroup = document.getElementById("angle-control-group");
  if (e.target.value === "radial") {
    angleGroup.style.display = "none";
  } else {
    angleGroup.style.display = "flex";
  }
});

// Stroke controls
chkStrokeEnable.addEventListener("change", (e) => {
  gradientState.enableStroke = e.target.checked;
  updateStrokeUI();
});

strokeColorSwatch.addEventListener("click", async () => {
  const defaultRGB = gradientCore.hexToRgb(gradientState.strokeColorHex) || { r: 255, g: 255, b: 255 };
  
  try {
    let pickedRGB = null;
    await core.executeAsModal(async () => {
      pickedRGB = await gradientCore.showColorPickerUXP(defaultRGB);
    }, { commandName: "Chọn màu viền" });
    
    if (pickedRGB) {
      gradientState.strokeColorHex = gradientCore.rgbToHex(pickedRGB.r, pickedRGB.g, pickedRGB.b);
      updateStrokeUI();
    }
  } catch (err) {
    console.error("Lỗi chọn màu stroke:", err);
  }
});

strokeSize.addEventListener("input", (e) => {
  let val = parseInt(e.target.value, 10);
  if (isNaN(val)) return;
  if (val < 1) val = 1;
  if (val > 100) val = 100;
  gradientState.strokeSizeValue = val;
});

strokeSize.addEventListener("change", (e) => {
  let val = parseInt(e.target.value, 10);
  if (isNaN(val)) val = 5;
  if (val < 1) val = 1;
  if (val > 100) val = 100;
  e.target.value = val;
  gradientState.strokeSizeValue = val;
});

// Stop Selection UI Event Delegation
gradientStopsList.addEventListener("change", (e) => {
  if (e.target.classList.contains("stop-checkbox")) {
    const idx = parseInt(e.target.getAttribute("data-index"), 10);
    if (!isNaN(idx) && gradientState.analyzedStops[idx]) {
      gradientState.analyzedStops[idx].selected = e.target.checked;
      renderGradientPreviewBarOnly();
    }
  }
});

gradientStopsList.addEventListener("click", async (e) => {
  const isIndicator = e.target.classList.contains("stop-color-indicator");
  const isLabel = e.target.classList.contains("stop-color-text");

  if (isIndicator || isLabel) {
    const idx = parseInt(e.target.getAttribute("data-index"), 10);
    if (isNaN(idx) || !gradientState.analyzedStops[idx]) return;

    const stop = gradientState.analyzedStops[idx];
    const defaultRGB = { r: stop.color[0], g: stop.color[1], b: stop.color[2] };

    try {
      let pickedRGB = null;
      await core.executeAsModal(async () => {
        pickedRGB = await gradientCore.showColorPickerUXP(defaultRGB);
      }, { commandName: "Chọn màu Stop" });

      if (pickedRGB) {
        stop.color = [pickedRGB.r, pickedRGB.g, pickedRGB.b];
        renderGradientPreviewBarOnly();
        renderGradientStopsList();
      }
    } catch (err) {
      console.error("Lỗi chọn màu stop:", err);
    }
  }
});

// Gradient Opacity
sliderGradientOpacity.addEventListener("input", (e) => {
  gradientState.opacity = parseInt(e.target.value, 10);
  valGradientOpacity.innerText = `${gradientState.opacity}%`;
});

// Glow sliders
sliderScanStart.addEventListener("input", (e) => {
  let startVal = parseInt(e.target.value, 10);
  let endVal = parseInt(sliderScanEnd.value, 10);
  if (startVal >= endVal) {
    endVal = startVal + 1;
    sliderScanEnd.value = endVal;
    valScanEnd.innerText = `${endVal} px`;
    glowState.scanEnd = endVal;
  }
  glowState.scanStart = startVal;
  valScanStart.innerText = `${startVal} px`;
});

sliderScanEnd.addEventListener("input", (e) => {
  let endVal = parseInt(e.target.value, 10);
  let startVal = parseInt(sliderScanStart.value, 10);
  if (endVal <= startVal) {
    startVal = Math.max(0, endVal - 1);
    sliderScanStart.value = startVal;
    valScanStart.innerText = `${startVal} px`;
    glowState.scanStart = startVal;
  }
  glowState.scanEnd = endVal;
  valScanEnd.innerText = `${endVal} px`;
});

sliderGlowSize.addEventListener("input", (e) => {
  glowState.size = parseInt(e.target.value, 10);
  valGlowSize.innerText = `${glowState.size} px`;
  renderGlowPreview();
});

sliderGlowSpread.addEventListener("input", (e) => {
  glowState.spread = parseInt(e.target.value, 10);
  valGlowSpread.innerText = `${glowState.spread}%`;
  renderGlowPreview();
});

sliderGlowRange.addEventListener("input", (e) => {
  glowState.range = parseInt(e.target.value, 10);
  valGlowRange.innerText = `${glowState.range}%`;
  renderGlowPreview();
});

sliderGlowOpacity.addEventListener("input", (e) => {
  glowState.opacity = parseInt(e.target.value, 10);
  valGlowOpacity.innerText = `${glowState.opacity}%`;
  renderGlowPreview();
});

const handleGlowColorClick = async () => {
  const defaultRGB = glowState.color || { r: 255, g: 255, b: 255 };
  try {
    let pickedRGB = null;
    await core.executeAsModal(async () => {
      pickedRGB = await gradientCore.showColorPickerUXP(defaultRGB);
    }, { commandName: "Chọn màu phát sáng" });
    
    if (pickedRGB) {
      glowState.color = pickedRGB;
      renderGlowPreview();
      btnApply.disabled = false;
    }
  } catch (err) {
    console.error("Lỗi chọn màu Glow:", err);
  }
};

if (glowColorSwatch) {
  glowColorSwatch.addEventListener("click", handleGlowColorClick);
}
if (glowPreviewCircle) {
  glowPreviewCircle.addEventListener("click", handleGlowColorClick);
}

// ══════════════════════════════════════════════
// PICK & APPLY CLICK ACTIONS
// ══════════════════════════════════════════════

btnPick.addEventListener("click", async () => {
  btnPick.disabled = true;
  
  if (currentMode === "gradient") {
    const result = await gradientCore.runGradientPickWorkflow(showStatus);
    if (result) {
      gradientState.analyzedStops = result.analyzedStops;
      
      // Auto apply detected gradient angle
      updateAngleUI(result.detectedAngleDeg);
      
      renderFullGradientUI();
      btnApply.disabled = false;
      showStatus(`Đã trích xuất ${result.analyzedStops.length} stops gradient (góc ${result.detectedAngleDeg}°)!`, "success");
    }
  } else {
    // Mode Glow
    const color = await glowCore.runGlowPickWorkflow(glowState.scanStart, glowState.scanEnd, showStatus);
    if (color) {
      glowState.color = color;
      renderGlowUI();
      btnApply.disabled = false;
      showStatus("Hút màu Glow thành công!", "success");
    }
  }
  
  btnPick.disabled = false;
});

btnApply.addEventListener("click", async () => {
  btnApply.disabled = true;
  
  if (currentMode === "gradient") {
    const options = {
      analyzedStops: gradientState.analyzedStops,
      currentType: selectGradientType.value,
      currentAngleValue: gradientState.angle,
      enableStroke: gradientState.enableStroke,
      strokeColorHex: gradientState.strokeColorHex,
      strokeSizeValue: gradientState.strokeSizeValue,
      opacity: gradientState.opacity
    };
    await gradientCore.applyGradientWorkflow(options, showStatus);
  } else {
    // Mode Glow
    await glowCore.runGlowApplyWorkflow(glowState, showStatus);
  }
  
  btnApply.disabled = false;
});

// ══════════════════════════════════════════════
// INITIALIZATION & LICENSING
// ══════════════════════════════════════════════

function initApp() {
  switchMode("gradient");
  renderFullGradientUI();
  renderGlowUI();
  showStatus("Sẵn sàng");
}

// Lấy các DOM element của màn hình kích hoạt
const licenseScreen = document.getElementById("license-screen");
const mainAppContainer = document.getElementById("main-app-container");
const inputCustomerName = document.getElementById("input-customer-name") || document.getElementById("input-customer-email");
const inputLicenseKey = document.getElementById("input-license-key");
const btnActivateLicense = document.getElementById("btn-activate-license");
const licenseErrorMsg = document.getElementById("license-error-msg");

/**
 * Kiểm tra trạng thái bản quyền đã kích hoạt trước đó chưa
 */
async function checkLicense() {
  const isLicensed = localStorage.getItem("sfx_licensed") === "true";
  const savedKey = localStorage.getItem("sfx_license_key");
  
  if (isLicensed) {
    if (licenseScreen) licenseScreen.style.display = "none";
    if (mainAppContainer) mainAppContainer.style.display = "flex";
    initApp();

    if (savedKey && typeof licensing.validateLicense === "function") {
      const valResult = await licensing.validateLicense(savedKey);
      if (valResult && valResult.valid === false) {
        localStorage.removeItem("sfx_licensed");
        localStorage.removeItem("sfx_license_key");
        if (licenseScreen) licenseScreen.style.display = "flex";
        if (mainAppContainer) mainAppContainer.style.display = "none";
        if (licenseErrorMsg) {
          licenseErrorMsg.innerText = valResult.message || "License Key không còn hợp lệ.";
          licenseErrorMsg.style.display = "block";
        }
      }
    }
  } else {
    if (licenseScreen) licenseScreen.style.display = "flex";
    if (mainAppContainer) mainAppContainer.style.display = "none";
  }
}

// Bắt sự kiện bấm nút Kích hoạt bản quyền
if (btnActivateLicense) {
  btnActivateLicense.addEventListener("click", async () => {
    btnActivateLicense.disabled = true;
    if (licenseErrorMsg) licenseErrorMsg.style.display = "none";
    
    const customerName = inputCustomerName ? inputCustomerName.value.trim() : "";
    const key = inputLicenseKey ? inputLicenseKey.value.trim() : "";
    
    // Kiểm tra dữ liệu nhập ở Client
    if (!customerName) {
      if (licenseErrorMsg) {
        licenseErrorMsg.innerText = "Vui lòng nhập tên hoặc email của bạn.";
        licenseErrorMsg.style.display = "block";
      }
      btnActivateLicense.disabled = false;
      return;
    }

    if (!key) {
      if (licenseErrorMsg) {
        licenseErrorMsg.innerText = "Vui lòng nhập License Key.";
        licenseErrorMsg.style.display = "block";
      }
      btnActivateLicense.disabled = false;
      return;
    }

    try {
      // Gọi API kích hoạt với cả Key và Tên/Email
      const result = await licensing.activateLicense(key, customerName);
      
      if (result.success) {
        // Lưu trạng thái đã kích hoạt thành công vào localStorage
        localStorage.setItem("sfx_licensed", "true");
        localStorage.setItem("sfx_license_key", key);
        localStorage.setItem("sfx_customer_name", customerName);
        localStorage.setItem("sfx_customer_email", customerName);
        
        // Chuyển đổi giao diện sang màn hình chính của plugin
        if (licenseScreen) licenseScreen.style.display = "none";
        if (mainAppContainer) mainAppContainer.style.display = "flex";
        
        initApp();
      } else {
        if (licenseErrorMsg) {
          licenseErrorMsg.innerText = result.message;
          licenseErrorMsg.style.display = "block";
        }
      }
    } catch (err) {
      console.error("Lỗi trong quá trình kích hoạt:", err);
      if (licenseErrorMsg) {
        licenseErrorMsg.innerText = "Lỗi mạng hoặc không thể kết nối tới server kích hoạt.";
        licenseErrorMsg.style.display = "block";
      }
    } finally {
      btnActivateLicense.disabled = false;
    }
  });
}

// Bắt đầu chạy check license khi nạp panel
checkLicense();
