package com.ticketpulse.data.repository

import com.ticketpulse.data.local.TokenManager
import com.ticketpulse.data.remote.api.AuthApi
import com.ticketpulse.data.remote.dto.LoginRequest
import com.ticketpulse.data.remote.dto.RefreshRequest
import com.ticketpulse.data.remote.dto.RegisterRequest
import com.ticketpulse.domain.model.User
import javax.inject.Inject
import javax.inject.Singleton

sealed class AuthResult {
    data class Success(val user: User) : AuthResult()
    data class Error(val message: String) : AuthResult()
}

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val tokenManager: TokenManager,
) {

    suspend fun login(email: String, password: String): AuthResult {
        return try {
            val response = authApi.login(LoginRequest(email, password))
            if (response.isSuccessful && response.body()?.ok == true) {
                val body = response.body()!!
                tokenManager.saveTokens(body.accessToken!!, body.refreshToken!!)
                val user = body.user!!
                tokenManager.saveUser(user.id, user.email, user.role, user.name)
                AuthResult.Success(
                    User(
                        id = user.id,
                        email = user.email,
                        name = user.name,
                        role = user.role,
                        image = user.image,
                    ),
                )
            } else {
                val error = response.body()?.error ?: "Login failed"
                AuthResult.Error(error)
            }
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Network error")
        }
    }

    suspend fun register(email: String, password: String, name: String?): AuthResult {
        return try {
            val response = authApi.register(RegisterRequest(email, password, name))
            if (response.isSuccessful && response.body()?.ok == true) {
                val body = response.body()!!
                tokenManager.saveTokens(body.accessToken!!, body.refreshToken!!)
                val user = body.user!!
                tokenManager.saveUser(user.id, user.email, user.role, user.name)
                AuthResult.Success(
                    User(
                        id = user.id,
                        email = user.email,
                        name = user.name,
                        role = user.role,
                        image = user.image,
                    ),
                )
            } else {
                val error = response.body()?.error ?: "Registration failed"
                AuthResult.Error(error)
            }
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Network error")
        }
    }

    suspend fun refreshToken(): Boolean {
        return try {
            val refreshToken = tokenManager.getRefreshToken() ?: return false
            val response = authApi.refresh(RefreshRequest(refreshToken))
            if (response.isSuccessful && response.body()?.ok == true) {
                val body = response.body()!!
                tokenManager.saveTokens(body.accessToken!!, body.refreshToken!!)
                true
            } else {
                tokenManager.clear()
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    suspend fun logout() {
        tokenManager.clear()
    }

    suspend fun isLoggedIn(): Boolean = tokenManager.getAccessToken() != null

    suspend fun getUserRole(): String? = tokenManager.getUserRole()
}
