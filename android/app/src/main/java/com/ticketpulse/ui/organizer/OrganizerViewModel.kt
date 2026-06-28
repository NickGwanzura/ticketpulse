package com.ticketpulse.ui.organizer

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ticketpulse.data.repository.ScanRepository
import com.ticketpulse.data.repository.OrganizerEventItem
import com.ticketpulse.domain.model.EventStats
import com.ticketpulse.domain.model.RecentCheckin
import com.ticketpulse.domain.model.ScanResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

// ─── Organizer Dashboard ─────────────────────────────────────────────────────

data class OrganizerDashboardUiState(
    val isLoading: Boolean = true,
    val events: List<OrganizerEventItem> = emptyList(),
    val error: String? = null,
)

@HiltViewModel
class OrganizerDashboardViewModel @Inject constructor(
    private val scanRepository: ScanRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(OrganizerDashboardUiState())
    val uiState: StateFlow<OrganizerDashboardUiState> = _uiState.asStateFlow()

    init {
        loadEvents()
    }

    fun loadEvents() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = scanRepository.getOrganizerEvents()) {
                is com.ticketpulse.data.repository.OrganizerEventsResult.Success -> {
                    _uiState.value = OrganizerDashboardUiState(
                        isLoading = false,
                        events = result.events,
                    )
                }
                is com.ticketpulse.data.repository.OrganizerEventsResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message,
                    )
                }
            }
        }
    }
}

// ─── Scanner ─────────────────────────────────────────────────────────────────

data class ScannerUiState(
    val scanResult: ScanResult = ScanResult(com.ticketpulse.domain.model.ScanStatus.IDLE),
    val recentScans: List<RecentScanItem> = emptyList(),
    val isLocked: Boolean = false,
)

data class RecentScanItem(
    val id: String,
    val status: com.ticketpulse.domain.model.ScanStatus,
    val title: String,
    val time: String,
)

@HiltViewModel
class ScannerViewModel @Inject constructor(
    private val scanRepository: ScanRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ScannerUiState())
    val uiState: StateFlow<ScannerUiState> = _uiState.asStateFlow()

    fun scanCode(code: String) {
        if (_uiState.value.isLocked) return
        _uiState.value = _uiState.value.copy(isLocked = true)

        viewModelScope.launch {
            val result = scanRepository.scanTicket(code)
            val now = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
                .format(java.util.Date())

            _uiState.value = _uiState.value.copy(
                scanResult = result,
                recentScans = listOf(
                    RecentScanItem(
                        id = java.util.UUID.randomUUID().toString(),
                        status = result.status,
                        title = result.eventTitle.ifBlank { result.detail },
                        time = now,
                    ),
                ) + _uiState.value.recentScans.take(7),
            )

            // Unlock after 1.4s debounce
            kotlinx.coroutines.delay(1400)
            _uiState.value = _uiState.value.copy(isLocked = false)
        }
    }

    fun clearResult() {
        _uiState.value = _uiState.value.copy(
            scanResult = ScanResult(com.ticketpulse.domain.model.ScanStatus.IDLE),
        )
    }
}

// ─── Event Live Stats ────────────────────────────────────────────────────────

data class EventStatsUiState(
    val isLoading: Boolean = true,
    val stats: EventStats? = null,
    val recent: List<RecentCheckin> = emptyList(),
    val error: String? = null,
)

@HiltViewModel
class EventStatsViewModel @Inject constructor(
    private val scanRepository: ScanRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(EventStatsUiState())
    val uiState: StateFlow<EventStatsUiState> = _uiState.asStateFlow()

    fun loadStats(eventId: String) {
        viewModelScope.launch {
            _uiState.value = EventStatsUiState(isLoading = true)
            when (val result = scanRepository.getEventLiveStats(eventId)) {
                is com.ticketpulse.data.repository.LiveStatsResult.Success -> {
                    _uiState.value = EventStatsUiState(
                        isLoading = false,
                        stats = result.stats,
                        recent = result.recent,
                    )
                }
                is com.ticketpulse.data.repository.LiveStatsResult.Error -> {
                    _uiState.value = EventStatsUiState(
                        isLoading = false,
                        error = result.message,
                    )
                }
            }
        }
    }
}
