package com.ticketpulse.data.repository

import com.ticketpulse.data.remote.api.OrderApi
import com.ticketpulse.domain.model.Order
import com.ticketpulse.domain.model.OrderEvent
import com.ticketpulse.domain.model.Ticket
import javax.inject.Inject
import javax.inject.Singleton

sealed class OrdersResult {
    data class Success(val orders: List<Order>) : OrdersResult()
    data class Error(val message: String) : OrdersResult()
}

sealed class OrderDetailResult {
    data class Success(val order: Order) : OrderDetailResult()
    data class Error(val message: String) : OrderDetailResult()
}

@Singleton
class OrderRepository @Inject constructor(
    private val orderApi: OrderApi,
) {

    suspend fun getOrders(): OrdersResult {
        return try {
            val response = orderApi.getOrders()
            if (response.isSuccessful && response.body()?.ok == true) {
                val dtos = response.body()?.orders ?: emptyList()
                val orders = dtos.map { dto ->
                    Order(
                        id = dto.id,
                        status = dto.status,
                        totalAmount = dto.totalAmount,
                        currency = dto.currency,
                        createdAt = dto.createdAt,
                        eventTitle = dto.eventTitle,
                        eventId = dto.eventId,
                    )
                }
                OrdersResult.Success(orders)
            } else {
                OrdersResult.Error(response.body()?.error ?: "Failed to load orders")
            }
        } catch (e: Exception) {
            OrdersResult.Error(e.message ?: "Network error")
        }
    }

    suspend fun getOrderDetail(orderId: String): OrderDetailResult {
        return try {
            val response = orderApi.getOrderDetail(orderId)
            if (response.isSuccessful && response.body()?.ok == true) {
                val body = response.body()!!
                val orderDto = body.order ?: return OrderDetailResult.Error("Order not found")

                val orderEvent = orderDto.event?.let {
                    OrderEvent(
                        id = it.id,
                        title = it.title,
                        slug = it.slug,
                        startsAt = it.startsAt,
                        venue = it.venue,
                        city = it.city,
                    )
                }

                val tickets = body.tickets?.map { t ->
                    Ticket(
                        id = t.id,
                        qrCode = t.qrCode,
                        tierName = t.tierName,
                        scannedAt = t.scannedAt,
                        status = t.status,
                        isStaffTicket = t.isStaffTicket,
                        staffName = t.staffName,
                        staffRole = t.staffRole,
                    )
                } ?: emptyList()

                val order = Order(
                    id = orderDto.id,
                    status = orderDto.status,
                    totalAmount = orderDto.totalAmount,
                    currency = orderDto.currency,
                    createdAt = orderDto.createdAt,
                    eventTitle = orderDto.event?.title ?: "Event",
                    eventId = orderDto.event?.id,
                    guestName = orderDto.guestName,
                    guestEmail = orderDto.guestEmail,
                    guestPhone = orderDto.guestPhone,
                    event = orderEvent,
                    tickets = tickets,
                )
                OrderDetailResult.Success(order)
            } else {
                OrderDetailResult.Error(response.body()?.error ?: "Failed to load order")
            }
        } catch (e: Exception) {
            OrderDetailResult.Error(e.message ?: "Network error")
        }
    }
}
