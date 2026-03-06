// ChatScreen - 精确模仿 ChatGPT 移动端 UI

import React, { useContext, useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native'
import { ThemeContext } from '../context'
import { Agent, Conversation, Message, AVAILABLE_MODELS } from '../types/agent'
import { agentService } from '../services/agentService'
import { API_KEYS } from '../../constants'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import * as FileSystem from 'expo-file-system'
import Markdown from '@ronradtke/react-native-markdown-display'

const { width } = Dimensions.get('window')

// Nano Banana 图片生成配置
const GEMINI_IMAGE_API_KEY = 'sk-5dsmWDBRPKaSnSC3HYBp9shak39KFgZjgjdXM7BiDEmxbaif'
const GEMINI_IMAGE_API = `https://yunwu.ai/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GEMINI_IMAGE_API_KEY}`

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', desc: '正方形' },
  { label: '9:16', value: '9:16', desc: '竖屏' },
  { label: '16:9', value: '16:9', desc: '横屏' },
  { label: '4:3', value: '4:3', desc: '标准' },
]

const IMAGE_SIZES = [
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
  { label: '4K', value: '4K' },
]

// 根据模型选择 API Key
const getApiKey = (model: string): string => {
  if (model.includes('gpt') || model.includes('GPT')) {
    return 'sk-7bW8PnA4sv9mt7ipJsNzkDDtYSOYlb60kusyzJmqaTo52zld'
  }
  return 'sk-5dsmWDBRPKaSnSC3HYBp9shak39KFgZjgjdXM7BiDEmxbaif'
}

