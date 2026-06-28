package com.ticketpulse.ui.navigation

sealed class Screen(val route: String) {
    // Auth
    data object Login : Screen("login")
    data object Register : Screen("register")

    // Attendee tabs
    data object Home : Screen("home")
    data object Events : Screen("events")
    data object Tickets : Screen("tickets")
    data object Account : Screen("account")

    // Detail screens
    data object EventDetail : Screen("events/{eventId}") {
        fun createRoute(eventId: String) = "events/$eventId"
    }

    data object OrderDetail : Screen("orders/{orderId}") {
        fun createRoute(orderId: String) = "orders/$orderId"
    }

    data object TicketDetail : Screen("tickets/{ticketId}") {
        fun createRoute(ticketId: String) = "tickets/$ticketId"
    }

    // Organizer screens
    data object OrganizerDashboard : Screen("organizer/dashboard")
    data object OrganizerScanner : Screen("organizer/scanner")
    data object OrganizerHistory : Screen("organizer/history")
    data object OrganizerEventDetail : Screen("organizer/events/{eventId}") {
        fun createRoute(eventId: String) = "organizer/events/$eventId"
    }
}
