# DataViz 2 - Conflict Data Visualization

## 📋 Mô tả dự án

Đây là dự án trực quan hóa dữ liệu xung đột toàn cầu sử dụng D3.js và các kỹ thuật visualization hiện đại. Dự án cung cấp nhiều góc nhìn khác nhau về dữ liệu xung đột bao gồm bản đồ, biểu đồ thống kê, và mạng lưới các phe phái.

## 📁 Cấu trúc thư mục

```
Viz2/
├── index.html                     # 🏠 Trang chủ - Map View (entry point)
│
├── css/                           # CSS Stylesheets
│   └── globe.css                  # Style chính cho toàn bộ ứng dụng
│
├── html/                          # HTML Pages (các view khác)
│   ├── graph.html                 # Graph View - Mạng lưới phe phái
│   ├── statistics.html            # Statistics View - Biểu đồ thống kê
│   └── generate-data.html         # Công cụ sinh dữ liệu JSON
│
├── scripts/                       # JavaScript Files
│   ├── global-new.js              # Logic cho Map View
│   ├── graph.js                   # Logic cho Graph View
│   ├── statistics.js              # Logic cho Statistics View
│   └── generate-stats-data.js     # Node.js script sinh dữ liệu
│
├── js/                            # Shared JavaScript Modules
│   └── shared/
│       ├── constants.js           # Hằng số và cấu hình
│       ├── utils.js               # Utility functions
│       ├── stateManager.js        # Quản lý state
│       ├── dataLoader.js          # Load dữ liệu
│       ├── mapRenderer.js         # Render bản đồ
│       ├── chartRenderer.js       # Render charts
│       ├── panelBuilder.js        # Xây dựng panels
│       └── canvasBubbleRenderer.js # Canvas rendering cho bubbles
│
├── data/                          # Pre-processed JSON Data
│   ├── timeline_area_data.json
│   ├── ridgeline_data.json
│   ├── treemap_data.json
│   ├── heatmap_monthly.json
│   └── ... (các file JSON khác)
│
├── backup_original/               # Backup files gốc
│
├── GEDEvent_v25_1.csv            # Dữ liệu CSV gốc (~250MB)
├── ged251.pdf                     # Tài liệu UCDP GED
├── paper_ieee.tex                 # Báo cáo LaTeX IEEE format
└── README.md                      # File này
```

## 🚀 Các tính năng chính

### 1. Map View (`index.html`) - Trang chủ
- Hiển thị bản đồ thế giới với các điểm xung đột
- Filter theo quốc gia, loại bạo lực, khoảng thời gian
- Xem chi tiết sự kiện khi click vào bubble
- Biểu đồ trends theo thời gian

#### 🔍 Filters & Controls
| Filter | Mô tả | Cách sử dụng |
|--------|-------|--------------|
| **Region Filter** | Lọc theo khu vực địa lý | Click vào legend (Africa, Americas, Asia, Europe, Middle East) |
| **Violence Type Filter** | Lọc theo loại bạo lực | Click để chọn: State-based, Non-state, One-sided |
| **Time Slider** | Lọc theo năm (1989-2023) | Kéo slider hoặc nhấn ▶ Play để auto-play |

#### 🖱️ Click Interactions
| Thao tác | Kết quả |
|----------|---------|
| **Click vào bubble quốc gia** | Zoom vào quốc gia, hiển thị các sự kiện chi tiết |
| **Click vào bubble sự kiện** | Hiển thị Event Details panel với thông tin đầy đủ |
| **Click vào map (khi trong country view)** | Xóa filter và selection hiện tại |
| **Click nút ← Back** | Quay lại view trước đó |

#### 📊 View Modes
- **World View**: Hiển thị tất cả quốc gia với bubbles tổng hợp
- **Region View**: Zoom vào khu vực, hiển thị top countries
- **Country View**: Zoom vào quốc gia, hiển thị từng sự kiện riêng lẻ
- **Event View**: Chi tiết sự kiện với Casualties Breakdown (pie chart)

---

### 2. Graph View (`html/graph.html`)
- Mạng lưới các phe phái xung đột (Force-directed graph)
- Hiển thị mối quan hệ giữa các nhóm vũ trang
- Drill-down từ faction → country → event
- Thống kê chi tiết cho mỗi phe phái

#### 🔍 Filters & Controls
| Filter | Mô tả | Cách sử dụng |
|--------|-------|--------------|
| **Country Filter Dropdown** | Lọc factions theo quốc gia | Chọn từ dropdown trên graph |
| **Node Limit Input** | Giới hạn số nodes hiển thị | Nhập số lượng max nodes |
| **Region Filter** | Lọc theo khu vực | Click vào legend |
| **Violence Type Filter** | Lọc theo loại bạo lực | Click để chọn loại |
| **Time Slider** | Lọc theo năm | Kéo slider hoặc nhấn Play |

