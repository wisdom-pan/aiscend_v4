import { SetStateAction, Dispatch } from 'react'

export interface IIconProps {
  type: string
  props: any
}

export interface IOpenAIMessages {
  role: string
  content: string
}

export interface IOpenAIUserHistory {
  user: string
  assistant: string
  fileIds?: any[]
}

export interface IOpenAIStateWithIndex {
  index: string
  messages: IOpenAIUserHistory[]
}

export interface IThemeContext {
  theme: any
  setTheme: Dispatch<SetStateAction<string>>
  themeName: string
}

export interface Model {
  name: string;
  label: string;
  icon: any
}

export interface IAppContext {
  setImageModel: Dispatch<SetStateAction<string>>
  imageModel: string,
  closeModal: () => void,
  illusionImage: string,
  setIllusionImage: Dispatch<SetStateAction<string>>,
}

// History types
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
  weeklyActiveDays: string[]
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