const { app, core, imaging, constants } = require("photoshop");
const { batchPlay } = require("photoshop").action;

// ══════════════════════════════════════════════
// GRADIENT ANALYSIS FUNCTIONS
// ══════════════════════════════════════════════

function detectBackgroundColors(pixelData, imgW, imgH, comp) {
  const borderPixels = [];
  const totalBorderExpected = imgW * 2 + (imgH - 2) * 2;
  
  const addPixel = (x, y) => {
    const idx = (y * imgW + x) * comp;
    const alpha = comp === 4 ? pixelData[idx + 3] : (comp === 2 ? pixelData[idx + 1] : 255);
    if (alpha >= 30) {
      borderPixels.push({
        r: pixelData[idx],
        g: pixelData[idx + 1],
        b: pixelData[idx + 2]
      });
    }
  };

  for (let x = 0; x < imgW; x++) {
    addPixel(x, 0);
    addPixel(x, imgH - 1);
  }
  
  for (let y = 1; y < imgH - 1; y++) {
    addPixel(0, y);
    addPixel(imgW - 1, y);
  }

  if (borderPixels.length < totalBorderExpected * 0.5) {
    return [];
  }

  const bins = {};
  borderPixels.forEach(p => {
    const qr = Math.floor(p.r / 8) * 8;
    const qg = Math.floor(p.g / 8) * 8;
    const qb = Math.floor(p.b / 8) * 8;
    const key = `${qr},${qg},${qb}`;
    if (!bins[key]) {
      bins[key] = { rSum: 0, gSum: 0, bSum: 0, count: 0 };
    }
    bins[key].rSum += p.r;
    bins[key].gSum += p.g;
    bins[key].bSum += p.b;
    bins[key].count++;
  });

  const sortedBins = Object.values(bins).sort((a, b) => b.count - a.count);
  
  const bgColors = [];
  let accumulatedCount = 0;
  for (const bin of sortedBins) {
    bgColors.push({
      r: bin.rSum / bin.count,
      g: bin.gSum / bin.count,
      b: bin.bSum / bin.count
    });
    accumulatedCount += bin.count;
    if (accumulatedCount > borderPixels.length * 0.8) break;
  }
  
  return bgColors;
}

function isBgPixel(r, g, b, bgColors) {
  for (const bg of bgColors) {
    const dr = r - bg.r;
    const dg = g - bg.g;
    const db = b - bg.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    const bgLum = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b;
    const threshold = bgLum < 40 ? 18 : 30;
    if (dist < threshold) return true;
  }
  return false;
}

function extractPixels(pixelData, imgW, imgH, comp, bgColors = [], erodeRadius = 0) {
  const getSolidMask = (x, y) => {
    if (x < 0 || x >= imgW || y < 0 || y >= imgH) return false;
    const idx = (y * imgW + x) * comp;
    const alpha = comp === 4 ? pixelData[idx + 3] : (comp === 2 ? pixelData[idx + 1] : 255);
    if (alpha < 30) return false;
    
    const r = pixelData[idx], g = pixelData[idx + 1], b = pixelData[idx + 2];
    if (bgColors.length > 0 && isBgPixel(r, g, b, bgColors)) return false;
    return true;
  };

  const pixels = [];
  for (let y = 0; y < imgH; y++) {
    for (let x = 0; x < imgW; x++) {
      if (!getSolidMask(x, y)) continue;

      if (erodeRadius > 0) {
        let nearEdge = false;
        for (let dy = -erodeRadius; dy <= erodeRadius; dy++) {
          for (let dx = -erodeRadius; dx <= erodeRadius; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (dx * dx + dy * dy > erodeRadius * erodeRadius) continue; // Circle shape radius
            if (!getSolidMask(x + dx, y + dy)) {
              nearEdge = true;
              break;
            }
          }
          if (nearEdge) break;
        }
        if (nearEdge) continue; // Skip edge pixels
      }

      const idx = (y * imgW + x) * comp;
      const r = pixelData[idx], g = pixelData[idx + 1], b = pixelData[idx + 2];
      pixels.push({ x, y, r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b });
    }
  }
  return pixels;
}

