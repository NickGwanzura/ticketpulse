import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/api.dart';
import '../data/models.dart';
import 'scanner.dart';
import 'order_detail.dart';
import 'overview_widgets.dart';
import 'event_detail.dart';
import 'event_widgets.dart';
import 'payout_request.dart';
import '../design.dart';

class OrganizerWorkspace extends StatefulWidget {
  const OrganizerWorkspace({super.key, required this.api});
  final OrganizerApi api;
  @override
  State<OrganizerWorkspace> createState() => _OrganizerWorkspaceState();
}

class _OrganizerWorkspaceState extends State<OrganizerWorkspace> {
  int _tab = 0;
  bool _eventsDirty = false;
  int _notificationUnread = 0;
  OrganizerEvent? _scanEvent;

  /// Event whose orders the Orders tab is filtered to (from the event page).
  OrganizerEvent? _ordersEvent;
  late Future<List<OrganizerEvent>> _events;
  Timer? _pollTimer;
  @override
  void initState() {
    super.initState();
    _events = widget.api.events();
    _loadNotificationCount();
    _pollTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (!mounted) return;
      _reload();
      _loadNotificationCount();
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadNotificationCount() async {
    try {
      final data = await widget.api.notifications();
      if (mounted) {
        setState(
          () => _notificationUnread = number(data['unreadCount']).toInt(),
        );
      }
    } catch (_) {}
  }

  Future<void> _reload() async {
    final future = widget.api.events();
    setState(() {
      _events = future;
    });
    try {
      await future;
    } catch (_) {
      /* FutureBuilder displays the failure. */
    }
  }

  void _scan(OrganizerEvent event) => setState(() {
    _scanEvent = event;
    _tab = 3;
  });

  /// Soonest upcoming (or in-progress) event, for the Home "Next up" card.
  OrganizerEvent? _nextEvent(List<OrganizerEvent> events) {
    final upcoming = _sortedUpcoming(
      events.where((e) => e.isUpcoming && e.startsAt != null),
    );
    return upcoming.isEmpty ? null : upcoming.first;
  }

  List<OrganizerEvent> _sortedUpcoming(Iterable<OrganizerEvent> events) =>
      events.toList()..sort(
        (a, b) => (a.startsAt ?? DateTime(9999)).compareTo(
          b.startsAt ?? DateTime(9999),
        ),
      );

  List<Widget> _eventRows(Iterable<OrganizerEvent> events) => [
    for (final (i, event) in events.indexed) ...[
      if (i > 0) const Divider(height: 1),
      EventRow(event: event, onTap: () => _openEvent(event)),
    ],
  ];

  Future<void> _openEvent(OrganizerEvent event) async {
    final action = await showEventDetail(context, widget.api, event);
    if (!mounted) return;
    switch (action) {
      case EventAction.scan:
        _scan(event);
      case EventAction.orders:
        setState(() {
          _ordersEvent = event;
          _tab = 2;
        });
      case null:
        break;
    }
  }

  Future<void> _signOut() async {
    try {
      await widget.api.signOut();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not clear saved credentials. Retry sign out.'),
          ),
        );
      }
    }
  }

  void _showAccount() {
    final user = widget.api.user;
    final name = user?['name']?.toString() ?? 'Organizer';
    final email = user?['email']?.toString();
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  _AccountAvatar(name: name, radius: 26),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: Theme.of(sheetContext).textTheme.titleMedium,
                        ),
                        if (email != null) Text(email),
                        Text(statusLabel(user?['role']?.toString() ?? '')),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(sheetContext);
                  openWebsite(context, widget.api, '/organizer');
                },
                icon: const Icon(Icons.open_in_new),
                label: const Text('Open TicketPulse website'),
              ),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: () {
                  Navigator.pop(sheetContext);
                  _signOut();
                },
                icon: const Icon(Icons.logout),
                label: const Text('Sign out'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showNotifications() async {
    Json data;
    try {
      data = await widget.api.notifications();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$error')));
      return;
    }
    final rows = ((data['notifications'] as List?) ?? const [])
        .whereType<Json>()
        .toList();
    if (!mounted) return;
    setState(() => _notificationUnread = 0);
    try {
      await widget.api.markNotificationsRead();
    } catch (_) {}
    if (!mounted) return;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Notifications',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 14),
              if (rows.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('You’re all caught up.')),
                ),
              for (final row in rows.take(30))
                _NotificationRow(
                  icon: row['read'] == true
                      ? Icons.notifications_none
                      : Icons.notifications_active_outlined,
                  title: row['title']?.toString() ?? 'TicketPulse update',
                  message:
                      '${row['body'] ?? ''}\n${dateLabel(row['createdAt'])}',
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      titleSpacing: 20,
      title: Row(
        children: [
          Semantics(
            button: true,
            label: 'Account',
            child: InkWell(
              onTap: _showAccount,
              customBorder: const CircleBorder(),
              child: _AccountAvatar(
                name: widget.api.user?['name']?.toString() ?? 'Organizer',
              ),
            ),
          ),
          const SizedBox(width: 12),
          const BrandWordmark(),
        ],
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(999),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x140A2540),
                  blurRadius: 18,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: 'Create an event',
                  onPressed: () =>
                      openWebsite(context, widget.api, '/organizer/events/new'),
                  icon: const Icon(Icons.add_rounded),
                ),
                IconButton(
                  tooltip: 'Notifications',
                  onPressed: _showNotifications,
                  icon: Badge(
                    isLabelVisible: _notificationUnread > 0,
                    label: Text('$_notificationUnread'),
                    child: const Icon(Icons.notifications_none_rounded),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 920),
          child: switch (_tab) {
            2 => OrdersScreen(
              key: ValueKey(_ordersEvent?.id),
              api: widget.api,
              event: _ordersEvent,
              onClearEvent: () => setState(() => _ordersEvent = null),
            ),
            4 =>
              widget.api.user?['role'] == 'admin'
                  ? AdminScreen(api: widget.api)
                  : PaymentsScreen(api: widget.api),
            _ => FutureBuilder<List<OrganizerEvent>>(
              future: _events,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return Failure(message: '${snapshot.error}', retry: _reload);
                }
                final events = snapshot.data!;
                if (_tab == 3) {
                  return ScannerScreen(
                    api: widget.api,
                    events: events,
                    initialEvent: _scanEvent,
                    onScanned: () {
                      _eventsDirty = true;
                    },
                  );
                }
                return RefreshIndicator(
                  onRefresh: _reload,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      if (_tab == 0) ...[
                        PageHeading(
                          eyebrow: 'Your workspace',
                          title:
                              'Welcome, ${widget.api.user?['name'] ?? 'organizer'}',
                          subtitle: 'Great events start with a clear view.',
                        ),
                        if (_nextEvent(events) case final next?) ...[
                          NextEventCard(
                            event: next,
                            onOpen: () => _openEvent(next),
                            onScan: () => _scan(next),
                          ),
                          const SizedBox(height: 14),
                        ],
                        OverviewSummary(events: events),
                        // The "Next up" card already offers Scan for its event.
                        if (!(_nextEvent(events)?.canScan ?? false)) ...[
                          const SizedBox(height: 14),
                          ScanShortcut(onTap: () => setState(() => _tab = 3)),
                        ],
                        const SizedBox(height: 28),
                        _SectionLink(
                          title: 'Your events',
                          semanticLabel: 'View all events',
                          onTap: () => setState(() => _tab = 1),
                        ),
                      ] else ...[
                        PageHeading(
                          eyebrow: 'Make it happen',
                          title: 'Your events',
                          subtitle: events.length == 1
                              ? '1 event · every detail in one place'
                              : '${events.length} events · every detail in one place',
                        ),
                      ],
                      if (events.isEmpty)
                        const EmptyState(
                          icon: Icons.event_outlined,
                          title: 'Your next event starts here',
                          message:
                              'Create an event on TicketPulse, then refresh to manage it here.',
                        ),
                      if (_tab == 0)
                        ..._eventRows(events.take(3))
                      else ...[
                        if (events.any((e) => e.isUpcoming)) ...[
                          const _ListLabel('Upcoming'),
                          ..._eventRows(
                            _sortedUpcoming(events.where((e) => e.isUpcoming)),
                          ),
                          const SizedBox(height: 20),
                        ],
                        if (events.any((e) => !e.isUpcoming)) ...[
                          const _ListLabel('Past'),
                          ..._eventRows(events.where((e) => !e.isUpcoming)),
                        ],
                      ],
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: () => openWebsite(
                          context,
                          widget.api,
                          '/organizer/events',
                        ),
                        icon: const Icon(Icons.open_in_new),
                        label: const Text('Manage events on the website'),
                      ),
                    ],
                  ),
                );
              },
            ),
          },
        ),
      ),
    ),
    bottomNavigationBar: SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      // Floating bar with a soft shadow (Luma-style), rather than a docked bar.
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          boxShadow: const [
            BoxShadow(
              color: Color(0x1A0A2540),
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: NavigationBar(
            height: 68,
            selectedIndex: _tab,
            onDestinationSelected: (value) => setState(() {
              if (_eventsDirty && (value == 0 || value == 1)) {
                _events = widget.api.events();
                _eventsDirty = false;
              }
              if (value != 2) _ordersEvent = null;
              _tab = value;
            }),
            destinations: [
              const NavigationDestination(
                icon: Icon(Icons.space_dashboard_outlined),
                selectedIcon: Icon(Icons.space_dashboard_rounded),
                label: 'Home',
              ),
              const NavigationDestination(
                icon: Icon(Icons.event_outlined),
                selectedIcon: Icon(Icons.event_rounded),
                label: 'Events',
              ),
              const NavigationDestination(
                icon: Icon(Icons.receipt_long_outlined),
                selectedIcon: Icon(Icons.receipt_long_rounded),
                label: 'Orders',
              ),
              const NavigationDestination(
                icon: Icon(Icons.qr_code_scanner),
                selectedIcon: Icon(Icons.qr_code_scanner_rounded),
                label: 'Scan',
              ),
              NavigationDestination(
                icon: const Icon(Icons.account_balance_wallet_outlined),
                selectedIcon: const Icon(Icons.account_balance_wallet_rounded),
                label: widget.api.user?['role'] == 'admin'
                    ? 'Admin'
                    : 'Payments',
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Round avatar with the organizer's initials.
class _AccountAvatar extends StatelessWidget {
  const _AccountAvatar({required this.name, this.radius = 20});
  final String name;
  final double radius;
  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    final initials = parts.take(2).map((p) => p[0].toUpperCase()).join();
    return CircleAvatar(
      radius: radius,
      backgroundColor: Pulse.navy,
      child: Text(
        initials.isEmpty ? '?' : initials,
        style: TextStyle(
          color: Colors.white,
          fontSize: radius * .75,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Section title that links to the full list: "Your events ›".
class _SectionLink extends StatelessWidget {
  const _SectionLink({
    required this.title,
    required this.semanticLabel,
    required this.onTap,
  });
  final String title, semanticLabel;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: semanticLabel,
    excludeSemantics: true,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(width: 4),
            Icon(
              Icons.chevron_right_rounded,
              color: Theme.of(context).textTheme.bodyMedium?.color,
            ),
          ],
        ),
      ),
    ),
  );
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: CircleAvatar(
      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
      child: Icon(icon, color: Theme.of(context).colorScheme.primary),
    ),
    title: Text(title),
    subtitle: Text(message),
  );
}

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({
    super.key,
    required this.api,
    this.event,
    this.onClearEvent,
  });
  final OrganizerApi api;

  /// When set, only this event's orders are listed (opened from its page).
  final OrganizerEvent? event;
  final VoidCallback? onClearEvent;
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

/// Status filters shown as chips; less common states sit behind "More".
const _primaryStatuses = ['paid', 'pending', 'refunded'];
const _moreStatuses = [
  'completed',
  'awaiting_verification',
  'cancelled',
  'expired',
];

class _OrdersScreenState extends State<OrdersScreen> {
  final List<Json> _orders = [];
  String? _status, _error;
  final _search = TextEditingController();
  String _query = '';
  Timer? _debounce;
  bool _busy = false, _more = true;

  /// Ignore responses from searches the user has already moved past.
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  /// Search as you type, after a short pause so every keystroke isn't a request.
  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted || value.trim() == _query) return;
      _query = value.trim();
      _load(reset: true);
    });
  }

  void _setStatus(String? status) {
    if (status == _status) return;
    _status = status;
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    if (_busy && !reset) return;
    final generation = ++_generation;
    setState(() {
      _busy = true;
      _error = null;
      if (reset) {
        _orders.clear();
        _more = true;
      }
    });
    try {
      final page = await widget.api.orders(
        offset: _orders.length,
        status: _status,
        query: _query,
        eventId: widget.event?.id,
      );
      if (mounted && generation == _generation) {
        setState(() {
          _orders.addAll(page.orders);
          _more = page.hasMore;
        });
      }
    } catch (e) {
      if (mounted && generation == _generation) setState(() => _error = '$e');
    } finally {
      if (mounted && generation == _generation) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: () => _load(reset: true),
    child: ListView(
      padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        PageHeading(
          eyebrow: widget.api.user?['role'] == 'admin'
              ? 'Operations & support'
              : 'Every ticket counts',
          title: 'Sales & orders',
          subtitle: widget.api.user?['role'] == 'admin'
              ? 'Find a buyer, inspect an order, and resolve ticket issues.'
              : 'Sales, buyer details, and entry for your events.',
        ),
        TextField(
          controller: _search,
          textInputAction: TextInputAction.search,
          onChanged: (value) {
            setState(() {});
            _onSearchChanged(value);
          },
          onSubmitted: (value) {
            _debounce?.cancel();
            _query = value.trim();
            _load(reset: true);
          },
          decoration: InputDecoration(
            labelText: 'Search orders',
            hintText: 'Buyer, email, event, or reference',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _search.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Clear search',
                    onPressed: () {
                      _search.clear();
                      _onSearchChanged('');
                      setState(() {});
                    },
                    icon: const Icon(Icons.close_rounded),
                  ),
          ),
        ),
        const SizedBox(height: 14),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              if (widget.event != null) ...[
                InputChip(
                  avatar: const Icon(Icons.event_rounded, size: 18),
                  label: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 180),
                    child: Text(
                      widget.event!.title,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  tooltip: 'Show orders for all events',
                  onDeleted: widget.onClearEvent,
                ),
                const SizedBox(width: 8),
              ],
              ChoiceChip(
                label: const Text('All'),
                selected: _status == null,
                onSelected: (_) => _setStatus(null),
              ),
              for (final status in _primaryStatuses) ...[
                const SizedBox(width: 8),
                ChoiceChip(
                  label: Text(statusLabel(status)),
                  selected: _status == status,
                  onSelected: (_) => _setStatus(status),
                ),
              ],
              const SizedBox(width: 8),
              PopupMenuButton<String>(
                tooltip: 'More statuses',
                onSelected: _setStatus,
                itemBuilder: (_) => [
                  for (final status in _moreStatuses)
                    CheckedPopupMenuItem(
                      value: status,
                      checked: _status == status,
                      child: Text(statusLabel(status)),
                    ),
                ],
                child: Chip(
                  label: Text(
                    _moreStatuses.contains(_status)
                        ? statusLabel(_status!)
                        : 'More',
                  ),
                  avatar: const Icon(Icons.expand_more_rounded, size: 18),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        for (final order in _orders)
          OrderCard(
            order: order,
            onTap: () async {
              await showOrderDetail(
                context,
                widget.api,
                order['id'].toString(),
              );
              if (mounted) _load(reset: true);
            },
          ),
        if (_error != null) Failure(message: _error!, retry: () => _load()),
        if (_busy)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
        if (!_busy && _error == null && _orders.isEmpty)
          EmptyState(
            icon: Icons.receipt_long_outlined,
            title: _query.isNotEmpty ? 'No matching orders' : 'No orders yet',
            message: _query.isNotEmpty
                ? 'Try a buyer name, email, or order reference.'
                : 'Orders matching this filter will appear here.',
          ),
        if (!_busy && _error == null && _more && _orders.isNotEmpty)
          OutlinedButton(
            onPressed: _load,
            child: const Text('Load more orders'),
          ),
      ],
    ),
  );
}

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key, required this.api});
  final OrganizerApi api;
  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  late Future<Json> _future;
  @override
  void initState() {
    super.initState();
    _future = widget.api.payments();
  }

  Future<void> _reload() async {
    final future = widget.api.payments();
    setState(() {
      _future = future;
    });
    try {
      await future;
    } catch (_) {
      /* Rendered by FutureBuilder. */
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Json>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return Failure(message: '${snapshot.error}', retry: _reload);
      }
      final data = snapshot.data!, summary = data['summary'] as Json;
      final payouts = (data['payouts'] as List).cast<Json>();
      final currency = data['currency'] as String;
      final available = number(summary['availableBalance']).toDouble();
      final activePayout = data['activePayout'] == true;
      final canRequest = !activePayout && available >= 1;
      return RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const PageHeading(
              eyebrow: 'The bigger picture',
              title: 'Your money, clearly',
              subtitle: 'Personal payout balance from your owned events.',
            ),
            Card(
              color: Pulse.navy,
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Eyebrow(
                      'Available balance',
                      color: Color(0xFFB5C9DA),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      money(summary['availableBalance'], currency),
                      style: Theme.of(
                        context,
                      ).textTheme.headlineLarge?.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'After fees, active payouts, and outstanding adjustments.',
                      style: TextStyle(color: Color(0xFFB5C9DA), fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 8,
                ),
                child: Column(
                  children: [
                    for (final item in [
                      ('Confirmed revenue', 'grossRevenue'),
                      ('Platform fee', 'platformFee'),
                      ('Net earned', 'netRevenue'),
                      ('Paid out', 'paidOut'),
                      ('In progress', 'pendingPayouts'),
                      ('Adjustments', 'outstandingClawbacks'),
                    ])
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                item.$1,
                                style: Theme.of(
                                  context,
                                ).textTheme.bodyMedium?.copyWith(fontSize: 13),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Flexible(
                              child: Text(
                                money(summary[item.$2], currency),
                                textAlign: TextAlign.right,
                                style: Theme.of(
                                  context,
                                ).textTheme.titleMedium?.copyWith(fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: canRequest
                  ? () async {
                      final sent = await showPayoutRequest(
                        context,
                        widget.api,
                        available: available,
                        lastDestination: data['lastDestination'] as Json?,
                      );
                      if (sent) _reload();
                    }
                  : null,
              icon: const Icon(Icons.payments_outlined),
              label: const Text('Request payout'),
            ),
            if (!canRequest)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  activePayout
                      ? 'Your current request is being processed. You can request again once it’s paid or rejected.'
                      : 'Nothing to withdraw yet. Confirmed ticket sales show up here after fees.',
                  textAlign: TextAlign.center,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontSize: 13),
                ),
              ),
            const SizedBox(height: 4),
            TextButton.icon(
              onPressed: () => openWebsite(context, widget.api, '/payouts'),
              icon: const Icon(Icons.open_in_new, size: 18),
              label: const Text('Payout details on the website'),
            ),
            const SizedBox(height: 24),
            Text(
              'Payout history',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            if (payouts.isEmpty)
              const EmptyState(
                icon: Icons.account_balance_wallet_outlined,
                title: 'No payouts yet',
                message:
                    'Your payout requests and their progress will appear here.',
              ),
            for (final payout in payouts)
              Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      StatusChip(payout['status'] as String),
                      const SizedBox(height: 8),
                      Text(
                        money(payout['amount'], payout['currency'] as String),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      Text(statusLabel(payout['method'] as String)),
                      Text(dateLabel(payout['createdAt'])),
                      if (payout['processedAt'] != null)
                        Text('Processed ${dateLabel(payout['processedAt'])}'),
                      if (payout['rejectionReason'] != null)
                        Text(payout['rejectionReason'] as String),
                    ],
                  ),
                ),
              ),
            if (data['hasMore'] == true)
              const Text(
                'Showing the latest 100 payouts. Open the website for your full history.',
              ),
          ],
        ),
      );
    },
  );
}

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key, required this.api});
  final OrganizerApi api;
  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  late Future<Json> _future;
  List<Json>? _recentOrders;
  bool _recentHasMore = false;
  bool _loadingMore = false;
  @override
  void initState() {
    super.initState();
    _future = widget.api.adminOverview();
  }

  Future<void> _reload() async {
    _recentOrders = null;
    _recentHasMore = false;
    final future = widget.api.adminOverview();
    setState(() {
      _future = future;
    });
    try {
      await future;
    } catch (_) {}
  }

  Future<void> _loadMoreRecent() async {
    if (_loadingMore || !_recentHasMore) return;
    setState(() => _loadingMore = true);
    try {
      final data = await widget.api.adminOverview(
        recentOffset: _recentOrders?.length ?? 0,
      );
      final rows = ((data['recentOrders'] as List?) ?? const [])
          .whereType<Json>();
      if (mounted) {
        setState(() {
          (_recentOrders ??= []).addAll(rows);
          _recentHasMore = data['recentOrdersHasMore'] == true;
        });
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Json>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return Failure(message: '${snapshot.error}', retry: _reload);
      }
      final data = snapshot.data!;
      final events = data['eventSummary'] as Json;
      final orders = data['orderSummary'] as Json;
      final payouts = ((data['pendingPayouts'] as List?) ?? const [])
          .cast<Json>();
      final organizers = ((data['pendingOrganizers'] as List?) ?? const [])
          .cast<Json>();
      final recentOrders = ((data['recentOrders'] as List?) ?? const [])
          .cast<Json>();
      _recentHasMore = data['recentOrdersHasMore'] == true;
      final visibleRecentOrders = _recentOrders ?? recentOrders;
      final orderCount = orders.values.fold<int>(
        0,
        (sum, value) => sum + number((value as Json)['count']).toInt(),
      );
      final paid = orders['paid'] as Json?;
      return RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const PageHeading(
              eyebrow: 'Control room',
              title: 'Admin operations & support',
              subtitle:
                  'Monitor orders, payouts, events, and organizer support from one place.',
            ),
            Row(
              children: [
                Expanded(
                  child: _AdminStat(
                    value: '${events['published'] ?? 0}',
                    label: 'Live events',
                    icon: Icons.wifi_tethering,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _AdminStat(
                    value: '$orderCount',
                    label: 'Orders',
                    icon: Icons.receipt_long_outlined,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _AdminStat(
                    value: '${organizers.length}',
                    label: 'Approvals',
                    icon: Icons.person_add_alt_1_outlined,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            _AdminSection(
              title: 'Paid order value',
              child: _RevenueCard(value: money(paid?['total'] ?? 0)),
            ),
            _buildPayoutQueue(context, widget.api, payouts),
            _buildOrganizerApprovals(context, widget.api, organizers),
            _buildRecentOrders(
              context,
              widget.api,
              visibleRecentOrders,
              hasMore: _recentHasMore,
              loadingMore: _loadingMore,
              onLoadMore: _loadMoreRecent,
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => openWebsite(context, widget.api, '/admin'),
              icon: const Icon(Icons.open_in_new),
              label: const Text('Open full admin console'),
            ),
            const SizedBox(height: 56),
          ],
        ),
      );
    },
  );
}

Widget _buildRecentOrders(
  BuildContext context,
  OrganizerApi api,
  List<Json> rows, {
  required bool hasMore,
  required bool loadingMore,
  required VoidCallback onLoadMore,
}) => _AdminSection(
  title: 'Recent orders',
  child: Card(
    clipBehavior: Clip.antiAlias,
    child: rows.isEmpty
        ? const Padding(
            padding: EdgeInsets.all(8),
            child: Text('No orders yet.'),
          )
        : Column(
            children: [
              ...rows.map((row) {
                final buyer = (row['buyerName'] ?? row['buyerEmail'] ?? 'Guest')
                    .toString();
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.receipt_long_outlined),
                  title: Text(
                    row['eventTitle']?.toString() ?? 'Untitled event',
                  ),
                  subtitle: Text(
                    '$buyer · ${statusLabel(row['status']?.toString() ?? 'pending')}',
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () =>
                      showOrderDetail(context, api, row['id'].toString()),
                );
              }),
              if (hasMore)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: loadingMore ? null : onLoadMore,
                      child: Text(
                        loadingMore ? 'Loading…' : 'Load more orders',
                      ),
                    ),
                  ),
                ),
            ],
          ),
  ),
);

