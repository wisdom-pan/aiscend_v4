export interface HistoryRecord {
  id: string
  user_id: string
  type: 'facial' | 'content' | 'video' | 'qa'
  image_path?: string
  image_metadata?: {
    mime_type: string
    size: number
    width: number
    height: number
    filename: string
  }
  prompt: string
  result: string
  metadata?: {
    model_provider?: string
    model_name?: string
    temperature?: number
    replay_count?: number
    replayed_at?: string
  }
  created_at: string
}

export interface UsageStats {
  totalAnalyses: number
  totalContentGenerated: number
  totalVideosCreated: number
  totalQaResponses: number
  weeklyActiveDays: number[]
  favoriteFeatures: { [key: string]: number }
  averageSessionTime: number
  conversionRate?: number
}

export interface ChartData {
  labels: string[]
  datasets: {
    data: number[]
    color?: (opacity: number) => string
  }[]
}

export interface PieChartData {
  name: string
  value: number
  color: string
  legendFontColor: string
  legendFontSize: number
}