// SSE 流式调用 - 使用 XMLHttpRequest（React Native 兼容）
const streamAPI = (
  messages: any[],
  model: string,
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (err: Error) => void
): (() => void) => {
  const xhr = new XMLHttpRequest()
  let aborted = false
  let lastLen = 0
  const apiKey = getApiKey(model)

  console.log('🔗 XHR: Opening connection...')
  xhr.open('POST', 'https://yunwu.ai/v1/chat/completions')
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`)

  xhr.onreadystatechange = () => {
    if (aborted) return

    console.log('📡 XHR readyState:', xhr.readyState, 'status:', xhr.status)

    if (xhr.readyState === 3 || xhr.readyState === 4) {
      const text = xhr.responseText
      if (text.length > lastLen) {
        lastLen = text.length
        console.log('📦 XHR received:', text.length, 'bytes')

        // 解析 SSE 数据
        const lines = text.split('\n')
        let content = ''
        for (const line of lines) {
          const t = line.trim()
          if (!t || !t.startsWith('data: ')) continue
          const data = t.slice(6)
          if (data === '[DONE]') continue
          try {
            const j = JSON.parse(data)
            content += j.choices?.[0]?.delta?.content || ''
          } catch (e) {}
        }
        if (content) {
          console.log('✨ Parsed content length:', content.length)
          onChunk(content)
        }
      }
    }

    if (xhr.readyState === 4 && !aborted) {
      console.log('🏁 XHR complete, status:', xhr.status)
      if (xhr.status === 200) {
        onComplete()
      } else {
        onError(new Error(`HTTP ${xhr.status}: ${xhr.responseText}`))
      }
    }
  }

  xhr.onerror = (e) => {
    console.log('❌ XHR error:', e)
    if (!aborted) onError(new Error('网络错误'))
  }
  xhr.timeout = 120000
  xhr.ontimeout = () => {
    console.log('⏰ XHR timeout')
    if (!aborted) onError(new Error('请求超时'))
  }

  console.log('🚀 XHR: Sending request...')
  xhr.send(JSON.stringify({ model, messages, stream: true, temperature: 0.7 }))

  return () => {
    aborted = true
    xhr.abort()
  }
}

const toBase64 = async (uri: string): Promise<string> => {
  const res = await fetch(uri)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

interface Props {
  agent: Agent
  conversation: Conversation | null
  onNewConversation: (agentId: string) => Promise<Conversation>
  onUpdateConversation: (conversation: Conversation) => void
  onOpenSidebar: () => void
}

export function ChatScreen({ agent, conversation, onNewConversation, onUpdateConversation, onOpenSidebar }: Props) {
  const { theme, themeName } = useContext(ThemeContext)
  const isDark = themeName === 'Dark'
  const styles = getStyles(isDark)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [base64, setBase64] = useState<string | null>(null)
  const [model, setModel] = useState(agent.supportedModels?.[0] || 'gemini-3.1-flash-preview')
  const [showModels, setShowModels] = useState(false)

  // Nano Banana 图片生成状态
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [imageSize, setImageSize] = useState('2K')
  const [showImageSettings, setShowImageSettings] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<{uri: string, prompt: string}[]>([])

  const scrollRef = useRef<ScrollView>(null)
  const abortRef = useRef<(() => void) | null>(null)

  const isImageGenerator = agent.isImageGenerator

  useEffect(() => {
    setMessages(conversation?.messages || [])
    setStreaming('')
  }, [conversation?.id])

  useEffect(() => {
    if (agent.supportedModels?.length) setModel(agent.supportedModels[0])
  }, [agent.id])

  useEffect(() => () => abortRef.current?.(), [])

  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)

  // Nano Banana 图片生成
  const generateImage = async (prompt: string) => {
    console.log('🍌 Generating image:', prompt)
    setLoading(true)

    try {
      const response = await fetch(GEMINI_IMAGE_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GEMINI_IMAGE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio, imageSize }
          }
        })
      })

      console.log('🍌 Response status:', response.status)
      const data = await response.json()

      let imageUri: string | null = null
      if (data.candidates?.[0]?.content?.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const base64Data = part.inlineData.data
            const mimeType = part.inlineData.mimeType || 'image/png'
            imageUri = `data:${mimeType};base64,${base64Data}`
            console.log('🍌 Got image, size:', base64Data.length)
          }
        }
      }

      if (imageUri) {
        setGeneratedImages(prev => [{ uri: imageUri!, prompt }, ...prev])
        return imageUri
      } else {
        const textResponse = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
        Alert.alert('生成失败', textResponse || '无法生成图片')
        return null
      }
    } catch (error: any) {
      console.error('🍌 Error:', error)
      Alert.alert('错误', error.message || '生成失败')
      return null
    } finally {
      setLoading(false)
    }
  }

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.6 })
    if (!r.canceled) {
      setImage(r.assets[0].uri)
      setBase64(await toBase64(r.assets[0].uri))
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text && !base64) return
    if (loading) return

    // Nano Banana 图片生成模式
    if (isImageGenerator) {
      if (!text) return
      setInput('')
      const imageUri = await generateImage(text)
      if (imageUri) {
        // 保存到对话历史
        let conv = conversation
        if (!conv) {
          conv = await onNewConversation(agent.id)
        }
        if (conv) {
          await agentService.addMessage(conv.id, { role: 'user', content: text })
          const base64Data = imageUri.split(',')[1]
          await agentService.addMessage(conv.id, { role: 'assistant', content: '图片已生成', images: [base64Data] })
          const updated = agentService.getConversation(conv.id)
          if (updated) {
            setMessages(updated.messages)
            onUpdateConversation(updated)
          }
        }
      }
      return
    }

    try {
      setInput('')
      setImage(null)
      const img = base64
      setBase64(null)

      let conv = conversation
      if (!conv) {
        console.log('📝 Creating new conversation...')
        conv = await onNewConversation(agent.id)
        console.log('✅ New conversation created:', conv?.id)
      }

      if (!conv) {
        Alert.alert('错误', '无法创建对话')
        return
      }

      console.log('💬 Adding user message...')
      const userMsg = await agentService.addMessage(conv.id, { role: 'user', content: text, images: img ? [img] : undefined })
      setMessages(prev => [...prev, userMsg])
      scrollToBottom()
      setLoading(true)

      const apiMsgs: any[] = [{ role: 'system', content: agent.systemPrompt }]
      ;[...messages, userMsg].slice(-10).forEach(m => {
        if (m.images?.length) {
          apiMsgs.push({ role: m.role, content: [{ type: 'text', text: m.content || '分析图片' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.images[0]}` } }] })
        } else {
          apiMsgs.push({ role: m.role, content: m.content })
        }
      })

      console.log('🚀 Calling API with model:', model)
      // 流式调用 API
      let finalContent = ''
      abortRef.current = streamAPI(
        apiMsgs,
        model,
        (content) => {
          // 流式更新
          finalContent = content
          setStreaming(content)
          scrollToBottom()
        },
        async () => {
          // 完成
          setLoading(false)
          setStreaming('')
          if (finalContent) {
            const m = finalContent.match(/!\[image\]\((data:image\/[^;]+;base64,[^)]+)\)/)
            const textContent = m ? finalContent.replace(/!\[image\]\([^)]+\)/, '').trim() : finalContent
            const imgData = m?.[1]?.split(',')[1]
            const asstMsg = await agentService.addMessage(conv!.id, { role: 'assistant', content: textContent || '[图片]', images: imgData ? [imgData] : undefined })
            setMessages(prev => [...prev, asstMsg])
            const updated = agentService.getConversation(conv!.id)
            if (updated) onUpdateConversation(updated)
          }
        },
        (e) => {
          console.error('❌ API error:', e)
          setLoading(false)
          setStreaming('')
          Alert.alert('错误', e.message)
        }
      )
    } catch (e) {
      console.error('❌ Send error:', e)
      setLoading(false)
      Alert.alert('错误', e instanceof Error ? e.message : '发送失败')
    }
  }

  const stop = () => { abortRef.current?.(); abortRef.current = null; setLoading(false); setStreaming('') }

  const copyText = async (t: string) => { await Clipboard.setStringAsync(t); Alert.alert('已复制') }

  const modelInfo = AVAILABLE_MODELS.find(m => m.id === model)

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* 顶部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onOpenSidebar} hitSlop={8}>
          <View style={styles.menuIcon}>
            <View style={[styles.menuLine, { width: 18 }]} />
            <View style={[styles.menuLine, { width: 14 }]} />
            <View style={[styles.menuLine, { width: 10 }]} />
          </View>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>{agent.name}</Text>
          <TouchableOpacity style={styles.modelRow} onPress={() => setShowModels(!showModels)}>
            <Text style={styles.modelName}>{modelInfo?.name}</Text>
            <Ionicons name={showModels ? 'chevron-up' : 'chevron-down'} size={14} color={isDark ? '#8e8ea0' : '#6B6B6B'} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => onNewConversation(agent.id)} hitSlop={8}>
          <Ionicons name="pencil" size={20} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
      </View>

      {/* 模型选择下拉 */}
      {showModels && (
        <View style={styles.modelDropdown}>
          {agent.supportedModels?.map(m => {
            const info = AVAILABLE_MODELS.find(am => am.id === m)
            return (
              <TouchableOpacity
                key={m}
                style={[styles.modelItem, model === m && styles.modelItemActive]}
                onPress={() => { setModel(m); setShowModels(false) }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modelItemName, model === m && { color: '#fff' }]}>{info?.name}</Text>
                  <Text style={styles.modelItemDesc}>{info?.description}</Text>
                </View>
                {model === m && <Ionicons name="checkmark" size={18} color="#fff" />}
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* 消息 */}
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.msgContent} onContentSizeChange={scrollToBottom}>
        {/* Nano Banana 图片生成专用界面 */}
        {isImageGenerator && (
          <>
            {/* 图片设置面板 */}
            {showImageSettings && (
              <View style={styles.imageSettingsPanel}>
                <Text style={styles.settingsLabel}>宽高比</Text>
                <View style={styles.settingsRow}>
                  {ASPECT_RATIOS.map(ar => (
                    <TouchableOpacity
                      key={ar.value}
                      style={[styles.settingsBtn, aspectRatio === ar.value && styles.settingsBtnActive]}
                      onPress={() => setAspectRatio(ar.value)}
                    >
                      <Text style={[styles.settingsBtnText, aspectRatio === ar.value && styles.settingsBtnTextActive]}>{ar.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.settingsLabel, { marginTop: 12 }]}>清晰度</Text>
                <View style={styles.settingsRow}>
                  {IMAGE_SIZES.map(size => (
                    <TouchableOpacity
                      key={size.value}
                      style={[styles.settingsBtn, imageSize === size.value && styles.settingsBtnActive]}
                      onPress={() => setImageSize(size.value)}
                    >
                      <Text style={[styles.settingsBtnText, imageSize === size.value && styles.settingsBtnTextActive]}>{size.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 当前设置显示 */}
            <View style={styles.currentSettings}>
              <TouchableOpacity style={styles.settingTag} onPress={() => setShowImageSettings(!showImageSettings)}>
                <Text style={styles.settingTagText}>{aspectRatio}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingTag} onPress={() => setShowImageSettings(!showImageSettings)}>
                <Text style={styles.settingTagText}>{imageSize}</Text>
              </TouchableOpacity>
            </View>

            {/* 最近生成的图片 */}
            {generatedImages.length > 0 && (
              <View style={styles.recentImages}>
                <Text style={styles.recentLabel}>最近生成</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {generatedImages.slice(0, 5).map((img, i) => (
                    <Image key={i} source={{ uri: img.uri }} style={styles.recentImage} />
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}

        {!messages.length && !loading && !isImageGenerator && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyEmoji}>{agent.avatar}</Text>
            </View>
            <Text style={styles.emptyTitle}>今天想聊点什么？</Text>
          </View>
        )}

        {/* 图片生成器空状态 */}
        {isImageGenerator && !messages.length && !loading && generatedImages.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyEmoji}>{agent.avatar}</Text>
            </View>
            <Text style={styles.emptyTitle}>描述你想要的图片</Text>
            <Text style={styles.emptyDesc}>支持多种尺寸和清晰度</Text>
          </View>
        )}

        {messages.map(msg => (
          <View key={msg.id} style={[styles.msgRow, msg.role === 'user' && styles.userRow]}>
            {msg.role === 'assistant' && (
              <View style={styles.aiIcon}>
                <Text style={styles.aiIconText}>{agent.avatar}</Text>
              </View>
            )}
            <View style={[styles.msgBox, msg.role === 'user' && styles.userBox]}>
              {msg.images?.[0] && (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: `data:image/png;base64,${msg.images[0]}` }} style={styles.generatedImage} resizeMode="contain" />
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={async () => {
                      try {
                        const filePath = FileSystem.documentDirectory + `nano_banana_${Date.now()}.png`
                        await FileSystem.writeAsStringAsync(filePath, msg.images[0], { encoding: FileSystem.EncodingType.Base64 })
                        Alert.alert('保存成功', `图片已保存到: ${filePath}`)
                      } catch (e) {
                        Alert.alert('保存失败', '无法保存图片')
                      }
                    }}
                  >
                    <Ionicons name="download-outline" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>保存图片</Text>
                  </TouchableOpacity>
                </View>
              )}
              {msg.content ? msg.role === 'user' ? (
                <Text style={styles.userText}>{msg.content}</Text>
              ) : (
                <>
                  <Markdown style={mdStyles(isDark)}>{msg.content}</Markdown>
                  <TouchableOpacity style={styles.copyBtn} onPress={() => copyText(msg.content)}>
                    <Ionicons name="copy-outline" size={14} color="#8e8ea0" />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        ))}

        {loading && streaming && (
          <View style={styles.msgRow}>
            <View style={styles.aiIcon}><Text style={styles.aiIconText}>{agent.avatar}</Text></View>
            <View style={styles.msgBox}>
              <Markdown style={mdStyles(isDark)}>{streaming}</Markdown>
              <TouchableOpacity style={styles.stopBtn} onPress={stop}>
                <View style={styles.stopIcon} />
                <Text style={styles.stopText}>停止生成</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading && !streaming && (
          <View style={styles.msgRow}>
            <View style={styles.aiIcon}><Text style={styles.aiIconText}>{agent.avatar}</Text></View>
            <View style={[styles.msgBox, { flexDirection: 'row', alignItems: 'center' }]}>
              <View style={styles.dots}>
                <View style={[styles.dot, { animationDelay: '0s' }]} />
                <View style={[styles.dot, { animationDelay: '0.2s' }]} />
                <View style={[styles.dot, { animationDelay: '0.4s' }]} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 输入 */}
      <View style={styles.inputWrap}>
        {image && (
          <View style={styles.preview}>
            <Image source={{ uri: image }} style={styles.previewImg} />
            <TouchableOpacity style={styles.previewClose} onPress={() => { setImage(null); setBase64(null) }}>
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBox}>
          <TouchableOpacity onPress={pickImage} style={styles.attachBtn}>
            <Ionicons name="image-outline" size={20} color="#8e8ea0" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="发送消息..."
            placeholderTextColor="#8e8ea0"
            value={input}
            onChangeText={setInput}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && !base64 && styles.sendBtnDisabled]}
            onPress={loading ? stop : send}
          >
            <Ionicons name={loading ? 'stop' : 'arrow-up'} size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#212121' : '#fff' },

  // Nano Banana 图片生成样式
  imageSettingsPanel: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: isDark ? '#2f2f2f' : '#f5f5f5',
    borderRadius: 12,
  },
  settingsLabel: { fontSize: 13, fontWeight: '600', color: isDark ? '#8e8ea0' : '#6B6B6B', marginBottom: 8 },
  settingsRow: { flexDirection: 'row', gap: 8 },
  settingsBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isDark ? '#424242' : '#e0e0e0' },
  settingsBtnActive: { backgroundColor: '#10a37f' },
  settingsBtnText: { fontSize: 14, fontWeight: '500', color: isDark ? '#fff' : '#000' },
  settingsBtnTextActive: { color: '#fff' },
  currentSettings: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  settingTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: isDark ? '#2f2f2f' : '#f0f0f0' },
  settingTagText: { fontSize: 13, color: isDark ? '#8e8ea0' : '#6B6B6B' },
  recentImages: { marginHorizontal: 16, marginBottom: 16 },
  recentLabel: { fontSize: 13, fontWeight: '600', color: isDark ? '#8e8ea0' : '#6B6B6B', marginBottom: 8 },
  recentImage: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: isDark ? '#424242' : '#e0e0e0',
  },
  menuIcon: { width: 20, height: 16, justifyContent: 'space-between' },
  menuLine: { height: 2, backgroundColor: isDark ? '#fff' : '#000', borderRadius: 1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '600', color: isDark ? '#fff' : '#000' },
  modelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  modelName: { fontSize: 12, color: isDark ? '#8e8ea0' : '#6B6B6B' },

  modelDropdown: {
    position: 'absolute', top: 56, left: 16, right: 16,
    backgroundColor: isDark ? '#2f2f2f' : '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  modelItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#3f3f3f' : '#E0E0E0',
  },
  modelItemActive: { backgroundColor: '#10a37f' },
  modelItemName: { fontSize: 15, fontWeight: '500', color: isDark ? '#fff' : '#000' },
  modelItemDesc: { fontSize: 12, color: isDark ? '#8e8ea0' : '#6B6B6B', marginTop: 2 },

  messages: { flex: 1 },
  msgContent: { padding: 20, paddingBottom: 8 },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: isDark ? '#2f2f2f' : '#f0f0f0', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: isDark ? '#fff' : '#000' },
  emptyDesc: { fontSize: 14, color: isDark ? '#8e8ea0' : '#6B6B6B', marginTop: 8 },

  msgRow: { flexDirection: 'row', marginBottom: 24, alignItems: 'flex-start' },
  userRow: { flexDirection: 'row-reverse' },

  aiIcon: { width: 28, height: 28, borderRadius: 6, backgroundColor: isDark ? '#424242' : '#ececf1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  aiIconText: { fontSize: 14 },

  msgBox: { flex: 1, maxWidth: '85%' },
  userBox: { backgroundColor: isDark ? '#2f2f2f' : '#f0f0f0', padding: 14, borderRadius: 18, borderBottomRightRadius: 4 },
  userText: { fontSize: 16, color: isDark ? '#fff' : '#000', lineHeight: 24 },
  msgImg: { width: '100%', height: 200, borderRadius: 12, marginBottom: 8 },

  // 生成的图片容器
  imageContainer: { marginTop: 8 },
  generatedImage: { width: width - 80, height: width - 80, borderRadius: 12, backgroundColor: isDark ? '#2f2f2f' : '#f5f5f5' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#10a37f', borderRadius: 20, alignSelf: 'flex-start' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '500', marginLeft: 6 },

  copyBtn: { marginTop: 8, padding: 4 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 12, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: isDark ? '#424242' : '#e0e0e0', borderRadius: 16 },
  stopIcon: { width: 10, height: 10, borderRadius: 2, backgroundColor: isDark ? '#fff' : '#000', marginRight: 6 },
  stopText: { fontSize: 13, color: isDark ? '#fff' : '#000' },

  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8e8ea0' },

  inputWrap: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12, borderTopWidth: 1, borderTopColor: isDark ? '#424242' : '#e0e0e0' },
  preview: { marginBottom: 8 },
  previewImg: { width: 56, height: 56, borderRadius: 8 },
  previewClose: { position: 'absolute', top: -6, left: 50, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },

  inputBox: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: isDark ? '#2f2f2f' : '#f0f0f0', borderRadius: 24, paddingLeft: 12, paddingRight: 6, paddingVertical: 4 },
  attachBtn: { padding: 8 },
  input: { flex: 1, fontSize: 16, color: isDark ? '#fff' : '#000', maxHeight: 100, paddingVertical: 10 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#fff' : '#000', alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  sendBtnDisabled: { backgroundColor: isDark ? '#424242' : '#d0d0d0' },
})

const mdStyles = (isDark: boolean) => ({
  body: { color: isDark ? '#fff' : '#000', fontSize: 16, lineHeight: 24 },
  heading1: { color: isDark ? '#fff' : '#000', fontSize: 20, fontWeight: 'bold' as const, marginBottom: 8 },
  heading2: { color: isDark ? '#fff' : '#000', fontSize: 18, fontWeight: 'bold' as const, marginBottom: 6 },
  paragraph: { color: isDark ? '#fff' : '#000', marginBottom: 8 },
  strong: { fontWeight: 'bold' as const, color: isDark ? '#fff' : '#000' },
  code_inline: { backgroundColor: isDark ? '#424242' : '#e8e8e8', color: isDark ? '#fff' : '#000', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, fontSize: 14 },
  code_block: { backgroundColor: isDark ? '#2f2f2f' : '#f0f0f0', borderRadius: 8, padding: 12, marginVertical: 8 },
  link: { color: '#10a37f' },
  list_item: { color: isDark ? '#fff' : '#000', marginBottom: 4 },
})
