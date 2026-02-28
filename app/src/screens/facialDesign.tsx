import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableHighlight,
  Image,
  ActivityIndicator,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Alert
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useState, useRef, useContext, useEffect } from 'react'
import { ThemeContext } from '../context'
import * as ImagePicker from 'expo-image-picker'
import Ionicons from '@expo/vector-icons/Ionicons'
import Markdown from '@ronradtke/react-native-markdown-display'
import { fetchStream, getFirstN, getFirstNCharsOrLess, getChatType } from '../utils'
import { API_KEYS } from '../../constants'
import { apiService } from '../services/apiService'
import { historyService } from '../services/historyService'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  images?: string[]
  createdAt: string
  isComplete?: boolean  // 标记消息是否已完成（用于控制操作按钮显示）
  suggestedQuestions?: string[]  // 引导性问题
}

// 面诊引导性问题
const FACIAL_SUGGESTED_QUESTIONS = [
  '针对我的鼻子，有什么具体改善建议？',
  '我的皮肤适合什么医美项目？',
  '请详细分析一下我的眼部特征',
  '有什么保守的改善方案吗？',
  '帮我制定一个综合的改善计划',
]

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// 内容分段函数（用于选择性复制）
const parseContents = (content: string): string[] => {
  if (!content || typeof content !== 'string') return []

  // 尝试使用 --- 分割
  if (content.includes('---')) {
    return content.split('---').map(s => s.trim()).filter(s => s.length > 0)
  }

  // 尝试使用数字序号分割
  const numberPattern = /^\d+\.|\d+、/m
  if (numberPattern.test(content)) {
    const parts = content.split(/^\d+\.|\d+、/m).map(s => s.trim()).filter(s => s.length > 0)
    if (parts.length > 1) return parts
  }

  // 尝试使用emoji分割
  const emojiPattern = /^[📋🔍💡✨⭐️🎯📌📝🗒️]/m
  if (emojiPattern.test(content)) {
    const parts = content.split(/^[📋🔍💡✨⭐️🎯📌📝🗒️]/m).map(s => s.trim()).filter(s => s.length > 0)
    if (parts.length > 1) return parts
  }

  // 尝试使用章节标题分割（## 开头）
  if (content.includes('##')) {
    const parts = content.split(/^##\s+/m).map(s => s.trim()).filter(s => s.length > 0)
    if (parts.length > 1) return parts
  }

  // 默认返回整个内容作为一个段落
  return [content]
}

export function FacialDesign() {
  const [loading, setLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      type: 'assistant',
      content: '您好！我是AI面部美学设计师。请上传您的照片（建议3张：正面、侧面45度、侧面90度），并告诉我您的需求，我将为您提供专业的美学分析和建议。',
      createdAt: new Date().toISOString(),
      isComplete: true
    }
  ])
  const [input, setInput] = useState('')
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('')
  const [geminiApiKey, setGeminiApiKey] = useState<string>('')
  const [backgroundTaskId, setBackgroundTaskId] = useState<string | null>(null)
  const scrollViewRef = useRef<ScrollView | null>(null)
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)

  // 新开对话
  const handleNewConversation = () => {
    Alert.alert(
      '新开对话',
      '确定要开始新的对话吗？当前对话将被清空。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => {
            setMessages([{
              id: generateId(),
              type: 'assistant',
              content: '您好！我是AI面部美学设计师。请上传您的照片（建议3张：正面、侧面45度、侧面90度），并告诉我您的需求，我将为您提供专业的美学分析和建议。',
              createdAt: new Date().toISOString(),
              isComplete: true
            }])
            setInput('')
            setSelectedImages([])
            setLoading(false)
            clearBackgroundTask()
          }
        }
      ]
    )
  }

  // 停止响应
  const stopResponse = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
    setLoading(false)
    clearBackgroundTask()
  }

  // 初始化 API Keys 和检查后台任务
  useEffect(() => {
    async function initializeKeys() {
      // 首先尝试从 constants 导入的硬编码密钥
      if (API_KEYS.OPENAI) {
        setOpenaiApiKey(API_KEYS.OPENAI)
      }
      if (API_KEYS.GEMINI) {
        setGeminiApiKey(API_KEYS.GEMINI)
      }

      // 然后尝试从 apiService 加载（会优先使用 AsyncStorage 中的值）
      try {
        await apiService.loadApiKeys()
        const { hasOpenAI, hasGemini } = apiService.hasApiKeys()

        if (hasOpenAI) {
          const stored = await AsyncStorage.getItem('openai_api_key')
          // 优先使用API_KEYS常量，如果没有再使用存储的值
          if (API_KEYS.OPENAI) {
            setOpenaiApiKey(API_KEYS.OPENAI)
          } else if (stored) {
            setOpenaiApiKey(stored)
          }
        }
        if (hasGemini) {
          const stored = await AsyncStorage.getItem('gemini_api_key')
          // 优先使用API_KEYS常量，如果没有再使用存储的值
          if (API_KEYS.GEMINI) {
            setGeminiApiKey(API_KEYS.GEMINI)
          } else if (stored) {
            setGeminiApiKey(stored)
          }
        }

        // 设置API密钥到apiService - 优先使用API_KEYS常量
        const openaiKey = API_KEYS.OPENAI || (await AsyncStorage.getItem('openai_api_key')) || ''
        const geminiKey = API_KEYS.GEMINI || (await AsyncStorage.getItem('gemini_api_key')) || ''
        await apiService.setApiKeys(openaiKey, geminiKey)

        // 检查是否有正在运行的后台任务
        await checkBackgroundTask()
      } catch (error) {
        console.error('Failed to initialize API keys:', error)
      }
    }

    initializeKeys()
  }, [])

  // 检查并恢复后台任务
  const checkBackgroundTask = async () => {
    try {
      const backgroundTask = await AsyncStorage.getItem('facial_background_task')
      if (backgroundTask) {
        const task = JSON.parse(backgroundTask)
        console.log('发现后台任务，正在恢复...', task)
        setBackgroundTaskId(task.id)
        setLoading(true)

        // 恢复任务
        if (task.type === 'analyze') {
          await resumeAnalyzeTask(task)
        }
      }
    } catch (error) {
      console.error('检查后台任务失败:', error)
    }
  }

  // 保存后台任务
  const saveBackgroundTask = async (task: any) => {
    try {
      await AsyncStorage.setItem('facial_background_task', JSON.stringify(task))
      setBackgroundTaskId(task.id)
    } catch (error) {
      console.error('保存后台任务失败:', error)
    }
  }

  // 清除后台任务
  const clearBackgroundTask = async () => {
    try {
      await AsyncStorage.removeItem('facial_background_task')
      setBackgroundTaskId(null)
    } catch (error) {
      console.error('清除后台任务失败:', error)
    }
  }

  // 恢复分析任务
  const resumeAnalyzeTask = async (task: any) => {
    try {
      let localResponse = task.partialResponse || ''
      const controller = new AbortController()
      setAbortController(controller)

      const assistantMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: localResponse,
        createdAt: new Date().toISOString(),
        isComplete: false  // 初始时未完成
      }

      setMessages(prev => [...prev, assistantMessage])

      // 继续流式请求
      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: task.prompt
            },
            ...task.imageContents.map((img: string) => ({
              type: 'image_url' as const,
              image_url: { url: img }
            }))
          ]
        }
      ]

      await fetchStream({
        body: {
          messages,
          model: 'gemini-3.1-pro-preview',
          temperature: 0.5,
          top_p: 1,
          stream: true
        },
        type: 'openai',
        apiKey: API_KEYS.GEMINI,
        abortController: controller,
        onMessage: (data) => {
          console.log('📨 [恢复任务] 收到数据:', JSON.stringify(data, null, 2))
          if (data.choices && data.choices[0]?.delta?.content) {
            const newContent = data.choices[0].delta.content
            console.log('✏️ [恢复任务] 新内容:', newContent)
            localResponse = localResponse + newContent
            console.log('📝 [恢复任务] 累计内容长度:', localResponse.length)
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1].content = localResponse
              return newMessages
            })
          } else if (data.choices && data.choices[0]?.message?.content) {
            // 处理非流式响应
            const fullContent = data.choices[0].message.content
            console.log('📦 [恢复任务] 完整内容:', fullContent)
            localResponse = fullContent
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1].content = localResponse
              return newMessages
            })
          }
        },
        onError: (error) => {
          console.error('Connection error:', error)
          setLoading(false)
          setAbortController(null)

          // 将最后一条助手消息标记为完成（即使是错误）
          setMessages(prev => {
            const newMessages = [...prev]
            const lastIndex = newMessages.length - 1
            if (lastIndex >= 0 && newMessages[lastIndex].type === 'assistant') {
              newMessages[lastIndex] = { ...newMessages[lastIndex], isComplete: true }
            }
            return newMessages
          })

          // 如果有部分响应，显示给用户
          if (localResponse && localResponse.length > 0) {
            console.log('显示部分分析结果:', localResponse)
          } else {
            // 如果没有响应，显示错误消息
            const errorMessage: Message = {
              id: generateId(),
              type: 'assistant',
              content: `❌ 分析失败: ${error.message || '未知错误'}`,
              createdAt: new Date().toISOString(),
              isComplete: true
            }
            setMessages(prev => [...prev, errorMessage])
          }

          clearBackgroundTask()
        },
        onClose: async () => {
          setLoading(false)
          setAbortController(null)
          await clearBackgroundTask()

          // 将最后一条助手消息标记为完成并添加引导问题
          setMessages(prev => {
            const newMessages = [...prev]
            const lastIndex = newMessages.length - 1
            if (lastIndex >= 0 && newMessages[lastIndex].type === 'assistant') {
              newMessages[lastIndex] = {
                ...newMessages[lastIndex],
                isComplete: true,
                suggestedQuestions: FACIAL_SUGGESTED_QUESTIONS
              }
            }
            return newMessages
          })

          // TODO: 暂时禁用效果图生成功能
          // 生成效果图功能已禁用
          try {
            await historyService.saveRecord({
              type: 'facial',
              title: `面部分析 - ${task.requirement}`,
              prompt: `需求：${task.requirement}\n图片数量：${task.imageContents.length}`,
              result: localResponse,
            })
          } catch (error) {
            console.error('保存分析记录失败:', error)
          }
        }
      })

    } catch (error) {
      console.error('恢复分析任务失败:', error)
      setLoading(false)
      setAbortController(null)
      clearBackgroundTask()
    }
  }


  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 0.8,
    })

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri)
      setSelectedImages(prev => [...prev, ...newImages].slice(0, 3))
    }
  }

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (permission.granted) {
      const result = await ImagePicker.launchCameraAsync({
        allowsMultipleSelection: true,
        selectionLimit: 3,
        quality: 0.8,
      })

      if (!result.canceled) {
        const capturedImages = result.assets.map(asset => asset.uri)
        setSelectedImages(prev => [...prev, ...capturedImages].slice(0, 3))
      }
    }
  }

  // 清除选中的图片
  const clearSelectedImages = () => {
    setSelectedImages([])
  }

  const analyzeImages = async (images: string[], requirement: string) => {
    setLoading(true)
    try {
      let localResponse = ''
      const taskId = `analyze-${Date.now()}`
      const controller = new AbortController()
      setAbortController(controller)

      const prompt = `你是一位资深的面部美学设计专家，拥有15年以上的面部分析和美学设计经验。

【重要】请用中文回复所有分析内容。

用户需求：${requirement}

请分析用户上传的面部照片，并提供专业的美学分析和建议。

## 分析框架与标准

### 第一部分：整体轮廓分析
- 脸型分类：根据长宽比例判断（鹅蛋脸3:2、方脸1:1、长脸4:3等）
- 三庭比例：额头到眉毛、眉毛到鼻翼、鼻翼到下巴的比例是否协调（标准1:1:1）
- 五眼比例：面部宽度是否等于五只眼睛的宽度
- 面部线条：评估棱角感、流畅度、立体感

### 第二部分：皮肤状态评估
- 皮肤类型：油性/干性/混合性/敏感性/中性
- 皮肤光滑度：光滑/细腻/粗糙/凹凸不平
- 皮肤弹性：紧致/有弹性/松弛/缺乏弹性
- 皮肤水润度：水润/干燥/脱水/正常
- 毛孔状况：细小/正常/粗大/明显
- 色素情况：色斑、色素沉淀、肤色均匀度

### 第三部分：五官区域深度解析
- 额头颅顶区：宽度、高度、发际线、立体度
- 眼周精细分析：眼型、眼距、眼周状态、睫毛
- 颧骨结构：高度、宽度、协调性
- 苹果肌活力：饱满度、动态表现
- 鼻部结构：高度、宽度、形态
- 唇部与下面部：唇形、下颌线条、下巴

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

请详细分析每张照片，并给出综合建议。`

      const assistantMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isComplete: false  // 初始时未完成
      }

      setMessages(prev => [...prev, assistantMessage])

      // 将图片转换为base64格式
      const imageContents = await Promise.all(
        images.map(async (imageUri) => {
          const response = await fetch(imageUri)
          const blob = await response.blob()
          return new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              resolve(reader.result as string)
            }
            reader.readAsDataURL(blob)
          })
        })
      )

      // 保存后台任务
      await saveBackgroundTask({
        id: taskId,
        type: 'analyze',
        prompt,
        imageContents,
        requirement,
        partialResponse: localResponse,
        timestamp: Date.now()
      })

      // 使用gemini-3.1-pro-preview进行面部分析（支持图片输入和流式输出）
      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: prompt
            },
            ...imageContents.map(img => ({
              type: 'image_url' as const,
              image_url: {
                url: img
              }
            }))
          ]
        }
      ]

      console.log('🚀 开始分析，图片数量:', imageContents.length)
      console.log('🔑 API Key:', openaiApiKey.substring(0, 10) + '...')

      await fetchStream({
        body: {
          messages,
          model: 'gemini-3.1-pro-preview',
          temperature: 0.5,
          top_p: 1,
          stream: true
        },
        type: 'openai',
        apiKey: API_KEYS.GEMINI,
        abortController: controller,
        onMessage: (data) => {
          console.log('📨 收到数据:', JSON.stringify(data, null, 2))
          if (data.choices && data.choices[0]?.delta?.content) {
            const newContent = data.choices[0].delta.content
            console.log('✏️ 新内容:', newContent)
            localResponse = localResponse + newContent
            console.log('📝 累计内容长度:', localResponse.length)

            // 强制立即更新UI
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1].content = localResponse
              return newMessages
            })

            // 强制触发UI重绘（防止批量更新合并）
            setTimeout(() => {
              setMessages(current => [...current])
            }, 0)

            // 定期保存进度
            if (localResponse.length % 500 === 0) {
              saveBackgroundTask({
                id: taskId,
                type: 'analyze',
                prompt,
                imageContents,
                requirement,
                partialResponse: localResponse,
                timestamp: Date.now()
              })
            }
          } else if (data.choices && data.choices[0]?.message?.content) {
            // 处理非流式响应
            const fullContent = data.choices[0].message.content
            console.log('📦 完整内容:', fullContent)
            localResponse = fullContent
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1].content = localResponse
              return newMessages
            })
          }
        },
        onError: (error) => {
          console.error('Connection error:', error)
          setLoading(false)
          setAbortController(null)

          // 将最后一条助手消息标记为完成（即使是错误）
          setMessages(prev => {
            const newMessages = [...prev]
            const lastIndex = newMessages.length - 1
            if (lastIndex >= 0 && newMessages[lastIndex].type === 'assistant') {
              newMessages[lastIndex] = { ...newMessages[lastIndex], isComplete: true }
            }
            return newMessages
          })

          // 如果有部分响应，显示给用户
          if (localResponse && localResponse.length > 0) {
            console.log('显示部分分析结果:', localResponse)
          } else {
            // 如果没有响应，显示错误消息
            const errorMessage: Message = {
              id: generateId(),
              type: 'assistant',
              content: `❌ 分析失败: ${error.message || '未知错误'}`,
              createdAt: new Date().toISOString(),
              isComplete: true
            }
            setMessages(prev => [...prev, errorMessage])
          }

          clearBackgroundTask()
        },
        onClose: async () => {
          setLoading(false)
          setAbortController(null)
          await clearBackgroundTask()

          // 将最后一条助手消息标记为完成并添加引导问题
          setMessages(prev => {
            const newMessages = [...prev]
            const lastIndex = newMessages.length - 1
            if (lastIndex >= 0 && newMessages[lastIndex].type === 'assistant') {
              newMessages[lastIndex] = {
                ...newMessages[lastIndex],
                isComplete: true,
                suggestedQuestions: FACIAL_SUGGESTED_QUESTIONS
              }
            }
            return newMessages
          })

          // 分析完成，记录历史记录
          try {
            await historyService.saveRecord({
              type: 'facial',
              title: `面部分析 - ${requirement}`,
              prompt: `需求：${requirement}\n图片数量：${imageContents.length}`,
              result: localResponse,
            })
          } catch (error) {
            console.error('保存分析记录失败:', error)
          }
        }
      })

    } catch (error) {
      console.error('分析失败:', error)
      const errorMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: '抱歉，分析过程中出现了错误。请重试或联系客服。',
        createdAt: new Date().toISOString(),
        isComplete: true,
        suggestedQuestions: ['请重新上传照片', '换一张更清晰的照片试试']
      }
      setMessages(prev => [...prev, errorMessage])
      setLoading(false)
      setAbortController(null)
      await clearBackgroundTask()
    }
  }

  const handleSend = async () => {
    // 如果有图片，先分析图片
    if (selectedImages.length > 0) {
      const userMessage: Message = {
        id: generateId(),
        type: 'user',
        content: input || '请分析我的照片',
        images: selectedImages,
        createdAt: new Date().toISOString(),
        isComplete: true
      }

      setMessages(prev => [...prev, userMessage])
      setInput('')
      setSelectedImages([])
      await analyzeImages(selectedImages, userMessage.content)
      return
    }

    // 没有图片时，发送文字消息
    if (!input.trim()) return

    const userMessage: Message = {
      id: generateId(),
      type: 'user',
      content: input,
      createdAt: new Date().toISOString(),
      isComplete: true
    }

    setMessages(prev => [...prev, userMessage])
    const userInput = input
    setInput('')
    setLoading(true)

    try {
      let localResponse = ''

      // 构建包含历史消息的对话
      const conversationHistory = [
        ...messages.map(m => ({
          role: m.type === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content
        })),
        {
          role: 'user' as const,
          content: userInput
        }
      ]

      const eventSourceArgs = {
        body: {
          messages: conversationHistory,
          model: 'gemini-3.1-pro-preview',
          stream: true
        },
        type: 'openai',
        apiKey: API_KEYS.GEMINI
      }

      const assistantMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isComplete: false  // 初始时未完成
      }

      setMessages(prev => [...prev, assistantMessage])

      await fetchStream({
        body: eventSourceArgs.body,
        type: eventSourceArgs.type,
        apiKey: eventSourceArgs.apiKey,
        onMessage: (data) => {
          console.log('📨 收到数据:', JSON.stringify(data, null, 2))
          if (data.choices && data.choices[0]?.delta?.content) {
            const newContent = data.choices[0].delta.content
            console.log('✏️ 新内容:', newContent)
            localResponse = localResponse + newContent
            console.log('📝 累计内容长度:', localResponse.length)

            // 强制立即更新UI
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1].content = localResponse
              return newMessages
            })

            // 强制触发UI重绘（防止批量更新合并）
            setTimeout(() => {
              setMessages(current => [...current])
            }, 0)

            // 定期保存进度
            if (localResponse.length % 500 === 0) {
              historyService.updateRecord(assistantMessage.id, {
                title: localResponse.substring(0, 50) + '...'
              }).catch(console.error)
            }
          }
        },
        onError: (error) => {
          console.error('Connection error:', error)
          setLoading(false)

          // 将最后一条助手消息标记为完成（即使是错误）
          setMessages(prev => {
            const newMessages = [...prev]
            const lastIndex = newMessages.length - 1
            if (lastIndex >= 0 && newMessages[lastIndex].type === 'assistant') {
              newMessages[lastIndex] = { ...newMessages[lastIndex], isComplete: true }
            }
            return newMessages
          })
        },
        onClose: () => {
          setLoading(false)

          // 将最后一条助手消息标记为完成并添加引导问题
          setMessages(prev => {
            const newMessages = [...prev]
            const lastIndex = newMessages.length - 1
            if (lastIndex >= 0 && newMessages[lastIndex].type === 'assistant') {
              newMessages[lastIndex] = {
                ...newMessages[lastIndex],
                isComplete: true,
                suggestedQuestions: FACIAL_SUGGESTED_QUESTIONS
              }
            }
            return newMessages
          })
        }
      })

    } catch (error) {
      console.error('发送失败:', error)
      const errorMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: '抱歉，发送过程中出现了错误。请重试或联系客服。',
        createdAt: new Date().toISOString(),
        isComplete: true
      }
      setMessages(prev => [...prev, errorMessage])
      setLoading(false)
    }
  }

  const renderItem = ({ item }: { item: Message }) => {
    // 处理追问
    const handleFollowUp = (question: string) => {
      setInput(question)
      setTimeout(() => handleSend(), 100)
    }

    // 处理选择性复制
    const handleCopyContent = async (content: string) => {
      try {
        await Clipboard.setStringAsync(content)
        Alert.alert('提示', '内容已复制到剪贴板')
      } catch (error) {
        Alert.alert('提示', '复制失败：' + error.message)
      }
    }

    return (
      <View style={[styles.messageContainer, item.type === 'user' ? styles.userMessage : styles.assistantMessage]}>
        {item.images && item.images.length > 0 && (
          <View style={styles.imageContainer}>
            {item.images.map((uri, index) => (
              <TouchableOpacity
                key={index}
                onLongPress={async () => {
                  try {
                    // 复制到剪贴板
                    await Clipboard.setString(uri)
                    Alert.alert('提示', '图片已复制到剪贴板')
                  } catch (error) {
                    Alert.alert('提示', '复制失败：' + error.message)
                  }
                }}
                activeOpacity={0.7}
              >
                <Image source={{ uri }} style={styles.messageImage} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={[styles.messageBubble, item.type === 'user' ? styles.userBubble : styles.assistantBubble]}>
          {item.type === 'assistant' ? (
            <View>
              {parseContents(item.content).map((content, index) => (
                <View key={index} style={styles.contentSection}>
                  <View style={styles.contentHeader}>
                    <Text style={styles.contentTitle}>第 {index + 1} 部分</Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => handleCopyContent(content)}
                    >
                      <Ionicons name="copy-outline" size={16} color={theme.primaryColor} />
                      <Text style={styles.copyBtnText}>复制</Text>
                    </TouchableOpacity>
                  </View>
                  <Markdown style={styles.markdownStyle}>{content}</Markdown>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.messageText}>{item.content}</Text>
          )}
        </View>

        {/* 操作按钮 - 只在消息完成时显示 */}
        {item.type === 'assistant' && item.isComplete && (
          <View style={styles.messageActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(item.content)
                  Alert.alert('提示', '分析结果已复制到剪贴板')
                } catch (error) {
                  Alert.alert('提示', '复制失败：' + error.message)
                }
              }}
            >
              <Ionicons name="copy-outline" size={18} color="#666" />
              <Text style={styles.actionBtnText}>复制全部</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  await historyService.saveRecord({
                    type: 'facial',
                    title: item.content.substring(0, 30) + '...',
                    prompt: '面部分析结果',
                    result: item.content,
                  })
                  Alert.alert('提示', '已收藏到历史记录')
                } catch (error) {
                  Alert.alert('提示', '收藏失败：' + error.message)
                }
              }}
            >
              <Ionicons name="bookmark-outline" size={18} color="#666" />
              <Text style={styles.actionBtnText}>收藏</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                // 重试功能 - 重新发送最后一条用户消息
                const lastUserMessage = messages.filter(m => m.type === 'user').pop()
                if (lastUserMessage) {
                  setInput(lastUserMessage.content)
                  setMessages(messages.filter(m => m.id !== item.id))
                  handleSend()
                }
              }}
            >
              <Ionicons name="refresh-outline" size={18} color="#666" />
              <Text style={styles.actionBtnText}>重试</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 引导性提问 */}
        {item.type === 'assistant' && item.isComplete && item.suggestedQuestions && item.suggestedQuestions.length > 0 && (
          <View style={styles.suggestedQuestions}>
            <Text style={styles.suggestedTitle}>💡 您可以继续问：</Text>
            {item.suggestedQuestions.map((q, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestedBtn}
                onPress={() => handleFollowUp(q)}
              >
                <Text style={styles.suggestedBtnText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.container}
      keyboardVerticalOffset={110}
    >
      {messages.length > 1 && (
        <View style={styles.chatHeader}>
          <Text style={styles.chatHeaderTitle}>当前对话</Text>
          <TouchableOpacity style={styles.newChatButton} onPress={handleNewConversation}>
            <Ionicons name="add-circle-outline" size={18} color={theme.primaryColor} />
            <Text style={styles.newChatButtonText}>新开对话</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesContainer}
        scrollEnabled={true}
      />

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.primaryColor} />
          <Text style={styles.loadingText}>AI正在分析中...</Text>
          <TouchableOpacity style={styles.stopButton} onPress={stopResponse}>
            <Ionicons name="stop-circle" size={20} color="#fff" />
            <Text style={styles.stopButtonText}>停止</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 已选择的图片预览 */}
      {selectedImages.length > 0 && (
        <View style={styles.selectedImagesContainer}>
          <View style={styles.selectedImagesHeader}>
            <Text style={styles.selectedImagesTitle}>已选择 {selectedImages.length} 张图片</Text>
            <TouchableOpacity onPress={clearSelectedImages}>
              <Text style={styles.clearImagesText}>清除</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.selectedImagesList}>
              {selectedImages.map((uri, index) => (
                <TouchableOpacity key={index} onPress={() => {
                  // 点击移除这张图片
                  setSelectedImages(prev => prev.filter((_, i) => i !== index))
                }}>
                  <Image source={{ uri }} style={styles.selectedImage} />
                  <View style={styles.removeImageBtn}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
          <Ionicons name="camera" size={24} color={theme.primaryColor} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
          <Ionicons name="image" size={24} color={theme.primaryColor} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="描述需求或提问..."
          placeholderTextColor={theme.placeholderColor}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableHighlight
          underlayColor={'transparent'}
          activeOpacity={0.65}
          onPress={handleSend}
        >
          <View style={styles.sendButton}>
            <Ionicons name="send" size={20} color={theme.buttonText} />
          </View>
        </TouchableHighlight>
      </View>
    </KeyboardAvoidingView>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColor,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  chatHeaderTitle: {
    fontSize: 14,
    color: theme.textColor,
    fontWeight: '500',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.primaryColor + '15',
  },
  newChatButtonText: {
    fontSize: 13,
    color: theme.primaryColor,
    fontWeight: '500',
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '100%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  imageContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  messageImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: theme.primaryColor,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: theme.cardBackground,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: theme.buttonText,
    fontSize: 16,
    lineHeight: 22,
  },
  markdownStyle: {
    body: {
      color: theme.textColor,
      fontSize: 16,
      lineHeight: 22,
    },
    heading1: {
      color: theme.textColor,
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    heading2: {
      color: theme.textColor,
      fontSize: 17,
      fontWeight: '600',
      marginBottom: 6,
    },
    heading3: {
      color: theme.textColor,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    bullet_list: {
      color: theme.textColor,
    },
    list_item: {
      color: theme.textColor,
      marginBottom: 2,
    },
    strong: {
      fontWeight: 'bold',
      color: theme.tintColor,
    },
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  loadingText: {
    color: theme.placeholderColor,
    fontSize: 14,
    marginBottom: 8,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedImagesContainer: {
    padding: 12,
    backgroundColor: theme.cardBackground,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
  },
  selectedImagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedImagesTitle: {
    fontSize: 13,
    color: theme.textColor,
    fontWeight: '500',
  },
  clearImagesText: {
    fontSize: 13,
    color: theme.primaryColor,
  },
  selectedImagesList: {
    flexDirection: 'row',
    gap: 8,
  },
  selectedImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF4757',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    backgroundColor: theme.backgroundColor,
    gap: 8,
  },
  imageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    color: theme.textColor,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 12,
    color: '#666',
  },
  suggestedQuestions: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
  },
  suggestedTitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  suggestedBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestedBtnText: {
    fontSize: 13,
    color: '#333',
  },
  contentSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primaryColor,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.primaryColor + '20',
    borderRadius: 12,
  },
  copyBtnText: {
    fontSize: 12,
    color: theme.primaryColor,
    fontWeight: '500',
  },
})
