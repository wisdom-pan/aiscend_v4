import { useContext, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FacialDesign, ContentGenerator, VideoCreator, SmartQA, Settings } from './screens'
import { Header } from './components'
import FeatherIcon from '@expo/vector-icons/Feather'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { ThemeContext } from './context'

const Tab = createBottomTabNavigator()

function MainComponent() {
  const insets = useSafeAreaInsets()
  const { theme } = useContext(ThemeContext)
  const styles = getStyles({ theme, insets })

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: theme.tabBarActiveTintColor,
          tabBarInactiveTintColor: theme.tabBarInactiveTintColor,
          tabBarStyle: {
            borderTopWidth: 0,
            backgroundColor: theme.backgroundColor,
          },
        }}
      >
        <Tab.Screen
          name="面部美学"
          component={FacialDesign}
          options={{
            header: () => <Header />,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="analytics"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name="文案生成"
          component={ContentGenerator}
          options={{
            header: () => <Header />,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="create-outline"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name="内容创作"
          component={VideoCreator}
          options={{
            header: () => <Header />,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="videocam-outline"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name="智能问答"
          component={SmartQA}
          options={{
            header: () => <Header />,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="chatbubble-ellipses-outline"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name="设置"
          component={Settings}
          options={{
            header: () => <Header />,
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="settings-outline"
                color={color}
                size={size}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

export function Main() {
  return (
    <SafeAreaProvider>
      <MainComponent />
    </SafeAreaProvider>
  )
}

const getStyles = ({ theme, insets } : { theme: any, insets: any}) => StyleSheet.create({
  container: {
    backgroundColor: theme.backgroundColor,
    flex: 1,
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  },
})