function detectAngle(pixels) {
  if (pixels.length < 4) return 90;

  function calcVariance(deg) {
    const rad = deg * Math.PI / 180;
    const dx = Math.cos(rad), dy = -Math.sin(rad);

    let minP = Infinity, maxP = -Infinity;
    const projs = new Array(pixels.length);
    for (let i = 0; i < pixels.length; i++) {
      const t = pixels[i].x * dx + pixels[i].y * dy;
      projs[i] = t;
      if (t < minP) minP = t;
      if (t > maxP) maxP = t;
    }

    if (maxP === minP) return -1;

    const B = 10;
    const bandSums = new Float64Array(B);
    const bandCounts = new Uint32Array(B);
    const range = maxP - minP;

    for (let i = 0; i < projs.length; i++) {
      const b = Math.min(B - 1, Math.floor((projs[i] - minP) / range * B));
      bandSums[b] += pixels[i].lum;
      bandCounts[b]++;
    }

    let count = 0, sum = 0;
    const means = [];
    for (let b = 0; b < B; b++) {
      if (bandCounts[b] > 0) {
        const m = bandSums[b] / bandCounts[b];
        means.push(m);
        sum += m;
        count++;
      }
    }

    if (count < 2) return -1;

    const mu = sum / count;
    let variance = 0;
    for (let i = 0; i < means.length; i++) {
      variance += (means[i] - mu) ** 2;
    }
    return variance / count;
  }

  let bestAngle = 90, bestVar = -1;
  for (let deg = 0; deg < 180; deg += 10) {
    const v = calcVariance(deg);
    if (v > bestVar) { bestVar = v; bestAngle = deg; }
  }

  for (let deg = bestAngle - 15; deg <= bestAngle + 15; deg++) {
    const normalizedDeg = ((deg % 180) + 180) % 180;
    const v = calcVariance(normalizedDeg);
    if (v > bestVar) { bestVar = v; bestAngle = normalizedDeg; }
  }

  return bestAngle;
}

function pickStopsByPosition(pixels, k, angleDeg) {
  if (pixels.length < k) return pixels.map(p => ({ r: p.r, g: p.g, b: p.b }));

  const rad = angleDeg * Math.PI / 180;
  const dx = Math.cos(rad), dy = -Math.sin(rad);

  const proj = pixels.map(p => ({ ...p, t: p.x * dx + p.y * dy }));
  proj.sort((a, b) => a.t - b.t);

  const tMin = proj[0].t, tMax = proj[proj.length - 1].t;
  const tRange = tMax - tMin;
  if (tRange < 0.001) return [{ r: pixels[0].r, g: pixels[0].g, b: pixels[0].b }];

  const FINE = 120;
  const fine = Array.from({ length: FINE }, () => []);
  proj.forEach(p => {
    const i = Math.min(FINE - 1, Math.floor((p.t - tMin) / tRange * FINE));
    fine[i].push({ r: p.r, g: p.g, b: p.b });
  });

  const rawCurve = new Array(FINE);
  for (let i = 0; i < FINE; i++) {
    const bandPixels = fine[i];
    if (bandPixels.length === 0) {
      rawCurve[i] = null;
      continue;
    }

    // Sort pixels in this band by luminance (ascending)
    const sortedByLum = [...bandPixels].sort((a, b) => {
      const lumA = 0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b;
      const lumB = 0.2126 * b.r + 0.7152 * b.g + 0.0722 * b.b;
      return lumA - lumB;
    });

    // Adaptive percentile sampling:
    // For dark/black bands (median lum < 50), use median (50th percentile) so anti-aliasing edge highlights don't pull black to gray.
    // For bright bands (median lum > 150), use ~85th percentile to get clean highlight fill color without edge shadows.
    const medianIdx = Math.floor(sortedByLum.length * 0.5);
    const medianPixel = sortedByLum[medianIdx];
    const medianLum = 0.2126 * medianPixel.r + 0.7152 * medianPixel.g + 0.0722 * medianPixel.b;

    let targetPercentile = 0.5;
    if (medianLum >= 150) {
      targetPercentile = 0.85;
    } else if (medianLum > 50) {
      targetPercentile = 0.5 + 0.35 * ((medianLum - 50) / 100);
    }

    const targetIdx = Math.min(sortedByLum.length - 1, Math.floor(sortedByLum.length * targetPercentile));
    const chosenPixel = sortedByLum[targetIdx];

    let r = chosenPixel.r;
    let g = chosenPixel.g;
    let b = chosenPixel.b;

    // Black snapping helper: snap very dark colors (max RGB <= 12) to pure black (#000000)
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    if (maxVal <= 12) {
      r = 0;
      g = 0;
      b = 0;
    } else if (maxVal > 215 && (maxVal - minVal) < 22) {
      // White snapping helper: snap colors near top-left of color picker to pure white (#FFFFFF)
      r = 255;
      g = 255;
      b = 255;
    }

    rawCurve[i] = { t: (i + 0.5) / FINE, r, g, b };
  }

  for (let i = 1; i < FINE; i++) {
    if (!rawCurve[i] && rawCurve[i - 1]) {
      rawCurve[i] = { ...rawCurve[i - 1], t: (i + 0.5) / FINE };
    }
  }
  for (let i = FINE - 2; i >= 0; i--) {
    if (!rawCurve[i] && rawCurve[i + 1]) {
      rawCurve[i] = { ...rawCurve[i + 1], t: (i + 0.5) / FINE };
    }
  }

  const filledCurve = rawCurve.filter(c => c !== null);
  if (filledCurve.length < 2) return [{ r: pixels[0].r, g: pixels[0].g, b: pixels[0].b }];

  const W = 5;
  const half = Math.floor(W / 2);
  const smoothed = filledCurve.map((point, idx) => {
    // Preserve exact end points to avoid diluting start/end stop colors
    if (idx === 0 || idx === filledCurve.length - 1) {
      return { ...point };
    }
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let j = Math.max(0, idx - half); j <= Math.min(filledCurve.length - 1, idx + half); j++) {
      rSum += filledCurve[j].r; gSum += filledCurve[j].g; bSum += filledCurve[j].b;
      count++;
    }
    return { t: point.t, r: rSum / count, g: gSum / count, b: bSum / count };
  });

  return Array.from({ length: k }, (_, i) => {
    const lo = 0.0, hi = 1.0;
    const target = k === 1 ? 0.5 : lo + (i / (k - 1)) * (hi - lo);
    let best = smoothed[0], bestD = Infinity;
    for (const c of smoothed) {
      const d = Math.abs(c.t - target);
      if (d < bestD) { bestD = d; best = c; }
    }
    return { r: Math.round(best.r), g: Math.round(best.g), b: Math.round(best.b) };
  });
}

