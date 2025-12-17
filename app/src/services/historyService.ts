import AsyncStorage from '@react-native-async-storage/async-storage'
import { HistoryRecord, UsageStats, PieChartData } from '../types/history'

const HISTORY_KEY = 'aisenda_history'
const STATS_KEY = 'aisenda_stats'
const USER_ID_KEY = 'aisenda_user_id'

export class HistoryService {
  private static instance: HistoryService
  private userId: string = ''

  private constructor() {
    this.initializeUserId()
  }

  static getInstance(): HistoryService {
    if (!HistoryService.instance) {
      HistoryService.instance = new HistoryService()
    }
    return HistoryService.instance
  }

  private async initializeUserId() {
    try {
      const existingId = await AsyncStorage.getItem(USER_ID_KEY)
      if (existingId) {
        this.userId = existingId
      } else {
        this.userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        await AsyncStorage.setItem(USER_ID_KEY, this.userId)
      }
    } catch (error) {
      console.error('Error initializing user ID:', error)
      this.userId = `user_${Date.now()}`
    }
  }

  async saveRecord(record: Omit<HistoryRecord, 'id' | 'user_id' | 'created_at'>): Promise<HistoryRecord> {
    try {
      const newRecord: HistoryRecord = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: this.userId,
        created_at: new Date().toISOString(),
        ...record,
      }

      const existingHistory = await this.getHistory()
      const updatedHistory = [newRecord, ...existingHistory]

      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory))
      await this.updateStats(newRecord)

      return newRecord
    } catch (error) {
      console.error('Error saving record:', error)
      throw error
    }
  }

  async getHistory(limit?: number): Promise<HistoryRecord[]> {
    try {
      const historyJson = await AsyncStorage.getItem(HISTORY_KEY)
      if (!historyJson) return []

      const history: HistoryRecord[] = JSON.parse(historyJson)

      if (limit) {
        return history.slice(0, limit)
      }

      return history
    } catch (error) {
      console.error('Error getting history:', error)
      return []
    }
  }

  async getHistoryByType(type: HistoryRecord['type'], limit?: number): Promise<HistoryRecord[]> {
    const history = await this.getHistory()
    const filtered = history.filter(record => record.type === type)

    if (limit) {
      return filtered.slice(0, limit)
    }

    return filtered
  }

  async deleteRecord(id: string): Promise<void> {
    try {
      const history = await this.getHistory()
      const updatedHistory = history.filter(record => record.id !== id)
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory))
    } catch (error) {
      console.error('Error deleting record:', error)
      throw error
    }
  }

  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY)
    } catch (error) {
      console.error('Error clearing history:', error)
      throw error
    }
  }

  private async updateStats(record: HistoryRecord): Promise<void> {
    try {
      const stats = await this.getStats()
      const today = new Date().toISOString().split('T')[0]

      switch (record.type) {
        case 'facial':
          stats.totalAnalyses += 1
          break
        case 'content':
          stats.totalContentGenerated += 1
          break
        case 'video':
          stats.totalVideosCreated += 1
          break
        case 'qa':
          stats.totalQaResponses += 1
          break
      }

      if (!stats.weeklyActiveDays.includes(today)) {
        stats.weeklyActiveDays.push(today)
        if (stats.weeklyActiveDays.length > 7) {
          stats.weeklyActiveDays = stats.weeklyActiveDays.slice(-7)
        }
      }

      stats.favoriteFeatures[record.type] = (stats.favoriteFeatures[record.type] || 0) + 1

      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats))
    } catch (error) {
      console.error('Error updating stats:', error)
    }
  }

  async getStats(): Promise<UsageStats> {
    try {
      const statsJson = await AsyncStorage.getItem(STATS_KEY)
      if (!statsJson) {
        return this.getDefaultStats()
      }

      return JSON.parse(statsJson)
    } catch (error) {
      console.error('Error getting stats:', error)
      return this.getDefaultStats()
    }
  }

  private getDefaultStats(): UsageStats {
    return {
      totalAnalyses: 0,
      totalContentGenerated: 0,
      totalVideosCreated: 0,
      totalQaResponses: 0,
      weeklyActiveDays: [],
      favoriteFeatures: {},
      averageSessionTime: 0,
      conversionRate: 0,
    }
  }

  async getUsageChartData(): Promise<PieChartData[]> {
    const stats = await this.getStats()

    return [
      {
        name: '面部分析',
        value: stats.totalAnalyses,
        color: '#FF6B9D',
        legendFontColor: '#333',
        legendFontSize: 14,
      },
      {
        name: '文案生成',
        value: stats.totalContentGenerated,
        color: '#C06C84',
        legendFontColor: '#333',
        legendFontSize: 14,
      },
      {
        name: '视频创作',
        value: stats.totalVideosCreated,
        color: '#6C5B7B',
        legendFontColor: '#333',
        legendFontSize: 14,
      },
      {
        name: '智能问答',
        value: stats.totalQaResponses,
        color: '#355C7D',
        legendFontColor: '#333',
        legendFontSize: 14,
      },
    ]
  }

  async getWeeklyActivityData(): Promise<{ labels: string[], data: number[] }> {
    const history = await this.getHistory()
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return date.toISOString().split('T')[0]
    })

    const activityCount = last7Days.map(date => {
      return history.filter(record =>
        record.created_at.startsWith(date)
      ).length
    })

    const dayLabels = last7Days.map(date => {
      const day = new Date(date).getDay()
      return ['日', '一', '二', '三', '四', '五', '六'][day]
    })

    return {
      labels: dayLabels,
      data: activityCount,
    }
  }

  async exportHistory(): Promise<string> {
    const history = await this.getHistory()
    return JSON.stringify(history, null, 2)
  }

  async importHistory(historyJson: string): Promise<void> {
    try {
      const history: HistoryRecord[] = JSON.parse(historyJson)
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('Error importing history:', error)
      throw error
    }
  }
}

export const historyService = HistoryService.getInstance()
