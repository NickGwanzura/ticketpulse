package com.ticketpulse.data.repository

import com.ticketpulse.data.remote.api.OrganizerApi
import com.ticketpulse.data.remote.dto.ScanRequest
import com.ticketpulse.domain.model.EventStats
import com.ticketpulse.domain.model.RecentCheckin
import com.ticketpulse.domain.model.ScanResult
import com.ticketpulse.domain.model.ScanStatus
import javax.inject.Inject
import javax.inject.Singleton

sealed class OrganizerEventsResult {
    data class Success(
        val events: List<OrganizerEventItem>,
    ) : OrganizerEventsResult()

    data class Error(val message: String) : OrganizerEventsResult()
}

data class OrganizerEventItem(
    val id: String,
    val title: String,
    val status: String,
    val startsAt: String?,
    val venue: String,
    val city: String,
    val coverImage: String?,
    val totalSold: Int,
    val totalCapacity: Int,
    val checkedIn: Int,
)

sealed class LiveStatsResult {
    data class Success(
        val stats: EventStats,
        val recent: List<RecentCheckin>,
    ) : LiveStatsResult()

    data class Error(val message: String) : LiveStatsResult()
}

@Singleton
class ScanRepository @Inject constructor(
    private val organizerApi: OrganizerApi,
) {

    suspend fun getOrganizerEvents(): OrganizerEventsResult {
        return try {
            val response = organizerApi.getOrganizerEvents()
            val body = response.body()
            if (response.isSuccessful && body?.ok == true) {
                val dtos = body.events ?: emptyList()
                val events = dtos.map { dto ->
                    OrganizerEventItem(
                        id = dto.id,
                        title = dto.title,
                        status = dto.status,
                        startsAt = dto.startsAt,
                        venue = dto.venue,
                        city = dto.city,
                        coverImage = dto.coverImage,
                        totalSold = dto.totalSold,
                        totalCapacity = dto.totalCapacity,
                        checkedIn = dto.checkedIn,
                    )
                }
                OrganizerEventsResult.Success(events)
            } else {
                OrganizerEventsResult.Error(body?.error ?: "Failed to load events")
            }
        } catch (e: Exception) {
            OrganizerEventsResult.Error(e.message ?: "Network error")
        }
    }

    suspend fun getEventLiveStats(eventId: String): LiveStatsResult {
        return try {
            val response = organizerApi.getEventLiveStats(eventId)
            val body = response.body()
            val statsDto = body?.stats
            if (response.isSuccessful && statsDto != null) {
                val stats = EventStats(
                    totalSold = statsDto.totalSold,
                    totalCapacity = statsDto.totalCapacity,
                    checkedIn = statsDto.checkedIn,
                    capacityPct = statsDto.capacityPct,
                    checkinPct = statsDto.checkinPct,
                )
                val recent = body.recent?.map { r ->
                    RecentCheckin(
                        code = r.code,
                        tierName = r.tierName,
                        holder = r.holder,
                        scannedAt = r.scannedAt,
                    )
                } ?: emptyList()
                LiveStatsResult.Success(stats, recent)
            } else {
                LiveStatsResult.Error(body?.error ?: "Failed to load stats")
            }
        } catch (e: Exception) {
            LiveStatsResult.Error(e.message ?: "Network error")
        }
    }

    suspend fun scanTicket(code: String): ScanResult {
        return try {
            val response = organizerApi.scanTicket(ScanRequest(code))
            val body = response.body()
            if (response.isSuccessful && body?.ok == true) {
                when (body.status) {
                    "new" -> ScanResult(
                        status = ScanStatus.VALID,
                        eventTitle = body.ticket?.eventTitle ?: "Valid",
                        detail = body.ticket?.tierName ?: "Ticket admitted",
                        holder = body.ticket?.holder,
                    )
                    "duplicate" -> ScanResult(
                        status = ScanStatus.DUPLICATE,
                        eventTitle = body.ticket?.eventTitle ?: "Already scanned",
                        detail = body.ticket?.tierName ?: "Duplicate scan",
                        holder = body.ticket?.holder,
                    )
                    else -> ScanResult(
                        status = ScanStatus.INVALID,
                        detail = body.error ?: "Unknown result",
                    )
                }
            } else {
                ScanResult(
                    status = ScanStatus.INVALID,
                    detail = body?.error ?: "Scan rejected",
                )
            }
        } catch (e: Exception) {
            ScanResult(
                status = ScanStatus.NETWORK_ERROR,
                detail = "Check connection or use manual lookup",
            )
        }
    }
}
