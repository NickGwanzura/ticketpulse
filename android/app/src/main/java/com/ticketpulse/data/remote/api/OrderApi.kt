package com.ticketpulse.data.remote.api

import com.ticketpulse.data.remote.dto.OrderDetailResponse
import com.ticketpulse.data.remote.dto.OrderListResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface OrderApi {

    @GET("api/mobile/orders")
    suspend fun getOrders(
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0,
    ): Response<OrderListResponse>

    @GET("api/mobile/orders/{id}")
    suspend fun getOrderDetail(@Path("id") orderId: String): Response<OrderDetailResponse>
}
