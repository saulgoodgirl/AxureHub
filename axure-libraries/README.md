# Axure 高保真数据可视化与设计系统精选元件库合集

本目录已为您整理并下载了当前产品经理、UI/UX 设计师在原型设计与大屏可视化领域最常用、高星开源的 **Axure 官方规范元件库（.rplib）**，参考并完全覆盖了 Axhub Charts 的常用图表场景，所有资源 100% 离线可用，免付费、免授权锁。

---

## 📁 目录元件库清单与定位

### 1. 数据可视化与大屏图表专题 (Data Visualization & Charts)

| 元件库文件名 | 文件大小 | 核心功能与涵盖组件 |
| :--- | :--- | :--- |
| **`Refs-数据可视化图表库.rplib`** | 1.25 MB | **高频商业图表大全**：折线图、双轴折线、柱状图、堆叠柱状图、条形图、饼图、环形图、漏斗图、雷达图、散点图、水波进度、迷你趋势图等。 |
| **`Refs-图表模型与大屏看板库.rplib`** | 928 KB | **复合分析模型与大屏卡片**：多维交叉分析、KPI 核心指标看板、环比趋势模型、业务转化漏斗、大屏标题栅格。 |
| **`Data-Visualization-Lite-大屏高保真图表库.rplib`** | 5.12 MB | **大屏科技风高保真组件**：暗色/科技蓝背景下的数据流图、雷达扫描、多维动态进度条、仪表盘表头、数据地图骨架。 |
| **`InteractiveCharts-动态交互图表.rplib`** | 1.26 MB | **原生动态交互图表**：支持通过 Axure 原生状态切换、中继器驱动的折线/柱状/饼图动态联动。 |
| **`DashboardWidgets-仪表盘大屏挂件.rplib`** | 205 KB | **仪表盘度量器与指针**：汽车/工控/运营级圆弧仪表盘、半圆进度刻度、状态指示警报灯。 |
| **`ChartsandTables-图表与数据表格.rplib`** | 118 KB | **数据表格与混合图表**：树形表格、多表头统计报表、带微图表的业务明细列表。 |

---

### 2. 主流前端 UI 设计系统专题 (Design Systems)

| 元件库文件名 | 文件大小 | 核心功能与涵盖组件 |
| :--- | :--- | :--- |
| **`AntDesign-阿里高保真组件库.rplib`** | 10.2 MB | **阿里巴巴 Ant Design 官方高保真规范**：涵盖按钮、表单、输入框、下拉选择、穿梭框、树形控件、标签页、通知弹窗、步骤条等全套 B 端中后台组件。 |
| **`Element-UI-后台全套组件库.rplib`** | 4.81 MB | **饿了么 Element UI 官方高保真规范**：Vue 生态最经典的后台管理系统原型规范，开箱即用，交互状态极其丰富。 |
| **`Refs-Apple设计规范库.rplib`** | 3.17 MB | **Apple iOS / macOS 官方人机交互指南 (HIG)**：iOS 原生导航栏、分段控制器、开关 Toggle、底栏 TabBar、弹窗 ActionSheet。 |
| **`Refs-Fluent微软设计规范库.rplib`** | 2.78 MB | **微软 Fluent Design (Windows 11 规范)**：Win11 亚克力微光效果、现代视窗控件、标准图标与菜单结构。 |
| **`Refs-Material谷歌设计规范库.rplib`** | 4.43 MB | **Google Material Design 官方规范**：Android 经典浮动操作按钮 (FAB)、卡片抽屉 (Navigation Drawer)、纸墨动效层级。 |

---

### 3. 高清矢量图标库专题 (Vector Icons)

| 元件库文件名 | 文件大小 | 核心功能与涵盖组件 |
| :--- | :--- | :--- |
| **`Refs-阿里巴巴矢量图标库.rplib`** | 3.97 MB | **Iconfont 常用通用图标全集**：电商、金融、办公、系统管理等 1000+ 原生矢量图标，可任意缩放换色。 |
| **`FontAwesome5-矢量图标库.rplib`** | 8.81 MB | **Font Awesome 5 完整图标库**：全球最通用的 UI 图标体系，支持实体与轮廓双形态。 |

---

## 🚀 如何在 Axure RP 中加载与使用

### 方案 A：永久载入（推荐，重启后依然保留）

1. 打开 Windows 文件资源管理器，进入当前用户的文档目录：
   ```text
   C:\Users\<你的用户名>\Documents\Axure\Libraries
   ```
   *(或者在文件地址栏直接输入 `%USERPROFILE%\Documents\Axure\Libraries` 敲回车)*
2. 将本目录（`axure-libraries`）下的 `.rplib` 文件直接复制或移动到上述 `Libraries` 文件夹中；
3. 打开或重启 **Axure RP**，在左侧的 **【元件 (Libraries)】** 面板下拉菜单中即可看到新载入的元件库，拖拽即用！

### 方案 B：临时/快速载入

1. 打开 Axure RP，找到左侧面板中的 **【元件】** 标签；
2. 点击元件库名称右侧的 **“更多库选项”** 图标（通常为三条横线或 `+` 号）；
3. 选择 **「载入元件库 (Load Library)」**；
4. 定位并选择本目录下的任意 `.rplib` 文件即可立即加载。

---

## 💡 深度进阶：像 Axhub Charts 一样在 Axure 中渲染 100% 动态 ECharts 图表

> **原理解密**：Axhub Charts 等第三方商业图表库的底层逻辑，就是在 Axure 矩形元件加载时通过 JavaScript 动态引入 Apache ECharts 或 AntV 脚本，并向 DOM 挂载真实图表。
> **您完全不需要购买 39 元商业授权**，只需按以下步骤操作即可在 Axure 原型中渲染具备**鼠标悬停 Tooltip、动态流式动画、真机交互缩放**的任意高端大屏图表！

### 3 步实现原生 ECharts 动态大屏图表：

1. **拖入容器**：
   在 Axure 画布中拖入一个【矩形】，设置所需宽高（例如 `600 × 380`），并在右上角为其命名（例如 `chart_container`）。
2. **添加交互**：
   选中该矩形，在右侧【交互】面板中新建事件：
   - 触发时机：**载入时 (OnLoad)** 或 **单击时 (OnClick)**
   - 动作：选择 **打开链接 (Open Link) -> 链接到外部 URL (Link to external url)**
3. **粘贴以下 JavaScript 注入代码**：
   点击 `fx` 按钮，直接粘贴：

```javascript
javascript:
(function() {
    function render() {
        var el = $('[data-label="chart_container"]')[0];
        if (!el) return;
        var myChart = echarts.init(el);
        var option = {
            title: { text: '实时数据流趋势', textStyle: { color: '#333' } },
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', boundaryGap: false, data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
            yAxis: { type: 'value' },
            series: [{
                name: '访问量',
                type: 'line',
                smooth: true,
                areaStyle: { color: 'rgba(59, 130, 246, 0.2)' },
                itemStyle: { color: '#3b82f6' },
                data: [120, 192, 141, 234, 390, 330, 420]
            }]
        };
        myChart.setOption(option);
        window.addEventListener('resize', function() { myChart.resize(); });
    }

    if (window.echarts) {
        render();
    } else {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
        s.onload = render;
        document.head.appendChild(s);
    }
})();
```

4. **按 F5 预览**：
   页面打开后，Axure RP 将自动从 CDN 载入 ECharts 并绘制出高保真动态图表！配合本项目自建的 **AxureHub 原型同步助手**，一键推送到云端服务器，任何团队成员扫码或在浏览器中打开均可体验完整的动态数据交互！
