import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native'
import { useState, useContext } from 'react'
import { ThemeContext } from '../context'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import { MODELS } from '../../constants'
import { fetchStream } from '../utils'
import { API_KEYS } from '../../constants'

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

  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)

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
      setImage(result.assets[0].uri)
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

      const eventSourceArgs = {
        body: {
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `客户问题：${question}`
            }
          ],
          model: MODELS.gpt.label,
          stream: true
        },
        type: 'openai',
        apiKey: API_KEYS.OPENAI
      }

      let localResponse = ''

      await fetchStream({
        body: eventSourceArgs.body,
        type: eventSourceArgs.type,
        apiKey: eventSourceArgs.apiKey,
        onOpen: () => {
          console.log("Open streaming connection.")
        },
        onMessage: (data) => {
          try {
            if (data.choices && data.choices[0]?.delta?.content) {
              localResponse += data.choices[0].delta.content
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
          alert('生成失败，请重试')
        },
        onClose: () => {
          console.log('Stream closed')
          setLoading(false)
        }
      })

    } catch (error) {
      console.error('生成失败:', error)
      alert('生成失败，请重试')
      setLoading(false)
    }
  }

  const copyToClipboard = (content: string) => {
    // 实际应用中可以使用 expo-clipboard
    alert('已复制到剪贴板')
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
          <Text style={styles.attachButtonText}>添加截图（可选）</Text>
        </TouchableOpacity>
        {image && (
          <Text style={styles.imageAttached}>✓ 图片已附加</Text>
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

      {replyOptions.length > 0 && (
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
              <TouchableOpacity style={styles.saveButton}>
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
