// App.tsx
import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';
import { api, Employee, SalaryCluster } from './src/api';

export default function App() {
  // Auth & Token States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string>('');
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('password123');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // App Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Form Input States
  const [name, setName] = useState<string>('');
  const [position, setPosition] = useState<string>('');
  const [salary, setSalary] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Insights State
  const [clusters, setClusters] = useState<SalaryCluster[]>([]);
  const [showInsights, setShowInsights] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  // Handle Login
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอก Username และ Password');
      return;
    }

    try {
      setAuthLoading(true);
      const res = await api.login(username, password);
      setAuthToken(res.token);
      setIsLoggedIn(true);
      fetchEmployees(res.token);
    } catch (error: any) {
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', error.message || 'โปรดตรวจสอบข้อมูลอีกครั้ง');
    } finally {
      setAuthLoading(false);
    }
  };

  // Fetch Employees
  const fetchEmployees = async (token: string) => {
    try {
      setLoading(true);
      const res = await api.employees(token);
      setEmployees(res.employees);
    } catch (error: any) {
      Alert.alert('ข้อผิดพลาด', error.message || 'ไม่สามารถโหลดข้อมูลพนักงานได้');
    } finally {
      setLoading(false);
    }
  };

  // Add Employee
  const handleAddEmployee = async () => {
    if (!name.trim() || !position.trim() || !salary.trim()) {
      Alert.alert('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อ ตำแหน่ง และเงินเดือนให้ครบถ้วน');
      return;
    }

    const numSalary = parseFloat(salary);
    if (isNaN(numSalary) || numSalary <= 0) {
      Alert.alert('ข้อมูลไม่ถูกต้อง', 'กรุณาระบุเงินเดือนเป็นตัวเลขมากกว่า 0');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.addEmployee(authToken, {
        name: name.trim(),
        position: position.trim(),
        salary: numSalary,
      });
      setEmployees((prev) => [res.employee, ...prev]);
      setName('');
      setPosition('');
      setSalary('');
      Alert.alert('สำเร็จ', 'เพิ่มข้อมูลพนักงานเรียบร้อยแล้ว');
    } catch (error: any) {
      Alert.alert('ข้อผิดพลาด', error.message || 'ไม่สามารถเพิ่มพนักงานได้');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Employee Status
  const handleToggleStatus = async (id: string) => {
    try {
      const res = await api.toggleStatus(authToken, id);
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === id ? res.employee : emp))
      );
    } catch (error: any) {
      Alert.alert('ข้อผิดพลาด', error.message || 'ไม่สามารถเปลี่ยนสถานะได้');
    }
  };

  // Delete Employee
  const handleDeleteEmployee = (id: string, empName: string) => {
    Alert.alert(
      'ยืนยันการลบ',
      `คุณต้องการลบข้อมูลคุณ "${empName}" ใช่หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบข้อมูล',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteEmployee(authToken, id);
              setEmployees((prev) => prev.filter((emp) => emp.id !== id));
            } catch (error: any) {
              Alert.alert('ข้อผิดพลาด', error.message || 'ไม่สามารถลบข้อมูลได้');
            }
          },
        },
      ]
    );
  };

  // Analyze Salary Clusters (K-Means)
  const handleAnalyzeSalaries = async () => {
    try {
      setAnalyzing(true);
      const res = await api.salaryClusters(authToken);
      setClusters(res.clusters);
      setShowInsights(true);
    } catch (error: any) {
      Alert.alert('ข้อผิดพลาด', error.message || 'ไม่สามารถทำการวิเคราะห์ข้อมูลได้');
    } finally {
      setAnalyzing(false);
    }
  };

  // Metrics Calculation
  const metrics = useMemo(() => {
    const total = employees.length;
    const activeCount = employees.filter((e) => e.status === 'Active').length;
    const avgSalary =
      total > 0
        ? employees.reduce((sum, e) => sum + Number(e.salary), 0) / total
        : 0;

    return { total, activeCount, avgSalary };
  }, [employees]);

  // LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>People & Pay</Text>
          <Text style={styles.loginSubtitle}>ระบบบริหารจัดการพนักงานและวิเคราะห์เงินเดือน</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>ชื่อผู้ใช้งาน (Username)</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>รหัสผ่าน (Password)</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={authLoading}
          >
            {authLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginBtnText}>เข้าสู่ระบบ</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // MAIN DASHBOARD SCREEN
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>People & Pay</Text>
            <Text style={styles.appSubtitle}>Employee & Salary Management</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              setIsLoggedIn(false);
              setAuthToken('');
            }}
          >
            <Text style={styles.logoutText}>ออกจากระบบ</Text>
          </TouchableOpacity>
        </View>

        {/* Dashboard Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.total}</Text>
            <Text style={styles.metricLabel}>พนักงานทั้งหมด</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: '#10B981' }]}>
              {metrics.activeCount}
            </Text>
            <Text style={styles.metricLabel}>ทำงานอยู่ (Active)</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: '#3B82F6', fontSize: 15 }]}>
              ฿{metrics.avgSalary.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </Text>
            <Text style={styles.metricLabel}>เงินเดือนเฉลี่ย</Text>
          </View>
        </View>

        {/* Add Employee Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>➕ เพิ่มพนักงานใหม่</Text>

          <TextInput
            style={styles.formInput}
            placeholder="ชื่อ-นามสกุล"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.formInput}
            placeholder="ตำแหน่งงาน"
            value={position}
            onChangeText={setPosition}
          />
          <TextInput
            style={styles.formInput}
            placeholder="เงินเดือนพื้นฐาน (เช่น 25000)"
            value={salary}
            onChangeText={setSalary}
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAddEmployee}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.addBtnText}>บันทึกข้อมูลพนักงาน</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Action Header & Analysis Button */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>รายชื่อพนักงาน</Text>
          <TouchableOpacity
            style={styles.analyzeBtn}
            onPress={handleAnalyzeSalaries}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.analyzeBtnText}>📊 วิเคราะห์เงินเดือน (K-Means)</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Employee List */}
        {loading ? (
          <ActivityIndicator style={{ marginVertical: 20 }} color="#1E293B" />
        ) : employees.length === 0 ? (
          <Text style={styles.emptyText}>ยังไม่มีข้อมูลพนักงานในระบบ</Text>
        ) : (
          employees.map((item) => (
            <View key={item.id} style={styles.employeeCard}>
              <View style={styles.employeeInfo}>
                <Text style={styles.empName}>{item.name}</Text>
                <Text style={styles.empPosition}>{item.position}</Text>
                <Text style={styles.empSalary}>
                  ฿{Number(item.salary).toLocaleString('th-TH')}
                </Text>
              </View>

              <View style={styles.employeeActions}>
                <TouchableOpacity
                  style={[
                    styles.statusBadge,
                    item.status === 'Active'
                      ? styles.badgeActive
                      : styles.badgeLeave,
                  ]}
                  onPress={() => handleToggleStatus(item.id)}
                >
                  <Text
                    style={[
                      styles.statusText,
                      item.status === 'Active'
                        ? styles.textActive
                        : styles.textLeave,
                    ]}
                  >
                    {item.status}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteEmployee(item.id, item.name)}
                >
                  <Text style={styles.deleteBtnText}>ลบ</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Salary Insights Modal */}
      <Modal
        visible={showInsights}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInsights(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📈 ผลการวิเคราะห์กลุ่มเงินเดือน</Text>
            <Text style={styles.modalSubtitle}>การแบ่งกลุ่มด้วยอัลกอริทึม K-Means</Text>

            {clusters.map((c, idx) => (
              <View key={idx} style={styles.clusterCard}>
                <Text style={styles.clusterGroup}>{c.group}</Text>
                <Text style={styles.clusterDetail}>จำนวน: {c.count} คน</Text>
                <Text style={styles.clusterDetail}>
                  ค่ากลาง (Centroid): ฿{Number(c.centroid).toLocaleString('th-TH')}
                </Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowInsights(false)}
            >
              <Text style={styles.closeModalText}>ปิดหน้าต่าง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loginContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', padding: 20 },
  scrollContent: { padding: 16 },
  loginCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 16 },
  loginTitle: { fontSize: 28, fontWeight: 'bold', color: '#0F172A', textAlign: 'center' },
  loginSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16 },
  loginBtn: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  loginBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  appTitle: { fontSize: 24, fontWeight: 'bold', color: '#0F172A' },
  appSubtitle: { fontSize: 13, color: '#64748B' },
  logoutBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  logoutText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginHorizontal: 4, alignItems: 'center', elevation: 2 },
  metricValue: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  metricLabel: { fontSize: 11, color: '#64748B', marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 20, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 12 },
  formInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 14 },
  addBtn: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  analyzeBtn: { backgroundColor: '#6366F1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  analyzeBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginVertical: 20 },
  employeeCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  employeeInfo: { flex: 1 },
  empName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  empPosition: { fontSize: 13, color: '#64748B', marginTop: 2 },
  empSalary: { fontSize: 14, fontWeight: '600', color: '#2563EB', marginTop: 4 },
  employeeActions: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  badgeActive: { backgroundColor: '#D1FAE5' },
  badgeLeave: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  textActive: { color: '#047857' },
  textLeave: { color: '#B45309' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: '#EF4444', fontSize: 12, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  clusterCard: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  clusterGroup: { fontSize: 15, fontWeight: 'bold', color: '#2563EB', marginBottom: 4 },
  clusterDetail: { fontSize: 13, color: '#334155' },
  closeModalBtn: { backgroundColor: '#0F172A', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  closeModalText: { color: '#FFF', fontWeight: 'bold' },
});