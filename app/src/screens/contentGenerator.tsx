import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native'
import { useState, useContext } from 'react'
import { ThemeContext } from '../context'
import * as ImagePicker from 'expo-image-picker'
import Ionicons from '@expo/vector-icons/Ionicons'
import { v4 as uuid } from 'uuid'
import { MODELS } from '../../constants'
import { fetchStream } from '../utils'
import { API_KEYS } from '../../constants'

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

export function ContentGenerator() {
  const [loading, setLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [selectedPersona, setSelectedPersona] = useState<string>('professional')
  const [selectedStyle, setSelectedStyle] = useState<string>('professional')
  const [keywords, setKeywords] = useState('')
  const [wordCount, setWordCount] = useState('100-200')
  const [generatedContents, setGeneratedContents] = useState<string[]>([])
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

  const generateContent = async () => {
    if (!keywords.trim()) {
      alert('请输入关键词')
      return
    }

    setLoading(true)
    try {
      console.log('Starting content generation...')
      console.log('MODELS:', MODELS)
      console.log('API_KEYS:', API_KEYS)

      // 选择人设和风格
      const selectedPersonaObj = PERSONAS.find(p => p.key === selectedPersona)
      const selectedStyleObj = CONTENT_STYLES.find(s => s.key === selectedStyle)

      console.log('Selected persona:', selectedPersonaObj)
      console.log('Selected style:', selectedStyleObj)

      const systemPrompt = `你是一位专业的医美朋友圈文案创作专家，擅长创作吸引人的朋友圈内容。

人设风格：${selectedPersonaObj?.label} - ${selectedPersonaObj?.description}
内容风格：${selectedStyleObj?.label} - ${selectedStyleObj?.description}
目标字数：${wordCount}

请基于提供的关键词，生成3条不同的朋友圈文案，要求：
1. 语言自然流畅，符合朋友圈的调性
2. 融入关键词，体现专业性
3. 适当使用emoji，但不要过度
4. 每条文案角度不同，避免重复
5. 符合选定的人设和风格
6. 字数控制在${wordCount}字左右`

      let localResponse = ''

      await fetchStream({
        body: {
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `关键词：${keywords}`
            }
          ],
          model: 'gpt-5.1',
          stream: true
        },
        type: 'openai',
        apiKey: API_KEYS.OPENAI,
        onOpen: () => {
          console.log("Open streaming connection.")
        },
        onMessage: (data) => {
          try {
            if (data.choices && data.choices[0]?.delta?.content) {
              localResponse += data.choices[0].delta.content
              // 实时更新显示（流式输出效果）
              setGeneratedContents([localResponse])
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
      console.error('Error stack:', error.stack)
      alert('生成失败，请重试')
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>朋友圈文案生成</Text>
        <Text style={styles.subtitle}>智能生成专业医美朋友圈内容</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📷 上传素材（可选）</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.uploadedImage} />
          ) : (
            <>
              <Ionicons name="image-outline" size={40} color={theme.primaryColor} />
              <Text style={styles.uploadText}>点击上传图片或视频</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 选择人设</Text>
        <View style={styles.optionGroup}>
          {PERSONAS.map((persona) => (
            <TouchableOpacity
              key={persona.key}
              style={[
                styles.optionCard,
                selectedPersona === persona.key && styles.optionCardActive
              ]}
              onPress={() => setSelectedPersona(persona.key)}
            >
              <Text style={[
                styles.optionTitle,
                selectedPersona === persona.key && styles.optionTitleActive
              ]}>
                {persona.label}
              </Text>
              <Text style={[
                styles.optionDesc,
                selectedPersona === persona.key && styles.optionDescActive
              ]}>
                {persona.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎨 选择内容风格</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔑 输入关键词</Text>
        <TextInput
          style={styles.input}
          placeholder="如：客户反馈，体现专业度，新技术等"
          placeholderTextColor={theme.placeholderColor}
          value={keywords}
          onChangeText={setKeywords}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📏 个性化设置</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>字数：</Text>
          <TouchableOpacity
            style={styles.settingOption}
            onPress={() => setWordCount('50-100')}
          >
            <Text style={[
              styles.settingText,
              wordCount === '50-100' && styles.settingTextActive
            ]}>
              简短
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingOption}
            onPress={() => setWordCount('100-200')}
          >
            <Text style={[
              styles.settingText,
              wordCount === '100-200' && styles.settingTextActive
            ]}>
              中等
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingOption}
            onPress={() => setWordCount('200-300')}
          >
            <Text style={[
              styles.settingText,
              wordCount === '200-300' && styles.settingTextActive
            ]}>
              详细
            </Text>
          </TouchableOpacity>
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
          onPress={generateContent}
        >
          <Ionicons name="create-outline" size={24} color={theme.buttonText} />
          <Text style={styles.generateButtonText}>生成文案</Text>
        </TouchableOpacity>
      )}

      {generatedContents.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>✨ 生成的文案</Text>
          {generatedContents.map((content, index) => (
            <View key={index} style={styles.contentCard}>
              <Text style={styles.contentText}>{content}</Text>
              <View style={styles.contentActions}>
                <TouchableOpacity style={styles.actionBtn}>
                  <Ionicons name="copy-outline" size={20} color={theme.primaryColor} />
                  <Text style={styles.actionBtnText}>复制</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                  <Ionicons name="heart-outline" size={20} color={theme.primaryColor} />
                  <Text style={styles.actionBtnText}>收藏</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
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
  optionGroup: {
    gap: 12,
  },
  optionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.borderColor,
  },
  optionCardActive: {
    backgroundColor: theme.primaryColor,
    borderColor: theme.primaryColor,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textColor,
    marginBottom: 4,
  },
  optionTitleActive: {
    color: theme.buttonText,
  },
  optionDesc: {
    fontSize: 14,
    color: theme.placeholderColor,
  },
  optionDescActive: {
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
  input: {
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 8,
    padding: 12,
    color: theme.textColor,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.textColor,
    fontWeight: '500',
  },
  settingOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  settingText: {
    fontSize: 14,
    color: theme.textColor,
  },
  settingTextActive: {
    color: theme.primaryColor,
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
  resultsContainer: {
    padding: 20,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textColor,
    marginBottom: 16,
  },
  contentCard: {
    padding: 16,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    marginBottom: 12,
  },
  contentText: {
    fontSize: 15,
    color: theme.textColor,
    lineHeight: 24,
    marginBottom: 12,
  },
  contentActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 14,
    color: theme.primaryColor,
    fontWeight: '500',
  },
})
