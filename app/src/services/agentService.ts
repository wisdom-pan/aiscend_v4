// 智能体服务 - 管理智能体数据和对话历史

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Agent, Conversation, Message } from '../types/agent'

// 简单的 UUID 生成器（兼容 React Native）
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// 预设智能体
export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'general',
    name: '通用助手',
    description: '智能问答，解答各类问题',
    avatar: '🤖',
    systemPrompt: '你是一位专业的医美客服咨询顾问，擅长用不同风格回复客户问题。请根据用户的问题，提供专业、温暖、有同理心的回复。',
    type: 'general',
    isDefault: true,
    supportedModels: ['gemini-3.1-flash-preview', 'gemini-3.1-pro-preview', 'gpt-5.2'],
  },
  {
    id: 'facial',
    name: '面部美学顾问',
    description: '专业面部分析与美学建议，支持生成效果图',
    avatar: '✨',
    systemPrompt: `你是一位资深的面部美学设计专家，拥有15年以上的面部分析和美学设计经验。

【重要】请用中文回复所有分析内容。

请分析用户上传的面部照片，并提供专业的美学分析和建议。

## 分析框架与标准

### 第一部分：整体轮廓分析
- 脸型判断：鹅蛋脸/圆脸/方脸/长脸/心形脸/菱形脸
- 三庭比例：上庭（发际线到眉毛）、中庭（眉毛到鼻尖）、下庭（鼻尖到下巴）
- 五眼标准：脸宽为五个眼长，眼距等于一个眼长
- 侧面线条：额头-鼻子-下巴的角度和起伏

### 第二部分：五官细节分析
- 眉眼区域：眉形、眼距、眼裂长度、眼型（杏眼/桃花眼/丹凤眼等）
- 鼻部区域：鼻梁高度、鼻翼宽度、鼻尖形态、鼻唇角
- 唇部区域：唇形、唇峰、唇珠、人中长度
- 下颌区域：下巴长度、下颌角角度、下缘线条

### 第三部分：皮肤与软组织
- 皮肤质地：毛孔、纹理、光泽度
- 软组织分布：脂肪垫位置、苹果肌饱满度
- 年龄特征：法令纹、泪沟、木偶纹等

### 第四部分：风格量感定位
- 量感等级：微量感/小量感/中量感/大量感/超大量感
- 精致度：骨骼感强弱、软组织饱满度
- 风格适配：少女型、自然型、优雅型、古典型、戏剧型、前卫型、少年型、浪漫型

## 专业要求
1. 使用专业术语，避免主观评价词汇
2. 每个部位都要有"优势"和"待优化点"
3. 提供具体的数据比例（如可测量）
4. 给出3-5个优先级排序的改善建议
5. 基于黄金比例、三庭五眼等美学标准
6. 考虑东方人面部特征标准
7. 提供保守到进取的多层次建议

请详细分析每张照片，并给出综合建议。`,
    type: 'facial',
    supportedModels: ['gemini-3.1-pro-preview', 'gemini-3.1-flash-image-preview', 'gpt-5.2'],
    canGenerateImage: true,
  },
  {
    id: 'content',
    name: '文案创作助手',
    description: '营销文案、社交媒体内容创作',
    avatar: '📝',
    systemPrompt: '你是一位专业的医美文案创作专家，擅长撰写营销文案、社交媒体内容、产品介绍等。请根据用户的需求，创作专业、吸引人的文案内容。',
    type: 'content',
    supportedModels: ['gemini-3.1-flash-preview', 'gemini-3.1-pro-preview', 'gpt-5.2'],
  },
  {
    id: 'video',
    name: '视频创意助手',
    description: '短视频脚本、创意策划',
    avatar: '🎬',
    systemPrompt: '你是一位专业的短视频创意策划专家，擅长撰写抖音、小红书等平台的短视频脚本。请根据用户的需求，提供创意脚本和拍摄建议。',
    type: 'video',
    supportedModels: ['gemini-3.1-flash-preview', 'gemini-3.1-pro-preview', 'gpt-5.2'],
  },
  {
    id: 'nanobanana',
    name: 'Nano Banana',
    description: 'AI 图片创作，支持多种尺寸和清晰度',
    avatar: '🍌',
    systemPrompt: '',
    type: 'image',
    supportedModels: ['gemini-3.1-flash-image-preview'],
    isImageGenerator: true,
  },
]

const CONVERSATIONS_KEY = 'aiscend_conversations'

class AgentService {
  private conversations: Conversation[] = []

  // 获取所有智能体
  getAgents(): Agent[] {
    return DEFAULT_AGENTS
  }

  // 获取默认智能体
  getDefaultAgent(): Agent {
    return DEFAULT_AGENTS.find(a => a.isDefault) || DEFAULT_AGENTS[0]
  }

  // 根据ID获取智能体
  getAgentById(id: string): Agent | undefined {
    return DEFAULT_AGENTS.find(a => a.id === id)
  }

  // 加载所有对话
  async loadConversations(): Promise<Conversation[]> {
    try {
      const data = await AsyncStorage.getItem(CONVERSATIONS_KEY)
      if (data) {
        this.conversations = JSON.parse(data)
        return this.conversations
      }
      return []
    } catch (error) {
      console.error('Failed to load conversations:', error)
      return []
    }
  }

  // 保存对话到存储
  private async saveConversations(): Promise<void> {
    try {
      await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(this.conversations))
    } catch (error) {
      console.error('Failed to save conversations:', error)
    }
  }

  // 创建新对话
  async createConversation(agentId: string): Promise<Conversation> {
    const agent = this.getAgentById(agentId)
    const conversation: Conversation = {
      id: generateUUID(),
      agentId,
      title: '新对话',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.conversations.unshift(conversation)
    await this.saveConversations()
    return conversation
  }

  // 获取对话
  getConversation(conversationId: string): Conversation | undefined {
    return this.conversations.find(c => c.id === conversationId)
  }

  // 获取某个智能体的所有对话
  getConversationsByAgent(agentId: string): Conversation[] {
    return this.conversations.filter(c => c.agentId === agentId)
  }

  // 添加消息到对话
  async addMessage(conversationId: string, message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const conversation = this.getConversation(conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const newMessage: Message = {
      ...message,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
    }

    conversation.messages.push(newMessage)
    conversation.updatedAt = new Date().toISOString()

    // 自动生成标题（使用第一条用户消息）
    if (conversation.title === '新对话' && message.role === 'user') {
      conversation.title = message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '')
    }

    await this.saveConversations()
    return newMessage
  }

  // 更新消息
  async updateMessage(conversationId: string, messageId: string, content: string): Promise<void> {
    const conversation = this.getConversation(conversationId)
    if (!conversation) return

    const message = conversation.messages.find(m => m.id === messageId)
    if (message) {
      message.content = content
      await this.saveConversations()
    }
  }

  // 删除对话
  async deleteConversation(conversationId: string): Promise<void> {
    this.conversations = this.conversations.filter(c => c.id !== conversationId)
    await this.saveConversations()
  }

  // 清空所有对话
  async clearAllConversations(): Promise<void> {
    this.conversations = []
    await this.saveConversations()
  }

  // 更新对话标题
  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const conversation = this.getConversation(conversationId)
    if (conversation) {
      conversation.title = title
      await this.saveConversations()
    }
  }
}

export const agentService = new AgentService()
