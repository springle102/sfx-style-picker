# SFX Style Picker - Photoshop UXP Plugin

**SFX Style Picker** là một plugin Photoshop UXP (Unified Extensibility Platform) mạnh mẽ, giúp các nhà thiết kế nhanh chóng trích xuất các dải màu Gradient, viền Stroke và hiệu ứng phát sáng Outer Glow từ bất kỳ hình ảnh hoặc tài nguyên thiết kế nào trên Canvas, sau đó áp dụng trực tiếp lên các Layer mục tiêu (như Text Layer, Shape Layer) dưới dạng Layer Style chỉ với một vài thao tác đơn giản.

---

## 1. Yêu cầu cấu hình hệ thống

Để cài đặt và sử dụng plugin **SFX Style Picker**, hệ thống của bạn cần đáp ứng các yêu cầu tối thiểu sau:

*   **Phần mềm:** Adobe Photoshop phiên bản **24.0.0 (Photoshop 2023)** trở lên.
*   **Hệ điều hành:** Hỗ trợ đầy đủ trên cả **Windows** và **macOS** (tương thích với các phiên bản Photoshop chạy trên hệ điều hành này).
*   **Thiết lập Tài liệu (Document Settings) khi trích xuất màu:**
    *   **Hệ màu (Color Mode):** Bắt buộc sử dụng hệ màu **RGB** (*Image > Mode > RGB Color*).
    *   **Độ sâu màu (Bit Depth):** Bắt buộc sử dụng **8-bit/Channel** (*Image > Mode > 8 Bits/Channel*).

---

## 2. Hướng dẫn cài đặt

Plugin được đóng gói sẵn dưới dạng file cài đặt chuẩn `.ccx`. Bạn có thể cài đặt dễ dàng theo các bước sau:

1. Đảm bảo ứng dụng **Adobe Creative Cloud Desktop** đã được cài đặt trên máy tính.
2. Nhấp đúp chuột vào file `sfx-style-picker_PS.ccx`.
3. Ứng dụng Adobe Creative Cloud sẽ tự động bật lên và hiển thị hộp thoại xác nhận.
4. Chọn **Install** (hoặc **Install locally**).
5. Mở Photoshop và truy cập vào thanh menu: **Plugins > SFX Style Picker** để bắt đầu sử dụng.

---

## 3. Hướng dẫn kích hoạt bản quyền (License Activation)

Khi mở plugin lần đầu tiên, giao diện kích hoạt bản quyền sẽ hiển thị:

1. **Nhập thông tin cá nhân:** Điền Tên hoặc Email của bạn vào ô *"Nhập tên hoặc email của bạn..."*.
2. **Nhập License Key:** Dán mã License Key bạn đã được cấp vào ô nhập key.
3. **Kích hoạt:** Nhấn nút **Kích hoạt ngay**. Plugin sẽ tự động xác thực và mở khóa toàn bộ tính năng sử dụng.

---

## 4. Hướng dẫn sử dụng

### A. Chế độ trích xuất Gradient & Stroke (Tab Gradient)

1. **Chuẩn bị vùng chọn:**
   * Chọn layer nguồn chứa dải màu gradient trên bảng Layer của Photoshop.
   * Sử dụng công cụ tạo vùng chọn (ví dụ: *Rectangular Marquee Tool*) để khoanh vùng khu vực chứa dải gradient bạn muốn lấy màu.
2. **Trích xuất màu:**
   * Trên panel của plugin, chọn tab **Gradient**.
   * Nhấn nút **Pick Gradient**.
   * Plugin sẽ tự động tính toán góc nghiêng của gradient, lọc màu nền nhiễu và phân tích ra tối đa 4 điểm màu (Stops) xuất hiện trên thanh **Preview**.
3. **Cấu hình tùy chọn:**
   * **Stops List:** Cho phép bạn bật/tắt (check/uncheck) từng stop màu, hoặc click vào chỉ báo màu để chọn lại màu thông qua bảng Color Picker của Photoshop.
   * **Style Gradient:** Chọn kiểu gradient mong muốn (*Linear, Radial, Angle, Reflected, Diamond*).
   * **Angle (Góc):** Kéo vòng quay trực quan hoặc nhập góc cụ thể để thay đổi hướng dải màu.
   * **Stroke (Viền):** Tích hợp checkbox cho phép bật/tắt nhanh việc áp dụng Stroke lên layer (mặc định được bật). Khi bật, bạn có thể click vào ô màu viền để chọn màu qua Color Picker hoặc điền độ dày viền (px) để tùy chỉnh.
   * **Opacity Gradient:** Điều chỉnh độ mờ đục của dải màu.
4. **Áp dụng:**
    * Chọn layer đích (ví dụ: Text layer hoặc Vector Shape layer) trong Photoshop.
    * Nhấn nút **Apply to layer** để áp dụng hiệu ứng lên layer đó.

---

### B. Chế độ trích xuất Outer Glow (Tab Outer Glow)

