package com.ticketpulse.data.remote.api

import com.ticketpulse.data.remote.dto.LiveStatsResponse
import com.ticketpulse.data.remote.dto.OrganizerEventsResponse
import com.ticketpulse.data.remote.dto.ScanRequest
import com.ticketpulse.data.remote.dto.ScanResponseDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface OrganizerApi {

    @GET("api/mobile/organizer/events")
    suspend fun getOrganizerEvents(): Response<OrganizerEventsResponse>

    @GET("api/mobile/events/{id}/live/stats")
    suspend fun getEventLiveStats(@Path("id") eventId: String): Response<LiveStatsResponse>

    @POST("api/mobile/scan")
    suspend fun scanTicket(@Body request: ScanRequest): Response<ScanResponseDto>
}
