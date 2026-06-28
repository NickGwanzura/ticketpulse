package com.ticketpulse.data.remote.api

import com.ticketpulse.data.remote.dto.AuthResponseDto
import com.ticketpulse.data.remote.dto.LoginRequest
import com.ticketpulse.data.remote.dto.MeResponse
import com.ticketpulse.data.remote.dto.RefreshRequest
import com.ticketpulse.data.remote.dto.RegisterRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {

    @POST("api/mobile/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponseDto>

    @POST("api/mobile/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponseDto>

    @POST("api/mobile/auth/refresh")
    suspend fun refresh(@Body request: RefreshRequest): Response<AuthResponseDto>

    @GET("api/mobile/me")
    suspend fun me(): Response<MeResponse>
}
