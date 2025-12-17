# 🚀 艾森达 - 完整功能大纲 (V2.1)

## 🎯 产品定位
**专业医美AI助手** - 全流程赋能医美工作流，基于百万级案例数据库，提供场景化精准输出

---

## 📱 三端支持架构
```
核心架构：React Native + Expo (Managed Workflow)
├── Android (主攻) - 原生应用
├── iOS (同步) - 原生应用  
└── Web (未来) -管理后台
```

---

## 🔥 四大核心功能模块

### 1️⃣ 面部美学设计 (AI智能面诊)
#### 功能流程
```
1. 上传客户三张照片 (正面/45度/侧面)
2. 输入客户需求 (全脸设计/鼻部设计/皮肤管理)
3. 选择分析深度 (快速/标准/专业)
4. AI生成面部美学报告
5. 支持重新分析和参数调整
```

#### 核心能力
- ✅ **三庭五眼比例分析** - 骨相基础评估
- ✅ **皮相状态评估** - 皮肤质地、脂肪分布
- ✅ **美学焦点识别** - 3个可优化区域
- ✅ **方案生成** - 产品策略+预算建议+沟通话术
- ✅ **对比图生成** - 使用gemini-3-pro-image-preview生成前后对比图
- ✅ **多模型支持** - GPT-5.1 (细节分析)(整体评估)

#### 技术实现
- 📸 **本地图片处理** - 无CDN完整存储
- 🔄 **流式响应** - 实时显示分析进度
- 📊 **历史记录** - 完整保存原始图片+分析结果


---

### 2️⃣ 朋友圈文案生成 (灵感文案库)
#### 功能流程
```
1. 上传素材 (照片/视频)
2. 选择人设 (通用/专业/温柔/犀利)
3. 选择内容风格 (8种预设+自定义)
4. 个性化设置 (字数/表情包/口语化)
5. 输入关键词 (如"客户反馈，体现专业度")
6. 生成+优化文案
```

#### 风格配置
```javascript
const CONTENT_STYLES = {
  professional: '专业引导 - 突出技术实力和案例效果',
  customer_voice: '客户口碑 - 真实案例分享',
  industry_authority: '行业权威 - 专业观点输出',
  value_delivery: '价值交付 - 效果导向',
  life_quality: '生活质感 - 生活方式分享',
  personal_thoughts: '个性随想 - 个人感悟',
  core_concept: '核心理念 - 品牌价值观',
  warm_care: '温暖关怀 - 情感连接'
};
```

#### 人设配置
```javascript
const PERSONA_CONFIGS = {
  professional: {
    tone: '专业严谨',
    keywords: ['权威', '精准', '效果', '案例'],
    emoji_style: '⚕️✨🎯',
    example_start: '【专业分享】'
  },
  warm: {
    tone: '亲切温和', 
    keywords: ['贴心', '关怀', '陪伴', '改变'],
    emoji_style: '💖🌸🌟',
    example_start: '【温暖时刻】'
  },
  sharp: {
    tone: '犀利直接',
    keywords: ['效果', '性价比', '真相', '改变'],
    emoji_style: '🔥💯⚡',
    example_start: '【真相时刻】'
  }
};
```

#### 技术实现
- ✅ **多模态输入** - 支持图片+文字
- ✅ **风格迁移** - 基于预设模板的动态生成
- ✅ **批量生成** - 一次生成3-5个选项
- ✅ **收藏功能** - 保存优质文案到个人库

---

### 3️⃣ 自媒体内容创作 (视频内容引擎)
#### 功能分类
```
A. 一创 (原创脚本)
   - 上传参考素材 (图片/视频)
   - 输入主题关键词
   - 选择风格要求 (明星案例/文字优美)
   - 生成完整脚本

B. 二创 (脚本优化)
   - 上传原视频脚本
   - 输入优化需求 (增加争议性/加强专业度)
   - 生成优化版本
```

#### 支持平台
- ✅ **抖音** - 短平快+争议性+明星案例
- ✅ **小红书** - 故事剧情+专业评测+情感分享
- ✅ **视频号** - 专业科普+客户见证

#### 核心能力
- 🎬 **脚本结构化** - 开头/中间/结尾模板
- 🌟 **明星案例集成** - 自动匹配相关明星
- ⚡ **争议性生成** - 适度制造话题
- 📝 **字幕优化** - 适合短视频的字幕节奏
- 🔍 **SEO优化** - 关键词自然植入

#### 技术实现
- ✅ **长文本处理** - gpt5.1 
- ✅ **风格保持** - 二创时保留原脚本核心
- ✅ **分镜建议** - 画面描述+镜头切换
- ✅ **音乐推荐** - 根据内容推荐背景音乐

---

### 4️⃣ 智能问答 (高情商沟通)
#### 功能流程
```
1. 输入客户问题 (文字/截图)
2. 选择沟通场景 (咨询/异议处理/成交)
3. AI生成5种回复选项
4. 选择最佳回复或自定义
5. 保存到话术库
```

