package com.ticketpulse.domain.model

data class EventStats(
    val totalSold: Int,
    val totalCapacity: Int,
    val checkedIn: Int,
    val capacityPct: Int,
    val checkinPct: Int,
)

data class RecentCheckin(
    val code: String,
    val tierName: String,
    val holder: String?,
    val scannedAt: String,
)