class _RevenueCard extends StatelessWidget {
  const _RevenueCard({required this.value});
  final String value;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          const Icon(Icons.trending_up, color: Pulse.orange),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value, style: Theme.of(context).textTheme.titleLarge),
              const Text('Paid order value', style: TextStyle(fontSize: 12)),
            ],
          ),
        ],
      ),
    ),
  );
}

Widget _buildPayoutQueue(
  BuildContext context,
  OrganizerApi api,
  List<Json> payouts,
) => _AdminSection(
  title: 'Payout queue',
  trailing: '${payouts.length}',
  child: _AdminList<Json>(
    items: payouts.take(5).toList(),
    empty: const EmptyState(
      icon: Icons.check_circle_outline,
      title: 'All clear',
      message: 'No payout requests are waiting.',
    ),
    builder: (payout) => ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
      leading: const Icon(Icons.account_balance_wallet_outlined),
      title: Text(
        payout['organizerName'] as String? ??
            payout['organizerEmail'] as String? ??
            'Organizer',
      ),
      subtitle: Text(
        '${payout['eventTitle'] ?? 'Platform payout'} · ${statusLabel(payout['status'] as String)}',
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            money(payout['amount'], payout['currency'] as String),
            style: Theme.of(context).textTheme.labelLarge,
          ),
          PopupMenuButton<String>(
            tooltip: 'Payout actions',
            onSelected: (action) async {
              await _runPayoutAction(context, api, payout, action);
            },
            itemBuilder: (_) => [
              if (payout['status'] == 'pending')
                const PopupMenuItem(value: 'approve', child: Text('Approve')),
              // A payout must be approved before it can be paid.
              if (payout['status'] == 'approved' ||
                  payout['status'] == 'processing')
                const PopupMenuItem(value: 'paid', child: Text('Mark paid')),
              if (payout['status'] == 'approved')
                const PopupMenuItem(
                  value: 'processing',
                  child: Text('Mark processing'),
                ),
              if (payout['status'] == 'pending')
                const PopupMenuItem(value: 'reject', child: Text('Reject')),
            ],
          ),
        ],
      ),
    ),
  ),
);