1. **Chuẩn bị vùng chọn lõi:**
   * Chọn layer nguồn chứa vật thể phát sáng (chữ neon, hiệu ứng lửa, v.v.).
   * Dùng công cụ chọn màu (như *Magic Wand* hoặc *Select > Color Range*) để tạo vùng chọn xung quanh **lõi** của vật thể phát sáng đó (không chọn vùng phát sáng bên ngoài).
2. **Thiết lập phạm vi quét:**
   * **Bắt đầu quét (Inner Offset):** Khoảng cách bắt đầu quét màu tính từ biên vùng chọn ban đầu ra ngoài (mặc định là `3px`, giúp bỏ qua phần viền đục của lõi).
   * **Kết thúc quét (Outer Offset):** Khoảng cách kết thúc quét màu (mặc định `9px`). Khoảng giữa hai thông số này sẽ là vùng mà plugin quét để phân tích màu phát sáng.
3. **Thiết lập/Hút màu phát sáng:**
   * **Cách 1 - Hút màu tự động:** Nhấn nút **Pick Glow Color**. Plugin sẽ tự lọc và trích xuất ra màu phát sáng đặc trưng nhất trong dải quét của bạn.
   * **Cách 2 - Chọn màu thủ công:** Sử dụng ô swatch màu **"Màu phát sáng"** hoặc click trực tiếp vào hình tròn màu ở khung Preview để chọn màu qua Color Picker native của Photoshop.
4. **Điều chỉnh thông số áp dụng:**
   * **Size:** Kích thước vùng phát sáng (0 - 250px).
   * **Spread:** Độ lan tỏa của hiệu ứng (0 - 100%).
   * **Range (Độ mịn):** Độ mịn/mượt của hiệu ứng (1 - 100%).
   * **Opacity:** Độ mờ đục của hiệu ứng phát sáng.
5. **Áp dụng:**
   * Chọn layer đích trong Photoshop và nhấn **Apply to layer**.

---

## 5. Các chức năng chính (Ưu điểm & Nhược điểm)

### Các chức năng chính
* **Tự động nhận diện & trích xuất Gradient:** Phân tích pixel và sắp xếp các điểm dừng màu (Color Stops) theo đúng vị trí phân bố của chúng trên trục gradient.
* **Tự động tính toán góc nghiêng:** Thuật toán dựa trên độ biến thiên độ sáng (luminance variance) để phát hiện góc xoay của gradient nguyên bản.
* **Bộ lọc màu nền thông minh:** Tự động phát hiện và loại bỏ các pixel thuộc nền biên vùng chọn để tránh làm sai lệch màu gradient cần lấy.
* **Trích xuất màu Glow vùng biên:** Quét màu phát sáng bằng kỹ thuật giãn nở vùng chọn hai lớp (Inner & Outer Offset).
* **Đồng bộ Layer Style:** Áp dụng hiệu ứng trực tiếp dưới dạng Layer Effects (`gradientFill` và `outerGlow`) giữ nguyên thuộc tính layer gốc của Photoshop (chữ vẫn chỉnh sửa được font, nội dung, shape vẫn co giãn vector được).
* **Bật/tắt nhanh Stroke:** Checkbox tắt/mở nhanh Stroke giúp tùy chọn thêm hoặc không thêm viền dễ dàng.
* **Xem trước trực quan (Live Preview):** Hiển thị thanh màu Gradient hoặc vòng phát sáng thời gian thực ngay trên panel giao diện trước khi áp dụng.

### Ưu điểm
* ⚡ **Tiết kiệm thời gian vượt trội:** Thay thế quy trình hút màu thủ công tẻ nhạt bằng một cú click chuột duy nhất.
* 🎯 **Độ chính xác cao:** Thuật toán phân tích toán học giúp bắt đúng góc gradient và màu phát sáng thực tế từ hình ảnh phẳng.
* 🎨 **Giao diện hiện đại, dễ tương tác:** Hỗ trợ vòng xoay góc (angle dial) mượt mà, bảng xem trước sinh động.
* 🔒 **An toàn & không phá hủy:** Sử dụng cơ chế modal an toàn (`executeAsModal`), tự động dọn dẹp các layer tạm sau khi phân tích và không ghi đè lên các Layer Effect khác đang bật trên layer mục tiêu.

### Nhược điểm (Hạn chế)
* ⚠️ **Giới hạn hệ màu và độ sâu màu:** Không hoạt động trên các file ảnh hệ màu **CMYK, Grayscale** hoặc ảnh có độ sâu màu **16-bit/32-bit**. Người dùng phải chuyển đổi định dạng tài liệu về RGB 8-bit trước khi phân tích.
* ⚠️ **Phụ thuộc vào vùng chọn ban đầu:** Nếu người dùng tạo vùng chọn không chính xác (quá nhỏ hoặc không chứa đủ dải màu/vùng phát sáng), thuật toán có thể trả về lỗi hoặc kết quả không mong muốn.
* ⚠️ **Không tự động tạo Layer Style mới:** Plugin chỉ ghi đè hoặc thêm trực tiếp vào thuộc tính Layer Effects hiện có của layer mục tiêu, chưa lưu dải màu vào thư viện Swatches/Gradients dùng chung của Photoshop.
