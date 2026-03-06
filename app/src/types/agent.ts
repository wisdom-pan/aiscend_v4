// 智能体类型定义

export interface Agent {
  id: string
  name: string
  description: string
  avatar: string // emoji or icon name
  systemPrompt: string
  type: 'facial' | 'general' | 'content' | 'video' | 'image'
  isDefault?: boolean
  supportedModels?: string[] // 支持的模型列表
  canGenerateImage?: boolean // 是否支持生图
  isImageGenerator?: boolean // 是否是纯图片生成器
}

// 可用模型列表 - 与 constants 保持一致
export const AVAILABLE_MODELS = [
  { id: 'gemini-3.1-flash-preview', name: 'Gemini Flash', description: '快速响应' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini Pro', description: '更强推理' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 图像', description: '支持生图' },
  { id: 'gpt-5.2', name: 'GPT-5.2', description: 'OpenAI 最新' },
]

export interface Conversation {
  id: string
  agentId: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[] // base64 images
  createdAt: string
}

export interface ChatState {
  currentAgent: Agent | null
  currentConversation: Conversation | null
  conversations: Conversation[]
  isLoading: boolean
}
