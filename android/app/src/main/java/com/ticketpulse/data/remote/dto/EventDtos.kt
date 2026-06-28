package com.ticketpulse.data.remote.dto

import com.google.gson.annotations.SerializedName

data class EventListResponse(
    val ok: Boolean,
    val events: List<EventSummaryDto>? = null,
    val error: String? = null,
)

data class EventDetailResponse(
    val ok: Boolean,
    val event: EventDetailDto? = null,
    val error: String? = null,
)

data class EventSummaryDto(
    val id: String,
    val title: String,
    val slug: String,
    val category: String,
    val status: String,
    val venue: String,
    val city: String,
    val country: String?,
    @SerializedName("startsAt")
    val startsAt: String?,
    @SerializedName("endsAt")
    val endsAt: String?,
    @SerializedName("coverImage")
    val coverImage: String?,
    val featured: Boolean = false,
    @SerializedName("organizerName")
    val organizerName: String?,
    @SerializedName("organizerImage")
    val organizerImage: String?,
    @SerializedName("lowestPrice")
    val lowestPrice: Double? = null,
    val currency: String? = "USD",
)

data class EventDetailDto(
    val id: String,
    val title: String,
    val slug: String,
    val description: String?,
    val category: String,
    val status: String,
    val venue: String,
    val city: String,
    val country: String?,
    val address: String?,
    @SerializedName("startsAt")
    val startsAt: String?,
    @SerializedName("endsAt")
    val endsAt: String?,
    @SerializedName("coverImage")
    val coverImage: String?,
    @SerializedName("googleMapsUrl")
    val googleMapsUrl: String?,
    val tags: List<String>? = emptyList(),
    val featured: Boolean = false,
    @SerializedName("organizerId")
    val organizerId: String?,
    @SerializedName("organizerName")
    val organizerName: String?,
    @SerializedName("organizerImage")
    val organizerImage: String?,
    val faq: String? = null,
    @SerializedName("promoImages")
    val promoImages: List<String>? = emptyList(),
    val tiers: List<TicketTierDto>? = emptyList(),
)

data class TicketTierDto(
    val id: String,
    val name: String,
    val description: String?,
    val price: Double,
    val currency: String = "USD",
    @SerializedName("totalQuantity")
    val totalQuantity: Int,
    @SerializedName("soldQuantity")
    val soldQuantity: Int? = 0,
    val remaining: Int,
    @SerializedName("maxPerOrder")
    val maxPerOrder: Int = 10,
    @SerializedName("earlyBirdPrice")
    val earlyBirdPrice: Double? = null,
    @SerializedName("earlyBirdUntil")
    val earlyBirdUntil: String? = null,
    @SerializedName("groupPrice")
    val groupPrice: Double? = null,
    @SerializedName("groupMinQty")
    val groupMinQty: Int? = null,
    @SerializedName("salesStart")
    val salesStart: String? = null,
    @SerializedName("salesEnd")
    val salesEnd: String? = null,
)
