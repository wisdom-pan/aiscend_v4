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
import { ThemeContext, AppContext } from '../context'
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
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export function FacialDesign() {
  const [loading, setLoading] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      type: 'assistant',
      content: '您好！我是AI面部美学设计师。请上传您的照片（建议3张：正面、侧面45度、侧面90度），并告诉我您的需求，我将为您提供专业的美学分析和建议。',
      createdAt: new Date().toISOString()
    }
  ])
  const [input, setInput] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('')
  const [geminiApiKey, setGeminiApiKey] = useState<string>('')
  const [backgroundTaskId, setBackgroundTaskId] = useState<string | null>(null)
  const scrollViewRef = useRef<ScrollView | null>(null)
  const { theme } = useContext(ThemeContext)
  const { chatType } = useContext(AppContext)
  const styles = getStyles(theme)

  // 停止响应
  const stopResponse = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
    setLoading(false)
    setGeneratingImage(false)
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
        } else if (task.type === 'image_generation') {
          await resumeImageGenerationTask(task)
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
        createdAt: new Date().toISOString()
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
          model: 'gemini-3-flash-preview',
          temperature: 0.5,
          top_p: 1,
          stream: true
        },
        type: 'openai',
        apiKey: openaiApiKey,
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

          // 如果有部分响应，显示给用户
          if (localResponse && localResponse.length > 0) {
            console.log('显示部分分析结果:', localResponse)
          } else {
            // 如果没有响应，显示错误消息
            const errorMessage: Message = {
              id: generateId(),
              type: 'assistant',
              content: `❌ 分析失败: ${error.message || '未知错误'}`,
              createdAt: new Date().toISOString()
            }
            setMessages(prev => [...prev, errorMessage])
          }

          clearBackgroundTask()
        },
        onClose: async () => {
          setLoading(false)
          setAbortController(null)
          await clearBackgroundTask()

          // TODO: 暂时禁用效果图生成功能
          // 生成效果图功能已禁用
          try {
            await historyService.saveRecord({
              type: 'facial',
              title: `面部分析 - ${task.requirement}`,
              description: localResponse.substring(0, 100) + '...',
              input_data: {
                images: task.imageContents,
                requirement: task.requirement,
              },
              output_data: {
                analysis: localResponse,
              },
              feature: 'facial_design',
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

  // TODO: 暂时禁用效果图生成功能
  // 恢复效果图生成任务 - 已禁用
  const resumeImageGenerationTask = async (task: any) => {
    // 功能已禁用
    console.log('效果图生成功能已禁用')
    setGeneratingImage(false)
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 0.8,
    })

    if (!result.canceled) {
      const selectedImages = result.assets.map(asset => asset.uri)
      setPendingImages(selectedImages)

      const userMessage: Message = {
        id: generateId(),
        type: 'user',
        content: input || '请分析我的照片',
        images: selectedImages,
        createdAt: new Date().toISOString()
      }

      setMessages(prev => [...prev, userMessage])
      setInput('')
      analyzeImages(selectedImages, userMessage.content)
    }
  }

  // 单独测试效果图生成功能
  const testImageGeneration = async () => {
    setGeneratingImage(true)
    try {
      // 添加测试提示
      const testMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: '🧪 正在测试Gemini效果图生成功能...',
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, testMessage])

      // 设置Gemini API密钥
      await apiService.setApiKeys(openaiApiKey, geminiApiKey)

      // 使用示例图片和调整建议
      const sampleImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='

      const sampleAnalysis = `面部美学分析结果：
1. 整体轮廓：脸型偏圆，建议通过发型修饰增加线条感
2. 皮肤状态：皮肤光滑，略有毛孔粗大，建议使用收缩毛孔的产品
3. 眼部：眼形好看，建议保持现状
4. 鼻部：鼻梁挺直，形态良好
5. 唇部：唇形饱满，建议使用保湿产品保持

建议调整：
1. 改善皮肤质感，减少毛孔
2. 增强面部轮廓线条
3. 提升整体气质和自信`

      const imageResult = await apiService.generateComparisonImage(
        sampleImage,
        sampleAnalysis
      )

      // 更新测试消息
      setMessages(prev => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].content = '✅ 测试成功！效果图已生成'
        return newMessages
      })

      // 添加包含效果图的最终消息
      const finalImageMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: '🎨 Gemini效果图测试结果',
        images: [imageResult],
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, finalImageMessage])

      // 记录测试历史
      await historyService.saveRecord({
        type: 'facial',
        title: 'Gemini API 测试',
        description: 'Gemini API效果图生成测试',
        input_data: {
          sampleImage,
          sampleAnalysis
        },
        output_data: {
          generatedImage: imageResult,
        },
        feature: 'facial_design',
      })

    } catch (error) {
      console.error('测试效果图生成失败:', error)
      setMessages(prev => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].content = `❌ 测试失败: ${error.message}`
        return newMessages
      })
    } finally {
      setGeneratingImage(false)
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
        setPendingImages(capturedImages)

        const userMessage: Message = {
          id: generateId(),
          type: 'user',
          content: input || '请分析我的照片',
          images: capturedImages,
          createdAt: new Date().toISOString()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        analyzeImages(capturedImages, userMessage.content)
      }
    }
  }

  const analyzeImages = async (images: string[], requirement: string) => {
    setLoading(true)
    try {
      let localResponse = ''
      const taskId = `analyze-${Date.now()}`
      const controller = new AbortController()
      setAbortController(controller)

      const prompt = `你是一位资深的面部美学设计专家，拥有15年以上的面部分析和美学设计经验。

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
        createdAt: new Date().toISOString()
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

      // 使用gemini-3-flash-preview进行面部分析（支持图片输入和流式输出）
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
          model: 'gemini-3-flash-preview',
          temperature: 0.5,
          top_p: 1,
          stream: true
        },
        type: 'openai',
        apiKey: openaiApiKey,
        abortController: controller,
        onMessage: (data) => {
          console.log('📨 收到数据:', JSON.stringify(data, null, 2))
          if (data.choices && data.choices[0]?.delta?.content) {
            const newContent = data.choices[0].delta.content
            console.log('✏️ 新内容:', newContent)
            localResponse = localResponse + newContent
            console.log('📝 累计内容长度:', localResponse.length)
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1].content = localResponse
              return newMessages
            })

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

          // 如果有部分响应，显示给用户
          if (localResponse && localResponse.length > 0) {
            console.log('显示部分分析结果:', localResponse)
          } else {
            // 如果没有响应，显示错误消息
            const errorMessage: Message = {
              id: generateId(),
              type: 'assistant',
              content: `❌ 分析失败: ${error.message || '未知错误'}`,
              createdAt: new Date().toISOString()
            }
            setMessages(prev => [...prev, errorMessage])
          }

          clearBackgroundTask()
        },
        onClose: async () => {
          setLoading(false)
          setAbortController(null)
          await clearBackgroundTask()

          // OpenAI分析完成后，使用Gemini生成效果图
          try {
            setGeneratingImage(true)

            // 设置Gemini API密钥
            await apiService.setApiKeys(openaiApiKey, geminiApiKey)

            // 添加效果图生成提示
            const imagePromptMessage: Message = {
              id: generateId(),
              type: 'assistant',
              content: '🎨 正在为您生成面部调整效果图...',
              createdAt: new Date().toISOString()
            }
            setMessages(prev => [...prev, imagePromptMessage])

            // 保存效果图生成任务
            await saveBackgroundTask({
              id: `image-${Date.now()}`,
              type: 'image_generation',
              imageContent: imageContents[0],
              suggestions: `基于以下分析建议，请生成优化后的面部效果图：\n\n${localResponse}`,
              timestamp: Date.now()
            })

            // 使用Gemini生成效果图
            const imageResult = await apiService.generateComparisonImage(
              imageContents[0], // 使用第一张图片作为参考
              `基于以下分析建议，请生成优化后的面部效果图：\n\n${localResponse}`
            )

            // 更新效果图消息
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1].content = '🎨 面部调整效果图已生成！'
              return newMessages
            })

            // 添加包含效果图的最终消息
            const finalImageMessage: Message = {
              id: generateId(),
              type: 'assistant',
              content: '✨ 效果图已完成！',
              images: [imageResult],
              createdAt: new Date().toISOString()
            }
            setMessages(prev => [...prev, finalImageMessage])

            // 清除后台任务
            await clearBackgroundTask()

            // 记录历史记录
            await historyService.saveRecord({
              type: 'facial',
              title: `面部分析 - ${requirement}`,
              description: localResponse.substring(0, 100) + '...',
              input_data: {
                images: imageContents,
                requirement,
              },
              output_data: {
                analysis: localResponse,
                generatedImage: imageResult,
              },
              feature: 'facial_design',
            })

          } catch (imageError) {
            console.error('效果图生成失败:', imageError)
            setMessages(prev => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1].content = '⚠️ 效果图生成失败，但美学分析已完成。'
              return newMessages
            })
            await clearBackgroundTask()
          } finally {
            setGeneratingImage(false)
          }
        }
      })

    } catch (error) {
      console.error('分析失败:', error)
      const errorMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: '抱歉，分析过程中出现了错误。请重试或联系客服。',
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
      setLoading(false)
      setAbortController(null)
      await clearBackgroundTask()
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: generateId(),
      type: 'user',
      content: input,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    const userInput = input
    setInput('')
    setLoading(true)

    try {
      let localResponse = ''
      const eventSourceArgs = {
        body: {
          messages: [
            {
              role: 'system',
              content: '你是一位资深的面部美学设计专家，拥有15年以上的面部分析和美学设计经验。请专业、详细地回答用户关于面部美学的问题。如果用户提供了照片，请基于照片进行分析；如果没有照片，请引导用户上传照片以便提供更精准的建议。'
            },
            {
              role: 'user',
              content: userInput
            }
          ],
          model: chatType.label,
          stream: true
        },
        type: getChatType(chatType),
        apiKey: chatType.label.includes('gemini') ? API_KEYS.GEMINI : API_KEYS.OPENAI
      }

      const assistantMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: '',
        createdAt: new Date().toISOString()
      }

      setMessages(prev => [...prev, assistantMessage])

      await fetchStream({
        body: eventSourceArgs.body,
        type: eventSourceArgs.type,
        apiKey: eventSourceArgs.apiKey,
        onMessage: (data) => {
          if (data.choices && data.choices[0]?.delta?.content) {
            localResponse = localResponse + data.choices[0].delta.content
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
        },
        onClose: () => {
          setLoading(false)
        }
      })

    } catch (error) {
      console.error('发送失败:', error)
      const errorMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: '抱歉，发送过程中出现了错误。请重试或联系客服。',
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
      setLoading(false)
    }
  }

  const renderItem = ({ item }: { item: Message }) => {
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
            <Markdown style={styles.markdownStyle}>{item.content}</Markdown>
          ) : (
            <Text style={styles.messageText}>{item.content}</Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.container}
      keyboardVerticalOffset={110}
    >
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesContainer}
        scrollEnabled={true}
      />

      {(loading || generatingImage) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.primaryColor} />
          <Text style={styles.loadingText}>
            {generatingImage ? '🎨 AI正在生成效果图...' : 'AI正在分析中...'}
          </Text>
          <TouchableOpacity style={styles.stopButton} onPress={stopResponse}>
            <Ionicons name="stop-circle" size={20} color="#fff" />
            <Text style={styles.stopButtonText}>停止</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 测试按钮 */}
      <View style={styles.testButtonContainer}>
        <TouchableOpacity style={styles.testButton} onPress={testImageGeneration}>
          <Ionicons name="flask" size={16} color="#fff" />
          <Text style={styles.testButtonText}>测试效果图生成</Text>
        </TouchableOpacity>
      </View>

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
  testButtonContainer: {
    padding: 12,
    paddingBottom: 0,
    alignItems: 'center',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
})
