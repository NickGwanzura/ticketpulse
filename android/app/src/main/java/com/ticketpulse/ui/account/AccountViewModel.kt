package com.ticketpulse.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ticketpulse.data.local.TokenManager
import com.ticketpulse.data.remote.api.AuthApi
import com.ticketpulse.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AccountUiState(
    val isLoading: Boolean = true,
    val user: User? = null,
    val error: String? = null,
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val authApi: AuthApi,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AccountUiState())
    val uiState: StateFlow<AccountUiState> = _uiState.asStateFlow()

    val userNameFlow = tokenManager.userNameFlow
    val userEmailFlow = tokenManager.userEmailFlow
    val userRoleFlow = tokenManager.userRoleFlow

    init {
        loadProfile()
    }

    fun loadProfile() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = authApi.me()
                if (response.isSuccessful && response.body()?.ok == true) {
                    val dto = response.body()?.user
                    if (dto != null) {
                        _uiState.value = AccountUiState(
                            isLoading = false,
                            user = User(
                                id = dto.id,
                                email = dto.email,
                                name = dto.name,
                                role = dto.role,
                                image = dto.image,
                                phone = dto.phone,
                                bio = dto.bio,
                                createdAt = dto.createdAt,
                            ),
                        )
                    }
                } else {
                    // Fall back to local cache
                    _uiState.value = AccountUiState(
                        isLoading = false,
                        user = User(
                            id = "",
                            email = tokenManager.userEmailFlow.first() ?: "",
                            name = tokenManager.userNameFlow.first(),
                            role = tokenManager.userRoleFlow.first() ?: "attendee",
                            image = null,
                        ),
                    )
                }
            } catch (e: Exception) {
                _uiState.value = AccountUiState(
                    isLoading = false,
                    user = User(
                        id = "",
                        email = "",
                        name = "User",
                        role = "attendee",
                        image = null,
                    ),
                )
            }
        }
    }
}