function buildAnalyzedStops(sorted) {
  const n = sorted.length;
  return sorted.map((c, i) => ({
    color: [
      Math.max(0, Math.min(255, Math.round(c.r))),
      Math.max(0, Math.min(255, Math.round(c.g))),
      Math.max(0, Math.min(255, Math.round(c.b)))
    ],
    pos: n === 1 ? 0.5 : i / (n - 1),
    selected: true
  }));
}

function rgbToHex(r, g, b) {
  r = Math.max(0, Math.min(255, Math.round(r)));
  g = Math.max(0, Math.min(255, Math.round(g)));
  b = Math.max(0, Math.min(255, Math.round(b)));
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

function hexToRgb(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function hexToPhotoshopRGB(hex) {
  if (!hex) {
    return { _obj: "RGBColor", red: 0, green: 0, blue: 0 };
  }
  let cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map(char => char + char).join("");
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return {
    _obj: "RGBColor",
    red: isNaN(r) ? 0 : r,
    green: isNaN(g) ? 0 : g,
    blue: isNaN(b) ? 0 : b
  };
}

async function showColorPickerUXP(defaultRGB) {
  const descriptor = {
    _obj: "showColorPicker",
    "Clr": {
      _obj: "RGBColor",
      Rd: defaultRGB.r,
      Grn: defaultRGB.g,
      Bl: defaultRGB.b
    }
  };

  try {
    const result = await batchPlay([descriptor], {
      dialogModes: "ALL"
    });

    if (result && result[0]) {
      const res = result[0];
      const colorObj = res.RGBFloatColor || res.RGBColor || res.Clr;
      if (colorObj) {
        const r = colorObj.red !== undefined ? colorObj.red : (colorObj.Rd !== undefined ? colorObj.Rd : 0);
        const g = colorObj.green !== undefined ? colorObj.green : (colorObj.grain !== undefined ? colorObj.grain : (colorObj.Grn !== undefined ? colorObj.Grn : 0));
        const b = colorObj.blue !== undefined ? colorObj.blue : (colorObj.Bl !== undefined ? colorObj.Bl : 0);
        return {
          r: Math.round(r),
          g: Math.round(g),
          b: Math.round(b)
        };
      }

      if (res.red !== undefined || res.Rd !== undefined || res.grain !== undefined) {
        const r = res.red !== undefined ? res.red : (res.Rd !== undefined ? res.Rd : 0);
        const g = res.green !== undefined ? res.green : (res.grain !== undefined ? res.grain : (res.Grn !== undefined ? res.Grn : 0));
        const b = res.blue !== undefined ? res.blue : (res.Bl !== undefined ? res.Bl : 0);
        return {
          r: Math.round(r),
          g: Math.round(g),
          b: Math.round(b)
        };
      }
    }
  } catch (e) {
    console.warn("Color picker cancelled or returned no color:", e);
  }
  return null;
}

function findLayerById(doc, id) {
  if (!doc || !id) return null;
  const check = (layers) => {
    for (const layer of layers) {
      if (layer.id === id) return layer;
      if (layer.layers && layer.layers.length > 0) {
        const found = check(layer.layers);
        if (found) return found;
      }
    }
    return null;
  };
  return check(doc.layers);
}

async function getSelectionBoundsViaBatchPlay(doc) {
  try {
    const result = await batchPlay([
      {
        _obj: "get",
        _target: [
          { _property: "selection" },
          { _ref: "document", _id: doc.id }
        ]
      }
    ], {});

    const sel = result && result[0] && result[0].selection;
    if (!sel) return null;

    const unwrap = (v) => (v && v._value !== undefined ? v._value : v);
    return {
      left: unwrap(sel.left),
      top: unwrap(sel.top),
      right: unwrap(sel.right),
      bottom: unwrap(sel.bottom)
    };
  } catch (e) {
    console.warn("getSelectionBoundsViaBatchPlay - no active selection:", e);
    return null;
  }
}

async function selectRectangle(doc, bounds) {
  try {
    await batchPlay([
      {
        _obj: "set",
        _target: [
          { _ref: "channel", _property: "selection" }
        ],
        to: {
          _obj: "rectangle",
          top: { _unit: "pixelsUnit", _value: bounds.top },
          left: { _unit: "pixelsUnit", _value: bounds.left },
          bottom: { _unit: "pixelsUnit", _value: bounds.bottom },
          right: { _unit: "pixelsUnit", _value: bounds.right }
        }
      }
    ], {});
  } catch (e) {
    console.warn("selectRectangle failed:", e);
  }
}

async function deselect(doc) {
  try {
    await batchPlay([
      {
        _obj: "set",
        _target: [
          { _ref: "channel", _property: "selection" }
        ],
        to: {
          _enum: "ordinal",
          _value: "none"
        }
      }
    ], {});
  } catch (e) {
    console.warn("deselect failed:", e);
  }
}

// ══════════════════════════════════════════════
// CORE WORKFLOWS
// ══════════════════════════════════════════════

async function runGradientPickWorkflow(statusCallback) {
  let analysisSuccess = false;
  const doc = app.activeDocument;
  if (!doc) {
    statusCallback("Không tìm thấy document nào đang mở.", "error");
    return null;
  }

  // Color Mode Check
  const docModeStr = String(doc.mode);
  const isRGB = (constants && constants.DocumentMode && doc.mode === constants.DocumentMode.RGB) || docModeStr === "RGBColorMode" || docModeStr === "RGB";
  if (!isRGB) {
    app.showAlert("Tool chỉ hỗ trợ hệ màu RGB. Vui lòng vào Image > Mode > RGB Color.");
    statusCallback("Lỗi: Hệ màu không hỗ trợ.", "error");
    return null;
  }

  // Bit Depth Check
  const bitDepthStr = String(doc.bitDepth || doc.bitsPerChannel);
  const is8Bit =
    (constants && constants.BitsPerChannelType && doc.bitsPerChannel === constants.BitsPerChannelType.EIGHT) ||
    bitDepthStr === "EIGHT" ||
    bitDepthStr === "8";

  if (!is8Bit) {
    app.showAlert("Tool chỉ hỗ trợ ảnh 8-bit/Channel. Vui lòng vào Image > Mode > 8 Bits/Channel.");
    statusCallback("Lỗi: Độ sâu màu không hỗ trợ.", "error");
    return null;
  }

  statusCallback("Đang thiết lập phân tích...", "info");

  const sourceLayer = doc.activeLayers[0];
  if (!sourceLayer) {
    statusCallback("Hãy chọn layer nguồn chứa màu gradient trước.", "error");
    return null;
  }

  try {
    if (sourceLayer.allLocked) {
      statusCallback("Layer đang bị khóa hoàn toàn. Vui lòng mở khóa trước khi phân tích.", "error");
      return null;
    }
  } catch (lockCheckErr) {
    console.warn("Could not check layer lock status:", lockCheckErr);
  }

  const selBounds = await getSelectionBoundsViaBatchPlay(doc);

  // Check if there is an active selection
  const hasSelection = (selBounds &&
      selBounds.left !== undefined &&
      selBounds.right !== undefined &&
      selBounds.top !== undefined &&
      selBounds.bottom !== undefined &&
      (selBounds.right - selBounds.left) > 0 &&
      (selBounds.bottom - selBounds.top) > 0);

  let targetBounds = null;

  if (hasSelection) {
    targetBounds = selBounds;
  } else {
    // If no selection, verify if sourceLayer has valid boundaries
    const layerBounds = sourceLayer.bounds;
    if (!layerBounds ||
        layerBounds.left === undefined ||
        layerBounds.right === undefined ||
        layerBounds.top === undefined ||
        layerBounds.bottom === undefined ||
        (layerBounds.right - layerBounds.left) <= 0 ||
        (layerBounds.bottom - layerBounds.top) <= 0) {
      statusCallback("Không có vùng chọn và layer được chọn không có pixel hợp lệ.", "error");
      app.showAlert("Vui lòng tạo vùng chọn hoặc chọn một layer có chứa hình ảnh/chữ.");
      return null;
    }
    targetBounds = {
      left: layerBounds.left,
      top: layerBounds.top,
      right: layerBounds.right,
      bottom: layerBounds.bottom
    };
  }

  let tempLayerParent = null;
  let tempLayer = null;
  let resultObject = null;

  try {
    await core.executeAsModal(async () => {
      if (hasSelection) {
        // Selection Mode (Logic cũ)
        tempLayerParent = await sourceLayer.duplicate();
        doc.activeLayers = [tempLayerParent];

        try {
          await batchPlay([
            {
              _obj: "rasterizeLayer",
              _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
              what: { _enum: "rasterizeItem", _value: "everything" }
            }
          ], {});
        } catch (rasterizeErr) {
          console.warn("Rasterize skipped (layer may already be rasterized):", rasterizeErr);
        }

        try {
          await batchPlay([
            {
              _obj: "copyToLayer",
              _options: { dialogOptions: "dontDisplay" }
            }
          ], {});
        } catch {
          throw new Error("Không thể sao chép vùng chọn. Vùng chọn trên layer này có thể bị rỗng.");
        }

        tempLayer = doc.activeLayers[0];
        if (!tempLayer || tempLayer.id === tempLayerParent.id) {
          throw new Error("Không thể sao chép vùng chọn. Vùng chọn có thể bị rỗng.");
        }
      } else {
        // Layer Mode (Logic mới)
        tempLayer = await sourceLayer.duplicate();
        doc.activeLayers = [tempLayer];

        try {
          await batchPlay([
            {
              _obj: "rasterizeLayer",
              _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
              what: { _enum: "rasterizeItem", _value: "everything" }
            }
          ], {});
        } catch (rasterizeErr) {
          console.warn("Rasterize skipped (layer may already be rasterized):", rasterizeErr);
        }

        // Use the rasterized layer bounds to get the final bounding box
        const dupBounds = tempLayer.bounds;
        if (dupBounds &&
            dupBounds.left !== undefined &&
            dupBounds.right !== undefined &&
            dupBounds.top !== undefined &&
            dupBounds.bottom !== undefined &&
            (dupBounds.right - dupBounds.left) > 0 &&
            (dupBounds.bottom - dupBounds.top) > 0) {
          targetBounds = {
            left: dupBounds.left,
            top: dupBounds.top,
            right: dupBounds.right,
            bottom: dupBounds.bottom
          };
        }
      }

      statusCallback("Đang đọc dữ liệu pixel...", "info");

      let pixelsObj = null;
      let pixelData = null;
      let components = 4;
      let width = 0;
      let height = 0;

      const hasImaging = (imaging && typeof imaging.getPixels === "function");

      if (hasImaging) {
        try {
          const getPixelsOpts = { 
            documentID: doc.id, 
            layerID: tempLayer.id,
            sourceBounds: targetBounds
          };

          try {
            pixelsObj = await imaging.getPixels({ ...getPixelsOpts, applyAlpha: true });
          } catch (alphaErr) {
            console.warn("getPixels with applyAlpha failed, retrying without:", alphaErr);
            pixelsObj = await imaging.getPixels(getPixelsOpts);
          }

          if (!pixelsObj || !pixelsObj.imageData) {
            throw new Error("imaging.getPixels trả về kết quả rỗng. Layer tạm có thể không chứa pixel nào.");
          }

          const imageData = pixelsObj.imageData;
          components = imageData.components || 4;
          width = imageData.width;
          height = imageData.height;

          if (!width || !height || width <= 0 || height <= 0) {
            throw new Error("Kích thước vùng ảnh không hợp lệ (" + width + "x" + height + ").");
          }

          let buffer;
          try {
            buffer = await imageData.getData({ chunky: true });
          } catch (getDataErr) {
            console.warn("getData({ chunky: true }) not supported, retrying without options:", getDataErr);
            buffer = await imageData.getData();
          }

          if (!buffer || buffer.byteLength === 0) {
            throw new Error("Dữ liệu pixel rỗng (buffer size = 0).");
          }

          pixelData = new Uint8Array(buffer);
        } catch (pixelReadErr) {
          if (pixelsObj && pixelsObj.imageData) {
            try { pixelsObj.imageData.dispose(); } catch (_) {}
            pixelsObj = null;
          }
          throw new Error("Lỗi đọc pixel: " + (pixelReadErr.message || String(pixelReadErr)));
        } finally {
          if (pixelsObj && pixelsObj.imageData) {
            try { pixelsObj.imageData.dispose(); } catch (_) {}
          }
        }
      } else {
        statusCallback("Đang đọc dữ liệu pixel (chế độ tương thích)...", "info");

        const bounds = tempLayer.bounds;
        const w = bounds.width !== undefined ? Math.round(bounds.width) : Math.round(bounds.right - bounds.left);
        const h = bounds.height !== undefined ? Math.round(bounds.height) : Math.round(bounds.bottom - bounds.top);

        if (!w || !h || w <= 0 || h <= 0) {
          throw new Error("Không xác định được kích thước vùng chọn.");
        }

        doc.activeLayers = [tempLayer];

        await batchPlay([
          {
            _obj: "set",
            _target: [{ _ref: "channel", _property: "selection" }],
            to: { _ref: "channel", _enum: "channel", _value: "transparencyEnum" }
          }
        ], {});

        await batchPlay([{ _obj: "copy" }], {});

        try {
          await batchPlay([
            {
              _obj: "set",
              _target: [{ _ref: "channel", _property: "selection" }],
              to: { _enum: "ordinal", _value: "none" }
            }
          ], {});
        } catch (_) {}

        const newDoc = await app.documents.add({
          width: w,
          height: h,
          resolution: doc.resolution || 72,
          mode: "RGBColorMode",
          fill: "transparent"
        });

        try {
          await batchPlay([{ _obj: "paste" }], {});

          const uxp = require("uxp");
          const fs = uxp.storage.localFileSystem;
          const tempFolder = await fs.getTemporaryFolder();
          const tempFile = await tempFolder.createFile("temp_gradient_fallback.png", { overwrite: true });

          await newDoc.saveAs.png(tempFile, {}, true);

          const arrayBuffer = await tempFile.read({ format: uxp.storage.formats.binary });
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            throw new Error("Không thể đọc file ảnh tạm.");
          }

          const blob = new Blob([arrayBuffer], { type: 'image/png' });
          const objectUrl = URL.createObjectURL(blob);

          const img = new Image();
          const imgData = await new Promise((resolve, reject) => {
            img.onload = () => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                const data = ctx.getImageData(0, 0, img.width, img.height);
                URL.revokeObjectURL(objectUrl);
                resolve(data);
              } catch (canvasErr) {
                reject(canvasErr);
              }
            };
            img.onerror = (imgErr) => {
              reject(new Error("Lỗi load ảnh vào canvas: " + String(imgErr)));
            };
            img.src = objectUrl;
          });

          width = imgData.width;
          height = imgData.height;
          pixelData = new Uint8Array(imgData.data.buffer);
          components = 4;

          try {
            await tempFile.delete();
          } catch (_) {}

        } finally {
          let saveOption = 2;
          if (constants && constants.SaveOptions && constants.SaveOptions.DONOTSAVECHANGES) {
            saveOption = constants.SaveOptions.DONOTSAVECHANGES;
          }
          await newDoc.close(saveOption);
        }
      }

      statusCallback("Đang trích xuất lõi Gradient & viền Stroke...", "info");

      const getAlpha = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0;
        const idx = (y * width + x) * components;
        if (components === 4) return pixelData[idx + 3];
        if (components === 2) return pixelData[idx + 1];
        return 255;
      };

      const getPixelRGB = (x, y) => {
        const idx = (y * width + x) * components;
        if (components >= 3) {
          return [pixelData[idx], pixelData[idx + 1], pixelData[idx + 2]];
        }
        return [pixelData[idx], pixelData[idx], pixelData[idx]];
      };

      const bgColors = detectBackgroundColors(pixelData, width, height, components);

      // Check if the layer has meaningful transparency (alpha channel).
      // Text layers after rasterize→copyToLayer have transparency → alpha
      // perfectly separates text from background, no color-based bg filtering needed.
      // This preserves white fill pixels that would otherwise be lost.
      // Opaque layers (artwork/scans) need bg color filtering as a fallback.
      let hasTransparency = false;
      if (components === 4) {
        let transparentCount = 0;
        const totalPixels = width * height;
        for (let i = 0; i < totalPixels; i++) {
          if (pixelData[i * components + 3] < 128) transparentCount++;
        }
        hasTransparency = transparentCount > totalPixels * 0.05;
      }

      const bgColorsToUse = hasTransparency ? [] : bgColors;

      // Extract pixels with adaptive erosion to remove stroke/edge colors.
      // Use radius 1 as the default to safely clean anti-aliased edge pixels without erasing thin letters.
      // Fallback to radius 0 if the selection is extremely small.
      let pixelsForGradient = extractPixels(pixelData, width, height, components, bgColorsToUse, 1);
      if (pixelsForGradient.length < 4) {
        pixelsForGradient = extractPixels(pixelData, width, height, components, bgColorsToUse, 0);
      }

      if (pixelsForGradient.length < 4) {
        throw new Error("Không đủ pixel hợp lệ trong vùng chọn (alpha > 30). Hãy thử chọn vùng rộng hơn chứa màu gradient.");
      }

      // Use the cleaned pixels for more accurate angle detection (less outline/shape bias)
      const detectedAngleDeg = detectAngle(pixelsForGradient);

      const k = 4;
      const sorted = pickStopsByPosition(pixelsForGradient, k, detectedAngleDeg);

      if (sorted.length < 2) {
        throw new Error("Không đủ màu để tạo gradient. Vùng chọn có thể chỉ chứa 1 màu.");
      }

      const analyzedStops = buildAnalyzedStops(sorted);

      resultObject = {
        analyzedStops,
        detectedAngleDeg
      };

    }, { commandName: "Trích xuất Gradient & Stroke" });

    analysisSuccess = true;
  } catch (err) {
    console.error("=== PIXEL ANALYSIS ERROR ===");
    console.error(err);
    const errorMsg = err.message || String(err) || "Lỗi không xác định khi phân tích pixel.";
    statusCallback(errorMsg, "error");
    app.showAlert(errorMsg);
  } finally {
    if (sourceLayer) {
      try {
        await core.executeAsModal(async () => {
          app.activeDocument.activeLayers = [sourceLayer];
        }, { commandName: "Khôi phục layer nguồn" });
      } catch (e) {
        console.error("Lỗi khôi phục layer nguồn:", e);
      }
    }

    if (analysisSuccess) {
      try {
        await core.executeAsModal(async () => {
          await deselect(doc);
        }, { commandName: "Bỏ chọn vùng chọn" });
      } catch (e) {
        console.warn("Lỗi bỏ chọn vùng chọn:", e);
      }
    } else if (selBounds) {
      try {
        await core.executeAsModal(async () => {
          await selectRectangle(doc, selBounds);
        }, { commandName: "Khôi phục vùng chọn" });
      } catch (e) {
        console.warn("Lỗi khôi phục vùng chọn:", e);
      }
    }

    if (tempLayer) {
      try {
        const exists = findLayerById(doc, tempLayer.id);
        if (exists) {
          await core.executeAsModal(async () => {
            await exists.delete();
          }, { commandName: "Dọn dẹp layer tạm" });
        }
      } catch (cleanErr) {
        console.warn("Cleanup tempLayer failed:", cleanErr);
      }
    }

    if (tempLayerParent) {
      try {
        const exists = findLayerById(doc, tempLayerParent.id);
        if (exists) {
          await core.executeAsModal(async () => {
            await exists.delete();
          }, { commandName: "Dọn dẹp layer cha tạm" });
        }
      } catch (cleanErr2) {
        console.warn("Cleanup tempLayerParent failed:", cleanErr2);
      }
    }
  }

  return resultObject;
}

