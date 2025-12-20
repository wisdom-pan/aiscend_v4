import { HistoryRecord } from '../types/history'
import AsyncStorage from '@react-native-async-storage/async-storage'

const OPENAI_API_URL = process.env.EXPO_PUBLIC_BASE_URL
  ? `${process.env.EXPO_PUBLIC_BASE_URL}/chat/completions`
  : 'https://yunwu.ai/v1/chat/completions'

const GEMINI_API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL
  ? `${process.env.EXPO_PUBLIC_BASE_URL}/chat/completions`
  : 'https://yunwu.ai/v1/chat/completions'

// ⚠️ 注意：不要在客户端代码中硬编码API密钥
// 使用环境变量或用户输入的密钥
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gemini-3-flash-preview'
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3-flash-preview'
const IMAGE_GENERATION_MODEL = process.env.EXPO_PUBLIC_IMAGE_MODEL || 'gemini-3-pro-image-preview'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: {
      url: string
    }
  }>
}

interface ImageUrlPart {
  type: 'image_url'
  image_url: {
    url: string
  }
}

interface TextPart {
  type: 'text'
  text: string
}

interface OpenAIRequest {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

export class ApiService {
  private static instance: ApiService
  private openaiApiKey: string = ''
  private geminiApiKey: string = ''

  private constructor() {
    // 不在构造函数中初始化密钥，等待用户配置
    console.log('ApiService initialized')
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService()
    }
    return ApiService.instance
  }

  async setApiKeys(openaiKey: string, geminiKey: string) {
    this.openaiApiKey = openaiKey
    this.geminiApiKey = geminiKey

    // 保存到本地存储
    try {
      await AsyncStorage.setItem('openai_api_key', openaiKey)
      await AsyncStorage.setItem('gemini_api_key', geminiKey)
      console.log('API keys saved successfully')
    } catch (error) {
      console.error('Failed to save API keys:', error)
    }
  }

  // 检查是否有API密钥
  hasApiKeys(): { hasOpenAI: boolean, hasGemini: boolean } {
    return {
      hasOpenAI: !!this.openaiApiKey,
      hasGemini: !!this.geminiApiKey
    }
  }

  async loadApiKeys() {
    try {
      // 首先尝试从 AsyncStorage 加载
      const [storedOpenAI, storedGemini] = await AsyncStorage.multiGet([
        'openai_api_key',
        'gemini_api_key'
      ])

      // 如果本地没有存储，则从环境变量加载
      if (!storedOpenAI[1] && process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
        this.openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY
        await AsyncStorage.setItem('openai_api_key', this.openaiApiKey)
      } else if (storedOpenAI[1]) {
        this.openaiApiKey = storedOpenAI[1]
      }

      if (!storedGemini[1] && process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
        this.geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY
        await AsyncStorage.setItem('gemini_api_key', this.geminiApiKey)
      } else if (storedGemini[1]) {
        this.geminiApiKey = storedGemini[1]
      }

      return {
        hasOpenAI: !!this.openaiApiKey,
        hasGemini: !!this.geminiApiKey
      }
    } catch (error) {
      console.error('Failed to load API keys:', error)
      return { hasOpenAI: false, hasGemini: false }
    }
  }

