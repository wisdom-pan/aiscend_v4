import { StyleSheet, View } from 'react-native'
import { useContext } from 'react'
import { Icon } from './Icon'
import { ThemeContext } from '../../src/context'

export function Header() {
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)

  return (
    <View style={styles.container}>
      <Icon size={34} fill={theme.textColor} />
    </View>
  )
}

function getStyles(theme:any) {
  return StyleSheet.create({
    container: {
      paddingVertical: 15,
      backgroundColor: theme.backgroundColor,
      justifyContent: 'center',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor
    }
  })
}