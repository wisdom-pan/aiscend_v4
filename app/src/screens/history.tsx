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
} from 'react-native'
import { useState, useEffect, useContext } from 'react'
import { ThemeContext } from '../context'
import { historyService } from '../services/historyService'
import { HistoryRecord, UsageStats } from '../types/history'
import Ionicons from '@expo/vector-icons/Ionicons'

export function History() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [selectedTab, setSelectedTab] = useState<'overview' | 'records'>('overview')
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const { theme } = useContext(ThemeContext)
  const styles = getStyles(theme)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const statsData = await historyService.getStats()
      const historyData = await historyService.getHistory(50)
      setStats(statsData)
      setHistory(historyData)
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
            {['日', '一', '二', '三', '四', '五', '六'].map((day, index) => (
              <View key={index} style={styles.dayColumn}>
                <View style={[
                  styles.activityBar,
                  { height: Math.random() * 60 + 20 }
                ]} />
                <Text style={styles.dayLabel}>{day}</Text>
              </View>
            ))}
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
      <Text style={styles.recordPrompt} numberOfLines={2}>
        {item.prompt}
      </Text>
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
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={styles.modalCancel}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>编辑记录</Text>
            <TouchableOpacity onPress={handleSaveEdit}>
              <Text style={styles.modalSave}>保存</Text>
            </TouchableOpacity>
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
              <Text style={styles.inputLabel}>内容</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={editPrompt}
                onChangeText={setEditPrompt}
                placeholder="输入内容"
                placeholderTextColor={theme.placeholderColor}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteRecord}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>删除记录</Text>
            </TouchableOpacity>
          </ScrollView>
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
    fontSize: 14,
    color: theme.textColor,
    lineHeight: 20,
  },
})
