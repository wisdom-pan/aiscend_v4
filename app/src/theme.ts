const colors = {
  white: '#fff',
  black: '#000',
  gray: 'rgba(0, 0, 0, .5)',
  lightWhite: 'rgba(255, 255, 255, .5)',
  blueTintColor: '#0281ff',
  lightPink: '#F7B5CD',
  primaryBlue: '#4A90E2',
  primaryGreen: '#5ED4A4',
  lightBlue: '#E8F4FF',
  cardBackground: '#FAFAFA',
}

const fonts = {
  ultraLightFont: 'Geist-Ultralight',
  thinFont: 'Geist-Thin',
  regularFont: 'Geist-Regular',
  lightFont: 'Geist-Light',
  mediumFont: 'Geist-Medium',
  semiBoldFont: 'Geist-SemiBold',
  boldFont: 'Geist-Bold',
  blackFont: 'Geist-Black',
  ultraBlackFont: 'Geist-Ultrablack',
}

const medicalTheme = {
  ...fonts,
  name: 'Medical',
  label: 'medical',
  textColor: '#2C3E50',
  secondaryTextColor: colors.white,
  mutedForegroundColor: '#95A5A6',
  backgroundColor: '#F8F9FA',
  placeholderTextColor: '#BDC3C7',
  secondaryBackgroundColor: colors.black,
  borderColor: 'rgba(74, 144, 226, .2)',
  primaryColor: colors.primaryBlue,
  buttonText: colors.white,
  cardBackground: colors.white,
  tintColor: colors.primaryBlue,
  tintTextColor: colors.white,
  tabBarActiveTintColor: colors.primaryBlue,
  tabBarInactiveTintColor: '#95A5A6',
}

const lightTheme = {
  ...fonts,
  name: 'Light',
  label: 'light',
  textColor: colors.black,
  secondaryTextColor: colors.white,
  mutedForegroundColor: colors.gray,
  backgroundColor: colors.white,
  placeholderTextColor: colors.gray,
  secondaryBackgroundColor: colors.black,
  borderColor: 'rgba(0, 0, 0, .15)',
  primaryColor: colors.primaryBlue,
  buttonText: colors.white,
  cardBackground: colors.white,
  tintColor: '#0281ff',
  tintTextColor: colors.white,
  tabBarActiveTintColor: colors.black,
  tabBarInactiveTintColor: colors.gray,
}

const darkTheme = {
  ...fonts,
  name: 'Dark',
  label: 'dark',
  textColor: colors.white,
  secondaryTextColor: colors.black,
  mutedForegroundColor: colors.lightWhite,
  backgroundColor: colors.black,
  placeholderTextColor: colors.lightWhite,
  laceholderTextColor: colors.lightWhite,
  secondaryBackgroundColor: colors.white,
  borderColor: 'rgba(255, 255, 255, .2)',
  primaryColor: colors.primaryBlue,
  buttonText: colors.white,
  cardBackground: '#1E1E1E',
  tintColor: '#0281ff',
  tintTextColor: colors.white,
  tabBarActiveTintColor: colors.blueTintColor,
  tabBarInactiveTintColor: colors.lightWhite,
}

const hackerNews = {
  ...lightTheme,
  name: 'Hacker News',
  label: 'hackerNews',
  backgroundColor: '#e4e4e4',
  tintColor: '#ed702d',
}

const miami = {
  ...darkTheme,
  name: 'Miami',
  label: 'miami',
  backgroundColor: '#231F20',
  tintColor: colors.lightPink,
  tintTextColor: '#231F20',
  tabBarActiveTintColor: colors.lightPink
}

const vercel = {
  ...darkTheme,
  name: 'Vercel',
  label: 'vercel',
  backgroundColor: colors.black,
  tintColor: '#171717',
  tintTextColor: colors.white,
  tabBarActiveTintColor: colors.white,
  secondaryTextColor: colors.white,
}

export {
  medicalTheme, lightTheme, darkTheme, hackerNews, miami, vercel
}