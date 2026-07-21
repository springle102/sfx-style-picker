/**
 * CLIENT LICENSING MODULE (Photoshop UXP Plugin - Vanilla JS)
 * Chịu trách nhiệm lấy Device ID ảo, lưu trữ và gửi request kích hoạt lên GAS.
 */

/**
 * 1. TỰ SINH UUID V4 THUẦN JS (Không dùng thư viện ngoài)
 * Định dạng chuẩn UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * Trong đó 'x' là ký tự hexa ngẫu nhiên, 'y' là một trong các giá trị [8, 9, a, b].
 * 
 * @returns {string} Mã UUID v4 ngẫu nhiên
 */
function generateUUID() {
  // Kiểm tra xem môi trường có hỗ trợ crypto API hiện đại không
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback dùng Math.random nếu chạy trong môi trường cũ
  let d = new Date().getTime();
  let d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0; // Thời gian độ phân giải cao
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 2. LẤY HOẶC TẠO DEVICE ID ẢO (Machine-Lock)
 * Kiểm tra trong localStorage xem đã lưu Device ID chưa.
 * - Nếu chưa: Tạo mới một UUID v4, lưu vào localStorage và trả về.
 * - Nếu có rồi: Đọc trực tiếp từ localStorage và trả về.
 * 
 * @returns {string} Device ID duy nhất của máy này
 */
function getDeviceID() {
  const STORAGE_KEY = 'sfx_device_id';
  try {
    let deviceId = localStorage.getItem(STORAGE_KEY);
    
    if (!deviceId) {
      deviceId = generateUUID();
      localStorage.setItem(STORAGE_KEY, deviceId);
      console.log(`[License] Đã tạo Device ID mới cho thiết bị này: ${deviceId}`);
    } else {
      console.log(`[License] Đã đọc Device ID sẵn có: ${deviceId}`);
    }
    
    return deviceId;
  } catch (error) {
    console.error('[License] Không thể truy cập localStorage để đọc/ghi Device ID:', error);
    // Trả về một ID ngẫu nhiên tạm thời nếu localStorage bị chặn
    return generateUUID();
  }
}

const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbw3WpIMld_Khsws2TJk3f5X5nMmfRizwc25dLSVJc7Db5jjD7oexAidrT7FrwjfFoOHkw/exec";

/**
 * 3. GỌI API KÍCH HOẠT LICENSE KEY
 * Gửi request POST lên Google Apps Script Web App URL với Payload:
 * { "key": "Mã_Key", "name": "Thông_Tin_Liên_Hệ", "email": "Thông_Tin_Liên_Hệ", "device_id": "Mã_Thiết_Bị" }
 * 
 * @param {string} licenseKey Key kích hoạt do khách hàng nhập vào
 * @param {string} customerName Tên hoặc Email của khách hàng khi kích hoạt
 * @param {string} gasAppUrl Đường dẫn URL Web App của Google Apps Script
 * @returns {Promise<Object>} Trả về object kết quả { success: boolean, message: string }
 */
async function activateLicense(licenseKey, customerName, gasAppUrl = DEFAULT_GAS_URL) {
  if (!licenseKey || !licenseKey.trim()) {
    return { success: false, code: 'EMPTY_KEY', message: 'Vui lòng nhập License Key.' };
  }

  if (!customerName || !customerName.trim()) {
    return { success: false, code: 'EMPTY_NAME', message: 'Vui lòng nhập tên hoặc email của bạn.' };
  }
  
  if (!gasAppUrl) {
    return { success: false, code: 'MISSING_URL', message: 'Thiếu cấu hình Server URL kích hoạt.' };
  }

  const deviceId = getDeviceID();
  const payload = {
    key: licenseKey.trim(),
    name: customerName.trim(),
    email: customerName.trim(), // Gửi song song để tương thích hoàn toàn hệ thống cũ và mới
    device_id: deviceId
  };

  console.log(`[License] Đang gửi request kích hoạt tới Server...`, payload);

  try {
    const response = await fetch(gasAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain' // Tránh CORS Preflight (OPTIONS) của Google Apps Script
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[License] Kết quả phản hồi từ Server:`, result);

    if (result.status === 'SUCCESS') {
      console.log('✅ Kích hoạt License thành công!');
      return { 
        success: true, 
        message: 'Kích hoạt thành công!' 
      };
    } else if (result.status === 'ERROR') {
      if (result.code === 'ALREADY_USED_ON_OTHER_DEVICE') {
        console.error('❌ Lỗi kích hoạt: Key đã được sử dụng ở thiết bị khác.');
        const uiMessage = "Key này đã được kích hoạt trên một thiết bị khác. Vui lòng sử dụng key mới hoặc liên hệ dev để hỗ trợ.";
        return { 
          success: false, 
          code: 'ALREADY_USED_ON_OTHER_DEVICE', 
          message: uiMessage 
        };
      } else if (result.code === 'INVALID_KEY') {
        console.error('❌ Lỗi kích hoạt: Key không hợp lệ.');
        const uiMessage = "License Key không hợp lệ. Vui lòng kiểm tra lại!";
        return { 
          success: false, 
          code: 'INVALID_KEY', 
          message: uiMessage 
        };
      } else {
        console.error(`❌ Lỗi kích hoạt không xác định: ${result.code}`);
        return { 
          success: false, 
          code: result.code || 'UNKNOWN_ERROR', 
          message: `Lỗi kích hoạt: ${result.code || 'Unknown error'}` 
        };
      }
    }
  } catch (error) {
    console.error('❌ Lỗi kết nối mạng khi gọi API kích hoạt:', error);
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: 'Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra kết nối mạng của bạn.'
    };
  }
}

/**
 * 4. GỌI API KIỂM TRA LẠI LICENSE (BACKGROUND CHECK)
 * @param {string} licenseKey
 * @param {string} gasAppUrl
 * @returns {Promise<Object>}
 */
async function validateLicense(licenseKey, gasAppUrl = DEFAULT_GAS_URL) {
  if (!licenseKey || !licenseKey.trim()) {
    return { valid: false, code: 'EMPTY_KEY', message: 'License Key trống.' };
  }

  const deviceId = getDeviceID();
  const payload = {
    action: 'validate',
    key: licenseKey.trim(),
    device_id: deviceId
  };

  try {
    const response = await fetch(gasAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return { valid: true };
    }

    const result = await response.json();
    if (result.status === 'SUCCESS' && result.valid) {
      return { valid: true };
    } else {
      return { 
        valid: false, 
        code: result.code || 'INVALID_KEY', 
        message: result.message || 'License Key không còn tồn tại hoặc đã bị khóa từ hệ thống.' 
      };
    }
  } catch (error) {
    console.warn('[License] Validation offline mode, keeping current session:', error);
    return { valid: true };
  }
}

// Export cho UXP
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getDeviceID,
    activateLicense,
    validateLicense,
    generateUUID
  };
}