const GRADIENT_TYPE_MAP = {
  "linear": "linear",
  "radial": "radial",
  "angle": "angle",
  "reflected": "reflected",
  "diamond": "diamond"
};

async function applyGradientWorkflow(options, statusCallback) {
  const {
    analyzedStops,
    currentType,
    currentAngleValue,
    enableStroke,
    strokeColorHex,
    strokeSizeValue,
    opacity
  } = options;

  if (!analyzedStops || analyzedStops.length === 0) {
    statusCallback("Chưa có dữ liệu gradient. Vui lòng phân tích trước.", "error");
    return;
  }

  const selectedStops = analyzedStops.filter(stop => stop.selected !== false);
  if (selectedStops.length === 0) {
    statusCallback("Vui lòng chọn ít nhất 1 màu để áp dụng.", "error");
    return;
  }

  let finalStops = [...selectedStops];
  if (finalStops.length === 1) {
    finalStops = [
      { color: [...finalStops[0].color], pos: 0.0 },
      { color: [...finalStops[0].color], pos: 1.0 }
    ];
  } else {
    const minPos = finalStops[0].pos;
    const maxPos = finalStops[finalStops.length - 1].pos;
    const range = maxPos - minPos || 1;
    finalStops = finalStops.map(stop => ({
      color: [...stop.color],
      pos: (stop.pos - minPos) / range
    }));
  }

  const doc = app.activeDocument;
  if (!doc) {
    statusCallback("Không tìm thấy document nào đang mở.", "error");
    return;
  }

  const targetLayer = doc.activeLayers[0];
  if (!targetLayer) {
    statusCallback("Vui lòng chọn layer mục tiêu.", "error");
    return;
  }

  if (targetLayer.kind !== "text") {
    statusCallback("Lưu ý: Layer được chọn không phải Text Layer. Vẫn áp dụng...", "info");
  } else {
    statusCallback("Đang áp dụng hiệu ứng Gradient & Stroke...", "info");
  }

  const normalizedAngle = ((currentAngleValue % 360) + 360) % 360;
  const angleForPS = normalizedAngle > 180 ? normalizedAngle - 360 : normalizedAngle;
  const photoshopGradientType = GRADIENT_TYPE_MAP[currentType] || "linear";

  try {
    await core.executeAsModal(async () => {
      const colorsDescriptor = finalStops.map(stop => ({
        _obj: "colorStop",
        color: {
          _obj: "RGBColor",
          red: stop.color[0],
          green: stop.color[1],
          blue: stop.color[2]
        },
        type: { _enum: "colorStopType", _value: "userStop" },
        location: Math.round(stop.pos * 4096),
        midpoint: { _unit: "percentUnit", _value: 50 }
      }));

      const transparencyDescriptor = [
        {
          _obj: "opacityStop",
          opacity: { _unit: "percentUnit", _value: 100 },
          type: { _enum: "colorStopType", _value: "userStop" },
          location: 0,
          midpoint: { _unit: "percentUnit", _value: 50 }
        },
        {
          _obj: "opacityStop",
          opacity: { _unit: "percentUnit", _value: 100 },
          type: { _enum: "colorStopType", _value: "userStop" },
          location: 4096,
          midpoint: { _unit: "percentUnit", _value: 50 }
        }
      ];

      const gradientFill = {
        _obj: "gradientFill",
        enabled: true,
        mode: { _enum: "blendMode", _value: "normal" },
        opacity: { _unit: "percentUnit", _value: opacity !== undefined ? opacity : 100 },
        scale: { _unit: "percentUnit", _value: 100 },
        type: { _enum: "gradientType", _value: photoshopGradientType },
        gradient: {
          _obj: "gradient",
          name: "Extracted Gradient",
          gradientForm: { _enum: "gradientForm", _value: "customStops" },
          colors: colorsDescriptor,
          transparency: transparencyDescriptor
        }
      };

      const needsAngleBoolean = (photoshopGradientType !== "radial");
      if (needsAngleBoolean) {
        gradientFill.angle = { _unit: "angleUnit", _value: angleForPS };
      }

      let existingEffects = { _obj: "layerEffects" };
      try {
        const effectsResult = await batchPlay([
          {
            _obj: "get",
            _target: [
              { _ref: "property", _property: "layerEffects" },
              { _ref: "layer", _id: targetLayer.id }
            ]
          }
        ], {});
        if (effectsResult && effectsResult[0] && effectsResult[0].layerEffects) {
          existingEffects = effectsResult[0].layerEffects;
        }
      } catch (fxErr) {
        console.warn("Could not read existing layer effects, using fresh descriptor:", fxErr);
      }

      // Helper function to recursively clean metadata keys like 'present', 'showInDialog', and UXP-specific '_class'
      const cleanDescriptor = (obj) => {
        if (obj === null || typeof obj !== "object") {
          return obj;
        }
        if (Array.isArray(obj)) {
          return obj.map(cleanDescriptor);
        }
        const cleaned = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Remove read-only properties
            if (key === "present" || key === "showInDialog" || key === "presentInDescriptor") {
              continue;
            }
            // Remove keys starting with '_' unless they are standard action value fields
            if (key.startsWith("_") && key !== "_obj" && key !== "_enum" && key !== "_unit" && key !== "_value") {
              continue;
            }
            cleaned[key] = cleanDescriptor(obj[key]);
          }
        }
        return cleaned;
      };

      const cleanedEffects = cleanDescriptor(existingEffects);

      // Clean up disabled sub-effects (both single-object properties and Multi-effect arrays)
      // to avoid cluttering the Photoshop Layers panel with unused/disabled effects
      for (const effectKey in cleanedEffects) {
        const val = cleanedEffects[effectKey];
        if (val && typeof val === "object") {
          if (Array.isArray(val)) {
            // Filter and keep only the items inside the Multi-effect array that are enabled
            const enabledItems = val.filter(item => item && item.enabled === true);
            if (enabledItems.length > 0) {
              cleanedEffects[effectKey] = enabledItems;
            } else {
              delete cleanedEffects[effectKey]; // Delete the array property completely if no sub-effects are active
            }
          } else {
            // For standard single-object effects
            if (val.enabled === false) {
              delete cleanedEffects[effectKey];
            }
          }
        }
      }

      // Force root type to be layerEffects, which is required for ActionManager SET to succeed
      cleanedEffects._obj = "layerEffects";

      // Merge/overwrite gradientFill (Gradient Overlay) - supports both legacy single and modern Multi-effect arrays
      if (cleanedEffects.gradientFillMulti) {
        cleanedEffects.gradientFillMulti = [gradientFill];
        delete cleanedEffects.gradientFill; // Avoid potential conflicts by removing the single key
      } else {
        cleanedEffects.gradientFill = gradientFill;
      }

      // Merge/overwrite frameFX (Stroke)
      const strokeWidthValue = parseInt(strokeSizeValue, 10) || 3;
      const photoshopColor = hexToPhotoshopRGB(strokeColorHex);

      const frameFX = {
        _obj: "frameFX",
        enabled: enableStroke,
        style: { _enum: "frameStyle", _value: "outF" }, // Outside
        paintType: { _enum: "frameFill", _value: "solidColor" }, // Correct enum name frameFill
        mode: { _enum: "blendMode", _value: "normal" },
        opacity: { _unit: "percentUnit", _value: 100 },
        size: { _unit: "pixelsUnit", _value: strokeWidthValue },
        color: photoshopColor
      };

      if (cleanedEffects.frameFXMulti) {
        cleanedEffects.frameFXMulti = [frameFX];
        delete cleanedEffects.frameFX; // Avoid potential conflicts by removing the single key
      } else {
        cleanedEffects.frameFX = frameFX;
      }

      const descriptor = {
        _obj: "set",
        _target: [
          { _ref: "property", _property: "layerEffects" },
          { _ref: "layer", _id: targetLayer.id }
        ],
        to: cleanedEffects
      };

      await batchPlay([descriptor], {});
    }, { commandName: "Áp dụng Gradient & Stroke" });

    statusCallback("Đã áp dụng Gradient & Stroke thành công!", "success");
  } catch (err) {
    console.error(err);
    statusCallback("Thất bại khi áp dụng Gradient & Stroke: " + (err.message || err), "error");
  }
}

module.exports = {
  runGradientPickWorkflow,
  applyGradientWorkflow,
  showColorPickerUXP,
  rgbToHex,
  hexToRgb
};