  async callOpenAI(
    messages: OpenAIMessage[],
    options: {
      model?: string
      temperature?: number
      maxTokens?: number
      stream?: boolean
    } = {}
  ): Promise<string> {
    try {
      const requestBody: OpenAIRequest = {
        model: options.model || OPENAI_MODEL || 'gpt-5.1',
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        stream: options.stream || false,
      }

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (error) {
      console.error('OpenAI API call failed:', error)
      throw error
    }
  }

  async callGemini(
    prompt: string,
    imageBase64?: string | string[],
    options: {
      aspectRatio?: string
      imageSize?: string
      model?: string
    } = {}
  ): Promise<{ text: string, image?: string }> {
    try {
      const model = options.model || GEMINI_MODEL

      // 使用统一的chat completions接口
      let content: string | Array<TextPart | ImageUrlPart>

      if (Array.isArray(imageBase64) && imageBase64.length > 0) {
        content = [
          { type: 'text', text: prompt } as TextPart,
          ...imageBase64.map(img => ({
            type: 'image_url',
            image_url: { url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` }
          })) as ImageUrlPart[]
        ]
      } else {
        content = prompt
      }

      const messages: OpenAIMessage[] = [
        {
          role: 'user',
          content
        }
      ]

      const requestBody: OpenAIRequest = {
        model: model,
        messages,
        temperature: 0.5,
        stream: false,
      }

      const response = await fetch(GEMINI_API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.geminiApiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const data = await response.json()

      let text = ''
      let image = ''

      // 使用OpenAI格式的响应
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content || ''

        // 检查content中是否包含markdown格式的图片
        const imageMatch = content.match(/!\[image\]\((data:image\/[^;]+;base64,[^)]+)\)/)
        if (imageMatch && imageMatch[1]) {
          image = imageMatch[1]
          text = content.replace(/!\[image\]\([^)]+\)/, '[图片]').trim()
        } else {
          text = content
        }

        // 检查是否有image_url字段
        if (data.choices[0].message.image_url) {
          image = data.choices[0].message.image_url.url
        }
      }

      return { text, image }
    } catch (error) {
      console.error('Gemini API call failed:', error)
      throw error
    }
  }

  async analyzeFacialImage(
    images: string[],
    requirement: string,
    analysisType: string
  ): Promise<string> {
    try {
      const prompt = `作为专业的医美医生，请分析这些面部照片：
需求：${requirement}
分析深度：${analysisType}

请从以下角度进行分析：
1. 三庭五眼比例分析 - 骨相基础评估
2. 皮相状态评估 - 皮肤质地、脂肪分布
3. 美学焦点识别 - 3个可优化区域
4. 方案生成 - 产品策略+预算建议+沟通话术

请用专业的医美语言，给出详细的分析和建议。`

      // 传递所有图片而不是只传第一张
      const result = await this.callGemini(prompt, images)

      return result.text
    } catch (error) {
      console.error('Facial analysis failed:', error)
      throw error
    }
  }

  async generateContent(
    keywords: string,
    persona: string,
    style: string,
    imageBase64?: string
  ): Promise<string[]> {
    try {
      const prompt = `请根据以下信息生成3条不同的朋友圈文案：

关键词：${keywords}
人设：${persona}
风格：${style}

要求：
1. 每条文案风格要有所不同
2. 符合医美行业特点
3. 具有吸引力和说服力
4. 字数在100-200字之间
5. 可以适当使用emoji

请返回3条完整的文案，每条用---分隔。`

      const result = await this.callGemini(prompt, undefined, {
        model: GEMINI_MODEL
      })

      return result.text.split('---').map(s => s.trim()).filter(s => s.length > 0)
    } catch (error) {
      console.error('Content generation failed:', error)
      throw error
    }
  }

  async generateVideoScript(
    topic: string,
    platform: string,
    style: string,
    mode: 'create' | 'rewrite',
    originalScript?: string,
    optimizationNeeds?: string
  ): Promise<string> {
    try {
      let prompt = ''

      if (mode === 'create') {
        prompt = `请为${platform}平台创作一个医美相关的视频脚本：

主题：${topic}
风格要求：${style}

要求：
1. 开头要抓人眼球（3秒）
2. 中间部分要有实用内容和争议点
3. 结尾要有互动引导
4. 总时长控制在60-90秒
5. 适合短视频节奏
6. 包含分镜建议和音乐推荐

请用markdown格式输出，包含所有细节。`
      } else {
        prompt = `请优化以下视频脚本：

原脚本：
${originalScript}

优化需求：${optimizationNeeds}

目标平台：${platform}

要求：
1. 保持原脚本的核心内容
2. 按照优化需求进行调整
3. 增加争议性或专业度
4. 优化开头和结尾
5. 适合短视频节奏

请用markdown格式输出优化后的脚本。`
      }

      const systemPrompt = '你是一位资深的短视频内容创作专家，擅长医美行业的视频脚本创作。'

      const result = await this.callGemini(`${systemPrompt}\n\n${prompt}`, undefined, {
        model: GEMINI_MODEL
      })

      return result.text
    } catch (error) {
      console.error('Video script generation failed:', error)
      throw error
    }
  }

  async generateQAReplies(
    question: string,
    scenario: string,
    style: string
  ): Promise<{ style: string, content: string }[]> {
    try {
      const prompt = `请针对以下客户问题，生成5种不同风格的回复：

客户问题：${question}
沟通场景：${scenario}
回复风格要求：${style}

请生成5种不同风格的回复：
1. 专业权威 - 用数据和案例说服
2. 温暖关怀 - 情感共鸣+专业建议
3. 高情商 - 先理解后引导
4. 安抚型 - 消除顾虑+重建信任
5. 直接型 - 快速解决问题

每条回复要：
- 符合医美行业特点
- 具有说服力和同理心
- 字数在100-150字
- 可以引导客户进一步咨询

请按格式返回：
风格：内容
---`

      const systemPrompt = '你是一位资深的医美咨询师，擅长高情商的客户沟通。'

      const result = await this.callGemini(`${systemPrompt}\n\n${prompt}`, undefined, {
        model: GEMINI_MODEL
      })

      const replies = result.text.split('---').map(s => s.trim()).filter(s => s.length > 0)

      return replies.map(reply => {
        const [stylePart, ...contentParts] = reply.split('：')
        return {
          style: stylePart.replace('风格：', '').trim(),
          content: contentParts.join('：').trim(),
        }
      })
    } catch (error) {
      console.error('QA reply generation failed:', error)
      throw error
    }
  }

  async generateComparisonImage(
    originalImage: string,
    adjustmentSuggestions: string
  ): Promise<string> {
    try {
      const imagePrompt = `请对这张面部照片进行精确编辑，根据以下调整建议生成优化后的效果图：

调整建议：
${adjustmentSuggestions}

要求：
1. 严格基于原始照片进行编辑，不要生成全新图片
2. 只调整指定的区域，保持照片其他部分完全不变
3. 保持照片的光照、角度、比例一致
4. 确保调整后的效果自然真实
5. 输出格式：![image](data:image/jpeg;base64,...)`

      const result = await this.callGemini(imagePrompt, originalImage, {
        model: IMAGE_GENERATION_MODEL
      })

      if (!result.image) {
        throw new Error('No image generated')
      }

      return result.image
    } catch (error) {
      console.error('Image generation failed:', error)
      throw error
    }
  }
}

export const apiService = ApiService.getInstance()
