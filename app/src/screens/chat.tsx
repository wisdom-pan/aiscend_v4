import { useState, useContext, useEffect, useRef, useCallback } from 'react'
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
import * as Clipboard from 'expo-clipboard'
import { ThemeContext } from '../context'
import { Ionicons } from '@expo/vector-icons'
import { useActionSheet } from '@expo/react-native-action-sheet'
import * as ImagePicker from 'expo-image-picker'
import Markdown from '@ronradtke/react-native-markdown-display'
import { chatService } from '../services/chatService'
import { historyService } from '../services/historyService'
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
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [selectedImages, setSelectedImages] = useState<ImageItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const streamingContentRef = useRef('')
  const scrollViewRef = useRef<ScrollView>(null)
  const isSavingRef = useRef(false)

  const colors = theme || {
    backgroundColor: '#F8F9FA',
    textColor: '#2C3E50',
    borderColor: '#DDDDDD',
    tintColor: '#4A90E2',
    tintTextColor: '#FFFFFF',
    placeholderTextColor: '#999999'
  }

  // 加载会话 - 使用 useCallback
  const loadSession = useCallback(async () => {
    try {
      console.log('Chat: Loading session from storage...')
      const sessions = await chatService.getSessions()
      console.log('Chat: Found sessions:', sessions.length)
      if (sessions.length > 0) {
        console.log('Chat: Loading messages, count:', sessions[0].messages.length)
        setMessages(sessions[0].messages)
        const model = MODELS.find(m => m.id === sessions[0].modelId)
        if (model) {
          setSelectedModel(model)
          console.log('Chat: Loaded model:', model.name)
        }
      }
      setIsLoaded(true)
    } catch (e) {
      console.log('Chat: Load error', e)
      setIsLoaded(true)
    }
  }, [])

  // 组件挂载时加载会话
  useEffect(() => {
    console.log('Chat: useEffect running, loading session...')
    loadSession()
  }, [loadSession])

  // 保存会话 - 使用 useCallback
  const saveCurrentSession = useCallback(async (msgs: Message[]) => {
    if (isSavingRef.current) {
      console.log('Chat: Already saving, skip...')
      return
    }
    isSavingRef.current = true

    try {
      console.log('Chat: Saving session, messages count:', msgs.length)
      let sessions = await chatService.getSessions()
      if (sessions.length === 0) {
        await chatService.createSession(selectedModel.id, selectedModel.name)
        sessions = await chatService.getSessions()
      }

      if (sessions.length > 0) {
        const session = sessions[0]
        session.messages = msgs
        session.modelId = selectedModel.id
        session.modelName = selectedModel.name
        await chatService.updateSession(session)
        console.log('Chat: Session saved successfully')

        // 同时保存到历史记录
        const lastUserMsg = msgs.filter(m => m.role === 'user').pop()
        const lastAssistantMsg = msgs.filter(m => m.role === 'assistant').pop()

        if (lastUserMsg && lastAssistantMsg) {
          try {
            await historyService.saveRecord({
              type: 'qa',
              title: lastUserMsg.content.substring(0, 50) || '智能问答',
              prompt: lastUserMsg.content,
              result: lastAssistantMsg.content,
              metadata: {
                model_provider: 'yunwu',
                model_name: selectedModel.id
              }
            })
            console.log('Chat: History record saved')
          } catch (e) {
            console.log('Chat: Save history error:', e)
          }
        }
      }
    } catch (e) {
      console.log('Chat: Save session error:', e)
    } finally {
      isSavingRef.current = false
    }
  }, [selectedModel.id, selectedModel.name])

  // 监听消息变化自动保存 - 只在加载完成后执行
  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      console.log('Chat: Messages changed, scheduling save...')
      // 使用 setTimeout 确保在渲染完成后保存
      const timer = setTimeout(() => {
        saveCurrentSession(messages)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [messages, isLoaded, saveCurrentSession])

  // 使用 ref 保存最新的 messages 和 selectedModel
  const messagesRef = useRef(messages)
  const selectedModelRef = useRef(selectedModel)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    selectedModelRef.current = selectedModel
  }, [selectedModel])

  // 组件卸载前保存
  useEffect(() => {
    return () => {
      console.log('Chat: Component unmounting, saving...')
      const currentMessages = messagesRef.current
      const currentModel = selectedModelRef.current
      // 同步保存当前消息
      if (currentMessages.length > 0) {
        chatService.getSessions().then(sessions => {
          if (sessions.length > 0) {
            sessions[0].messages = currentMessages
            sessions[0].modelId = currentModel.id
            sessions[0].modelName = currentModel.name
            chatService.updateSession(sessions[0])
            console.log('Chat: Saved on unmount')
          }
        })
      }
    }
  }, [])

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
        base64: asset.base64 ?? undefined
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

    const assistantMsgId = String(Date.now()) + 'a'
    setStreamingId(assistantMsgId)

    // 保存用户消息
    await saveCurrentSession(newMessages)

    try {
      await callAPIStream(input, selectedImages, (chunk) => {
        if (chunk) {
          streamingContentRef.current += chunk
          // 直接更新流式内容状态，不更新消息数组
          setStreamingContent(streamingContentRef.current)
        }
      })

      // 流式结束后，添加最终消息
      const finalContent = streamingContentRef.current
      if (finalContent) {
        const assistantMessage: Message = {
          id: assistantMsgId,
          role: 'assistant',
          content: finalContent,
          timestamp: Date.now()
        }
        const finalMessages = [...newMessages, assistantMessage]
        setMessages(finalMessages)
        await saveCurrentSession(finalMessages)
      }
    } catch (error: any) {
      console.log('API error:', error)
      // 错误时也添加错误消息
      const errorMessage: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '抱歉，发生了错误，请重试。',
        timestamp: Date.now()
      }
      setMessages([...newMessages, errorMessage])
    } finally {
      setLoading(false)
      setStreamingContent('')
      setStreamingId(null)
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

  // 使用真正的流式API (SSE)
  async function callAPIStream(prompt: string, images: ImageItem[], onChunk: (content: string) => void): Promise<void> {
    // 构建消息内容 - 支持多模态
    let userContent: any

    if (images && images.length > 0) {
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

    console.log('Calling streaming API with images:', images?.length || 0)

    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${selectedModel.apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel.id,
        messages: apiMessages,
        stream: true  // 启用真正的流式
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log('Error:', errorText)
      throw new Error(`API错误: ${response.status}`)
    }

    // 处理 SSE 流
    const reader = response.body?.getReader()
    const decoder = new TextDecoder('utf-8')

    if (!reader) {
      throw new Error('无法读取响应流')
    }

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''  // 保留不完整的行

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

        const data = trimmedLine.slice(6) // 去掉 'data: '

        if (data === '[DONE]') {
          console.log('Stream completed')
          return
        }

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            onChunk(delta)
          }
        } catch (e) {
          // 忽略解析错误，继续处理下一行
          console.log('Parse error for line:', trimmedLine)
        }
      }
    }

    // 处理剩余的缓冲区
    if (buffer.trim()) {
      const trimmedLine = buffer.trim()
      if (trimmedLine.startsWith('data: ')) {
        const data = trimmedLine.slice(6)
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              onChunk(delta)
            }
          } catch (e) {
            // 忽略
          }
        }
      }
    }
  }

  function switchModel() {
    const options = MODELS.map(m => m.name)
    showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, (idx) => {
      if (idx !== undefined) setSelectedModel(MODELS[idx])
    })
  }

  // 复制内容
  const handleCopyContent = async (content: string) => {
    try {
      await Clipboard.setStringAsync(content)
      Alert.alert('提示', '内容已复制到剪贴板')
    } catch (error: any) {
      Alert.alert('提示', '复制失败：' + error.message)
    }
  }

  // 收藏内容
  const handleFavorite = async (msg: Message) => {
    const userMsg = messages.filter(m => m.role === 'user' && m.timestamp < msg.timestamp).pop()
    if (!userMsg) return

    try {
      await historyService.saveRecord({
        type: 'favorite',
        title: userMsg.content.substring(0, 50) || '收藏',
        prompt: userMsg.content,
        result: msg.content,
        metadata: {
          model_provider: 'yunwu',
          model_name: selectedModel.id
        }
      })
      Alert.alert('提示', '已添加到收藏')
    } catch (error: any) {
      Alert.alert('提示', '收藏失败：' + error.message)
    }
  }

  // 重试功能
  const handleRetry = async () => {
    // 找到最后一条用户消息
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()
    if (!lastUserMsg) return

    // 删除最后一条assistant消息
    const newMessages = messages.filter(m => m.role === 'user')
    setMessages(newMessages)

    // 重新发送
    setInput(lastUserMsg.content)
    if (lastUserMsg.images && lastUserMsg.images.length > 0) {
      setSelectedImages(lastUserMsg.images)
    }
  }

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user'
    const isComplete = !isUser && msg.content.length > 0

    const displayContent = msg.content

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
          {/* AI回复使用Markdown渲染 */}
          {!isUser && displayContent ? (
            <Markdown style={markdownStyles}>
              {displayContent}
            </Markdown>
          ) : (
            <Text selectable style={[styles.bubbleText, { color: isUser ? colors.tintTextColor : colors.textColor }]}>
              {displayContent}
            </Text>
          )}
        </View>

        {/* AI回复的操作按钮 */}
        {!isUser && isComplete && (
          <View style={styles.messageActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleCopyContent(msg.content)}
            >
              <Ionicons name="copy-outline" size={18} color="#666" />
              <Text style={styles.actionBtnText}>复制</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleFavorite(msg)}
            >
              <Ionicons name="bookmark-outline" size={18} color="#666" />
              <Text style={styles.actionBtnText}>收藏</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleRetry}
            >
              <Ionicons name="refresh-outline" size={18} color="#666" />
              <Text style={styles.actionBtnText}>重试</Text>
            </TouchableOpacity>
          </View>
        )}
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
        {messages.length === 0 && !loading && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textColor }]}>
              与 {selectedModel.name} 开始对话
            </Text>
          </View>
        )}
        {messages.map((msg) => renderMessage(msg))}

        {/* 流式输出中的助手消息 */}
        {loading && streamingId && streamingContent.length > 0 && (
          <View style={[styles.messageRow, styles.assistantRow]}>
            <View style={[
              styles.bubble,
              { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor, borderWidth: 1 }
            ]}>
              <Markdown style={markdownStyles}>
                {streamingContent}
              </Markdown>
              <Text style={styles.cursor}>▊</Text>
            </View>
          </View>
        )}

        {/* 等待响应的加载指示器 */}
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
  sendBtn: { marginLeft: 10, padding: 12, borderRadius: 25 },
  // 操作按钮样式
  messageActions: { flexDirection: 'row', marginTop: 8, gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12 },
  actionBtnText: { fontSize: 12, color: '#666' }
})
