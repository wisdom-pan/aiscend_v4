// Chat session management service
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ChatSession, Message } from '../types/chat'

const STORAGE_KEY = 'chat_sessions'

// 简单的 ID 生成函数，替代 uuid
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const chatService = {
  async getSessions(): Promise<ChatSession[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Failed to get sessions:', error)
      return []
    }
  },

  async saveSessions(sessions: ChatSession[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    } catch (error) {
      console.error('Failed to save sessions:', error)
    }
  },

  async createSession(modelId: string, modelName: string): Promise<ChatSession> {
    const sessions = await this.getSessions()
    const newSession: ChatSession = {
      id: generateId(),
      modelId,
      modelName,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    sessions.unshift(newSession)
    await this.saveSessions(sessions)
    return newSession
  },

  async updateSession(session: ChatSession): Promise<void> {
    const sessions = await this.getSessions()
    const index = sessions.findIndex(s => s.id === session.id)
    if (index !== -1) {
      session.updatedAt = Date.now()
      sessions[index] = session
      await this.saveSessions(sessions)
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    const sessions = await this.getSessions()
    const filtered = sessions.filter(s => s.id !== sessionId)
    await this.saveSessions(filtered)
  },

  async clearAllSessions(): Promise<void> {
    await this.saveSessions([])
  }
}
