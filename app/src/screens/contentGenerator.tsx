import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useState, useContext, useRef, useEffect } from 'react'
import { ThemeContext } from '../context'
import * as ImagePicker from 'expo-image-picker'
import Ionicons from '@expo/vector-icons/Ionicons'
import Markdown from '@ronradtke/react-native-markdown-display'
import { fetchStream } from '../utils'
import { API_KEYS } from '../../constants'
import { historyService } from '../services/historyService'

interface ContentStyle {
  key: string
  label: string
  description: string
}

interface Persona {
  key: string
  label: string
  description: string
}

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  images?: string[]
  createdAt: string
  isComplete?: boolean
  suggestedQuestions?: string[]
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

const CONTENT_STYLES: ContentStyle[] = [
  { key: 'professional', label: '专业引导', description: '突出技术实力和案例效果' },
  { key: 'customer_voice', label: '客户口碑', description: '真实案例分享' },
  { key: 'industry_authority', label: '行业权威', description: '专业观点输出' },
  { key: 'value_delivery', label: '价值交付', description: '效果导向' },
  { key: 'life_quality', label: '生活质感', description: '生活方式分享' },
  { key: 'personal_thoughts', label: '个性随想', description: '个人感悟' },
  { key: 'core_concept', label: '核心理念', description: '品牌价值观' },
  { key: 'warm_care', label: '温暖关怀', description: '情感连接' },
]

const PERSONAS: Persona[] = [
  { key: 'professional', label: '专业严谨', description: '权威、精准、效果、案例' },
  { key: 'warm', label: '亲切温和', description: '贴心、关怀、陪伴、改变' },
  { key: 'sharp', label: '犀利直接', description: '效果、性价比、真相、改变' },
]

// 引导性问题模板
const SUGGESTED_QUESTIONS = [
  '帮我换一个更吸引人的开头',
  '增加一些互动性的问题',
  '让文案更有情感共鸣',
  '加入一些专业术语提升权威感',
  '生成一个更简短的版本',
]

// 内容分段函数（用于选择性复制）
const parseContents = (content: string): string[] => {
  if (!content || typeof content !== 'string') return []

  // 清理转义字符（支持多种格式，包括 \\n  literal 字符串）
  // 先处理双反斜杠的情况（JSON 编码），再处理单反斜杠
  let cleaned = content
    // 1. 先把 \\n 替换为实际换行（双反斜杠-n）
    .replace(/\\\\n/g, '\n')
    // 2. 再把 \n 替换为实际换行（单反斜杠-n）
    .replace(/\\n/g, '\n')
    // 3. 处理其他转义字符
    .replace(/\\t/g, '    ')
    .replace(/\\r/g, '')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim()

  // 尝试使用 --- 分割
  if (cleaned.includes('---')) {
    return cleaned.split('---').map(s => s.trim()).filter(s => s.length > 0)
  }
  // 默认返回整个内容作为一个段落
  return [cleaned]
}

