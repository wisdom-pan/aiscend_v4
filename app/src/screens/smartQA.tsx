import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useState, useContext, useEffect } from 'react'
import { ThemeContext, AppContext } from '../context'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import { fetchStream, getChatType } from '../utils'
import { API_KEYS } from '../../constants'
import { apiService } from '../services/apiService'
import { historyService } from '../services/historyService'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { v4 as uuid } from 'uuid'

interface ReplyOption {
  id: string
  style: string
  content: string
}

// 图片转为base64
const imageToBase64 = async (uri: string): Promise<string> => {
  const response = await fetch(uri)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

interface Scenario {
  key: string
  label: string
  description: string
}

const SCENARIOS: Scenario[] = [
  { key: 'consult', label: '咨询解答', description: '回答客户咨询问题' },
  { key: 'objection', label: '异议处理', description: '处理客户异议和顾虑' },
  { key: 'close', label: '促进成交', description: '推动客户做决定' },
]

const REPLY_STYLES = [
  { key: 'professional', label: '专业权威', description: '用数据和案例说服' },
  { key: 'warm', label: '温暖关怀', description: '情感共鸣+专业建议' },
  { key: 'high_eq', label: '高情商', description: '先理解后引导' },
  { key: 'soothing', label: '安抚型', description: '消除顾虑+重建信任' },
  { key: 'direct', label: '直接型', description: '快速解决问题' },
]

export function SmartQA() {
  const [loading, setLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [question, setQuestion] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [scenario, setScenario] = useState<string>('consult')
  const [replyStyle, setReplyStyle] = useState<string>('professional')
  const [replyOptions, setReplyOptions] = useState<ReplyOption[]>([])
  const [selectedReply, setSelectedReply] = useState<string | null>(null)
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('')

  const { theme } = useContext(ThemeContext)
  const { chatType } = useContext(AppContext)
  const styles = getStyles(theme)

  // 初始化 API Keys
  useEffect(() => {
    async function initializeKeys() {
      // 首先尝试从 constants 导入的硬编码密钥
      if (API_KEYS.OPENAI) {
        setOpenaiApiKey(API_KEYS.OPENAI)
      }

      // 然后尝试从 apiService 加载
      try {
        await apiService.loadApiKeys()
        const { hasOpenAI } = apiService.hasApiKeys()

        if (hasOpenAI) {
          const stored = await AsyncStorage.getItem('openai_api_key')
          if (API_KEYS.OPENAI) {
            setOpenaiApiKey(API_KEYS.OPENAI)
          } else if (stored) {
            setOpenaiApiKey(stored)
          }
        }

        // 设置API密钥到apiService
        const openaiKey = API_KEYS.OPENAI || (await AsyncStorage.getItem('openai_api_key')) || ''
        const geminiKey = API_KEYS.GEMINI || (await AsyncStorage.getItem('gemini_api_key')) || ''
        await apiService.setApiKeys(openaiKey, geminiKey)
      } catch (error) {
        console.error('Failed to initialize API keys:', error)
      }
    }

    initializeKeys()
  }, [])

  // 停止响应
  const stopResponse = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
    setLoading(false)
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    })

    if (!result.canceled) {
      const uri = result.assets[0].uri
      setImage(uri)
    }
  }

  const generateReplies = async () => {
    if (!question.trim() && !image) {
      alert('请输入客户问题或上传图片')
      return
    }

    setLoading(true)
    try {
      const selectedScenario = SCENARIOS.find(s => s.key === scenario)
      const selectedStyle = REPLY_STYLES.find(s => s.key === replyStyle)

      const systemPrompt = `你是一位专业的医美客服咨询顾问，擅长用不同风格回复客户问题。

应用场景：${selectedScenario?.label} - ${selectedScenario?.description}
回复风格：${selectedStyle?.label} - ${selectedStyle?.description}

请基于客户的问题或图片内容，生成5个不同风格的回复选项：
1. 专业权威（用数据和案例说服）
2. 温暖关怀（情感共鸣+专业建议）
3. 高情商（先理解后引导）
4. 安抚型（消除顾虑+重建信任）
5. 直接型（快速解决问题）

要求：
- 每个回复角度不同，避免重复
- 符合医美行业特点
- 专业但不生硬
- 适当引导到店咨询或加微信
- 自然融入问题关键词`

      const controller = new AbortController()
      setAbortController(controller)

      // 构建消息，支持图片多模态输入
      let messages: any[] = [
        {
          role: 'system',
          content: systemPrompt
        }
      ]

      // 用户消息（支持图片）
      if (image) {
        // 将图片转为 base64
        const base64Image = await imageToBase64(image)
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: `客户问题：${question || '请分析图片内容并给出回复建议'}` },
            { type: 'image_url', image_url: { url: base64Image } }
          ]
        })
      } else {
        messages.push({
          role: 'user',
          content: `客户问题：${question}`
        })
      }

      let localResponse = ''

      console.log('🚀 开始生成回复，使用的模型:', chatType.label)
      console.log('🔑 API Key:', openaiApiKey ? openaiApiKey.substring(0, 10) + '...' : '未设置')

      if (!openaiApiKey) {
        console.error('❌ API Key 未设置')
        setLoading(false)
        setAbortController(null)
        alert('请先在设置中配置API Key')
        return
      }

      await fetchStream({
        body: {
          messages,
          model: chatType.label,
          stream: true
        },
        type: getChatType(chatType),
        apiKey: openaiApiKey,
        abortController: controller,
        onMessage: (data) => {
          if (data.choices && data.choices[0]?.delta?.content) {
            const newContent = data.choices[0].delta.content
            localResponse += newContent
          }
        },
        onError: (error) => {
          console.error('Streaming error:', error)
          setLoading(false)
          setAbortController(null)
          alert('生成失败，请重试')
        },
        onClose: async () => {
          console.log('Stream closed')
          setLoading(false)
          setAbortController(null)

          // 解析5个回复选项
          const parseReplyOptions = (text: string): ReplyOption[] => {
            const options: ReplyOption[] = []
            const styleLabels = ['专业权威', '温暖关怀', '高情商', '安抚型', '直接型']

            // 尝试按分隔符分割
            const separators = [
              /\n(\d+[、.]\s*)/,
              /\n(【?\d+】?\s*)/,
              /\n(选项?\d+[：:]\s*)/,
              /(---\n)/,
            ]

            let parts = text.split(separators[0])
            if (parts.length < 3) {
              parts = text.split(separators[1])
            }

            if (parts.length >= 3 && parts[0].trim().length < 100) {
              // 按数字序号分割成功
              const regex = /(\d+[、.]\s*)/
              const optionTexts = text.split(regex).filter(t => t.trim().length > 20)
              optionTexts.forEach((text, index) => {
                const cleanText = text.replace(/^\d+[、.]\s*/, '').trim()
                if (cleanText.length > 10) {
                  options.push({
                    id: uuid(),
                    style: styleLabels[index] || `选项${index + 1}`,
                    content: cleanText
                  })
                }
              })
            }

            // 如果解析失败，创建单个选项
            if (options.length === 0) {
              options.push({
                id: uuid(),
                style: '生成结果',
                content: text
              })
            }

            return options
          }

          const replyOptions = parseReplyOptions(localResponse)
          setReplyOptions(replyOptions)

          // 记录历史
          try {
            await historyService.saveRecord({
              type: 'qa',
              title: `智能问答 - ${question.substring(0, 20)}...`,
              prompt: `问题：${question}\n场景：${scenario}\n风格：${replyStyle}`,
              result: localResponse,
            })
          } catch (historyError) {
            console.error('Failed to save history:', historyError)
          }
        }
      })

    } catch (error) {
      console.error('生成失败:', error)
      alert('生成失败，请重试')
      setLoading(false)
    }
  }

  const copyToClipboard = async (content: string) => {
    try {
      await Clipboard.setStringAsync(content)
      alert('已复制到剪贴板')
    } catch (error) {
      alert('复制失败：' + error.message)
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>智能问答</Text>
        <Text style={styles.subtitle}>高情商沟通助手，让成交更简单</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💬 客户问题</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="输入客户的问题或异议..."
          placeholderTextColor={theme.placeholderColor}
          value={question}
          onChangeText={setQuestion}
          multiline
          numberOfLines={4}
        />
        <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
          <Ionicons name="image-outline" size={20} color={theme.primaryColor} />
          <Text style={styles.attachButtonText}>{image ? '更换图片' : '添加截图（可选）'}</Text>
        </TouchableOpacity>
        {image && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: image }} style={styles.imagePreview} />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setImage(null)}
            >
              <Ionicons name="close-circle" size={20} color="#FF4757" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 沟通场景</Text>
        <View style={styles.scenarioGrid}>
          {SCENARIOS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.scenarioCard,
                scenario === s.key && styles.scenarioCardActive
              ]}
              onPress={() => setScenario(s.key)}
            >
              <Text style={[
                styles.scenarioLabel,
                scenario === s.key && styles.scenarioLabelActive
              ]}>
                {s.label}
              </Text>
              <Text style={[
                styles.scenarioDesc,
                scenario === s.key && styles.scenarioDescActive
              ]}>
                {s.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎨 回复风格</Text>
        <View style={styles.styleGrid}>
          {REPLY_STYLES.map((style) => (
            <TouchableOpacity
              key={style.key}
              style={[
                styles.styleChip,
                replyStyle === style.key && styles.styleChipActive
              ]}
              onPress={() => setReplyStyle(style.key)}
            >
              <Text style={[
                styles.styleChipText,
                replyStyle === style.key && styles.styleChipTextActive
              ]}>
                {style.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={stopResponse}
          >
            <Ionicons name="stop-circle" size={24} color="#fff" />
            <Text style={styles.stopButtonText}>停止生成</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.generateButton}
          onPress={generateReplies}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.buttonText} />
          <Text style={styles.generateButtonText}>生成回复选项</Text>
        </TouchableOpacity>
      )}

      {replyOptions.length > 0 && !loading && (
        <View style={styles.repliesContainer}>
          <Text style={styles.repliesTitle}>✨ 5种回复选项</Text>
          {replyOptions.map((reply) => (
            <TouchableOpacity
              key={reply.id}
              style={[
                styles.replyCard,
                selectedReply === reply.id && styles.replyCardSelected
              ]}
              onPress={() => setSelectedReply(reply.id)}
            >
              <View style={styles.replyHeader}>
                <Text style={styles.replyStyle}>{reply.style}</Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(reply.content)}
                >
                  <Ionicons name="copy-outline" size={20} color={theme.primaryColor} />
                </TouchableOpacity>
              </View>
              <Text style={styles.replyContent}>{reply.content}</Text>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={async () => {
                  try {
                    await historyService.saveRecord({
                      type: 'qa',
                      title: `问答收藏 - ${question.substring(0, 20)}...`,
                      prompt: `问题：${question}\n场景：${scenario}\n风格：${replyStyle}`,
                      result: reply.content,
                    })
                    Alert.alert('提示', '已保存到话术库')
                  } catch (error) {
                    Alert.alert('提示', '保存失败：' + error.message)
                  }
                }}
              >
                <Ionicons name="bookmark-outline" size={16} color={theme.primaryColor} />
                <Text style={styles.saveButtonText}>保存到话术库</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedReply && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedTitle}>已选择回复</Text>
          <Text style={styles.selectedText}>
            {replyOptions.find(r => r.id === selectedReply)?.content}
          </Text>
          <TouchableOpacity style={styles.customizeButton}>
            <Ionicons name="create-outline" size={20} color={theme.buttonText} />
            <Text style={styles.customizeButtonText}>自定义编辑</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColor,
  },
  header: {
    padding: 20,
    backgroundColor: theme.primaryColor,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.buttonText,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.buttonText,
    opacity: 0.9,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textColor,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 8,
    padding: 12,
    color: theme.textColor,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.primaryColor,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  attachButtonText: {
    fontSize: 14,
    color: theme.primaryColor,
    fontWeight: '500',
  },
  imageAttached: {
    fontSize: 14,
    color: theme.primaryColor,
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  scenarioGrid: {
    gap: 12,
  },
  scenarioCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.borderColor,
  },
  scenarioCardActive: {
    backgroundColor: theme.primaryColor,
    borderColor: theme.primaryColor,
  },
  scenarioLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textColor,
    marginBottom: 4,
  },
  scenarioLabelActive: {
    color: theme.buttonText,
  },
  scenarioDesc: {
    fontSize: 14,
    color: theme.placeholderColor,
  },
  scenarioDescActive: {
    color: theme.buttonText,
    opacity: 0.9,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.borderColor,
    backgroundColor: theme.cardBackground,
  },
  styleChipActive: {
    backgroundColor: theme.primaryColor,
    borderColor: theme.primaryColor,
  },
  styleChipText: {
    fontSize: 14,
    color: theme.textColor,
  },
  styleChipTextActive: {
    color: theme.buttonText,
    fontWeight: '600',
  },
  generateButton: {
    margin: 20,
    padding: 16,
    backgroundColor: theme.primaryColor,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.buttonText,
  },
  loadingContainer: {
    margin: 20,
    alignItems: 'center',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  repliesContainer: {
    padding: 20,
  },
  repliesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textColor,
    marginBottom: 16,
  },
  replyCard: {
    padding: 16,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  replyCardSelected: {
    borderColor: theme.primaryColor,
    backgroundColor: theme.primaryColor + '10',
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyStyle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primaryColor,
  },
  replyContent: {
    fontSize: 15,
    color: theme.textColor,
    lineHeight: 24,
    marginBottom: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  saveButtonText: {
    fontSize: 14,
    color: theme.primaryColor,
    fontWeight: '500',
  },
  selectedContainer: {
    margin: 20,
    padding: 16,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.primaryColor,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primaryColor,
    marginBottom: 8,
  },
  selectedText: {
    fontSize: 15,
    color: theme.textColor,
    lineHeight: 24,
    marginBottom: 12,
  },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: theme.primaryColor,
    borderRadius: 8,
  },
  customizeButtonText: {
    fontSize: 16,
    color: theme.buttonText,
    fontWeight: '500',
  },
})
