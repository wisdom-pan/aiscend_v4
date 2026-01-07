import { useContext, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView } from 'react-native';
import { FacialDesign, ContentGenerator, VideoCreator, SmartQA, History } from './screens'
import Ionicons from '@expo/vector-icons/Ionicons'
import { ThemeContext } from './context'

interface TabItem {
  name: string;
  icon: string;
  activeIcon: string;
}

const TAB_ITEMS: TabItem[] = [
  { name: '面部美学', icon: 'analytics-outline', activeIcon: 'analytics' },
  { name: '文案生成', icon: 'create-outline', activeIcon: 'create' },
  { name: '内容创作', icon: 'videocam-outline', activeIcon: 'videocam' },
  { name: '智能问答', icon: 'chatbubble-outline', activeIcon: 'chatbubble-ellipses' },
  { name: '历史记录', icon: 'time-outline', activeIcon: 'time' },
]

function MainComponent() {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)
  const [currentScreen, setCurrentScreen] = useState('面部美学')

  const screens = {
    '面部美学': FacialDesign,
    '文案生成': ContentGenerator,
    '内容创作': VideoCreator,
    '智能问答': SmartQA,
    '历史记录': History,
  }

  const CurrentScreen = screens[currentScreen as keyof typeof screens] || FacialDesign

  return (
    <SafeAreaView style={[styles.container, { paddingTop: 0 }]}>
      <View style={styles.mainContent}>
        <CurrentScreen />
      </View>

      {/* 底部标签栏 */}
      <View style={styles.tabBar}>
        {TAB_ITEMS.map((item) => {
          const isActive = currentScreen === item.name
          return (
            <TouchableOpacity
              key={item.name}
              style={styles.tabItem}
              onPress={() => setCurrentScreen(item.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={24}
                color={isActive ? theme.primaryColor : theme.textColor}
              />
              <Text style={[
                styles.tabLabel,
                { color: isActive ? theme.primaryColor : theme.textColor }
              ]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </SafeAreaView>
  )
}

export function Main() {
  return <MainComponent />
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColor,
  },
  mainContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.cardBackground,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    paddingBottom: 20,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
})