#### 回复风格
```javascript
const REPLY_STYLES = {
  professional: '专业权威 - 用数据和案例说服',
  warm: '温暖关怀 - 情感共鸣+专业建议',
  high_eq: '高情商 - 先理解后引导',
  soothing: '安抚型 - 消除顾虑+重建信任',
  direct: '直接型 - 快速解决问题'
};
```
### openai接口中转协议
```javascript
var request = require('request');
var options = {
   'method': 'POST',
   'url': 'https://yunwu.ai/v1/chat/completions',
   'headers': {
      'Accept': 'application/json',
      'Authorization': 'Bearer ${OPENAI_API_KEY}',
      'Content-Type': 'application/json'
   },
   body: JSON.stringify({
      "model": "gpt-4o",
      "messages": [
         {
            "role": "system",
            "content": "You are a helpful assistant."
         },
         {
            "role": "user",
            "content": [
               {
                  "type": "text",
                  "text": "这张图片里有什么?请详细描述。"
               },
               {
                  "type": "image_url",
                  "image_url": {
                     "url": "https://lsky.zhongzhuan.chat/i/2024/10/17/6711068a14527.png"
                  }
               }
            ]
         }
      ],
      "stream": true
   })

};
request(options, function (error, response) {
   if (error) throw new Error(error);
   console.log(response.body);
});
```
### gemini-3-pro-image-preview中转协议
```js

var request = require('request');
var options = {
   'method': 'POST',
   'url': 'https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent?key=',
   'headers': {
      'Authorization': 'Bearer ${GEMINI_API_KEY}',
      'Content-Type': 'application/json'
   },
   body: JSON.stringify({
      "contents": [
         {
            "role": "user",
            "parts": [
               {
                  "text": "'Hi, This is a picture of me. Can you add a llama next to me"
               },
               {
                  "inline_data": {
                     "mime_type": "image/jpeg",
                     "data": "iVBORw0KGgoAAAANSUhEUgAABAAAAAKoCAIAAABm4BptAAAAiXpUWHRSYXcgcHJvZmlsZSB0eXBlIGlwdGMAAAiZTYwxDgIxDAT7"
                  }
               }
            ]
         }
      ],
      "generationConfig": {
         "responseModalities": [
            "TEXT",
            "IMAGE"
         ],
         "imageConfig": {
            "aspectRatio": "9:16",
            "imageSize": "4K"
         }
      }
   })

};
request(options, function (error, response) {
   if (error) throw new Error(error);
   console.log(response.body);
});

```

#### 典型场景
- ❓ **技术问题** - "打眉骨会让眉眼距离更宽吗？"
- 💰 **价格异议** - "为什么你们的价格比别家高？"
- ⏰ **时间顾虑** - "恢复期太长，会影响工作"
- 🤔 **效果怀疑** - "真的能达到这种效果吗？"
- 👥 **决策犹豫** - "我再考虑考虑"

#### 技术实现
- ✅ **上下文理解** - 保持对话连贯性
- ✅ **情感分析** - 识别客户情绪状态
- ✅ **话术库** - 个人收藏的优质回复
- ✅ **场景适配** - 不同场景的回复策略

---

## 📊 历史记录与统计系统

### 1. 历史记录管理
#### 存储结构
```javascript
{
  id: 123,
  user_id: 'doctor_001',
  image_path: 'storage/images/doctor_001_20241213_143022_a1b2c3.jpg',
  image_metadata: {
    mime_type: 'image/jpeg',
    size: 2456789,
    width: 1024,
    height: 768,
    filename: 'doctor_001_20241213_143022_a1b2c3.jpg'
  },
  prompt: '分析这张面部照片的三庭五眼比例...',
  result: '【专业分析结果】...',
  analysis_type: 'facial',
  metadata: {
    model_provider: 'openai',
    model_name: 'gpt-5.1',
    temperature: 0.3,
    replay_count: 2,
    replayed_at: '2024-12-13T15:30:22Z'
  },
  created_at: '2024-12-13T14:30:22Z'
}
```


#### 可视化图表
- 📊 **饼图** - 功能使用分布
- 📈 **柱状图** - 周活跃度趋势
- 🎯 **雷达图** - 各功能使用强度
- 📋 **数据表格** - 详细统计列表

#### 专业统计
- 💰 **效率提升** - 对比使用前后的咨询转化率
- ⏱️ **时间节省** - 累计节省的工作时间
- 📝 **内容产出** - 生成的文案/脚本数量
- 🎯 **客户满意度** - 基于生成内容的反馈




### 4. 严格遵循编码原则
- ✅ **最小化代码**：统一服务层，避免重复
- ✅ **避免硬编码**：所有配置集中管理
- ✅ **代码可读性**：清晰注释 + 类型提示
- ✅ **可扩展性**：预留Claude等新模型接口
- ✅ **可测试性**：纯函数设计，100%覆盖核心逻辑



 subprojects 没有生效,因为 app 模块的配置太晚了。问题很明确:React
  Native 0.74.5 的预编译 fabricjni 库要求 minSdk 23,但是 CMake
  检测到的是 22。


  看到了!app/build.gradle 里有两处 minSdkVersion。一处是引用
  rootProject.ext.minSdkVersion,另一处是我之前添加的 minSdkVersion 
  23。第二个可能在我添加的 subprojects 块里。

  关键问题是:expo-modules-core 这个模块在构建native代码时,AGP传递给
  CMake 的 minSdkVersion 是 22。


### APK打包设置
  1. 修改了 expo-modules-core/android/CMakeLists.txt，强制设置
  CMAKE_SYSTEM_VERSION = 23
  2. 使用 NDK 26.1.10909125
  3. 配置了 minSdkVersion = 23