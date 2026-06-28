package com.ticketpulse.ui.orders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ticketpulse.data.repository.OrderRepository
import com.ticketpulse.domain.model.Order
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class OrderDetailUiState(
    val isLoading: Boolean = true,
    val order: Order? = null,
    val error: String? = null,
)

@HiltViewModel
class OrderDetailViewModel @Inject constructor(
    private val orderRepository: OrderRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(OrderDetailUiState())
    val uiState: StateFlow<OrderDetailUiState> = _uiState.asStateFlow()

    fun loadOrder(orderId: String) {
        viewModelScope.launch {
            _uiState.value = OrderDetailUiState(isLoading = true)
            when (val result = orderRepository.getOrderDetail(orderId)) {
                is com.ticketpulse.data.repository.OrderDetailResult.Success -> {
                    _uiState.value = OrderDetailUiState(
                        isLoading = false,
                        order = result.order,
                    )
                }
                is com.ticketpulse.data.repository.OrderDetailResult.Error -> {
                    _uiState.value = OrderDetailUiState(
                        isLoading = false,
                        error = result.message,
                    )
                }
            }
        }
    }
}
