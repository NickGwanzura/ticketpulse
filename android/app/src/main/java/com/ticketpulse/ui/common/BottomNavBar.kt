package com.ticketpulse.ui.common

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.ConfirmationNumber
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.ticketpulse.ui.navigation.Screen

data class BottomNavItem(
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val route: String,
)

private val attendeeTabs = listOf(
    BottomNavItem("Home", Icons.Filled.Home, Icons.Outlined.Home, Screen.Home.route),
    BottomNavItem("Events", Icons.Filled.CalendarMonth, Icons.Outlined.CalendarMonth, Screen.Events.route),
    BottomNavItem("Tickets", Icons.Filled.ConfirmationNumber, Icons.Outlined.ConfirmationNumber, Screen.Tickets.route),
    BottomNavItem("Account", Icons.Filled.Person, Icons.Outlined.Person, Screen.Account.route),
)

private val organizerTabs = listOf(
    BottomNavItem("Dashboard", Icons.Filled.Dashboard, Icons.Outlined.Dashboard, Screen.OrganizerDashboard.route),
    BottomNavItem("Scan", Icons.Filled.QrCodeScanner, Icons.Outlined.QrCodeScanner, Screen.OrganizerScanner.route),
    BottomNavItem("History", Icons.Filled.History, Icons.Outlined.History, Screen.OrganizerHistory.route),
    BottomNavItem("Account", Icons.Filled.Person, Icons.Outlined.Person, Screen.Account.route),
)

@Composable
fun BottomNavBar(
    isOrganizerMode: Boolean,
    currentRoute: String,
    onTabChange: (String) -> Unit,
) {
    val tabs = if (isOrganizerMode) organizerTabs else attendeeTabs

    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
    ) {
        tabs.forEach { item ->
            val selected = currentRoute == item.route
            NavigationBarItem(
                selected = selected,
                onClick = { onTabChange(item.route) },
                icon = {
                    Icon(
                        imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                        contentDescription = item.label,
                    )
                },
                label = {
                    Text(
                        text = item.label,
                        style = MaterialTheme.typography.labelMedium,
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    unselectedIconColor = MaterialTheme.colorScheme.outlineVariant,
                    unselectedTextColor = MaterialTheme.colorScheme.outlineVariant,
                    indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                ),
            )
        }
    }
}
