import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useState, useContext } from 'react'
import { ThemeContext } from '../context'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import Markdown from '@ronradtke/react-native-markdown-display'
import { fetchStream } from '../utils'
import { API_KEYS } from '../../constants'
import { historyService } from '../services/historyService'
import { useActionSheet } from '@expo/react-native-action-sheet'

interface ReplyOption {
  id: string
  style: string
  content: string
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

// 图片转Base64
const imageToBase64 = async (uri: string): Promise<string> => {
  try {
    const response = await fetch(uri)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        resolve(base64.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('图片转换失败:', error)
    throw error
  }
}

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
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [scenario, setScenario] = useState<string>('consult')
  const [replyStyle, setReplyStyle] = useState<string>('professional')
  const [replyOptions, setReplyOptions] = useState<ReplyOption[]>([])
  const [selectedReply, setSelectedReply] = useState<string | null>(null)
  // 追问功能状态
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  // 选择文本弹窗状态
  const [showSelectionModal, setShowSelectionModal] = useState(false)
  const [selectionContent, setSelectionContent] = useState('')
  const [selectedReplyId, setSelectedReplyId] = useState<string | null>(null)

  const { showActionSheetWithOptions } = useActionSheet()
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
            setQuestion('')
            setImage(null)
            setImageBase64(null)
            setReplyOptions([])
            setLoading(false)
            setFollowUpLoading(false)
            setSelectedReply(null)
            setFollowUpQuestion('')
          }
        }
      ]
    )
  }

  // 显示文本选择弹窗
  const showTextSelectionMenu = (content: string, replyId?: string) => {
    setSelectionContent(content)
    setSelectedReplyId(replyId || null)
    setShowSelectionModal(true)
  }

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
      // 转换为Base64
      try {
        const base64 = await imageToBase64(uri)
        setImageBase64(base64)
      } catch (error) {
        console.error('图片转换失败:', error)
        Alert.alert('提示', '图片处理失败，请重试')
      }
    }
  }

  const generateReplies = async () => {
    if (!question.trim()) {
      alert('请输入客户问题')
      return
    }

    setLoading(true)
    try {
      const selectedScenario = SCENARIOS.find(s => s.key === scenario)
      const selectedStyle = REPLY_STYLES.find(s => s.key === replyStyle)

      const systemPrompt = `你是一位专业的医美客服咨询顾问，擅长用不同风格回复客户问题。

应用场景：${selectedScenario?.label} - ${selectedScenario?.description}
回复风格：${selectedStyle?.label} - ${selectedStyle?.description}

请基于客户的问题，生成5个不同风格的回复选项：
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

      // 构建用户消息（支持图文）
      const userMessageContent = imageBase64
        ? [
            { type: 'text' as const, text: `客户问题：${question}` },
            { type: 'image_url' as const, image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        : `客户问题：${question}`

      const messages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: systemPrompt }
          ]
        },
        {
          role: 'user' as const,
          content: userMessageContent
        }
      ]

      let localResponse = ''

      await fetchStream({
        body: {
          messages,
          model: 'gemini-3-flash-preview',
          temperature: 0.5,
          top_p: 1,
          stream: true
        },
        apiKey: API_KEYS.GEMINI,
        onOpen: () => {
          console.log("Open streaming connection.")
        },
        onMessage: (data) => {
          try {
            console.log('📨 收到数据:', JSON.stringify(data, null, 2))
            if (data.choices && data.choices[0]?.delta?.content) {
              const newContent = data.choices[0].delta.content
              console.log('✏️ 新内容:', newContent)
              localResponse += newContent
              console.log('📝 累计内容长度:', localResponse.length)
              // 实时更新显示（流式输出效果）
              setReplyOptions([
                {
                  id: '1',
                  style: '生成中...',
                  content: localResponse
                }
              ])
            }
          } catch (error) {
            console.error('Failed to parse stream data:', error)
          }
        },
        onError: (error) => {
          console.error('Streaming error:', error)
          setLoading(false)
          Alert.alert('提示', '生成失败，请重试')
        },
        onClose: async () => {
          console.log('Stream closed')
          setLoading(false)

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
      Alert.alert('提示', '已复制到剪贴板')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Alert.alert('提示', '复制失败：' + errorMessage)
    }
  }

  // 显示操作菜单
  const showReplyActionsheet = (reply: ReplyOption) => {
    const options = ['复制全部', '选择复制', '追问', '保存到话术库', '取消']
    const cancelButtonIndex = 4

    showActionSheetWithOptions({
      options,
      cancelButtonIndex,
    }, (selectedIndex) => {
      switch (selectedIndex) {
        case 0: // 复制全部
          copyToClipboard(reply.content)
          break
        case 1: // 选择复制
          showTextSelectionMenu(reply.content)
          break
        case 2: // 追问
          setFollowUpQuestion('')
          setSelectedReply(reply.id)
          break
        case 3: // 保存到话术库
          handleSaveToLibrary(reply)
          break
        default:
          break
      }
    })
  }

  // 保存到话术库
  const handleSaveToLibrary = async (reply: ReplyOption) => {
    try {
      await historyService.saveRecord({
        type: 'qa',
        title: `问答收藏 - ${question.substring(0, 20)}...`,
        prompt: `问题：${question}\n场景：${scenario}\n风格：${replyStyle}`,
        result: reply.content,
      })
      Alert.alert('提示', '已保存到话术库')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Alert.alert('提示', '保存失败：' + errorMessage)
    }
  }

  // 追问功能 - 生成完整新回复
  const handleFollowUp = async () => {
    if (!followUpQuestion.trim()) {
      Alert.alert('提示', '请输入追问内容')
      return
    }
    if (!selectedReply) {
      Alert.alert('提示', '请先选择一个回复')
      return
    }

    setFollowUpLoading(true)
    try {
      const selectedReplyContent = replyOptions.find(r => r.id === selectedReply)?.content || ''

      // 直接生成完整的新回复，替换原有回复
      const systemPrompt = `你是一位专业的医美客服咨询顾问。

客户原始问题：${question}
场景：${scenario}
风格：${replyStyle}
原始回复：${selectedReplyContent}

用户追问：${followUpQuestion}

请根据用户的追问，生成一个完整、专业的医美咨询回复。直接输出优化后的完整回复，不需要添加任何说明文字或分隔符。`

      const messages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: systemPrompt }
          ]
        }
      ]

      let localResponse = ''

      // 先清空选中的回复内容，表示正在重新生成
      setReplyOptions(prev => prev.map(r =>
        r.id === selectedReply ? { ...r, content: '' } : r
      ))

      await fetchStream({
        body: {
          messages,
          model: 'gemini-3-flash-preview',
          temperature: 0.5,
          top_p: 1,
          stream: true
        },
        apiKey: API_KEYS.GEMINI,
        onOpen: () => {
          console.log("Open streaming connection.")
        },
        onMessage: (data) => {
          try {
            if (data.choices && data.choices[0]?.delta?.content) {
              const newContent = data.choices[0].delta.content
              localResponse += newContent
              // 更新当前选中的回复内容
              setReplyOptions(prev => prev.map(r =>
                r.id === selectedReply ? { ...r, content: localResponse } : r
              ))
            }
          } catch (error) {
            console.error('Failed to parse stream data:', error)
          }
        },
        onError: (error) => {
          console.error('Streaming error:', error)
          // 恢复原始内容
          setReplyOptions(prev => prev.map(r =>
            r.id === selectedReply ? { ...r, content: selectedReplyContent } : r
          ))
          setFollowUpLoading(false)
          Alert.alert('提示', '追问失败，请重试')
        },
        onClose: async () => {
          console.log('Stream closed')
          setFollowUpLoading(false)
          setFollowUpQuestion('')
          Alert.alert('提示', '追问完成，回复已更新')
        }
      })
    } catch (error) {
      console.error('追问失败:', error)
      Alert.alert('提示', '追问失败，请重试')
      setFollowUpLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>智能问答</Text>
          <TouchableOpacity style={styles.newChatButton} onPress={handleNewConversation}>
            <Ionicons name="add-circle-outline" size={18} color={theme.buttonText} />
            <Text style={styles.newChatButtonText}>新开对话</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={styles.attachButtonText}>添加截图（可选）</Text>
        </TouchableOpacity>
        {image && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: image }} style={styles.imagePreview} />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => {
                setImage(null)
                setImageBase64(null)
              }}
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
          <Text style={styles.repliesTitle}>✨ 回复选项</Text>
          <Text style={styles.hintText}>💡 点击卡片可复制，右上角聊天图标可直接追问</Text>
          {replyOptions.map((reply) => (
            <TouchableOpacity
              key={reply.id}
              style={[
                styles.replyCard,
                selectedReply === reply.id && styles.replyCardSelected
              ]}
              onPress={() => setSelectedReply(reply.id)}
              onLongPress={() => showReplyActionsheet(reply)}
              delayLongPress={300}
            >
              <View style={styles.replyHeader}>
                <Text style={styles.replyStyle}>{reply.style}</Text>
                <View style={styles.replyActions}>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(reply.content)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="copy-outline" size={20} color={theme.primaryColor} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setFollowUpQuestion('')
                      setSelectedReply(reply.id)
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.primaryColor} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 使用 Markdown 渲染内容 */}
              <ScrollView nestedScrollEnabled horizontal={false} showsVerticalScrollIndicator={false}>
                <Markdown style={{
                  body: {
                    color: theme.textColor,
                    fontSize: 15,
                    lineHeight: 24,
                  },
                  heading1: {
                    color: theme.primaryColor,
                    fontSize: 20,
                    fontWeight: 'bold',
                    marginBottom: 12,
                    marginTop: 8,
                  },
                  heading2: {
                    color: theme.primaryColor,
                    fontSize: 18,
                    fontWeight: 'bold',
                    marginBottom: 10,
                    marginTop: 6,
                  },
                  heading3: {
                    color: theme.textColor,
                    fontSize: 16,
                    fontWeight: '600',
                    marginBottom: 8,
                    marginTop: 4,
                  },
                  heading4: {
                    color: theme.textColor,
                    fontSize: 15,
                    fontWeight: '600',
                    marginBottom: 6,
                    marginTop: 2,
                  },
                  heading5: {
                    color: theme.textColor,
                    fontSize: 14,
                    fontWeight: '600',
                    marginBottom: 4,
                    marginTop: 2,
                  },
                  heading6: {
                    color: theme.textColor,
                    fontSize: 13,
                    fontWeight: '600',
                    marginBottom: 4,
                    marginTop: 2,
                  },
                  hr: {
                    backgroundColor: theme.borderColor,
                    height: 1,
                    marginVertical: 12,
                  },
                  blockquote: {
                    borderLeftColor: theme.primaryColor,
                    borderLeftWidth: 3,
                    paddingLeft: 12,
                    backgroundColor: theme.primaryColor + '10',
                    marginVertical: 8,
                    paddingVertical: 8,
                    paddingRight: 8,
                  },
                  blockquote_node: {
                    color: theme.placeholderColor,
                  },
                  bullet_list: {
                    color: theme.textColor,
                  },
                  list_item: {
                    color: theme.textColor,
                    marginBottom: 4,
                  },
                  paragraph: {
                    color: theme.textColor,
                    marginBottom: 8,
                  },
                  strong: {
                    fontWeight: 'bold',
                    color: theme.primaryColor,
                  },
                  em: {
                    fontStyle: 'italic',
                    color: theme.textColor,
                  },
                  code_inline: {
                    backgroundColor: theme.primaryColor + '20',
                    color: theme.primaryColor,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  },
                  code_block: {
                    backgroundColor: theme.primaryColor + '20',
                    borderRadius: 8,
                    padding: 12,
                    marginVertical: 8,
                  },
                  code_block_content: {
                    color: theme.textColor,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  },
                  fence: {
                    backgroundColor: theme.primaryColor + '20',
                    borderRadius: 8,
                    padding: 12,
                    marginVertical: 8,
                  },
                  fence_content: {
                    color: theme.textColor,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  },
                  link: {
                    color: theme.primaryColor,
                    textDecorationLine: 'underline',
                  },
                }}>
                  {reply.content}
                </Markdown>
              </ScrollView>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 选择文本弹窗 */}
      {showSelectionModal && selectionContent && (
        <View
          style={styles.selectionModal}
        >
          <View
            style={styles.selectionModalContent}
          >
            <View style={styles.selectionModalHeader}>
              <Text style={styles.selectionModalTitle}>长按选择文字复制</Text>
              <TouchableOpacity onPress={() => setShowSelectionModal(false)}>
                <Ionicons name="close" size={24} color={theme.textColor} />
              </TouchableOpacity>
            </View>
            <View style={styles.selectionScrollContent}>
              <TextInput
                ref={(ref: TextInput | null) => {
                  // Auto-focus when modal opens
                  setTimeout(() => ref?.focus(), 100)
                }}
                style={styles.selectionInput}
                value={selectionContent}
                multiline={true}
                selectTextOnFocus={true}
              />
            </View>
            <View style={styles.selectionModalFooter}>
              <TouchableOpacity
                style={styles.selectionFollowUpButton}
                onPress={() => {
                  setShowSelectionModal(false)
                  setFollowUpQuestion('')
                  setSelectedReply(selectedReplyId)
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.primaryColor} />
                <Text style={styles.selectionFollowUpButtonText}>追问优化</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 追问输入区域 */}
      {selectedReply && (
        <View style={styles.followUpContainer}>
          <Text style={styles.followUpTitle}>💬 追问优化</Text>
          <Text style={styles.followUpHint}>输入追问内容，AI将优化已选择的回复</Text>
          <TextInput
            style={[styles.input, styles.followUpInput]}
            placeholder="输入追问内容，例如：'再专业一点'、'加入价格信息'..."
            placeholderTextColor={theme.placeholderColor}
            value={followUpQuestion}
            onChangeText={setFollowUpQuestion}
            multiline
            numberOfLines={3}
          />
          <View style={styles.followUpButtons}>
            <TouchableOpacity
              style={[styles.followUpButton, styles.cancelButton]}
              onPress={() => {
                setSelectedReply(null)
                setFollowUpQuestion('')
              }}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.followUpButton, styles.submitButton]}
              onPress={handleFollowUp}
              disabled={followUpLoading}
            >
              {followUpLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={18} color="#fff" />
                  <Text style={styles.submitButtonText}>优化回复</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.buttonText,
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
  imagePreviewContainer: {
    marginTop: 12,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeImageButton: {
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
  replyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  contentSections: {
    marginTop: 8,
  },
  contentSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  selectableContent: {
    flex: 1,
    minHeight: 60,
    padding: 10,
    backgroundColor: theme.backgroundColor,
    borderRadius: 8,
    color: theme.textColor,
    fontSize: 14,
    lineHeight: 22,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contentTitle: {
    fontSize: 13,
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
  replyContent: {
    fontSize: 15,
    color: theme.textColor,
    lineHeight: 24,
  },
  hintText: {
    fontSize: 12,
    color: theme.placeholderColor,
    marginBottom: 12,
    fontStyle: 'italic',
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
  // 追问相关样式
  followUpContainer: {
    margin: 20,
    padding: 16,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.primaryColor,
  },
  followUpTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.primaryColor,
    marginBottom: 8,
  },
  followUpHint: {
    fontSize: 13,
    color: theme.placeholderColor,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  followUpInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  followUpButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  followUpButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  cancelButtonText: {
    fontSize: 14,
    color: theme.textColor,
  },
  submitButton: {
    backgroundColor: theme.primaryColor,
  },
  submitButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  // 选择文本弹窗样式
  selectionModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  selectionModalContent: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  selectionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  selectionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textColor,
  },
  selectionScrollContent: {
    flex: 1,
    maxHeight: 400,
    padding: 16,
  },
  selectionInput: {
    flex: 1,
    fontSize: 15,
    color: theme.textColor,
    lineHeight: 24,
    textAlignVertical: 'top',
    padding: 0,
  },
  selectionModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
  },
  selectionCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.primaryColor,
    borderRadius: 8,
  },
  selectionCopyButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  selectionFollowUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.primaryColor,
    borderRadius: 8,
  },
  selectionFollowUpButtonText: {
    fontSize: 14,
    color: theme.primaryColor,
    fontWeight: '600',
  },
  // 选择按钮样式
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.primaryColor + '15',
  },
  selectButtonText: {
    fontSize: 12,
    color: theme.primaryColor,
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
})

// Markdown 渲染样式
const markdownStyles = (theme: any) => ({
  paragraph: {
    color: theme.textColor,
    fontSize: 15,
    lineHeight: 24,
  },
  strong: {
    color: theme.textColor,
    fontWeight: '600' as const,
  },
  em: {
    color: theme.textColor,
    fontStyle: 'italic' as const,
  },
  blockquote: {
    borderLeftColor: theme.primaryColor,
    borderLeftWidth: 3,
    paddingLeft: 12,
    backgroundColor: theme.cardBackground,
    marginLeft: 0,
  },
  blockquote_node: {
    color: theme.textColor,
  },
  code_inline: {
    backgroundColor: theme.primaryColor + '20',
    color: theme.primaryColor,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  code_block: {
    backgroundColor: theme.primaryColor + '20',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  code_block_content: {
    color: theme.textColor,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  fence: {
    backgroundColor: theme.primaryColor + '20',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  fence_content: {
    color: theme.textColor,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  link: {
    color: theme.primaryColor,
  },
  bullet_list: {
    color: theme.textColor,
  },
  ordered_list: {
    color: theme.textColor,
  },
  list_item: {
    color: theme.textColor,
  },
})
