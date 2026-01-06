import { useContext, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { FacialDesign, ContentGenerator, VideoCreator, SmartQA, History } from './screens'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { ThemeContext } from './context'

const SIDEBAR_EXPANDED_WIDTH = 200
const SIDEBAR_COLLAPSED_WIDTH = 56

interface SidebarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  styles: any;
  isExpanded: boolean;
  onToggle: () => void;
}

function Sidebar({ currentScreen, onNavigate, styles, isExpanded, onToggle }: SidebarProps) {
  const { theme } = useContext(ThemeContext)

  const menuItems = [
    { name: '面部美学', icon: 'analytics' },
    { name: '文案生成', icon: 'create-outline' },
    { name: '内容创作', icon: 'videocam-outline' },
    { name: '智能问答', icon: 'chatbubble-ellipses-outline' },
    { name: '历史记录', icon: 'time-outline' },
  ]

  const handleNewChat = () => {
    onNavigate('new-chat')
  }

  const sidebarStyle = isExpanded
    ? [styles.sidebar, { width: SIDEBAR_EXPANDED_WIDTH, backgroundColor: theme.sidebarBackground }]
    : [styles.sidebarCollapsed, { width: SIDEBAR_COLLAPSED_WIDTH, backgroundColor: theme.sidebarBackground }]

  return (
    <View style={sidebarStyle}>
      <View style={isExpanded ? styles.sidebarContent : styles.sidebarCollapsedContent}>
        {/* 新开对话按钮 */}
        <TouchableOpacity
          style={[styles.newChatButton, { backgroundColor: theme.primaryColor }]}
          onPress={handleNewChat}
        >
          <Ionicons name="add" size={22} color={theme.buttonText} />
          {isExpanded && <Text style={[styles.newChatButtonText, { color: theme.buttonText }]}>新开对话</Text>}
        </TouchableOpacity>

        {/* 菜单列表 */}
        <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={[styles.menuItem, currentScreen === item.name && styles.menuItemActive]}
              onPress={() => onNavigate(item.name)}
            >
              <Ionicons
                name={item.icon as any}
                size={22}
                color={currentScreen === item.name ? theme.primaryColor : theme.textColor}
              />
              {isExpanded && (
                <Text style={[
                  styles.menuItemText,
                  { color: currentScreen === item.name ? theme.primaryColor : theme.textColor }
                ]}>
                  {item.name}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 展开/收起按钮 */}
        <TouchableOpacity style={styles.toggleButton} onPress={onToggle}>
          <Ionicons
            name={isExpanded ? "chevron-back" : "chevron-forward"}
            size={22}
            color={theme.textColor}
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

function MainComponent() {
  const { theme } = useContext(ThemeContext)
  const insets = useSafeAreaInsets()
  const styles = getStyles(theme)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)

  const toggleSidebar = useCallback(() => {
    setSidebarExpanded(prev => !prev)
  }, [])

  const [currentScreen, setCurrentScreen] = useState('面部美学')

  const screens = {
    '面部美学': FacialDesign,
    '文案生成': ContentGenerator,
    '内容创作': VideoCreator,
    '智能问答': SmartQA,
    '历史记录': History,
  }

  const handleNavigate = useCallback((screen: string) => {
    setCurrentScreen(screen)
  }, [])

  const CurrentScreen = screens[currentScreen as keyof typeof screens] || FacialDesign

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
        styles={styles}
        isExpanded={sidebarExpanded}
        onToggle={toggleSidebar}
      />
      <View style={styles.mainContent}>
        <CurrentScreen />
      </View>
    </View>
  )
}

export function Main() {
  return (
    <SafeAreaProvider>
      <MainComponent />
    </SafeAreaProvider>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.backgroundColor,
  },
  sidebar: {
    borderRightWidth: 1,
    borderRightColor: theme.borderColor,
  },
  sidebarCollapsed: {
    borderRightWidth: 1,
    borderRightColor: theme.borderColor,
    alignItems: 'center',
  },
  sidebarContent: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  sidebarCollapsedContent: {
    flex: 1,
    padding: 8,
    alignItems: 'center',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
    width: '100%',
  },
  newChatButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuList: {
    flex: 1,
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 6,
    gap: 10,
  },
  menuItemActive: {
    backgroundColor: theme.primaryColor + '15',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
  },
  toggleButton: {
    padding: 10,
    marginTop: 8,
  },
  mainContent: {
    flex: 1,
  },
})
