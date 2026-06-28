package com.ticketpulse.data.remote.dto

import com.google.gson.annotations.SerializedName

data class ScanRequest(
    val code: String,
)

data class ScanResponseDto(
    val ok: Boolean,
    val status: String? = null,
    val ticket: ScannedTicketDto? = null,
    val error: String? = null,
)

data class ScannedTicketDto(
    @SerializedName("eventTitle")
    val eventTitle: String?,
    @SerializedName("tierName")
    val tierName: String?,
    val holder: String?,
    @SerializedName("isStaffTicket")
    val isStaffTicket: Boolean = false,
    @SerializedName("staffRole")
    val staffRole: String? = null,
    @SerializedName("staffName")
    val staffName: String? = null,
)
