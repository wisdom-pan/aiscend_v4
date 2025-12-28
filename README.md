# 艾森达 - 专业医美AI助手

[![Ceasefire Now](https://badge.techforpalestine.org/default)](https://techforpalestine.org/learn-more)

## 🎯 产品定位
专业医美AI助手 - 全流程流，基于百万级赋能医美工作案例数据库，提供场景化精准输出

![艾森达](https://i.imgur.com/AOOgBM0.png)

> 基于 React Native + Expo 构建的跨平台医美AI应用

## 📱 应用架构
- **平台**: React Native + Expo (Managed Workflow)
- **目标平台**: Android (主攻) / iOS (同步) / Web (未来)
- **版本**: v2.1.0

## 🔥 四大核心功能模块

### 1️⃣ 面部美学设计 (AI智能面诊)
- 上传客户三张照片 (正面/45度/侧面)
- 输入客户需求 (全脸设计/鼻部设计/皮肤管理)
- 选择分析深度 (快速/标准/专业)
- AI生成面部美学报告
- 支持重新分析和参数调整

**核心能力**:
- ✅ 三庭五眼比例分析 - 骨相基础评估
- ✅ 皮相状态评估 - 皮肤质地、脂肪分布
- ✅ 美学焦点识别 - 3个可优化区域
- ✅ 方案生成 - 产品策略+预算建议+沟通话术
- ✅ 对比图生成 - 使用Gemini-3-pro-image-preview
- ✅ 多模型支持 - GPT-4o (细节分析)(整体评估)

### 2️⃣ 朋友圈文案生成 (灵感文案库)
- 上传素材 (照片/视频)
- 选择人设 (通用/专业/温柔/犀利)
- 选择内容风格 (8种预设+自定义)
- 个性化设置 (字数/表情包/口语化)
- 输入关键词
- 生成+优化文案

### 3️⃣ 自媒体内容创作 (视频内容引擎)
**A. 一创 (原创脚本)** / **B. 二创 (脚本优化)**
- 支持平台: 抖音 / 小红书 / 视频号
- 🎬 脚本结构化 - 开头/中间/结尾模板
- 🌟 明星案例集成 - 自动匹配相关明星
- ⚡ 争议性生成 - 适度制造话题

### 4️⃣ 智能问答 (高情商沟通)
- 输入客户问题 (文字/截图)
- 选择沟通场景 (咨询/异议处理/成交)
- AI生成5种回复选项
- 选择最佳回复或自定义
- 保存到话术库

### 5️⃣ 设置中心
- 🔑 API密钥配置 - 支持环境变量和应用内配置
- 🎨 主题切换 - 医美/Light/Dark等多种主题
- 🤖 模型选择 - 自定义OpenAI和Gemini模型
- 📊 连接测试 - 验证API配置是否正确

![艾森达功能预览](https://i.imgur.com/D4LIVal.png)

## 🚀 快速开始

### 安装依赖
```bash
cd app
npm install
```

### 配置API密钥
有两种方式配置API密钥：

**方式一：环境变量（推荐）**
在 `.env` 文件中配置：
```bash
EXPO_PUBLIC_OPENAI_API_KEY="your_openai_api_key"
EXPO_PUBLIC_GEMINI_API_KEY="your_gemini_api_key"
EXPO_PUBLIC_OPENAI_MODEL="gpt-5.2"
EXPO_PUBLIC_GEMINI_MODEL="gemini-3-pro-image-preview"
```

**方式二：在设置页面配置**
1. 启动应用
2. 点击底部导航"设置"
3. 在"API密钥配置"部分输入密钥
4. 点击"保存配置"

### 运行应用
```bash
# 启动开发服务器
npm start

# 运行在Android
npm run android

# 运行在iOS
npm run ios
```

## 🔧 技术实现

### API接口
- **OpenAI API中转**: `https://yunwu.ai/v1/chat/completions`
- **Gemini API中转**: `https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent`

### 核心技术
- 📸 **本地图片处理** - 无CDN完整存储
- 🔄 **流式响应** - 实时显示分析进度
- 📊 **历史记录** - 完整保存原始图片+分析结果
- 💾 **数据存储** - AsyncStorage本地存储
- 🎨 **UI设计** - 医美主题，模仿扫描王风格

## 📦 项目结构

```
app/
├── src/
│   ├── screens/          # 五大功能模块
│   │   ├── facialDesign.tsx      # 面部美学设计
│   │   ├── contentGenerator.tsx  # 朋友圈文案生成
│   │   ├── videoCreator.tsx      # 自媒体内容创作
│   │   ├── smartQA.tsx           # 智能问答
│   │   └── settings.tsx          # 设置页面（主题/模型/API配置）
│   ├── services/         # 业务服务
│   │   ├── apiService.ts         # API调用服务
│   │   └── historyService.ts     # 历史记录服务
│   ├── types/            # 类型定义
│   │   └── history.ts            # 历史记录类型
│   ├── components/       # 可复用组件
│   ├── context.tsx       # 全局状态管理
│   ├── theme.ts          # 主题配置
│   └── constants.ts      # 常量配置
├── .env                  # 环境变量配置
├── .env.example          # 环境变量示例
└── package.json
```

## 🎨 主题配置

艾森达应用默认使用医美主题，提供清新的蓝绿色调：

```ts
const medicalTheme = {
  primaryColor: '#4A90E2',      // 主色调 - 专业蓝
  backgroundColor: '#F8F9FA',   // 背景色 - 浅灰白
  textColor: '#2C3E50',         // 文字色 - 深蓝灰
  cardBackground: '#FFFFFF',    // 卡片背景 - 纯白
  borderColor: 'rgba(74, 144, 226, .2)',
}
```

同时支持其他主题：Light / Dark / Hacker News / Miami / Vercel

![主题预览](https://i.imgur.com/7Gser4F.png)

## 📝 开发说明

### 添加新功能
1. 在 `src/screens/` 创建新屏幕
2. 在 `src/services/` 添加业务逻辑
3. 更新导航配置 `src/main.tsx`
4. 在 `src/types/` 定义类型

### API调用示例
```typescript
import { apiService } from './services/apiService'

// 面部分析
const result = await apiService.analyzeFacialImage(
  images,
  '全脸设计',
  'standard'
)

// 文案生成
const contents = await apiService.generateContent(
  '玻尿酸',
  '专业严谨',
  '专业引导'
)

// 视频脚本生成
const script = await apiService.generateVideoScript(
  '玻尿酸注射',
  '抖音',
  '明星案例',
  'create'
)

// 智能问答
const replies = await apiService.generateQAReplies(
  '价格太贵了',
  '异议处理',
  '温暖关怀'
)
```

### 编码原则
- ✅ **最小化代码** - 统一服务层，避免重复
- ✅ **避免硬编码** - 所有配置集中管理
- ✅ **代码可读性** - 清晰注释 + 类型提示
- ✅ **可扩展性** - 预留新模型接口
- ✅ **可测试性** - 纯函数设计，核心逻辑清晰

## 📄 许可证
MIT License

## 👨‍💻 开发者
WisdomPan

---

**注意**: 本应用需要有效的API密钥才能正常使用AI功能。

API密钥获取：
- OpenAI API: https://platform.openai.com/
- Gemini API: https://makersuite.google.com/

如需使用中转服务，请联系yunwu.ai获取API密钥。


```bash
adb logcat | grep -E "(API Configuration Debug|API Key|Request URL|Request headers|ReactNativeJS)"

```


```bash
adb -s 192.168.1.2:43157 logcat | grep -E "(ReactNative|fetchStream|reasoning_content|content)"

adb -s 192.168.1.2:43157 logcat -d | grep -E "(fetchStream|response.body|Stream mode)"

```

adb -s 192.168.1.2:43157 logcat -d | grep -E  "(fetchStream|response.body|Stream mode|cleanup|XHR)"


adb -s 192.168.1.2:43157 logcat -d | grep   -E "(aisenda|fetchStream|Stream mode|cleanup)"
adb -s 192.168.1.2:43157 logcat -d | grep -E "(ReactNativeJS|JS|error)"