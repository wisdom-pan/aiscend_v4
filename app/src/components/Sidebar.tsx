// Sidebar - ChatGPT 风格侧边栏

import React, { useContext, useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Animated, Dimensions, TouchableWithoutFeedback
} from 'react-native'
import { ThemeContext } from '../context'
import { agentService, DEFAULT_AGENTS } from '../services/agentService'
import { Agent, Conversation } from '../types/agent'
import Ionicons from '@expo/vector-icons/Ionicons'

const { width } = Dimensions.get('window')
const SIDEBAR_WIDTH = width * 0.82

interface Props {
  visible: boolean
  onClose: () => void
  currentAgent: Agent | null
  currentConversationId: string | null
  onSelectAgent: (agent: Agent) => void
  onSelectConversation: (conversation: Conversation) => void
  onNewChat: () => void
}

export function Sidebar({ visible, onClose, currentAgent, currentConversationId, onSelectAgent, onSelectConversation, onNewChat }: Props) {
  const { theme, setTheme, themeName } = useContext(ThemeContext)
  const isDark = themeName === 'Dark'
  const styles = getStyles(isDark)

  const [agents] = useState<Agent[]>(DEFAULT_AGENTS)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [showAgents, setShowAgents] = useState(false)

  const slideAnim = React.useRef(new Animated.Value(-SIDEBAR_WIDTH)).current

  useEffect(() => { if (visible) loadConversations() }, [visible])

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: visible ? 0 : -SIDEBAR_WIDTH, duration: 280, useNativeDriver: true }).start()
  }, [visible])

  const loadConversations = async () => setConversations(await agentService.loadConversations())

  const handleSelectConversation = (c: Conversation) => {
    const agent = agentService.getAgentById(c.agentId)
    if (agent) onSelectAgent(agent)
    onSelectConversation(c)
    onClose()
  }

  const deleteConv = (id: string) => Alert.alert('删除对话', '确定删除？', [
    { text: '取消', style: 'cancel' },
    { text: '删除', style: 'destructive', onPress: async () => { await agentService.deleteConversation(id); loadConversations() } }
  ])

  const clearAll = () => Alert.alert('清空全部', '确定清空所有对话？', [
    { text: '取消', style: 'cancel' },
    { text: '清空', style: 'destructive', onPress: async () => { await agentService.clearAllConversations(); setConversations([]) } }
  ])

  const formatDate = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
    if (diff === 0) return '今天'
    if (diff === 1) return '昨天'
    if (diff < 7) return `${diff}天前`
    return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  if (!visible && slideAnim._value <= -SIDEBAR_WIDTH + 10) return null

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}><View style={styles.backdrop} /></TouchableWithoutFeedback>

        <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          {/* 新对话 */}
          <TouchableOpacity style={styles.newBtn} onPress={() => { onNewChat(); onClose() }}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newBtnText}>新对话</Text>
          </TouchableOpacity>

          {/* 智能体 */}
          <TouchableOpacity style={styles.agentBtn} onPress={() => setShowAgents(!showAgents)}>
            <Text style={styles.agentEmoji}>{currentAgent?.avatar}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.agentLabel}>智能体</Text>
              <Text style={styles.agentName}>{currentAgent?.name}</Text>
            </View>
            <Ionicons name={showAgents ? 'chevron-up' : 'chevron-down'} size={18} color="#8e8ea0" />
          </TouchableOpacity>

          {showAgents && (
            <View style={styles.agentList}>
              {agents.map(a => (
                <TouchableOpacity key={a.id} style={[styles.agentItem, currentAgent?.id === a.id && styles.agentItemActive]} onPress={() => { onSelectAgent(a); setShowAgents(false) }}>
                  <Text style={styles.agentItemEmoji}>{a.avatar}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.agentItemName, currentAgent?.id === a.id && { color: '#fff' }]}>{a.name}</Text>
                    <Text style={styles.agentItemDesc}>{a.description}</Text>
                  </View>
                  {currentAgent?.id === a.id && <Ionicons name="checkmark" size={18} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 历史 */}
          <ScrollView style={styles.historyList}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>历史</Text>
              {conversations.length > 0 && (
                <TouchableOpacity onPress={clearAll}><Text style={styles.clearText}>清空</Text></TouchableOpacity>
              )}
            </View>

            {conversations.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>暂无对话</Text></View>
            ) : (
              conversations.map(c => (
                <TouchableOpacity key={c.id} style={[styles.historyItem, currentConversationId === c.id && styles.historyItemActive]} onPress={() => handleSelectConversation(c)}>
                  <Ionicons name="chatbubble-outline" size={18} color="#8e8ea0" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.historyTitle2} numberOfLines={1}>{c.title}</Text>
                    <Text style={styles.historyDate}>{formatDate(c.updatedAt)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteConv(c.id)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={16} color="#8e8ea0" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* 底部 */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerItem} onPress={() => setTheme(isDark ? 'light' : 'dark')}>
              <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={isDark ? '#fff' : '#000'} />
              <Text style={styles.footerText}>{isDark ? '浅色模式' : '深色模式'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sidebar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDEBAR_WIDTH,
    backgroundColor: isDark ? '#171717' : '#FAFAFA',
  },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: 16, paddingVertical: 12, backgroundColor: isDark ? '#fff' : '#000', borderRadius: 8,
  },
  newBtnText: { fontSize: 16, fontWeight: '600', color: isDark ? '#000' : '#fff' },

  agentBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, padding: 12, backgroundColor: isDark ? '#2f2f2f' : '#EFEFEF', borderRadius: 8 },
  agentEmoji: { fontSize: 24, marginRight: 12 },
  agentLabel: { fontSize: 11, color: isDark ? '#8e8ea0' : '#6B6B6B', textTransform: 'uppercase' },
  agentName: { fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#000', marginTop: 2 },

  agentList: { marginHorizontal: 16, marginBottom: 12, backgroundColor: isDark ? '#2f2f2f' : '#EFEFEF', borderRadius: 8, overflow: 'hidden' },
  agentItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#3f3f3f' : '#E0E0E0' },
  agentItemActive: { backgroundColor: '#10a37f' },
  agentItemEmoji: { fontSize: 22, marginRight: 12 },
  agentItemName: { fontSize: 15, fontWeight: '500', color: isDark ? '#fff' : '#000' },
  agentItemDesc: { fontSize: 12, color: isDark ? '#8e8ea0' : '#6B6B6B', marginTop: 2 },

  historyList: { flex: 1, paddingHorizontal: 16 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  historyTitle: { fontSize: 12, fontWeight: '600', color: isDark ? '#8e8ea0' : '#6B6B6B', textTransform: 'uppercase' },
  clearText: { fontSize: 12, color: '#ef4444' },

  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: isDark ? '#8e8ea0' : '#6B6B6B', fontSize: 14 },

  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, marginBottom: 2 },
  historyItemActive: { backgroundColor: isDark ? '#2f2f2f' : '#EFEFEF' },
  historyTitle2: { fontSize: 15, color: isDark ? '#fff' : '#000', fontWeight: '500' },
  historyDate: { fontSize: 12, color: isDark ? '#8e8ea0' : '#6B6B6B', marginTop: 2 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: isDark ? '#2f2f2f' : '#E0E0E0' },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  footerText: { fontSize: 15, color: isDark ? '#fff' : '#000' },
})
