package com.ticketpulse.data.repository

import com.ticketpulse.data.remote.api.EventApi
import com.ticketpulse.domain.model.Event
import com.ticketpulse.domain.model.TicketTier
import javax.inject.Inject
import javax.inject.Singleton

sealed class EventsResult {
    data class Success(val events: List<Event>) : EventsResult()
    data class Error(val message: String) : EventsResult()
}

sealed class EventDetailResult {
    data class Success(val event: Event) : EventDetailResult()
    data class Error(val message: String) : EventDetailResult()
}

@Singleton
class EventRepository @Inject constructor(
    private val eventApi: EventApi,
) {

    suspend fun getEvents(
        category: String? = null,
        city: String? = null,
        query: String? = null,
    ): EventsResult {
        return try {
            val response = eventApi.getEvents(category, city, query)
            if (response.isSuccessful && response.body()?.ok == true) {
                val dtos = response.body()?.events ?: emptyList()
                val events = dtos.map { dto ->
                    Event(
                        id = dto.id,
                        title = dto.title,
                        slug = dto.slug,
                        category = dto.category,
                        status = dto.status,
                        venue = dto.venue,
                        city = dto.city,
                        country = dto.country,
                        startsAt = dto.startsAt ?: "",
                        endsAt = dto.endsAt,
                        coverImage = dto.coverImage,
                        featured = dto.featured,
                        organizerName = dto.organizerName,
                        organizerImage = dto.organizerImage,
                        lowestPrice = dto.lowestPrice,
                        currency = dto.currency,
                    )
                }
                EventsResult.Success(events)
            } else {
                EventsResult.Error(response.body()?.error ?: "Failed to load events")
            }
        } catch (e: Exception) {
            EventsResult.Error(e.message ?: "Network error")
        }
    }

    suspend fun getEventDetail(eventId: String): EventDetailResult {
        return try {
            val response = eventApi.getEventDetail(eventId)
            if (response.isSuccessful && response.body()?.ok == true) {
                val dto = response.body()?.event ?: return EventDetailResult.Error("Event not found")
                val tiers = dto.tiers?.map { t ->
                    TicketTier(
                        id = t.id,
                        name = t.name,
                        description = t.description,
                        price = t.price,
                        currency = t.currency,
                        totalQuantity = t.totalQuantity,
                        soldQuantity = t.soldQuantity,
                        remaining = t.remaining,
                        maxPerOrder = t.maxPerOrder,
                        earlyBirdPrice = t.earlyBirdPrice,
                        earlyBirdUntil = t.earlyBirdUntil,
                        groupPrice = t.groupPrice,
                        groupMinQty = t.groupMinQty,
                        salesStart = t.salesStart,
                        salesEnd = t.salesEnd,
                    )
                } ?: emptyList()

                val event = Event(
                    id = dto.id,
                    title = dto.title,
                    slug = dto.slug,
                    category = dto.category,
                    status = dto.status,
                    venue = dto.venue,
                    city = dto.city,
                    country = dto.country,
                    startsAt = dto.startsAt ?: "",
                    endsAt = dto.endsAt,
                    coverImage = dto.coverImage,
                    featured = dto.featured,
                    organizerName = dto.organizerName,
                    organizerImage = dto.organizerImage,
                    description = dto.description,
                    address = dto.address,
                    googleMapsUrl = dto.googleMapsUrl,
                    tags = dto.tags ?: emptyList(),
                    promoImages = dto.promoImages ?: emptyList(),
                    faq = dto.faq,
                    tiers = tiers,
                )
                EventDetailResult.Success(event)
            } else {
                EventDetailResult.Error(response.body()?.error ?: "Failed to load event")
            }
        } catch (e: Exception) {
            EventDetailResult.Error(e.message ?: "Network error")
        }
    }
}