Widget _buildOrganizerApprovals(
  BuildContext context,
  OrganizerApi api,
  List<Json> organizers,
) => _AdminSection(
  title: 'Organizer approvals',
  trailing: '${organizers.length}',
  child: _AdminList<Json>(
    items: organizers.take(5).toList(),
    empty: const EmptyState(
      icon: Icons.verified_outlined,
      title: 'No approvals waiting',
      message: 'New organizer applications will appear here.',
    ),
    builder: (organizer) => ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
      leading: const Icon(Icons.person_outline),
      title: Text(organizer['name'] as String? ?? 'Unnamed organizer'),
      subtitle: Text(organizer['email'] as String? ?? 'No email'),
      trailing: PopupMenuButton<String>(
        tooltip: 'Organizer actions',
        onSelected: (action) async {
          await _runOrganizerAction(context, api, organizer, action);
        },
        itemBuilder: (_) => const [
          PopupMenuItem(value: 'approve', child: Text('Approve organizer')),
          PopupMenuItem(value: 'reject', child: Text('Reject organizer')),
        ],
      ),
    ),
  ),
);

Future<void> _runPayoutAction(
  BuildContext context,
  OrganizerApi api,
  Json payout,
  String action,
) async {
  String? reason;
  String? proofReference;
  if (action == 'reject') {
    final controller = TextEditingController();
    reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Reject payout'),
        content: TextField(
          controller: controller,
          maxLength: 500,
          decoration: const InputDecoration(labelText: 'Reason'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(dialogContext, controller.text.trim()),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.isEmpty) return;
  } else if (action == 'paid') {
    // Money out needs evidence; the server rejects a paid payout without it.
    final controller = TextEditingController();
    proofReference = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Mark payout paid'),
          content: TextField(
            controller: controller,
            autofocus: true,
            onChanged: (_) => setDialogState(() {}),
            decoration: const InputDecoration(
              labelText: 'Transfer or receipt reference',
              helperText: 'Required: the EcoCash, bank, or cash reference.',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: controller.text.trim().length < 3
                  ? null
                  : () => Navigator.pop(dialogContext, controller.text.trim()),
              child: const Text('Mark paid'),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    if (proofReference == null || proofReference.isEmpty) return;
  }
  try {
    await api.adminPayoutAction(
      payout['id'].toString(),
      action,
      reason: reason,
      proofReference: proofReference,
    );
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Payout updated.')));
    }
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$error')));
    }
  }
}

Future<void> _runOrganizerAction(
  BuildContext context,
  OrganizerApi api,
  Json organizer,
  String action,
) async {
  try {
    await api.adminOrganizerAction(organizer['id'].toString(), action);
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Organizer updated.')));
    }
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$error')));
    }
  }
}

