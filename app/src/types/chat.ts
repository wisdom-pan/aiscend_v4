// Chat session type definitions
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  modelId?: string
  images?: { uri: string; base64?: string }[]
}

export interface ChatSession {
  id: string
  modelId: string
  modelName: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  isPinned?: boolean
}
