const { app, core, imaging } = require("photoshop");
const { batchPlay } = require("photoshop").action;

// ══════════════════════════════════════════════
// OUTER GLOW COLOR EXTRACTION HELPERS
// ══════════════════════════════════════════════

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d) % 6;
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else if (max === b) {
      h = (r - g) / d + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function medianColor(candidates) {
  const rValues = candidates.map(c => c[0]).sort((a, b) => a - b);
  const gValues = candidates.map(c => c[1]).sort((a, b) => a - b);
  const bValues = candidates.map(c => c[2]).sort((a, b) => a - b);
  
  const getMedian = (arr) => {
    const mid = Math.floor(arr.length / 2);
    if (arr.length % 2 !== 0) {
      return arr[mid];
    }
    return Math.round((arr[mid - 1] + arr[mid]) / 2);
  };
  
  return {
    r: getMedian(rValues),
    g: getMedian(gValues),
    b: getMedian(bValues)
  };
}

function detectGlowBackgroundColors(pixelData, width, height, comp) {
  const borderPixels = [];
  const addPixel = (x, y) => {
    const idx = (y * width + x) * comp;
    borderPixels.push({
      r: pixelData[idx],
      g: comp >= 2 ? pixelData[idx + 1] : pixelData[idx],
      b: comp >= 3 ? pixelData[idx + 2] : pixelData[idx]
    });
  };

  for (let x = 0; x < width; x++) {
    addPixel(x, 0);
    addPixel(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    addPixel(0, y);
    addPixel(width - 1, y);
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

function isGlowBgPixel(r, g, b, bgColors) {
  for (const bg of bgColors) {
    const dr = r - bg.r;
    const dg = g - bg.g;
    const db = b - bg.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < 20) return true;
  }
  return false;
}


function extractGlowColor(pixelData, maskData, width, height, components) {
  const candidates = [];
  for (let i = 0; i < maskData.length; i++) {
    if (maskData[i] < 200) continue;
    const idx = i * components;
    const r = pixelData[idx], g = pixelData[idx + 1], b = pixelData[idx + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    candidates.push({ r, g, b, chroma: max - min });
  }

  if (candidates.length === 0) {
    throw new Error("Không tìm được vùng phát sáng — vui lòng thử điều chỉnh lại dải quét hoặc chọn vùng lõi khác.");
  }

  candidates.sort((a, b) => b.chroma - a.chroma);
  const topN = candidates.slice(0, Math.min(20, candidates.length));
  return medianColor(topN.map(c => [c.r, c.g, c.b]));
}

function rgbToHex(r, g, b) {
  const toHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

async function hasActiveSelection() {
  try {
    const result = await batchPlay([
      {
        _obj: "get",
        _target: [
          { _ref: "property", _property: "selection" },
          { _ref: "document", _enum: "ordinal", _value: "targetEnum" }
        ]
      }
    ], { synchronousExecution: true });
    return !!(result && result[0] && result[0].selection);
  } catch (e) {
    return false;
  }
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

async function runGlowPickWorkflow(scanStart, scanEnd, statusCallback) {
  statusCallback("Đang xử lý...", "info");
  let analysisSuccess = false;
  const doc = app.activeDocument;
  if (!doc) {
    statusCallback("Không tìm thấy document nào đang mở.", "error");
    return null;
  }
  
  if (doc.mode === "CMYKColorMode") {
    statusCallback("Ảnh đang ở CMYK — cần convert sang RGB trước khi dùng tool này.", "error");
    return null;
  }
  
  const sourceLayer = doc.activeLayers[0];
  if (!sourceLayer) {
    statusCallback("Hãy chọn layer nguồn trước.", "error");
    return null;
  }
  
  const hasSelection = await hasActiveSelection();
  if (!hasSelection) {
    statusCallback("Vui lòng tạo selection lõi chữ (bằng Magic Wand / Color Range) trước khi Pick.", "error");
    return null;
  }

  const selBounds = await getSelectionBoundsViaBatchPlay(doc);
  let colorResult = null;

  try {
    await core.executeAsModal(async () => {
      let innerMaskData = null;
      let innerBounds = null;

      // 1. Expand by scanStart if > 0, then capture inner selection
      if (scanStart > 0) {
        await batchPlay([
          { _obj: "expand", by: { _unit: "pixelsUnit", _value: scanStart } }
        ], { synchronousExecution: true });

        const innerSel = await imaging.getSelection({ documentID: doc.id });
        if (innerSel && innerSel.imageData) {
          try {
            const rawInnerBuffer = await innerSel.imageData.getData({ chunky: true });
            innerMaskData = new Uint8Array(rawInnerBuffer);
            innerBounds = innerSel.sourceBounds;
          } finally {
            innerSel.imageData.dispose();
          }
        }
      }

      let innerCount = 0;
      if (innerMaskData) {
        for (let i = 0; i < innerMaskData.length; i++) {
          if (innerMaskData[i] >= 200) innerCount++;
        }
      }
      console.log(`[Pick Glow] Inner Mask (scanStart=${scanStart}) pixel count (>=200): ${innerCount}`);

      // 2. Expand further from the current selection by (scanEnd - scanStart)
      const remainingExpand = scanEnd - scanStart;
      if (remainingExpand <= 0) {
        throw new Error("Outer Offset phải lớn hơn Inner Offset.");
      }

      await batchPlay([
        { _obj: "expand", by: { _unit: "pixelsUnit", _value: remainingExpand } }
      ], { synchronousExecution: true });

      const outerSel = await imaging.getSelection({ documentID: doc.id });
      if (!outerSel || !outerSel.imageData) {
        throw new Error("Không lấy được thông tin vùng chọn ngoài.");
      }

      let outerMaskData = null;
      let outerBounds = null;
      try {
        const rawOuterBuffer = await outerSel.imageData.getData({ chunky: true });
        outerMaskData = new Uint8Array(rawOuterBuffer);
        outerBounds = outerSel.sourceBounds;
      } finally {
        outerSel.imageData.dispose();
      }

      let outerCount = 0;
      if (outerMaskData) {
        for (let i = 0; i < outerMaskData.length; i++) {
          if (outerMaskData[i] >= 200) outerCount++;
        }
      }
      console.log(`[Pick Glow] Outer Mask (scanEnd=${scanEnd}) pixel count (>=200): ${outerCount}`);

      // 3. Read composite document pixels inside outerBounds
      const pixels = await imaging.getPixels({
        documentID: doc.id,
        sourceBounds: outerBounds,
        colorSpace: "RGB"
      });

      if (!pixels || !pixels.imageData) {
        throw new Error("Không thể đọc pixel từ document.");
      }

      try {
        const rawBuffer = await pixels.imageData.getData({ chunky: true });
        const pixelData = new Uint8Array(rawBuffer);
        const components = pixels.imageData.components || 3;

        const maskWidth = outerBounds.right - outerBounds.left;
        const maskHeight = outerBounds.bottom - outerBounds.top;

        // Helper to check if a pixel is inside the inner selection
        const isInInnerMask = (absX, absY) => {
          if (innerMaskData === null || innerBounds === null) {
            return false;
          }
          if (absX < innerBounds.left || absX >= innerBounds.right || absY < innerBounds.top || absY >= innerBounds.bottom) {
            return false;
          }
          const localX = absX - innerBounds.left;
          const localY = absY - innerBounds.top;
          const localIndex = localY * (innerBounds.right - innerBounds.left) + localX;
          return innerMaskData[localIndex] >= 200;
        };

        // Detect background colors of the cropped region
        const bgColors = detectGlowBackgroundColors(pixelData, maskWidth, maskHeight, components);

        // Loop through outerBounds pixels and extract candidates in the ring region
        const glowCandidates = [];
        const allCandidates = [];

        for (let y = 0; y < maskHeight; y++) {
          for (let x = 0; x < maskWidth; x++) {
            const pixelIndex = y * maskWidth + x;
            
            // Skip if not selected in outer selection
            if (outerMaskData[pixelIndex] < 200) continue;

            const absX = outerBounds.left + x;
            const absY = outerBounds.top + y;

            // Skip if inside inner selection (leaving only the ring area)
            if (isInInnerMask(absX, absY)) continue;

            const idx = pixelIndex * components;
            const r = pixelData[idx];
            const g = components >= 2 ? pixelData[idx + 1] : r;
            const b = components >= 3 ? pixelData[idx + 2] : r;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const chroma = max - min;
            
            const cand = { r, g, b, chroma };
            allCandidates.push(cand);

            if (!isGlowBgPixel(r, g, b, bgColors)) {
              glowCandidates.push(cand);
            }
          }
        }

        // Determine which list of candidates to use
        // If we found enough pixels that are different from the background, use them.
        // Otherwise, fallback to all candidates.
        const activeCandidates = glowCandidates.length >= 10 ? glowCandidates : allCandidates;

        if (activeCandidates.length === 0) {
          throw new Error("Không tìm được vùng phát sáng — vui lòng thử điều chỉnh lại dải quét hoặc chọn vùng lõi khác.");
        }

        // Sort candidates by chroma descending first to see if there are any chromatic pixels
        const sortedByChroma = [...activeCandidates].sort((a, b) => b.chroma - a.chroma);
        const checkIndex = Math.min(9, sortedByChroma.length - 1);
        const isAchromatic = checkIndex >= 0 ? sortedByChroma[checkIndex].chroma < 15 : true;

        let topN;
        if (isAchromatic) {
          // Achromatic glow (like white, grey, black)
          // Sort active candidates by brightness
          activeCandidates.sort((a, b) => {
            const lumA = 0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b;
            const lumB = 0.2126 * b.r + 0.7152 * b.g + 0.0722 * b.b;
            return lumA - lumB;
          });
          // Pick 20 pixels around the center of the sorted active candidates list
          // representing the median point of the glow transition
          const midIdx = Math.floor(activeCandidates.length / 2);
          const startIdx = Math.max(0, midIdx - 10);
          topN = activeCandidates.slice(startIdx, Math.min(activeCandidates.length, startIdx + 20));
        } else {
          // Chromatic glow: sort by chroma descending and pick the top N (brightest/most saturated colors)
          topN = sortedByChroma.slice(0, Math.min(20, sortedByChroma.length));
        }
        colorResult = medianColor(topN.map(c => [c.r, c.g, c.b]));

      } finally {
        pixels.imageData.dispose();
      }
    }, { commandName: "Hút màu Outer Glow từ ảnh phẳng" });

    analysisSuccess = true;
  } catch (err) {
    console.error("Pick error full object:", err);
    const errMsg = err?.message || err?.number || (typeof err === "string" ? err : JSON.stringify(err)) || "Không rõ nguyên nhân, xem console";
    statusCallback(`Lỗi: ${errMsg}`, "error");
  } finally {
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
  }

  if (colorResult) {
    statusCallback("Hút màu thành công!", "success");
    return colorResult;
  }
  return null;
}

function buildOuterGlow({ color, opacity, size, spread, range }) {
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  return {
    _obj: "outerGlow",
    enabled: true,
    present: true,
    showInDialog: true,
    mode: { _enum: "blendMode", _value: "normal" },
    color: { _obj: "RGBColor", red: color.r, green: color.g, blue: color.b },
    opacity: { _unit: "percentUnit", _value: clamp(opacity, 0, 100) },
    blur: { _unit: "pixelsUnit", _value: clamp(size, 0, 250) },
    chokeMatte: { _unit: "percentUnit", _value: clamp(spread, 0, 100) },
    technique: { _enum: "glowTechnique", _value: "softMatte" },
    inputRange: { _unit: "percentUnit", _value: clamp(range, 1, 100) },
    jitter: { _unit: "percentUnit", _value: 0 },
    antialiasGloss: false
  };
}

async function runGlowApplyWorkflow(glowState, statusCallback) {
  statusCallback("Đang áp dụng...", "info");
  try {
    if (!glowState.color) {
      throw new Error("Chưa Pick màu — bấm Pick trước.");
    }
    
    const doc = app.activeDocument;
    if (!doc) {
      throw new Error("Không có document nào đang mở.");
    }
    if (!doc.activeLayers || doc.activeLayers.length === 0) {
      throw new Error("Vui lòng chọn một layer đích trong Photoshop.");
    }
    
    const targetLayerId = doc.activeLayers[0].id;
    
    const current = await batchPlay(
      [{ _obj: "get", _target: [
          { _ref: "property", _property: "layerEffects" },
          { _ref: "layer", _id: targetLayerId }
      ]}],
      { synchronousExecution: true }
    );
    const existingFx = current?.[0]?.layerEffects || { _obj: "layerEffects" };

    const merged = {
      ...existingFx,
      outerGlow: buildOuterGlow(glowState)
    };

    await core.executeAsModal(async () => {
      await batchPlay(
        [{
          _obj: "set",
          _target: [
            { _ref: "property", _property: "layerEffects" },
            { _ref: "layer", _id: targetLayerId }
          ],
          to: merged
        }],
        {}
      );
    }, { commandName: "Áp dụng Outer Glow" });

    statusCallback("Áp dụng Outer Glow thành công!", "success");
  } catch (err) {
    console.error("Apply error full object:", err);
    const errMsg = err?.message || err?.number || (typeof err === "string" ? err : JSON.stringify(err)) || "Không rõ nguyên nhân, xem console";
    statusCallback(`Lỗi: ${errMsg}`, "error");
  }
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

module.exports = {
  runGlowPickWorkflow,
  runGlowApplyWorkflow,
  rgbToHex,
  hexToRgb
};
