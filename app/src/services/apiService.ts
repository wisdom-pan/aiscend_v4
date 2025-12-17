import { HistoryRecord } from '../types/history'
import AsyncStorage from '@react-native-async-storage/async-storage'

const OPENAI_API_URL = process.env.EXPO_PUBLIC_BASE_URL
  ? `${process.env.EXPO_PUBLIC_BASE_URL}/chat/completions`
  : 'https://yunwu.ai/v1/chat/completions'

const GEMINI_API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL
  ? `${process.env.EXPO_PUBLIC_BASE_URL}/v1beta/models/gemini-3-pro-image-preview:generateContent`
  : 'https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent'

// ⚠️ 注意：不要在客户端代码中硬编码API密钥
// 使用环境变量或用户输入的密钥
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-5.2'
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3-pro-image-preview'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIRequest {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

interface GeminiPart {
  text?: string
  inline_data?: {
    mime_type: string
    data: string
  }
}

interface GeminiContent {
  role: string
  parts: GeminiPart[]
}

interface GeminiRequest {
  contents: GeminiContent[]
  generationConfig?: {
    responseModalities?: string[]
    imageConfig?: {
      aspectRatio?: string
      imageSize?: string
    }
  }
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
    } = {}
  ): Promise<{ text: string, image?: string }> {
    try {
      const parts: GeminiPart[] = []

      // 支持单张或多张图片
      if (imageBase64) {
        const images = Array.isArray(imageBase64) ? imageBase64 : [imageBase64]
        images.forEach(img => {
          parts.push({
            inline_data: {
              mime_type: 'image/jpeg',
              data: img.split(',')[1] || img,
            }
          })
        })
      }

      parts.push({ text: prompt })

      const requestBody: GeminiRequest = {
        contents: [
          {
            role: 'user',
            parts
          }
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: options.aspectRatio || '9:16',
            imageSize: options.imageSize || '4K',
          }
        }
      }

      const response = await fetch(`${GEMINI_API_BASE_URL}?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const data = await response.json()

      let text = ''
      let image = ''

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const content = data.candidates[0].content
        if (content.parts) {
          content.parts.forEach((part: any) => {
            if (part.text) {
              text += part.text
            }
            if (part.inlineData) {
              image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
            }
          })
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

      const messages: OpenAIMessage[] = [
        {
          role: 'system',
          content: '你是一位专业的医美营销文案专家，擅长创作吸引人的朋友圈内容。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]

      const result = await this.callOpenAI(messages, {
        model: OPENAI_MODEL || 'gpt-5.1',
        temperature: 0.8,
        maxTokens: 1000,
      })

      return result.split('---').map(s => s.trim()).filter(s => s.length > 0)
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

      const messages: OpenAIMessage[] = [
        {
          role: 'system',
          content: '你是一位资深的短视频内容创作专家，擅长医美行业的视频脚本创作。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]

      const result = await this.callOpenAI(messages, {
        model: OPENAI_MODEL || 'gpt-5.1',
        temperature: 0.7,
        maxTokens: 2000,
      })

      return result
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

      const messages: OpenAIMessage[] = [
        {
          role: 'system',
          content: '你是一位资深的医美咨询师，擅长高情商的客户沟通。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]

      const result = await this.callOpenAI(messages, {
        model: OPENAI_MODEL || 'gpt-5.1',
        temperature: 0.8,
        maxTokens: 1500,
      })

      const replies = result.split('---').map(s => s.trim()).filter(s => s.length > 0)

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
      const imagePrompt = `请基于这张原始面部照片，根据以下调整建议生成优化后的效果图：

${adjustmentSuggestions}

请生成一张高质量的面部优化效果图，展现改善后的效果。保持照片的真实感和自然度，确保调整后的效果符合医美美学标准。`

      const result = await this.callGemini(imagePrompt, originalImage)

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
