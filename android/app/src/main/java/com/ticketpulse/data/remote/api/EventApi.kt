package com.ticketpulse.data.remote.api

import com.ticketpulse.data.remote.dto.EventDetailResponse
import com.ticketpulse.data.remote.dto.EventListResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface EventApi {

    @GET("api/mobile/events")
    suspend fun getEvents(
        @Query("category") category: String? = null,
        @Query("city") city: String? = null,
        @Query("q") query: String? = null,
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0,
    ): Response<EventListResponse>

    @GET("api/mobile/events/{id}")
    suspend fun getEventDetail(@Path("id") eventId: String): Response<EventDetailResponse>
}
