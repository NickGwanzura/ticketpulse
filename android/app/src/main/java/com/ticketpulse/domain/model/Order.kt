package com.ticketpulse.domain.model

data class Order(
    val id: String,
    val status: String,
    val totalAmount: Double,
    val currency: String,
    val createdAt: String?,
    val eventTitle: String,
    val eventId: String?,
    val guestName: String? = null,
    val guestEmail: String? = null,
    val guestPhone: String? = null,
    val event: OrderEvent? = null,
    val tickets: List<Ticket> = emptyList(),
)

data class OrderEvent(
    val id: String?,
    val title: String?,
    val slug: String?,
    val startsAt: String?,
    val venue: String?,
    val city: String?,
)

data class Ticket(
    val id: String,
    val qrCode: String?,
    val tierName: String,
    val scannedAt: String?,
    val status: String?,
    val isStaffTicket: Boolean = false,
    val staffName: String? = null,
    val staffRole: String? = null,
)