export function ContentGenerator() {
  const [loading, setLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [images, setImages] = useState<string[]>([]) // 支持多图
  const [selectedPersona, setSelectedPersona] = useState<string>('professional')
  const [selectedStyle, setSelectedStyle] = useState<string>('professional')
  const [keywords, setKeywords] = useState('')
  const [wordCount, setWordCount] = useState('100-200')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      type: 'assistant',
      content: '您好！我是朋友圈文案生成助手。请选择人设、风格，输入关键词，我将为您生成专业的医美朋友圈内容。',
      createdAt: new Date().toISOString(),
      isComplete: true,
    }
  ])
  const [followUpInput, setFollowUpInput] = useState('')
  const [showSettings, setShowSettings] = useState(true)
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const flatListRef = useRef<FlatList>(null)
  const messagesRef = useRef<Message[]>(messages)

  // 更新 messagesRef 当 messages 变化时
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // 停止响应
  const stopResponse = () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
    setLoading(false)
  }

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
              content: '您好！我是AI内容创作助手。请选择人设风格，填写内容关键词，我将为您生成专业的医美内容。',
              createdAt: new Date().toISOString(),
              isComplete: true
            }])
            setImages([])
            setKeywords('')
            setFollowUpInput('')
            setShowSettings(true)
            setLoading(false)
          }
        }
      ]
    )
  }

  // 多图上传
  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    })

    if (!result.canceled) {
      setImages(result.assets.map(asset => asset.uri))
    }
  }

  // 删除单张图片
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const generateContent = async (isFollowUp: boolean = false, followUpMessage?: string) => {
    if (!isFollowUp && !keywords.trim()) {
      Alert.alert('提示', '请输入关键词')
      return
    }

    setLoading(true)
    setShowSettings(false) // 隐藏设置面板

    try {
      const openaiKey = API_KEYS.OPENAI
      const geminiKey = API_KEYS.GEMINI

      if (!openaiKey && !geminiKey) {
        setLoading(false)
        Alert.alert('提示', '请先配置 API Key')
        return
      }

      const selectedPersonaObj = PERSONAS.find(p => p.key === selectedPersona)
      const selectedStyleObj = CONTENT_STYLES.find(s => s.key === selectedStyle)

      // 添加用户消息
      const userContent = isFollowUp
        ? followUpMessage || followUpInput
        : `关键词：${keywords}\n人设：${selectedPersonaObj?.label}\n风格：${selectedStyleObj?.label}\n字数：${wordCount}`

      const userMessage: Message = {
        id: generateId(),
        type: 'user',
        content: userContent,
        images: isFollowUp ? undefined : (images.length > 0 ? [...images] : undefined),
        createdAt: new Date().toISOString(),
        isComplete: true
      }

      setMessages(prev => [...prev, userMessage])
      if (!isFollowUp) {
        setFollowUpInput('')
      }

      // 构建对话历史
      const conversationHistory = messagesRef.current
        .filter((m: any) => m.isComplete)
        .map((m: any) => ({
          role: m.type === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content
        }))

      const isLifeStyle = selectedStyle === 'life_quality' || selectedStyle === 'personal_thoughts'
      const styleHint = isLifeStyle
        ? '\n\n【特别提示】这是生活类内容，请创作纯生活方式/个人感悟类文案，不要提及任何医美、整形、整形手术、注射、项目等专业医美内容。内容应该轻松、自然、贴近生活。'
        : '\n\n【特别提示】这是医美行业内容，可以适当融入医美相关元素。'

      const prompt = `你是一位专业的医美朋友圈文案创作专家。

根据用户需求，直接输出文案内容。

要求：
- 自然流畅，符合医美行业特点
- 适当融入关键词
- 引导客户互动或咨询

直接输出文案，不需要任何格式说明。

## 用户需求：
人设风格：${selectedPersonaObj?.label} - ${selectedPersonaObj?.description}
内容风格：${selectedStyleObj?.label} - ${selectedStyleObj?.description}
目标字数：${wordCount}${styleHint}

如果用户要求修改或调整，请基于之前生成的内容进行优化。

用户需求：${userContent}`

      let localResponse = ''
      const controller = new AbortController()
      setAbortController(controller)

      const assistantMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isComplete: false,
        suggestedQuestions: []
      }

      setMessages(prev => [...prev, assistantMessage])

      // 处理图片（和面部美学保持一致）
      let imageContents: string[] = []
      if (!isFollowUp && images.length > 0) {
        imageContents = await Promise.all(images.map(async (imageUri) => {
          const response = await fetch(imageUri)
          const blob = await response.blob()
          return new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              resolve(reader.result as string)
            }
            reader.readAsDataURL(blob)
          })
        }))
      }

      // 构建多模态消息（和面部美学保持一致）
      const messages = [
        ...conversationHistory,
        {
          role: 'user' as const,
          content: imageContents.length > 0
            ? [
                { type: 'text' as const, text: prompt },
                ...imageContents.map((img: string) => ({
                  type: 'image_url' as const,
                  image_url: { url: img }
                }))
              ]
            : prompt
        }
      ]

      // 调用流式 API（和面部美学保持一致）
      await fetchStream({
        body: {
          messages,
          model: 'gemini-3-flash-preview',
          temperature: 0.5,
          stream: true
        },
        apiKey: openaiKey || geminiKey,
        abortController: controller,
        onMessage: (data) => {
          try {
            if (data.choices && data.choices[0]?.delta?.content) {
              let newContent = data.choices[0].delta.content
              // 清理转义字符（支持 \\n literal 字符串）
              newContent = newContent
                .replace(/\\\\n/g, '\n')
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '    ')
                .replace(/\\r/g, '')
              localResponse += newContent
              setMessages(prev => {
                const newMessages = [...prev]
                newMessages[newMessages.length - 1].content = localResponse
                return newMessages
              })
              // 强制触发UI重绘
              setTimeout(() => {
                setMessages(current => [...current])
              }, 0)
            }
          } catch (error) {
            console.error('Failed to parse stream data:', error)
          }
        },
        onError: (error) => {
          console.error('Streaming error:', error)
          setLoading(false)
          setAbortController(null)

          setMessages(prev => {
            const newMessages = [...prev]
            const lastIndex = newMessages.length - 1
            if (lastIndex >= 0) {
              newMessages[lastIndex] = {
                ...newMessages[lastIndex],
                content: localResponse || '生成失败，请重试',
                isComplete: true,
                suggestedQuestions: SUGGESTED_QUESTIONS.slice(0, 3)
              }
            }
            return newMessages
          })
        },
        onClose: async () => {
          setLoading(false)
          setAbortController(null)

          // 添加引导性问题
          setMessages(prev => {
            const newMessages = [...prev]
            const lastIndex = newMessages.length - 1
            if (lastIndex >= 0) {
              newMessages[lastIndex] = {
                ...newMessages[lastIndex],
                isComplete: true,
                suggestedQuestions: SUGGESTED_QUESTIONS.slice(0, 3)
              }
            }
            return newMessages
          })

          // 记录历史
          try {
            await historyService.saveRecord({
              type: 'content',
              title: `文案生成 - ${keywords}`,
              prompt: `关键词：${keywords}\n人设：${selectedPersonaObj?.label}\n风格：${selectedStyleObj?.label}`,
              result: localResponse,
              image_path: images.length > 0 ? images[0] : undefined,
            })
          } catch (historyError) {
            console.error('Failed to save history:', historyError)
          }
        }
      })
    } catch (error: any) {
      console.error('生成失败:', error)
      setLoading(false)
      setAbortController(null)

      setMessages(prev => {
        const newMessages = [...prev]
        const lastIndex = newMessages.length - 1
        if (lastIndex >= 0) {
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            content: error.message || '生成失败，请重试',
            isComplete: true,
            suggestedQuestions: SUGGESTED_QUESTIONS.slice(0, 3)
          }
        }
        return newMessages
      })
    }
  }

  // 处理追问
  const handleFollowUp = (question?: string) => {
    const message = question || followUpInput.trim()
    if (!message) return
    setFollowUpInput('')
    generateContent(true, message)
  }

  // 复制单段内容
  const copyContent = async (content: string) => {
    try {
      await Clipboard.setStringAsync(content)
      Alert.alert('提示', '内容已复制到剪贴板')
    } catch (error) {
      Alert.alert('提示', '复制失败')
    }
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.type === 'user'

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.assistantMessage]}>
        {/* 用户图片 */}
        {item.images && item.images.length > 0 && (
          <View style={styles.messageImageContainer}>
            {item.images.map((uri, index) => (
              <Image key={index} source={{ uri }} style={styles.messageImage} />
            ))}
          </View>
        )}

        {/* 消息内容 */}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {isUser ? (
            <Text style={styles.userMessageText}>{item.content}</Text>
          ) : (
            <View>
              {parseContents(item.content).map((content, index) => (
                <View key={index} style={styles.contentSection}>
                  <View style={styles.contentHeader}>
                    <Text style={styles.contentTitle}>第 {index + 1} 部分</Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => copyContent(content)}
                    >
                      <Ionicons name="copy-outline" size={16} color={theme.primaryColor} />
                      <Text style={styles.copyBtnText}>复制</Text>
                    </TouchableOpacity>
                  </View>
                  <Markdown style={styles.markdownStyle}>{content}</Markdown>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 引导性提问 */}
        {!isUser && item.isComplete && item.suggestedQuestions && item.suggestedQuestions.length > 0 && (
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
    <KeyboardAvoidingView behavior="padding" style={styles.container} keyboardVerticalOffset={110}>
      {/* 头部 - 新开对话按钮 */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>文案生成</Text>
          <TouchableOpacity style={styles.newChatButton} onPress={handleNewConversation}>
            <Ionicons name="add-circle-outline" size={18} color={theme.buttonText} />
            <Text style={styles.newChatButtonText}>新开对话</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>AI驱动的医美朋友圈文案创作</Text>
      </View>

      {/* 可折叠的设置面板 */}
      {showSettings && (
        <ScrollView style={styles.settingsPanel} showsVerticalScrollIndicator={false}>
          {/* 多图上传 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📷 上传素材（可选，最多5张）</Text>
            <View style={styles.imageGrid}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.uploadedImage} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF4757" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
                  <Ionicons name="add" size={32} color={theme.primaryColor} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 人设选择 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 选择人设</Text>
            <View style={styles.optionRow}>
              {PERSONAS.map((persona) => (
                <TouchableOpacity
                  key={persona.key}
                  style={[
                    styles.optionChip,
                    selectedPersona === persona.key && styles.optionChipActive
                  ]}
                  onPress={() => setSelectedPersona(persona.key)}
                >
                  <Text style={[
                    styles.optionChipText,
                    selectedPersona === persona.key && styles.optionChipTextActive
                  ]}>
                    {persona.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 风格选择 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎨 选择风格</Text>
            <View style={styles.styleGrid}>
              {CONTENT_STYLES.map((style) => (
                <TouchableOpacity
                  key={style.key}
                  style={[
                    styles.styleChip,
                    selectedStyle === style.key && styles.styleChipActive
                  ]}
                  onPress={() => setSelectedStyle(style.key)}
                >
                  <Text style={[
                    styles.styleChipText,
                    selectedStyle === style.key && styles.styleChipTextActive
                  ]}>
                    {style.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 关键词输入 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔑 输入关键词</Text>
            <TextInput
              style={styles.input}
              placeholder="如：客户反馈，专业度，新技术等"
              placeholderTextColor={theme.placeholderColor}
              value={keywords}
              onChangeText={setKeywords}
            />
          </View>

          {/* 字数设置 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📏 字数设置</Text>
            <View style={styles.optionRow}>
              {[
                { value: '50-100', label: '简短' },
                { value: '100-200', label: '中等' },
                { value: '200-300', label: '详细' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionChip,
                    wordCount === option.value && styles.optionChipActive
                  ]}
                  onPress={() => setWordCount(option.value)}
                >
                  <Text style={[
                    styles.optionChipText,
                    wordCount === option.value && styles.optionChipTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 生成按钮 */}
          <TouchableOpacity
            style={styles.generateButton}
            onPress={() => generateContent(false)}
            disabled={loading}
          >
            <Ionicons name="create-outline" size={24} color={theme.buttonText} />
            <Text style={styles.generateButtonText}>生成文案</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* 对话列表 */}
      {!showSettings && (
        <>
          <View style={styles.chatHeader}>
            <Text style={styles.chatHeaderTitle}>当前对话</Text>
            <TouchableOpacity style={styles.newChatButton} onPress={handleNewConversation}>
              <Ionicons name="add-circle-outline" size={18} color={theme.primaryColor} />
              <Text style={styles.newChatButtonText}>新开对话</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />

          {/* 加载中状态 */}
          {loading && (
            <View style={styles.loadingContainer}>
              <TouchableOpacity style={styles.stopButton} onPress={stopResponse}>
                <Ionicons name="stop-circle" size={20} color="#fff" />
                <Text style={styles.stopButtonText}>停止生成</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 追问输入框 */}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => setShowSettings(true)}
            >
              <Ionicons name="settings-outline" size={24} color={theme.primaryColor} />
            </TouchableOpacity>
            <TextInput
              style={styles.followUpInput}
              placeholder="继续提问或要求修改..."
              placeholderTextColor={theme.placeholderColor}
              value={followUpInput}
              onChangeText={setFollowUpInput}
              multiline
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => handleFollowUp()}
              disabled={loading || !followUpInput.trim()}
            >
              <Ionicons name="send" size={20} color={theme.buttonText} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.buttonText,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.buttonText,
    opacity: 0.9,
    marginTop: 4,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  newChatButtonText: {
    fontSize: 13,
    color: theme.buttonText,
    fontWeight: '500',
  },
  settingsPanel: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textColor,
    marginBottom: 10,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageWrapper: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  uploadedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.borderColor,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.borderColor,
    backgroundColor: theme.cardBackground,
  },
  optionChipActive: {
    backgroundColor: theme.primaryColor,
    borderColor: theme.primaryColor,
  },
  optionChipText: {
    fontSize: 14,
    color: theme.textColor,
  },
  optionChipTextActive: {
    color: theme.buttonText,
    fontWeight: '600',
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    backgroundColor: theme.cardBackground,
  },
  styleChipActive: {
    backgroundColor: theme.primaryColor,
    borderColor: theme.primaryColor,
  },
  styleChipText: {
    fontSize: 13,
    color: theme.textColor,
  },
  styleChipTextActive: {
    color: theme.buttonText,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 8,
    padding: 12,
    color: theme.textColor,
    fontSize: 14,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primaryColor,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.buttonText,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
  },
  messageImageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  messageImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
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
  userMessageText: {
    color: theme.buttonText,
    fontSize: 14,
    lineHeight: 20,
  },
  markdownStyle: {
    body: {
      color: theme.textColor,
      fontSize: 15,
      lineHeight: 22,
    },
    heading1: {
      color: theme.primaryColor,
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    heading2: {
      color: theme.primaryColor,
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
      color: theme.primaryColor,
    },
  },
  contentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primaryColor,
  },
  contentSection: {
    marginBottom: 16,
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
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyBtnText: {
    fontSize: 12,
    color: theme.primaryColor,
  },
  contentText: {
    color: theme.textColor,
    fontSize: 14,
    lineHeight: 22,
  },
  messageActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    color: theme.placeholderColor,
    marginBottom: 8,
  },
  suggestedBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  suggestedBtnText: {
    fontSize: 13,
    color: theme.textColor,
  },
  loadingContainer: {
    padding: 12,
    alignItems: 'center',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    backgroundColor: theme.backgroundColor,
    gap: 8,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUpInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    color: theme.textColor,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
