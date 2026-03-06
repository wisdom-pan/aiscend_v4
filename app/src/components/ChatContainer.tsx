// 主聊天容器 - 整合侧边栏和聊天界面

import React, { useContext, useState, useEffect, useCallback } from 'react'
import { View, StyleSheet, StatusBar } from 'react-native'
import { ThemeContext } from '../context'
import { Sidebar } from './Sidebar'
import { ChatScreen } from '../screens/ChatScreen'
import { agentService } from '../services/agentService'
import { Agent, Conversation } from '../types/agent'

export function ChatContainer() {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)

  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)

  useEffect(() => {
    // 初始化默认智能体
    const defaultAgent = agentService.getDefaultAgent()
    setCurrentAgent(defaultAgent)
  }, [])

  const handleSelectAgent = useCallback((agent: Agent) => {
    setCurrentAgent(agent)
    // 切换智能体时清空当前对话
    setCurrentConversation(null)
  }, [])

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    setCurrentConversation(conversation)
  }, [])

  const handleNewConversation = useCallback(async (agentId: string): Promise<Conversation> => {
    const conversation = await agentService.createConversation(agentId)
    setCurrentConversation(conversation)
    return conversation
  }, [])

  const handleUpdateConversation = useCallback((conversation: Conversation) => {
    setCurrentConversation(conversation)
  }, [])

  if (!currentAgent) {
    return null
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.name === 'Dark' ? 'light-content' : 'dark-content'} />

      {/* 聊天界面 */}
      <ChatScreen
        agent={currentAgent}
        conversation={currentConversation}
        onNewConversation={handleNewConversation}
        onUpdateConversation={handleUpdateConversation}
        onOpenSidebar={() => setSidebarVisible(true)}
      />

      {/* 侧边栏 */}
      <Sidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        currentAgent={currentAgent}
        currentConversationId={currentConversation?.id || null}
        onSelectAgent={handleSelectAgent}
        onSelectConversation={handleSelectConversation}
        onNewChat={() => {
          handleNewConversation(currentAgent.id)
          setSidebarVisible(false)
        }}
      />
    </View>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColor,
  },
})
