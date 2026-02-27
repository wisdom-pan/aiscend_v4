import { useState, useContext, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Image,
  Modal
} from 'react-native'
import { ThemeContext } from '../context'
import { Ionicons } from '@expo/vector-icons'
import { useActionSheet } from '@expo/react-native-action-sheet'
import * as ImagePicker from 'expo-image-picker'
import Markdown from '@ronradtke/react-native-markdown-display'
import { chatService } from '../services/chatService'
import { Message } from '../types/chat'

interface ImageItem {
  uri: string
  base64?: string
}

// 模型配置
const MODELS = [
  { id: 'gpt-5.2', name: 'GPT-5.2', color: '#10A37F', apiKey: 'sk-7bW8PnA4sv9mt7ipJsNzkDDtYSOYlb60kusyzJmqaTo52zld' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', color: '#4285F4', apiKey: 'sk-5dsmWDBRPKaSnSC3HYBp9shak39KFgZjgjdXM7BiDEmxbaif' }
]

const API_BASE = 'https://yunwu.ai/v1/chat/completions'

export function Chat() {
  const { theme } = useContext(ThemeContext)
  const { showActionSheetWithOptions } = useActionSheet()

  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedModel, setSelectedModel] = useState(MODELS[0])
  const [streamingContent, setStreamingContent] = useState('')
  const [selectedImages, setSelectedImages] = useState<ImageItem[]>([])
  const streamingContentRef = useRef('')
  const scrollViewRef = useRef<ScrollView>(null)

  const colors = theme || {
    backgroundColor: '#F8F9FA',
    textColor: '#2C3E50',
    borderColor: '#DDDDDD',
    tintColor: '#4A90E2',
    tintTextColor: '#FFFFFF',
    placeholderTextColor: '#999999'
  }

  useEffect(() => {
    loadSession()
  }, [])

  async function loadSession() {
    try {
      const sessions = await chatService.getSessions()
      if (sessions.length > 0) {
        setMessages(sessions[0].messages)
        const model = MODELS.find(m => m.id === sessions[0].modelId)
        if (model) setSelectedModel(model)
      }
    } catch (e) {
      console.log('load error', e)
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true
    })

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      const newImage: ImageItem = {
        uri: asset.uri,
        base64: asset.base64
      }
      setSelectedImages([...selectedImages, newImage])
    }
  }

  function removeImage(index: number) {
    const newImages = [...selectedImages]
    newImages.splice(index, 1)
    setSelectedImages(newImages)
  }

  async function sendMessage() {
    if (!input.trim() && selectedImages.length === 0) return

    const userMessage: Message = {
      id: String(Date.now()),
      role: 'user',
      content: input,
      timestamp: Date.now(),
      images: selectedImages
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setSelectedImages([])
    setLoading(true)
    setStreamingContent('')
    streamingContentRef.current = ''

    const assistantId = String(Date.now()) + 'a'
    const tempAssistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    setMessages([...newMessages, tempAssistantMessage])

    try {
      await callAPIStream(input, selectedImages, (chunk) => {
        if (chunk) {
          streamingContentRef.current += chunk
          setStreamingContent(streamingContentRef.current)
        }

        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (lastIdx >= 0 && updated[lastIdx].id === assistantId) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: streamingContentRef.current
            }
          }
          return updated
        })
      })
    } catch (error: any) {
      console.log('API error:', error)
    } finally {
      setLoading(false)
      setStreamingContent('')
    }
  }

  async function callAPI(prompt: string): Promise<string> {
    const apiMessages = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    apiMessages.push({ role: 'user', content: prompt })

    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${selectedModel.apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel.id,
        messages: apiMessages,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error(`API错误: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || '无响应'
  }

  // 使用非流式API
  async function callAPIStream(prompt: string, images: ImageItem[], onChunk: (content: string) => void): Promise<void> {
    // 构建消息内容 - 支持多模态
    let userContent: any

    if (images && images.length > 0) {
      // 多模态消息：文字 + 图片
      const contentParts: any[] = []

      if (prompt.trim()) {
        contentParts.push({ type: 'text', text: prompt })
      }

      for (const img of images) {
        if (img.base64) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${img.base64}` }
          })
        }
      }

      userContent = contentParts
    } else {
      userContent = prompt
    }

    const apiMessages = messages.slice(-10).map(m => {
      if (m.images && m.images.length > 0) {
        const contentParts: any[] = []
        if (m.content) {
          contentParts.push({ type: 'text', text: m.content })
        }
        for (const img of m.images) {
          if (img.base64) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${img.base64}` }
            })
          }
        }
        return { role: m.role, content: contentParts }
      }
      return { role: m.role, content: m.content }
    })

    apiMessages.push({ role: 'user', content: userContent })

    console.log('Calling API with images:', images?.length || 0)

    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${selectedModel.apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel.id,
        messages: apiMessages,
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log('Error:', errorText)
      throw new Error(`API错误: ${response.status}`)
    }

    const data = await response.json()
    console.log('Response received')

    const content = data.choices?.[0]?.message?.content || '无响应'

    // 模拟流式输出 - 加快速度
    let i = 0
    const chars = content.split('')
    const interval = setInterval(() => {
      if (i < chars.length) {
        // 一次输出5个字符，加快速度
        const chunk = chars.slice(i, i + 5).join('')
        onChunk(chunk)
        i += 5
      } else {
        clearInterval(interval)
      }
    }, 15)
  }

  function switchModel() {
    const options = MODELS.map(m => m.name)
    showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, (idx) => {
      if (idx !== undefined) setSelectedModel(MODELS[idx])
    })
  }

  const renderMessage = (msg: Message, index: number) => {
    const isUser = msg.role === 'user'
    const isLastAssistant = index === messages.length - 1 && !isUser && loading

    const displayContent = isLastAssistant && streamingContent ? streamingContent : msg.content

    // 获取消息中的图片
    const msgImages = msg.images || []

    return (
      <View key={msg.id} style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
        <View style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.tintColor }
            : { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor, borderWidth: 1 }
        ]}>
          {/* 显示用户消息中的图片 */}
          {msgImages.length > 0 && (
            <View style={styles.imageGrid}>
              {msgImages.map((img, idx) => (
                <Image key={idx} source={{ uri: img.uri }} style={styles.messageImage} />
              ))}
            </View>
          )}
          {/* AI回复使用Markdown渲染，支持选择文本 */}
          {!isUser && displayContent ? (
            <Markdown style={markdownStyles}>
              {displayContent}
            </Markdown>
          ) : (
            <Text selectable style={[styles.bubbleText, { color: isUser ? colors.tintTextColor : colors.textColor }]}>
              {displayContent}
            </Text>
          )}
          {isLastAssistant && loading && <Text style={styles.cursor}>▊</Text>}
        </View>
      </View>
    )
  }

  const markdownStyles = {
    body: { color: colors.textColor, fontSize: 16 },
    heading1: { color: colors.textColor, fontSize: 24, fontWeight: 'bold' as const, marginVertical: 8 },
    heading2: { color: colors.textColor, fontSize: 20, fontWeight: 'bold' as const, marginVertical: 6 },
    heading3: { color: colors.textColor, fontSize: 18, fontWeight: 'bold' as const, marginVertical: 4 },
    code_inline: { backgroundColor: '#E0E0E0', paddingHorizontal: 4, borderRadius: 4, fontFamily: 'monospace' },
    code_block: { backgroundColor: '#2D2D2D', color: '#F8F8F2', padding: 12, borderRadius: 8, fontFamily: 'monospace' },
    fence: { backgroundColor: '#2D2D2D', color: '#F8F8F2', padding: 12, borderRadius: 8, fontFamily: 'monospace' },
    blockquote: { backgroundColor: '#F0F0F0', borderLeftColor: colors.tintColor, borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 8 },
    link: { color: colors.tintColor, textDecorationLine: 'underline' as const },
    list_item: { marginVertical: 4 },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={switchModel} style={styles.modelBtn}>
          <View style={[styles.dot, { backgroundColor: selectedModel.color }]} />
          <Text style={[styles.modelName, { color: colors.textColor }]}>{selectedModel.name}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textColor} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textColor }]}>
              与 {selectedModel.name} 开始对话
            </Text>
          </View>
        )}
        {messages.map((msg, idx) => renderMessage(msg, idx))}
        {loading && streamingContent === '' && (
          <ActivityIndicator style={styles.loading} color={colors.tintColor} />
        )}
      </ScrollView>

      {/* 选中的图片预览 */}
      {selectedImages.length > 0 && (
        <View style={styles.selectedImagesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedImages.map((img, idx) => (
              <View key={idx} style={styles.selectedImageWrapper}>
                <Image source={{ uri: img.uri }} style={styles.selectedImage} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => removeImage(idx)}
                >
                  <Ionicons name="close-circle" size={20} color="red" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputContainer, { borderTopColor: colors.borderColor }]}>
        <TouchableOpacity onPress={pickImage} style={styles.imageBtn}>
          <Ionicons name="image-outline" size={24} color={colors.textColor} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: colors.textColor, borderColor: colors.borderColor, backgroundColor: colors.backgroundColor }]}
          placeholder="输入消息..."
          placeholderTextColor={colors.placeholderTextColor}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.tintColor }]}
          onPress={sendMessage}
        >
          <Ionicons name="send" size={20} color={colors.tintTextColor} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#DDDDDD' },
  modelBtn: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  modelName: { fontSize: 18, fontWeight: '600', marginRight: 4 },
  messages: { flex: 1, padding: 10 },
  messagesContent: { flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16 },
  messageRow: { marginVertical: 5, paddingHorizontal: 10 },
  userRow: { alignItems: 'flex-end' },
  assistantRow: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleText: { fontSize: 16 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  messageImage: { width: 100, height: 100, borderRadius: 8, marginRight: 4, marginBottom: 4 },
  thinkingContainer: { marginBottom: 8, padding: 8, backgroundColor: '#F0F0F0', borderRadius: 8 },
  thinkingLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  thinkingText: { fontSize: 13, fontStyle: 'italic' },
  cursor: { color: '#4A90E2' },
  loading: { marginTop: 10 },
  selectedImagesContainer: { paddingHorizontal: 10, paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#DDDDDD' },
  selectedImageWrapper: { marginRight: 8, position: 'relative' },
  selectedImage: { width: 60, height: 60, borderRadius: 8 },
  removeImageBtn: { position: 'absolute', top: -8, right: -8 },
  imageBtn: { marginRight: 8, padding: 4 },
  inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, alignItems: 'center' },
  input: { flex: 1, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, fontSize: 16, borderWidth: 1 },
  sendBtn: { marginLeft: 10, padding: 12, borderRadius: 25 }
})
