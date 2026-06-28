package com.ticketpulse.ui.events

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ticketpulse.data.repository.EventRepository
import com.ticketpulse.domain.model.Event
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

// ─── Event List ───────────────────────────────────────────────────────────────

data class EventListUiState(
    val isLoading: Boolean = true,
    val events: List<Event> = emptyList(),
    val selectedCategory: String? = null,
    val searchQuery: String = "",
    val error: String? = null,
)

@HiltViewModel
class EventListViewModel @Inject constructor(
    private val eventRepository: EventRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(EventListUiState())
    val uiState: StateFlow<EventListUiState> = _uiState.asStateFlow()

    init {
        loadEvents()
    }

    fun loadEvents(category: String? = null, query: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = eventRepository.getEvents(category = category, query = query)) {
                is com.ticketpulse.data.repository.EventsResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        events = result.events,
                    )
                }
                is com.ticketpulse.data.repository.EventsResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message,
                    )
                }
            }
        }
    }

    fun setCategory(category: String?) {
        _uiState.value = _uiState.value.copy(selectedCategory = category)
        loadEvents(category = category, query = _uiState.value.searchQuery.ifBlank { null })
    }

    fun search(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
        loadEvents(
            category = _uiState.value.selectedCategory,
            query = query.ifBlank { null },
        )
    }
}

// ─── Event Detail ────────────────────────────────────────────────────────────

data class EventDetailUiState(
    val isLoading: Boolean = true,
    val event: Event? = null,
    val error: String? = null,
)

@HiltViewModel
class EventDetailViewModel @Inject constructor(
    private val eventRepository: EventRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(EventDetailUiState())
    val uiState: StateFlow<EventDetailUiState> = _uiState.asStateFlow()

    fun loadEvent(eventId: String) {
        viewModelScope.launch {
            _uiState.value = EventDetailUiState(isLoading = true)
            when (val result = eventRepository.getEventDetail(eventId)) {
                is com.ticketpulse.data.repository.EventDetailResult.Success -> {
                    _uiState.value = EventDetailUiState(
                        isLoading = false,
                        event = result.event,
                    )
                }
                is com.ticketpulse.data.repository.EventDetailResult.Error -> {
                    _uiState.value = EventDetailUiState(
                        isLoading = false,
                        error = result.message,
                    )
                }
            }
        }
    }
}
