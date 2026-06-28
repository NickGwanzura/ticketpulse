package com.ticketpulse.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ticketpulse.data.local.TokenManager
import com.ticketpulse.ui.account.AccountScreen
import com.ticketpulse.ui.account.AccountViewModel
import com.ticketpulse.ui.auth.AuthViewModel
import com.ticketpulse.ui.auth.LoginScreen
import com.ticketpulse.ui.auth.RegisterScreen
import com.ticketpulse.ui.common.BottomNavBar
import com.ticketpulse.ui.events.EventDetailScreen
import com.ticketpulse.ui.events.EventListScreen
import com.ticketpulse.ui.home.HomeScreen
import com.ticketpulse.ui.orders.OrderDetailScreen
import com.ticketpulse.ui.organizer.OrganizerDashboardScreen
import com.ticketpulse.ui.organizer.OrganizerEventDetailScreen
import com.ticketpulse.ui.organizer.ScanHistoryScreen
import com.ticketpulse.ui.organizer.ScannerScreen
import com.ticketpulse.ui.tickets.MyTicketsScreen
import com.ticketpulse.ui.tickets.TicketDetailScreen

@Composable
fun AppNavHost(
    tokenManager: TokenManager? = null,
) {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = hiltViewModel()
    val isLoggedIn by authViewModel.isLoggedIn.collectAsState(initial = false)
    val userRole by authViewModel.userRole.collectAsState(initial = null)
    var isOrganizerMode by remember { mutableStateOf(false) }

    val startDestination = if (isLoggedIn) Screen.Home.route else Screen.Login.route

    // Handle auth state changes (logout -> redirect to login)
    val currentRoute by navController.currentBackStackEntryFlow.collectAsState(initial = null)

    NavHost(
        navController = navController,
        startDestination = startDestination,
    ) {
        // ─── Auth ────────────────────────────────────────────────────
        composable(Screen.Login.route) {
            LoginScreen(
                viewModel = authViewModel,
                onLoginSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToRegister = {
                    navController.navigate(Screen.Register.route)
                },
            )
        }

        composable(Screen.Register.route) {
            RegisterScreen(
                viewModel = authViewModel,
                onRegisterSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.popBackStack()
                },
            )
        }

        // ─── Attendee App (with bottom nav) ─────────────────────────
        composable(Screen.Home.route) {
            MainScaffold(
                navController = navController,
                isOrganizerMode = isOrganizerMode,
                currentRoute = Screen.Home.route,
                onTabChange = { screen ->
                    if (isOrganizerMode) {
                        when (screen) {
                            Screen.OrganizerDashboard.route -> navController.navigate(Screen.OrganizerDashboard.route)
                            Screen.OrganizerScanner.route -> navController.navigate(Screen.OrganizerScanner.route)
                            Screen.OrganizerHistory.route -> navController.navigate(Screen.OrganizerHistory.route)
                            Screen.Account.route -> navController.navigate(Screen.Account.route)
                        }
                    } else {
                        when (screen) {
                            Screen.Home.route -> {} // already here
                            Screen.Events.route -> navController.navigate(Screen.Events.route)
                            Screen.Tickets.route -> navController.navigate(Screen.Tickets.route)
                            Screen.Account.route -> navController.navigate(Screen.Account.route)
                        }
                    }
                },
            ) { modifier ->
                HomeScreen(
                    modifier = modifier,
                    onEventClick = { eventId ->
                        navController.navigate(Screen.EventDetail.createRoute(eventId))
                    },
                    onScanClick = {
                        navController.navigate(Screen.OrganizerScanner.route)
                    },
                )
            }
        }

        composable(Screen.Events.route) {
            MainScaffold(
                navController = navController,
                isOrganizerMode = false,
                currentRoute = Screen.Events.route,
                onTabChange = { screen ->
                    when (screen) {
                        Screen.Home.route -> navController.navigate(Screen.Home.route)
                        Screen.Events.route -> {}
                        Screen.Tickets.route -> navController.navigate(Screen.Tickets.route)
                        Screen.Account.route -> navController.navigate(Screen.Account.route)
                        else -> {}
                    }
                },
            ) { modifier ->
                EventListScreen(
                    modifier = modifier,
                    onEventClick = { eventId ->
                        navController.navigate(Screen.EventDetail.createRoute(eventId))
                    },
                )
            }
        }

        composable(Screen.Tickets.route) {
            MainScaffold(
                navController = navController,
                isOrganizerMode = false,
                currentRoute = Screen.Tickets.route,
                onTabChange = { screen ->
                    when (screen) {
                        Screen.Home.route -> navController.navigate(Screen.Home.route)
                        Screen.Events.route -> navController.navigate(Screen.Events.route)
                        Screen.Tickets.route -> {}
                        Screen.Account.route -> navController.navigate(Screen.Account.route)
                        else -> {}
                    }
                },
            ) { modifier ->
                MyTicketsScreen(
                    modifier = modifier,
                    onOrderClick = { orderId ->
                        navController.navigate(Screen.OrderDetail.createRoute(orderId))
                    },
                )
            }
        }

        composable(Screen.Account.route) {
            val accountViewModel: AccountViewModel = hiltViewModel()
            MainScaffold(
                navController = navController,
                isOrganizerMode = isOrganizerMode,
                currentRoute = Screen.Account.route,
                onTabChange = { screen ->
                    if (isOrganizerMode) {
                        when (screen) {
                            Screen.OrganizerDashboard.route -> navController.navigate(Screen.OrganizerDashboard.route)
                            Screen.OrganizerScanner.route -> navController.navigate(Screen.OrganizerScanner.route)
                            Screen.OrganizerHistory.route -> navController.navigate(Screen.OrganizerHistory.route)
                            Screen.Account.route -> {}
                            else -> {}
                        }
                    } else {
                        when (screen) {
                            Screen.Home.route -> navController.navigate(Screen.Home.route)
                            Screen.Events.route -> navController.navigate(Screen.Events.route)
                            Screen.Tickets.route -> navController.navigate(Screen.Tickets.route)
                            Screen.Account.route -> {}
                            else -> {}
                        }
                    }
                },
            ) { modifier ->
                AccountScreen(
                    modifier = modifier,
                    viewModel = accountViewModel,
                    isOrganizerMode = isOrganizerMode,
                    onToggleOrganizerMode = { isOrganizerMode = it },
                    onLogout = {
                        authViewModel.logout()
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                )
            }
        }

        // ─── Detail screens ──────────────────────────────────────────
        composable(
            route = Screen.EventDetail.route,
            arguments = listOf(navArgument("eventId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val eventId = backStackEntry.arguments?.getString("eventId") ?: return@composable
            EventDetailScreen(
                eventId = eventId,
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            route = Screen.OrderDetail.route,
            arguments = listOf(navArgument("orderId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getString("orderId") ?: return@composable
            OrderDetailScreen(
                orderId = orderId,
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            route = Screen.TicketDetail.route,
            arguments = listOf(navArgument("ticketId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val ticketId = backStackEntry.arguments?.getString("ticketId") ?: return@composable
            TicketDetailScreen(
                ticketId = ticketId,
                onBack = { navController.popBackStack() },
            )
        }

        // ─── Organizer screens (full screen, no bottom nav) ──────────
        composable(Screen.OrganizerDashboard.route) {
            OrganizerDashboardScreen(
                onBack = { navController.popBackStack() },
                onEventClick = { eventId ->
                    navController.navigate(Screen.OrganizerEventDetail.createRoute(eventId))
                },
            )
        }

        composable(Screen.OrganizerScanner.route) {
            ScannerScreen(
                onBack = { navController.popBackStack() },
            )
        }

        composable(Screen.OrganizerHistory.route) {
            ScanHistoryScreen(
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            route = Screen.OrganizerEventDetail.route,
            arguments = listOf(navArgument("eventId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val eventId = backStackEntry.arguments?.getString("eventId") ?: return@composable
            OrganizerEventDetailScreen(
                eventId = eventId,
                onBack = { navController.popBackStack() },
            )
        }
    }
}

@Composable
fun MainScaffold(
    navController: androidx.navigation.NavController,
    isOrganizerMode: Boolean,
    currentRoute: String,
    onTabChange: (String) -> Unit,
    content: @Composable (Modifier) -> Unit,
) {
    Scaffold(
        bottomBar = {
            BottomNavBar(
                isOrganizerMode = isOrganizerMode,
                currentRoute = currentRoute,
                onTabChange = onTabChange,
            )
        },
    ) { innerPadding ->
        content(Modifier.padding(innerPadding))
    }
}
