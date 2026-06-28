package com.ticketpulse.data.remote.dto

import com.google.gson.annotations.SerializedName

data class OrderListResponse(
    val ok: Boolean,
    val orders: List<OrderSummaryDto>? = null,
    val error: String? = null,
)

data class OrderDetailResponse(
    val ok: Boolean,
    val order: OrderDetailDto? = null,
    val tickets: List<TicketDto>? = null,
    val error: String? = null,
)

data class OrderSummaryDto(
    val id: String,
    val status: String,
    @SerializedName("totalAmount")
    val totalAmount: Double,
    val currency: String = "USD",
    @SerializedName("createdAt")
    val createdAt: String?,
    @SerializedName("eventTitle")
    val eventTitle: String,
    @SerializedName("eventId")
    val eventId: String?,
)

data class OrderDetailDto(
    val id: String,
    val status: String,
    @SerializedName("totalAmount")
    val totalAmount: Double,
    val currency: String = "USD",
    @SerializedName("guestName")
    val guestName: String?,
    @SerializedName("guestEmail")
    val guestEmail: String?,
    @SerializedName("guestPhone")
    val guestPhone: String?,
    @SerializedName("createdAt")
    val createdAt: String?,
    val event: OrderEventDto? = null,
)

data class OrderEventDto(
    val id: String?,
    val title: String?,
    val slug: String?,
    @SerializedName("startsAt")
    val startsAt: String?,
    val venue: String?,
    val city: String?,
)

data class TicketDto(
    val id: String,
    @SerializedName("qrCode")
    val qrCode: String?,
    @SerializedName("tierName")
    val tierName: String = "Ticket",
    @SerializedName("scannedAt")
    val scannedAt: String? = null,
    val status: String? = null,
    @SerializedName("isStaffTicket")
    val isStaffTicket: Boolean = false,
    @SerializedName("staffName")
    val staffName: String? = null,
    @SerializedName("staffRole")
    val staffRole: String? = null,
)
