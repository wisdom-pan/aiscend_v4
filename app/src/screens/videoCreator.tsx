import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
} from 'react-native'
import { useState, useContext } from 'react'
import { ThemeContext } from '../context'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import Ionicons from '@expo/vector-icons/Ionicons'
import { MODELS } from '../../constants'
import { fetchStream } from '../utils'
import { API_KEYS } from '../../constants'
import { historyService } from '../services/historyService'

interface Platform {
  key: string
  label: string
  description: string
}

const PLATFORMS: Platform[] = [
  { key: 'douyin', label: '抖音', description: '短平快+争议性+明星案例' },
  { key: 'xiaohongshu', label: '小红书', description: '故事剧情+专业评测+情感分享' },
  { key: 'weixin', label: '视频号', description: '专业科普+客户见证' },
]

export function VideoCreator() {
  const [mode, setMode] = useState<'create' | 'rewrite'>('create')
  const [loading, setLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<string>('douyin')
  const [style, setStyle] = useState('')
  const [originalScript, setOriginalScript] = useState('')
  const [optimizationNeeds, setOptimizationNeeds] = useState('')
  const [generatedScript, setGeneratedScript] = useState('')

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
            setImage(null)
            setTopic('')
            setStyle('')
            setOriginalScript('')
            setOptimizationNeeds('')
            setGeneratedScript('')
            setMode('create')
            setLoading(false)
          }
        }
      ]
    )
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

  const generateScript = async () => {
    if (mode === 'create' && !topic.trim()) {
      alert('请输入主题关键词')
      return
    }
    if (mode === 'rewrite' && !originalScript.trim()) {
      alert('请输入原视频脚本')
      return
    }

    setLoading(true)
    try {
      const selectedPlatform = PLATFORMS.find(p => p.key === platform)
      const platformDesc = selectedPlatform?.description || ''

      let systemPrompt = `你是一位专业的医美自媒体视频脚本创作专家，擅长为${selectedPlatform?.label}平台创作吸引人的视频脚本。

平台特点：${platformDesc}
平台名称：${selectedPlatform?.label}

请基于提供的主题或原脚本，创作一个完整的视频脚本，包括：
1. 开头（吸引眼球，3-5秒）
2. 中间主体内容（专业知识点+案例分享）
3. 结尾互动引导
4. 建议背景音乐
5. 预计时长
6. 适合的话题标签

要求：
- 语言自然流畅，符合平台调性
- 专业但不枯燥，有故事性
- 适合医美行业特点
- 时长控制在60-90秒`

      if (mode === 'rewrite') {
        systemPrompt += `\n\n原脚本内容：\n${originalScript}\n\n优化需求：${optimizationNeeds || '提升吸引力和专业度'}`
      } else {
        systemPrompt += `\n\n主题关键词：${topic}`
      }

      const eventSourceArgs = {
        body: {
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: mode === 'create' ? `请为"${topic}"创作视频脚本` : `请优化这个脚本：${originalScript}`
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
        apiKey: eventSourceArgs.apiKey,
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
              setGeneratedScript(localResponse)
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
        onClose: async () => {
          console.log('Stream closed')
          setLoading(false)

          // 记录历史
          try {
            await historyService.saveRecord({
              type: 'video',
              title: `${mode === 'create' ? '原创' : '优化'}脚本 - ${mode === 'create' ? topic : '脚本优化'}`,
              prompt: `平台：${PLATFORMS.find(p => p.key === platform)?.label}\n风格：${style || '默认风格'}\n模式：${mode === 'create' ? '原创' : '优化'}`,
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>自媒体内容创作</Text>
          <TouchableOpacity style={styles.newChatButton} onPress={handleNewConversation}>
            <Ionicons name="add-circle-outline" size={18} color={theme.buttonText} />
            <Text style={styles.newChatButtonText}>新开对话</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>AI驱动的视频脚本创作引擎</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ 创作模式</Text>
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'create' && styles.modeButtonActive
            ]}
            onPress={() => setMode('create')}
          >
            <Ionicons name="add-circle-outline" size={24} color={mode === 'create' ? theme.buttonText : theme.textColor} />
            <Text style={[
              styles.modeButtonText,
              mode === 'create' && styles.modeButtonTextActive
            ]}>
              一创（原创脚本）
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'rewrite' && styles.modeButtonActive
            ]}
            onPress={() => setMode('rewrite')}
          >
            <Ionicons name="refresh-circle-outline" size={24} color={mode === 'rewrite' ? theme.buttonText : theme.textColor} />
            <Text style={[
              styles.modeButtonText,
              mode === 'rewrite' && styles.modeButtonTextActive
            ]}>
              二创（脚本优化）
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {mode === 'create' && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📷 参考素材（可选）</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.uploadedImage} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={40} color={theme.primaryColor} />
                  <Text style={styles.uploadText}>上传参考图片或视频</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎯 主题关键词</Text>
            <TextInput
              style={styles.input}
              placeholder="如：玻尿酸注射、鼻综合手术、皮肤管理等"
              placeholderTextColor={theme.placeholderColor}
              value={topic}
              onChangeText={setTopic}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎨 风格要求</Text>
            <TextInput
              style={styles.input}
              placeholder="如：明星案例、文字优美、专业科普"
              placeholderTextColor={theme.placeholderColor}
              value={style}
              onChangeText={setStyle}
            />
          </View>
        </>
      )}

      {mode === 'rewrite' && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 原视频脚本</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="粘贴原始视频脚本内容"
              placeholderTextColor={theme.placeholderColor}
              value={originalScript}
              onChangeText={setOriginalScript}
              multiline
              numberOfLines={6}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✨ 优化需求</Text>
            <TextInput
              style={styles.input}
              placeholder="如：增加争议性、加强专业度、优化开头"
              placeholderTextColor={theme.placeholderColor}
              value={optimizationNeeds}
              onChangeText={setOptimizationNeeds}
            />
          </View>
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 目标平台</Text>
        <View style={styles.platformGrid}>
          {PLATFORMS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.platformCard,
                platform === p.key && styles.platformCardActive
              ]}
              onPress={() => setPlatform(p.key)}
            >
              <Text style={[
                styles.platformLabel,
                platform === p.key && styles.platformLabelActive
              ]}>
                {p.label}
              </Text>
              <Text style={[
                styles.platformDesc,
                platform === p.key && styles.platformDescActive
              ]}>
                {p.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={stopResponse}
          >
            <Ionicons name="stop-circle" size={24} color="#fff" />
            <Text style={styles.stopButtonText}>停止生成</Text>
          </TouchableOpacity>
        </View>
      )}

      {generatedScript ? (
        <View style={styles.scriptContainer}>
          <Text style={styles.scriptTitle}>🎬 生成的脚本</Text>
          <ScrollView style={styles.scriptScroll}>
            <Text style={styles.scriptText}>{generatedScript}</Text>
          </ScrollView>
          <View style={styles.scriptActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(generatedScript)
                  Alert.alert('提示', '脚本已复制到剪贴板')
                } catch (error: any) {
                  Alert.alert('提示', '复制失败：' + error.message)
                }
              }}
            >
              <Ionicons name="copy-outline" size={20} color={theme.buttonText} />
              <Text style={styles.actionButtonText}>复制脚本</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={async () => {
                try {
                  await historyService.saveRecord({
                    type: 'video',
                    title: `${mode === 'create' ? '原创' : '优化'}脚本 - ${mode === 'create' ? topic : '脚本优化'}`,
                    prompt: `平台：${PLATFORMS.find(p => p.key === platform)?.label}\n风格：${style || '默认风格'}\n模式：${mode === 'create' ? '原创' : '优化'}`,
                    result: generatedScript,
                  })
                  Alert.alert('提示', '已保存到历史记录')
                } catch (error: any) {
                  Alert.alert('提示', '保存失败：' + error.message)
                }
              }}
            >
              <Ionicons name="bookmark-outline" size={20} color={theme.buttonText} />
              <Text style={styles.actionButtonText}>保存记录</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        !loading && (
          <TouchableOpacity
            style={styles.generateButton}
            onPress={generateScript}
          >
            <Ionicons name="videocam-outline" size={24} color={theme.buttonText} />
            <Text style={styles.generateButtonText}>
              {mode === 'create' ? '生成原创脚本' : '生成优化版本'}
            </Text>
          </TouchableOpacity>
        )
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
  modeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.borderColor,
    alignItems: 'center',
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: theme.primaryColor,
    borderColor: theme.primaryColor,
  },
  modeButtonText: {
    fontSize: 14,
    color: theme.textColor,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: theme.buttonText,
  },
  uploadButton: {
    height: 200,
    borderWidth: 2,
    borderColor: theme.borderColor,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadText: {
    fontSize: 14,
    color: theme.placeholderColor,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 8,
    padding: 12,
    color: theme.textColor,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  platformGrid: {
    gap: 12,
  },
  platformCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.borderColor,
  },
  platformCardActive: {
    backgroundColor: theme.primaryColor,
    borderColor: theme.primaryColor,
  },
  platformLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textColor,
    marginBottom: 4,
  },
  platformLabelActive: {
    color: theme.buttonText,
  },
  platformDesc: {
    fontSize: 14,
    color: theme.placeholderColor,
  },
  platformDescActive: {
    color: theme.buttonText,
    opacity: 0.9,
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
  scriptContainer: {
    margin: 20,
    padding: 16,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
  },
  scriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scriptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textColor,
    marginBottom: 12,
  },
  scriptScroll: {
    maxHeight: 400,
  },
  scriptText: {
    fontSize: 14,
    color: theme.textColor,
    lineHeight: 24,
  },
  scriptActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.primaryColor,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: theme.buttonText,
    fontWeight: '500',
  },
})
