package com.ticketpulse.data.remote.dto

import com.google.gson.annotations.SerializedName

data class OrganizerEventsResponse(
    val ok: Boolean,
    val events: List<OrganizerEventDto>? = null,
    val error: String? = null,
)

data class OrganizerEventDto(
    val id: String,
    val title: String,
    val slug: String,
    val status: String,
    @SerializedName("startsAt")
    val startsAt: String?,
    val venue: String,
    val city: String,
    @SerializedName("coverImage")
    val coverImage: String?,
    val category: String,
    @SerializedName("totalCapacity")
    val totalCapacity: Int = 0,
    @SerializedName("totalSold")
    val totalSold: Int = 0,
    @SerializedName("checkedIn")
    val checkedIn: Int = 0,
)

data class LiveStatsResponse(
    val ok: Boolean? = null,
    val stats: EventStatsDto? = null,
    val recent: List<RecentCheckinDto>? = null,
    val error: String? = null,
)

data class EventStatsDto(
    @SerializedName("totalSold")
    val totalSold: Int,
    @SerializedName("totalCapacity")
    val totalCapacity: Int,
    @SerializedName("checkedIn")
    val checkedIn: Int,
    @SerializedName("capacityPct")
    val capacityPct: Int,
    @SerializedName("checkinPct")
    val checkinPct: Int,
)

data class RecentCheckinDto(
    val code: String,
    @SerializedName("tierName")
    val tierName: String,
    val holder: String?,
    @SerializedName("scannedAt")
    val scannedAt: String,
)
