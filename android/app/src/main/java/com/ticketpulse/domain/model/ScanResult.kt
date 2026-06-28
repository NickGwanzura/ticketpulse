package com.ticketpulse.domain.model

data class ScanResult(
    val status: ScanStatus,
    val eventTitle: String = "",
    val detail: String = "",
    val holder: String? = null,
)

enum class ScanStatus {
    IDLE,
    VALID,
    DUPLICATE,
    INVALID,
    NETWORK_ERROR,
}
