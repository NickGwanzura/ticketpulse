package com.ticketpulse.domain.model

data class User(
    val id: String,
    val email: String,
    val name: String?,
    val role: String,
    val image: String?,
    val phone: String? = null,
    val bio: String? = null,
    val createdAt: String? = null,
)
