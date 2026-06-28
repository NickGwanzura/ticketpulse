package com.ticketpulse.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ticketpulse.data.repository.AuthRepository
import com.ticketpulse.data.local.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val isLoggedIn: Boolean = false,
    val userRole: String? = null,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    val isLoggedIn = tokenManager.isLoggedIn
    val userRole = tokenManager.userRoleFlow

    init {
        viewModelScope.launch {
            _uiState.value = AuthUiState(
                isLoggedIn = authRepository.isLoggedIn(),
                userRole = authRepository.getUserRole(),
            )
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = authRepository.login(email, password)) {
                is com.ticketpulse.data.repository.AuthResult.Success -> {
                    _uiState.value = AuthUiState(
                        isLoggedIn = true,
                        userRole = result.user.role,
                    )
                }
                is com.ticketpulse.data.repository.AuthResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message,
                    )
                }
            }
        }
    }

    fun register(email: String, password: String, name: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = authRepository.register(email, password, name)) {
                is com.ticketpulse.data.repository.AuthResult.Success -> {
                    _uiState.value = AuthUiState(
                        isLoggedIn = true,
                        userRole = result.user.role,
                    )
                }
                is com.ticketpulse.data.repository.AuthResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message,
                    )
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _uiState.value = AuthUiState()
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
