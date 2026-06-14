import React, { useMemo, useState } from "react"
import {
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { CameraView, useCameraPermissions } from "expo-camera"
import * as Haptics from "expo-haptics"
import { Ionicons } from "@expo/vector-icons"

type Tab = "home" | "scanner" | "events" | "account"

type ScanState =
  | { kind: "idle" }
  | { kind: "valid"; title: string; body: string }
  | { kind: "duplicate"; title: string; body: string }
  | { kind: "invalid"; title: string; body: string }

type RecentScan = {
  id: string
  status: Exclude<ScanState["kind"], "idle">
  title: string
  time: string
}

const API_BASE_URL = "https://ticketpulse.tech"

const demoEvents = [
  { id: "1", title: "The Sunday Table", date: "Past event", sold: 26, checkedIn: 0, status: "Summary ready" },
  { id: "2", title: "SHENERGY", date: "20 Jun 2026", sold: 0, checkedIn: 0, status: "Upcoming" },
]

export default function App() {
  const [tab, setTab] = useState<Tab>("home")
  const [scanState, setScanState] = useState<ScanState>({ kind: "idle" })
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [manualCode, setManualCode] = useState("")

  const totals = useMemo(() => ({
    events: demoEvents.length,
    sold: demoEvents.reduce((sum, event) => sum + event.sold, 0),
    checkedIn: demoEvents.reduce((sum, event) => sum + event.checkedIn, 0),
  }), [])

  async function handleScan(code: string) {
    const trimmed = code.trim()
    if (!trimmed) return

    try {
      const res = await fetch(`${API_BASE_URL}/api/mobile/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      })
      const result = await res.json()

      if (result.ok && result.status === "new") {
        await feedback("valid")
        pushResult("valid", result.ticket?.eventTitle ?? "Ticket admitted", result.ticket?.holder ?? result.ticket?.tierName ?? "Valid scan")
        return
      }

      if (result.ok && result.status === "duplicate") {
        await feedback("duplicate")
        pushResult("duplicate", result.ticket?.eventTitle ?? "Already scanned", result.ticket?.holder ?? result.ticket?.tierName ?? "Duplicate scan")
        return
      }

      await feedback("invalid")
      pushResult("invalid", "Scan rejected", result.error ?? "TicketPulse could not verify this code")
    } catch {
      await feedback("invalid")
      pushResult("invalid", "Network unavailable", "Check connection or use manual lookup at the gate")
    }
  }

  async function feedback(status: Exclude<ScanState["kind"], "idle">) {
    if (status === "valid") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      return
    }
    if (status === "duplicate") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      return
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }

  function pushResult(status: Exclude<ScanState["kind"], "idle">, title: string, body: string) {
    setScanState({ kind: status, title, body })
    setRecentScans((items) => [
      { id: `${Date.now()}`, status, title, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ...items,
    ].slice(0, 8))
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.shell}>
        <Header />
        <View style={styles.content}>
          {tab === "home" && <HomeScreen totals={totals} onScan={() => setTab("scanner")} />}
          {tab === "scanner" && (
            <ScannerScreen
              scanState={scanState}
              recentScans={recentScans}
              manualCode={manualCode}
              onManualCode={setManualCode}
              onScan={handleScan}
            />
          )}
          {tab === "events" && <EventsScreen />}
          {tab === "account" && <AccountScreen />}
        </View>
        <BottomTabs active={tab} onChange={setTab} />
      </View>
    </SafeAreaView>
  )
}

function Header() {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.logo}>TicketPulse</Text>
        <Text style={styles.headerSub}>Organizer mobile</Text>
      </View>
      <Pressable style={styles.pill} onPress={() => Linking.openURL("https://ticketpulse.tech/organizer")}>
        <Ionicons name="open-outline" size={16} color="#071f3a" />
        <Text style={styles.pillText}>Web</Text>
      </Pressable>
    </View>
  )
}

function HomeScreen({ totals, onScan }: { totals: { events: number; sold: number; checkedIn: number }; onScan: () => void }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Gate operations</Text>
        <Text style={styles.heroTitle}>Scan guests. Track entry. Keep the line moving.</Text>
        <Pressable style={styles.primaryButton} onPress={onScan}>
          <Ionicons name="scan" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Open scanner</Text>
        </Pressable>
      </View>

      <View style={styles.statGrid}>
        <Metric label="Events" value={totals.events.toString()} icon="calendar-outline" />
        <Metric label="Tickets" value={totals.sold.toString()} icon="ticket-outline" />
        <Metric label="Checked in" value={totals.checkedIn.toString()} icon="checkmark-circle-outline" />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Today</Text>
        <Text style={styles.panelText}>Sunday Table is now a past event. Sales are closed and summary reporting is available on the web dashboard.</Text>
      </View>
    </ScrollView>
  )
}

function ScannerScreen({
  scanState,
  recentScans,
  manualCode,
  onManualCode,
  onScan,
}: {
  scanState: ScanState
  recentScans: RecentScan[]
  manualCode: string
  onManualCode: (value: string) => void
  onScan: (code: string) => void
}) {
  const [permission, requestPermission] = useCameraPermissions()
  const [locked, setLocked] = useState(false)

  async function handleBarcode({ data }: { data: string }) {
    if (locked) return
    setLocked(true)
    await onScan(data)
    setTimeout(() => setLocked(false), 1400)
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.scannerTop}>
        <Text style={styles.eyebrow}>Full-screen scanner</Text>
        <Text style={styles.screenTitle}>Point at a TicketPulse QR code</Text>
      </View>

      <View style={styles.cameraFrame}>
        {!permission?.granted ? (
          <View style={styles.cameraFallback}>
            <Ionicons name="camera-outline" size={42} color="#8a95a6" />
            <Text style={styles.panelTitle}>Camera permission needed</Text>
            <Text style={styles.panelText}>Allow camera access to scan tickets at the gate.</Text>
            <Pressable style={styles.secondaryButton} onPress={requestPermission}>
              <Text style={styles.secondaryButtonText}>Allow camera</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcode}
          />
        )}
        <View style={styles.scanBox} />
      </View>

      <ResultCard state={scanState} />

      <View style={styles.manualBox}>
        <TextInput
          value={manualCode}
          onChangeText={onManualCode}
          placeholder="Paste or type ticket code"
          placeholderTextColor="#8a95a6"
          style={styles.input}
          autoCapitalize="none"
        />
        <Pressable
          style={styles.manualButton}
          onPress={() => {
            onScan(manualCode)
            onManualCode("")
          }}
        >
          <Text style={styles.manualButtonText}>Check</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Recent scans</Text>
        {recentScans.length === 0 ? (
          <Text style={styles.panelText}>No scans yet.</Text>
        ) : (
          recentScans.map((scan) => (
            <View key={scan.id} style={styles.scanRow}>
              <View style={[styles.scanDot, styles[`${scan.status}Dot`]]} />
              <Text style={styles.scanRowTitle}>{scan.title}</Text>
              <Text style={styles.scanTime}>{scan.time}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

function ResultCard({ state }: { state: ScanState }) {
  const tone = state.kind === "valid" ? styles.validCard : state.kind === "duplicate" ? styles.duplicateCard : state.kind === "invalid" ? styles.invalidCard : styles.idleCard
  const icon = state.kind === "valid" ? "checkmark-circle" : state.kind === "duplicate" ? "alert-circle" : state.kind === "invalid" ? "close-circle" : "scan-circle"

  return (
    <View style={[styles.resultCard, tone]}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={30} color="#071f3a" />
      <View style={styles.resultCopy}>
        <Text style={styles.resultTitle}>{state.kind === "idle" ? "Awaiting scan" : state.title}</Text>
        <Text style={styles.resultBody}>{state.kind === "idle" ? "Valid scans will admit guests. Duplicate and invalid scans are blocked." : state.body}</Text>
      </View>
    </View>
  )
}

function EventsScreen() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <Text style={styles.screenTitle}>Events</Text>
      {demoEvents.map((event) => (
        <View key={event.id} style={styles.eventCard}>
          <Text style={styles.eventStatus}>{event.status}</Text>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.panelText}>{event.date}</Text>
          <View style={styles.eventMeta}>
            <Text style={styles.eventMetaText}>{event.sold} tickets</Text>
            <Text style={styles.eventMetaText}>{event.checkedIn} checked in</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

function AccountScreen() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <Text style={styles.screenTitle}>Account</Text>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Sign in handoff</Text>
        <Text style={styles.panelText}>Native auth will connect to TicketPulse sessions next. For now, open the web dashboard to manage events and payouts.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => Linking.openURL("https://ticketpulse.tech/auth/signin")}>
          <Text style={styles.secondaryButtonText}>Open sign in</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color="#50627a" />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

function BottomTabs({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "home", label: "Home", icon: "home-outline" },
    { key: "scanner", label: "Scan", icon: "scan-outline" },
    { key: "events", label: "Events", icon: "calendar-outline" },
    { key: "account", label: "Account", icon: "person-outline" },
  ]

  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const selected = active === tab.key
        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <Ionicons name={tab.icon} size={20} color={selected ? "#071f3a" : "#8a95a6"} />
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8fb" },
  shell: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f6f8fb",
  },
  logo: { color: "#071f3a", fontSize: 22, fontWeight: "800", letterSpacing: 0 },
  headerSub: { color: "#68768a", fontSize: 12, marginTop: 2 },
  pill: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#dce4ee",
  },
  pillText: { color: "#071f3a", fontSize: 12, fontWeight: "700" },
  content: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 120 },
  hero: {
    borderRadius: 24,
    backgroundColor: "#071f3a",
    padding: 22,
    minHeight: 220,
    justifyContent: "space-between",
  },
  eyebrow: { color: "#6bb7ff", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2 },
  heroTitle: { color: "#fff", fontSize: 32, fontWeight: "900", lineHeight: 36, letterSpacing: 0, marginVertical: 18 },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#0b6bff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  statGrid: { flexDirection: "row", gap: 10, marginTop: 14 },
  metric: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce4ee",
    padding: 14,
  },
  metricValue: { color: "#071f3a", fontSize: 24, fontWeight: "900", marginTop: 12 },
  metricLabel: { color: "#68768a", fontSize: 11, marginTop: 4 },
  panel: {
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce4ee",
    padding: 18,
    marginTop: 14,
  },
  panelTitle: { color: "#071f3a", fontSize: 16, fontWeight: "800" },
  panelText: { color: "#68768a", fontSize: 14, lineHeight: 20, marginTop: 8 },
  scannerTop: { marginBottom: 12 },
  screenTitle: { color: "#071f3a", fontSize: 28, fontWeight: "900", lineHeight: 32, marginTop: 6 },
  cameraFrame: {
    height: 420,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#06101f",
    borderWidth: 1,
    borderColor: "#172a45",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraFallback: { alignItems: "center", justifyContent: "center", padding: 24 },
  scanBox: {
    width: 230,
    height: 230,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#fff",
    opacity: 0.9,
  },
  resultCard: {
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
  },
  idleCard: { backgroundColor: "#fff", borderColor: "#dce4ee" },
  validCard: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  duplicateCard: { backgroundColor: "#fef3c7", borderColor: "#facc15" },
  invalidCard: { backgroundColor: "#fee2e2", borderColor: "#fca5a5" },
  resultCopy: { flex: 1 },
  resultTitle: { color: "#071f3a", fontSize: 17, fontWeight: "900" },
  resultBody: { color: "#38485c", fontSize: 13, lineHeight: 18, marginTop: 4 },
  manualBox: { flexDirection: "row", gap: 10, marginTop: 14 },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce4ee",
    paddingHorizontal: 14,
    color: "#071f3a",
    fontSize: 14,
  },
  manualButton: { height: 52, borderRadius: 16, backgroundColor: "#071f3a", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  manualButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#eef4fb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryButtonText: { color: "#071f3a", fontSize: 14, fontWeight: "800" },
  scanRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  scanDot: { width: 10, height: 10, borderRadius: 99 },
  validDot: { backgroundColor: "#22c55e" },
  duplicateDot: { backgroundColor: "#f59e0b" },
  invalidDot: { backgroundColor: "#ef4444" },
  scanRowTitle: { flex: 1, color: "#071f3a", fontSize: 14, fontWeight: "700" },
  scanTime: { color: "#8a95a6", fontSize: 12 },
  eventCard: {
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce4ee",
    padding: 18,
    marginTop: 12,
  },
  eventStatus: { color: "#0b6bff", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 },
  eventTitle: { color: "#071f3a", fontSize: 22, fontWeight: "900", marginTop: 8 },
  eventMeta: { flexDirection: "row", gap: 8, marginTop: 14 },
  eventMetaText: {
    color: "#38485c",
    backgroundColor: "#eef4fb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  tabs: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce4ee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: "#071f3a",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  tab: { alignItems: "center", gap: 4, minWidth: 58 },
  tabLabel: { color: "#8a95a6", fontSize: 11, fontWeight: "700" },
  tabLabelActive: { color: "#071f3a" },
})
