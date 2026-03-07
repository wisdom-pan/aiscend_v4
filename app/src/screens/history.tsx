import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  Image,
  TouchableWithoutFeedback,
  Dimensions
} from 'react-native'
import { useState, useEffect, useContext } from 'react'
import { useNavigation } from '@react-navigation/native'
import { ThemeContext } from '../context'
import { historyService } from '../services/historyService'
import { HistoryRecord, UsageStats } from '../types/history'
import Ionicons from '@expo/vector-icons/Ionicons'
import Markdown from '@ronradtke/react-native-markdown-display'
import * as Clipboard from 'expo-clipboard'
import * as FileSystem from 'expo-file-system'
import { CameraRoll } from '@react-native-camera-roll/camera-roll'

const { width } = Dimensions.get('window')

export function History() {
  const navigation = useNavigation()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [weeklyData, setWeeklyData] = useState<{ labels: string[], data: number[] }>({ labels: [], data: [] })
  const [selectedTab, setSelectedTab] = useState<'overview' | 'records'>('overview')
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [followUpText, setFollowUpText] = useState('')
  const [isFollowingUp, setIsFollowingUp] = useState(false)
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)

  // 图片预览状态
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)

  // 继续对话，跳转到对应页面
  const handleContinueConversation = () => {
    if (!selectedRecord) return
    setEditModalVisible(false)
    // 根据类型跳转到对应页面
    switch (selectedRecord.type) {
      case 'facial':
        navigation.navigate('FacialAnalysis' as never)
        break
      case 'content':
        navigation.navigate('ContentGenerator' as never)
        break
      case 'video':
        navigation.navigate('VideoCreator' as never)
        break
      case 'qa':
        navigation.navigate('SmartQA' as never)
        break
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const statsData = await historyService.getStats()
      const historyData = await historyService.getHistory() // 获取全部历史记录
      const weekly = await historyService.getWeeklyActivityData()
      setStats(statsData)
      setHistory(historyData)
      setWeeklyData(weekly)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const renderOverview = () => {
    if (!stats) return null

    return (
      <ScrollView style={styles.overviewContainer}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="analytics" size={32} color={theme.primaryColor} />
            <Text style={styles.statValue}>{stats.totalAnalyses}</Text>
            <Text style={styles.statLabel}>面部分析</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="create-outline" size={32} color={theme.primaryColor} />
            <Text style={styles.statValue}>{stats.totalContentGenerated}</Text>
            <Text style={styles.statLabel}>文案生成</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="videocam-outline" size={32} color={theme.primaryColor} />
            <Text style={styles.statValue}>{stats.totalVideosCreated}</Text>
            <Text style={styles.statLabel}>视频创作</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={theme.primaryColor} />
            <Text style={styles.statValue}>{stats.totalQaResponses}</Text>
            <Text style={styles.statLabel}>智能问答</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 本周活跃度</Text>
          <View style={styles.weeklyActivity}>
            {weeklyData.labels.map((day, index) => {
              const maxVal = Math.max(...weeklyData.data, 1)
              const height = (weeklyData.data[index] / maxVal) * 60 + 10
              return (
                <View key={index} style={styles.dayColumn}>
                  <View style={[styles.activityBar, { height }]} />
                  <Text style={styles.dayLabel}>{day}</Text>
                  <Text style={styles.dayCount}>{weeklyData.data[index]}</Text>
                </View>
              )
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 功能使用分布</Text>
          <View style={styles.featureDistribution}>
            {Object.entries(stats.favoriteFeatures).map(([feature, count]) => (
              <View key={feature} style={styles.featureItem}>
                <Text style={styles.featureName}>
                  {feature === 'facial' && '面部分析'}
                  {feature === 'content' && '文案生成'}
                  {feature === 'video' && '视频创作'}
                  {feature === 'qa' && '智能问答'}
                </Text>
                <Text style={styles.featureCount}>{count} 次</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 效率提升</Text>
          <View style={styles.efficiencyCard}>
            <Text style={styles.efficiencyText}>
              相比使用前，您的咨询转化率提升了
            </Text>
            <Text style={styles.efficiencyValue}>+35%</Text>
            <Text style={styles.efficiencySubtext}>
              累计节省工作时间: 120小时
            </Text>
          </View>
        </View>
      </ScrollView>
    )
  }

  const handleRecordPress = (item: HistoryRecord) => {
    setSelectedRecord(item)
    setEditTitle(item.title)
    setEditPrompt(item.prompt)
    setEditModalVisible(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedRecord) return

    try {
      await historyService.updateRecord(selectedRecord.id, {
        title: editTitle,
        prompt: editPrompt,
      })

      // 更新本地状态
      setHistory(history.map(item =>
        item.id === selectedRecord.id
          ? { ...item, title: editTitle, prompt: editPrompt }
          : item
      ))

      setEditModalVisible(false)
      Alert.alert('成功', '记录已更新')
    } catch (error) {
      console.error('Error updating record:', error)
      Alert.alert('错误', '更新失败，请重试')
    }
  }

  const handleDeleteRecord = async () => {
    if (!selectedRecord) return

    Alert.alert(
      '确认删除',
      '确定要删除这条记录吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await historyService.deleteRecord(selectedRecord.id)

              // 更新本地状态
              setHistory(history.filter(item => item.id !== selectedRecord.id))
              setEditModalVisible(false)
              Alert.alert('成功', '记录已删除')
            } catch (error) {
              console.error('Error deleting record:', error)
              Alert.alert('错误', '删除失败，请重试')
            }
          }
        }
      ]
    )
  }

  const copyResultToClipboard = async () => {
    if (!selectedRecord?.result) return
    try {
      await Clipboard.setStringAsync(selectedRecord.result)
      Alert.alert('提示', '已复制到剪贴板')
    } catch (error) {
      Alert.alert('提示', '复制失败')
    }
  }

  const copyPromptToClipboard = async () => {
    if (!selectedRecord?.prompt) return
    try {
      await Clipboard.setStringAsync(selectedRecord.prompt)
      Alert.alert('提示', '已复制到剪贴板')
    } catch (error) {
      Alert.alert('提示', '复制失败')
    }
  }

  // 追问功能
  const handleFollowUp = async () => {
    if (!selectedRecord || !followUpText.trim()) return

    setIsFollowingUp(true)
    try {
      // 根据类型跳转到对应页面，并传递追问内容
      switch (selectedRecord.type) {
        case 'facial':
          navigation.navigate('FacialAnalysis' as never, { followUp: followUpText, record: selectedRecord } as never)
          break
        case 'content':
          navigation.navigate('ContentGenerator' as never, { followUp: followUpText, record: selectedRecord } as never)
          break
        case 'video':
          navigation.navigate('VideoCreator' as never, { followUp: followUpText, record: selectedRecord } as never)
          break
        case 'qa':
          navigation.navigate('SmartQA' as never, { followUp: followUpText, record: selectedRecord } as never)
          break
      }
      setEditModalVisible(false)
      setFollowUpText('')
    } catch (error) {
      console.error('追问失败:', error)
      Alert.alert('提示', '追问失败，请重试')
    } finally {
      setIsFollowingUp(false)
    }
  }

  // 打开图片预览
  const openPreview = (imageUrl: string) => {
    setPreviewImage(imageUrl)
    setPreviewVisible(true)
  }

  // 保存图片到相册
  const saveToGallery = async (imageUrl: string) => {
    try {
      // 下载图片到本地
      const downloadResumable = FileSystem.createDownloadResumable(
        imageUrl,
        FileSystem.documentDirectory + `temp_image_${Date.now()}.png`
      )
      const downloadResult = await downloadResumable.downloadAsync()

      if (downloadResult && downloadResult.uri) {
        // 保存到相册
        await CameraRoll.save(downloadResult.uri, { type: 'photo', album: 'Aiscend' })

        // 删除临时文件
        await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true })

        Alert.alert('保存成功', '图片已保存到相册')
      }
    } catch (error: any) {
      console.error('Save to gallery error:', error)
      Alert.alert('保存失败', error.message || '无法保存到相册')
    }
  }

  const renderRecordItem = ({ item }: { item: HistoryRecord }) => (
    <TouchableOpacity style={styles.recordCard} onPress={() => handleRecordPress(item)}>
      <View style={styles.recordHeader}>
        <View style={styles.recordTypeIcon}>
          {item.type === 'facial' && <Ionicons name="analytics" size={24} color={theme.primaryColor} />}
          {item.type === 'content' && <Ionicons name="create-outline" size={24} color={theme.primaryColor} />}
          {item.type === 'video' && <Ionicons name="videocam-outline" size={24} color={theme.primaryColor} />}
          {item.type === 'qa' && <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.primaryColor} />}
        </View>
        <View style={styles.recordInfo}>
          <Text style={styles.recordType}>
            {item.type === 'facial' && '面部分析'}
            {item.type === 'content' && '文案生成'}
            {item.type === 'video' && '视频创作'}
            {item.type === 'qa' && '智能问答'}
          </Text>
          <Text style={styles.recordDate}>
            {new Date(item.created_at).toLocaleString('zh-CN')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.placeholderColor} />
      </View>

      {/* 图片显示 */}
      {item.image_path && (
        <TouchableOpacity
          onPress={() => openPreview(item.image_path!)}
          onLongPress={() => {
            Alert.alert(
              '保存图片',
              '确定要保存到相册吗？',
              [
                { text: '取消', style: 'cancel' },
                { text: '保存', onPress: () => saveToGallery(item.image_path!) }
              ]
            )
          }}
          delayLongPress={500}
        >
          <Image source={{ uri: item.image_path }} style={styles.recordImage} />
        </TouchableOpacity>
      )}

      <Text style={styles.recordTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.recordPrompt} numberOfLines={2}>
        {item.prompt}
      </Text>
      {item.result && (
        <Text style={styles.recordResult} numberOfLines={3} selectable={true}>
          {item.result}
        </Text>
      )}
    </TouchableOpacity>
  )

  const renderRecords = () => (
    <FlatList
      data={history}
      renderItem={renderRecordItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.recordsList}
      refreshing={false}
      onRefresh={loadData}
    />
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>历史记录</Text>
        <Text style={styles.subtitle}>查看使用统计和历史记录</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'overview' && styles.tabActive
          ]}
          onPress={() => setSelectedTab('overview')}
        >
          <Ionicons
            name="bar-chart-outline"
            size={20}
            color={selectedTab === 'overview' ? theme.buttonText : theme.textColor}
          />
          <Text style={[
            styles.tabText,
            selectedTab === 'overview' && styles.tabTextActive
          ]}>
            统计概览
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'records' && styles.tabActive
          ]}
          onPress={() => setSelectedTab('records')}
        >
          <Ionicons
            name="time-outline"
            size={20}
            color={selectedTab === 'records' ? theme.buttonText : theme.textColor}
          />
          <Text style={[
            styles.tabText,
            selectedTab === 'records' && styles.tabTextActive
          ]}>
            历史记录
          </Text>
        </TouchableOpacity>
      </View>

      {selectedTab === 'overview' ? renderOverview() : renderRecords()}

      {/* 编辑模态框 */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => setEditModalVisible(false)}
            >
              <Ionicons name="chevron-back" size={24} color={theme.primaryColor} />
              <Text style={styles.modalBackText}>返回</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>记录详情</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>标题</Text>
              <TextInput
                style={styles.textInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="输入标题"
                placeholderTextColor={theme.placeholderColor}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>输入内容</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={editPrompt}
                onChangeText={setEditPrompt}
                placeholder="输入内容"
                placeholderTextColor={theme.placeholderColor}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {selectedRecord?.result && (
              <View style={styles.inputGroup}>
                <View style={styles.resultHeader}>
                  <Text style={styles.inputLabel}>生成结果</Text>
                  <TouchableOpacity style={styles.copyButton} onPress={copyResultToClipboard}>
                    <Ionicons name="copy-outline" size={16} color={theme.primaryColor} />
                    <Text style={styles.copyButtonText}>复制结果</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.resultContainer} nestedScrollEnabled>
                  <Markdown selectable={true} style={markdownStyles(theme)}>
                    {selectedRecord.result}
                  </Markdown>
                </ScrollView>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={handleContinueConversation}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.primaryColor} />
                <Text style={styles.actionButtonText}>继续对话</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={copyPromptToClipboard}>
                <Ionicons name="document-text-outline" size={20} color={theme.primaryColor} />
                <Text style={styles.actionButtonText}>复制输入</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.actionButton, styles.actionButtonDelete]} onPress={handleDeleteRecord}>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>删除</Text>
              </TouchableOpacity>
            </View>

            {/* 追问功能 */}
            <View style={styles.followUpContainer}>
              <Text style={styles.inputLabel}>💬 继续追问</Text>
              <View style={styles.followUpInputRow}>
                <TextInput
                  style={styles.followUpInput}
                  placeholder="输入追问内容..."
                  placeholderTextColor={theme.placeholderColor}
                  value={followUpText}
                  onChangeText={setFollowUpText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendFollowUpBtn, !followUpText.trim() && styles.sendFollowUpBtnDisabled]}
                  onPress={handleFollowUp}
                  disabled={!followUpText.trim() || isFollowingUp}
                >
                  {isFollowingUp ? (
                    <Ionicons name="hourglass" size={20} color="#fff" />
                  ) : (
                    <Ionicons name="send" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* 图片预览 Modal */}
      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewModal}>
          <TouchableWithoutFeedback onPress={() => setPreviewVisible(false)}>
            <View style={styles.previewBackdrop} />
          </TouchableWithoutFeedback>

          {previewImage && (
            <View style={styles.previewContent}>
              <Image
                source={{ uri: previewImage }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={() => saveToGallery(previewImage)}
                >
                  <Ionicons name="download-outline" size={24} color="#fff" />
                  <Text style={styles.previewBtnText}>保存到相册</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={() => setPreviewVisible(false)}
                >
                  <Ionicons name="close-outline" size={24} color="#fff" />
                  <Text style={styles.previewBtnText}>关闭</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColor,
  },
  header: {
    padding: 20,
    backgroundColor: theme.primaryColor,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.buttonText,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.buttonText,
    opacity: 0.9,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.cardBackground,
    padding: 4,
    margin: 16,
    borderRadius: 12,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: theme.primaryColor,
  },
  tabText: {
    fontSize: 14,
    color: theme.textColor,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.buttonText,
  },
  overviewContainer: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    padding: 16,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.textColor,
  },
  statLabel: {
    fontSize: 14,
    color: theme.placeholderColor,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textColor,
    marginBottom: 12,
  },
  weeklyActivity: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
  },
  dayColumn: {
    alignItems: 'center',
    gap: 8,
  },
  activityBar: {
    width: 20,
    backgroundColor: theme.primaryColor,
    borderRadius: 4,
  },
  dayLabel: {
    fontSize: 12,
    color: theme.placeholderColor,
  },
  dayCount: {
    fontSize: 10,
    color: theme.primaryColor,
    fontWeight: '600',
  },
  featureDistribution: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featureName: {
    fontSize: 16,
    color: theme.textColor,
  },
  featureCount: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primaryColor,
  },
  efficiencyCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  efficiencyText: {
    fontSize: 16,
    color: theme.textColor,
    marginBottom: 8,
  },
  efficiencyValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.primaryColor,
    marginBottom: 8,
  },
  efficiencySubtext: {
    fontSize: 14,
    color: theme.placeholderColor,
  },
  recordsList: {
    padding: 16,
  },
  recordCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primaryColor + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordInfo: {
    flex: 1,
  },
  recordType: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textColor,
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 12,
    color: theme.placeholderColor,
  },
  recordPrompt: {
    fontSize: 13,
    color: theme.placeholderColor,
    lineHeight: 18,
    marginBottom: 8,
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textColor,
    marginBottom: 4,
  },
  recordResult: {
    fontSize: 13,
    color: theme.textColor,
    lineHeight: 18,
    backgroundColor: theme.backgroundColor,
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  recordImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  resultContainer: {
    backgroundColor: theme.cardBackground,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  resultDisplayText: {
    fontSize: 14,
    color: theme.textColor,
    lineHeight: 22,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.primaryColor + '15',
    borderRadius: 16,
  },
  copyButtonText: {
    fontSize: 13,
    color: theme.primaryColor,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  actionButtonDelete: {
    backgroundColor: '#FF4757',
    borderColor: '#FF4757',
  },
  actionButtonText: {
    fontSize: 14,
    color: theme.textColor,
    fontWeight: '500',
  },
  deleteButtonText: {
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.backgroundColor,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textColor,
  },
  modalBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalBackText: {
    fontSize: 16,
    color: theme.primaryColor,
  },
  followUpContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
  },
  followUpInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  followUpInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: theme.cardBackground,
    color: theme.textColor,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  sendFollowUpBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendFollowUpBtnDisabled: {
    opacity: 0.5,
  },
  // 图片预览 Modal 样式
  previewModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)'
  },
  previewContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewImage: {
    width: width,
    height: width
  },
  previewActions: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 20
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
    gap: 8
  },
  previewBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500'
  },
})

// Markdown 渲染样式
const markdownStyles = (theme: any) => ({
  paragraph: {
    color: theme.textColor,
    fontSize: 14,
    lineHeight: 22,
  },
  strong: {
    color: theme.textColor,
    fontWeight: 'bold',
  },
  em: {
    color: theme.textColor,
    fontStyle: 'italic',
  },
  blockquote: {
    borderLeftColor: theme.primaryColor,
    borderLeftWidth: 3,
    paddingLeft: 12,
    backgroundColor: theme.backgroundColor,
    marginLeft: 0,
  },
  blockquote_node: {
    color: theme.textColor,
  },
  code_inline: {
    backgroundColor: theme.primaryColor + '20',
    color: theme.primaryColor,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  code_block: {
    backgroundColor: theme.primaryColor + '20',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  code_block_content: {
    color: theme.textColor,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  fence: {
    backgroundColor: theme.primaryColor + '20',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  fence_content: {
    color: theme.textColor,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  link: {
    color: theme.primaryColor,
  },
})
