package com.ticketpulse.data.remote.dto

import com.google.gson.annotations.SerializedName

// ─── Request DTOs ─────────────────────────────────────────────────────────────────

data class LoginRequest(
    val email: String,
    val password: String,
)

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String? = null,
)

data class RefreshRequest(
    @SerializedName("refreshToken")
    val refreshToken: String,
)

// ─── Response DTOs ────────────────────────────────────────────────────────────────

data class AuthResponseDto(
    val ok: Boolean,
    val accessToken: String? = null,
    val refreshToken: String? = null,
    val user: UserDto? = null,
    val error: String? = null,
)

data class UserDto(
    val id: String,
    val email: String,
    val name: String?,
    val role: String,
    val image: String?,
    val phone: String? = null,
    val bio: String? = null,
    val createdAt: String? = null,
)

// ─── Wrapper responses ────────────────────────────────────────────────────────────

data class ApiResponse<T>(
    val ok: Boolean,
    val error: String? = null,
)

data class MeResponse(
    val ok: Boolean,
    val user: UserDto? = null,
    val error: String? = null,
)