class _AdminList<T> extends StatelessWidget {
  const _AdminList({
    required this.items,
    required this.empty,
    required this.builder,
  });
  final List<T> items;
  final Widget empty;
  final Widget Function(T item) builder;
  @override
  Widget build(BuildContext context) => items.isEmpty
      ? Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: empty,
          ),
        )
      : Card(
          child: Column(children: [for (final item in items) builder(item)]),
        );
}

class _AdminStat extends StatelessWidget {
  const _AdminStat({
    required this.value,
    required this.label,
    required this.icon,
  });
  final String value, label;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 19, color: Pulse.orange),
          const SizedBox(height: 12),
          Text(value, style: Theme.of(context).textTheme.titleLarge),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    ),
  );
}

class _AdminSection extends StatelessWidget {
  const _AdminSection({
    required this.title,
    required this.child,
    this.trailing,
  });
  final String title;
  final Widget child;
  final String? trailing;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            if (trailing != null)
              Text(trailing!, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        const SizedBox(height: 10),
        child,
      ],
    ),
  );
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final success = ['published', 'paid', 'completed'].contains(status);
    final danger = [
      'cancelled',
      'failed',
      'rejected',
      'refunded',
    ].contains(status);
    final color = success
        ? (dark ? const Color(0xFF6EE7B7) : const Color(0xFF047857))
        : danger
        ? (dark ? const Color(0xFFFDA4AF) : const Color(0xFFBE123C))
        : (dark ? const Color(0xFFFCD34D) : const Color(0xFF9A6700));
    final label = status == 'published' ? 'Live' : statusLabel(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .09),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label[0].toUpperCase() + label.substring(1),
              style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class Failure extends StatelessWidget {
  const Failure({super.key, required this.message, required this.retry});
  final String message;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 40),
            const SizedBox(height: 16),
            Semantics(
              liveRegion: true,
              child: Text(message, textAlign: TextAlign.center),
            ),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: retry, child: const Text('Try again')),
          ],
        ),
      ),
    ),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title, message;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 32),
    child: SizedBox(
      width: double.infinity,
      child: Column(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
            child: Icon(
              icon,
              size: 28,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}

Future<void> openWebsite(
  BuildContext context,
  OrganizerApi api,
  String path,
) async {
  try {
    if (!await launchUrl(
      api.baseUrl.resolve(path),
      mode: LaunchMode.externalApplication,
    )) {
      throw Exception();
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open your browser. Please try again.'),
        ),
      );
    }
  }
}

/// Small section label inside a list ("Upcoming", "Past").
class _ListLabel extends StatelessWidget {
  const _ListLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Text(text, style: Theme.of(context).textTheme.titleLarge),
  );
}