#### 🖱️ Click Interactions
| Thao tác | Kết quả |
|----------|---------|
| **Single click vào node** | Focus mode: highlight faction + connected nodes, dim others |
| **Double click vào node** | Chuyển sang Faction Map View với bản đồ hoạt động |
| **Click vào item trong Top Factions list** | Focus vào faction đó trong graph |
| **Click vào country bubble (faction map)** | Zoom vào quốc gia, hiển thị events của faction tại đó |
| **Click vào event trong Most Severe Events** | Zoom đến event location, highlight bubble |
| **Click nút ← Back** | Quay lại view trước đó |

#### 📊 View Modes
- **Graph World View**: Hiển thị tất cả factions dạng network graph
- **Faction Focus Mode**: Highlight một faction và các connections
- **Faction Map View**: Bản đồ với bubbles hoạt động của faction
- **Faction Country View**: Chi tiết events của faction trong một quốc gia
- **Event View**: Chi tiết sự kiện với Casualties Breakdown

---

### 3. Statistics View (`html/statistics.html`)
- **11 biểu đồ thống kê tổng hợp:**
  - Timeline Area Chart (Events & Casualties over time)
  - Slope/Parallel Regions Chart
  - Waffle Violence Chart
  - Ridgeline Chart (Event density by region)
  - Diverging Violence Chart (State-based vs One-sided)
  - Treemap (Top 20 countries by casualties)
  - Monthly Heatmap (Events by month/year)
  - Bullet Regions Chart
  - Dot Error Bars (Mean casualties with 95% CI)
  - 2D Waffle/Heatmap (Casualty ranges by time periods)
  - Lollipop Countries Chart

#### 🔍 Filters & Controls
| Filter | Mô tả |
|--------|-------|
| **Region Tabs** | Chọn All hoặc từng region cụ thể |

---

## 🎯 Tổng hợp tính năng Filtering

### Bộ lọc chung (Map & Graph View)
1. **Region Filter**: Click legend để lọc theo 5 khu vực
2. **Violence Type Filter**: 3 loại bạo lực với màu riêng biệt
3. **Time Slider**: Kéo để xem dữ liệu theo năm, Play button để animation
4. **Faction Filter** (Country View): Click vào faction để filter events

### Tương tác đặc biệt
- **Canvas Rendering**: Sử dụng HTML5 Canvas cho hiệu năng cao với nhiều bubbles
- **Smooth Zoom**: Zoom mượt mà khi chuyển đổi giữa các view
- **Panel Toggle**: Ẩn/hiện panels trái-phải bằng buttons hoặc hover
- **Responsive Charts**: Biểu đồ tự động resize theo container

## 🛠️ Công nghệ sử dụng

- **D3.js v7** - Thư viện visualization chính
- **TopoJSON** - Dữ liệu địa lý bản đồ thế giới
- **HTML5 Canvas** - Render hiệu năng cao cho nhiều bubbles
- **CSS3** - Styling với hiệu ứng glassmorphism, gradients, animations

## 📊 Nguồn dữ liệu

Dữ liệu xung đột từ **UCDP GED (Uppsala Conflict Data Program - Georeferenced Event Dataset)** phiên bản 25.1:
- Thời gian: 1989-2023
- Số sự kiện: ~300,000+
- Bao gồm: vị trí địa lý, thương vong, loại bạo lực, các bên tham gia

## 🏃 Cách chạy

1. **Yêu cầu**: Cần chạy qua local server (do CORS)

2. **Chạy local server:**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx serve .
   
   # VS Code: Sử dụng extension Live Server
   ```

3. **Truy cập:**
   - **Map View (Trang chủ)**: `http://localhost:8000/`
   - Graph View: `http://localhost:8000/html/graph.html`
   - Statistics: `http://localhost:8000/html/statistics.html`
   - Data Generator: `http://localhost:8000/html/generate-data.html`

## 🔧 Sinh dữ liệu mới

Nếu cần tạo lại các file JSON từ CSV:

1. Mở `html/generate-data.html` trong trình duyệt
2. Đợi xử lý hoàn tất
3. Tải về các file JSON
4. Đặt vào thư mục `data/`

## ⚠️ Lưu ý

- File `GEDEvent_v25_1.csv` có dung lượng ~250MB, **không nên commit lên Git**
- Đảm bảo `.gitignore` bao gồm `*.csv`
- Khuyến nghị sử dụng Chrome/Edge để có hiệu năng tốt nhất

## 👥 Tác giả

- DataViz 2 Team

## 📝 License

MIT License
