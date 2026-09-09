import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/api.dart';
import '../data/models.dart';
import 'scanner.dart';
import 'order_detail.dart';
import 'overview_widgets.dart';
import 'event_monitor.dart';
import 'event_editor.dart';
import '../design.dart';
import 'package:intl/intl.dart';

class OrganizerWorkspace extends StatefulWidget {
  const OrganizerWorkspace({super.key, required this.api});
  final OrganizerApi api;
  @override
  State<OrganizerWorkspace> createState() => _OrganizerWorkspaceState();
}

class _OrganizerWorkspaceState extends State<OrganizerWorkspace>
    with WidgetsBindingObserver {
  int _tab = 0;
  bool _eventsDirty = false;
  int _notificationUnread = 0;
  OrganizerEvent? _scanEvent;
  late Future<List<OrganizerEvent>> _events;
  Timer? _pollTimer;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
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
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _reload();
      _loadNotificationCount();
    }
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

  Future<void> _monitor(OrganizerEvent event) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) =>
            EventMonitorScreen(api: widget.api, initialEvent: event),
      ),
    );
    if (mounted) _reload();
  }

  Future<void> _editEvent([OrganizerEvent? event]) async {
    final saved = await Navigator.of(context).push<OrganizerEvent>(
      MaterialPageRoute(
        builder: (_) => EventEditorScreen(api: widget.api, event: event),
      ),
    );
    if (saved != null && mounted) {
      _eventsDirty = true;
      await _reload();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            event == null ? 'Event draft created.' : 'Event changes saved.',
          ),
        ),
      );
    }
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
    final previousUnread = _notificationUnread;
    setState(() => _notificationUnread = 0);
    final sheet = showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: .76,
        minChildSize: .4,
        maxChildSize: .94,
        builder: (context, scrollController) => SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Notifications',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  'Operational updates and account activity',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 10),
                Expanded(
                  child: rows.isEmpty
                      ? ListView(
                          controller: scrollController,
                          children: const [
                            Padding(
                              padding: EdgeInsets.symmetric(vertical: 48),
                              child: Center(
                                child: Text('You’re all caught up.'),
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          controller: scrollController,
                          itemCount: rows.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (_, index) {
                            final row = rows[index];
                            final link = row['link']?.toString();
                            return _NotificationRow(
                              icon: row['read'] == true
                                  ? Icons.notifications_none
                                  : Icons.notifications_active_outlined,
                              title:
                                  row['title']?.toString() ??
                                  'TicketPulse update',
                              message: row['body']?.toString() ?? '',
                              date: dateLabel(row['createdAt']),
                              priority: row['priority']?.toString() ?? 'normal',
                              onTap: link == null || link.isEmpty
                                  ? null
                                  : () {
                                      Navigator.pop(sheetContext);
                                      Future<void>.microtask(() {
                                        if (context.mounted) {
                                          openWebsite(
                                            context,
                                            widget.api,
                                            link,
                                          );
                                        }
                                      });
                                    },
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    try {
      await widget.api.markNotificationsRead();
    } catch (error) {
      if (mounted) {
        setState(() => _notificationUnread = previousUnread);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not mark notifications read: $error')),
        );
      }
    }
    await sheet;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const BrandWordmark(),
      actions: [
        IconButton(
          tooltip: 'Notifications',
          onPressed: _showNotifications,
          icon: Badge(
            isLabelVisible: _notificationUnread > 0,
            label: Text('$_notificationUnread'),
            child: const Icon(Icons.notifications_none_rounded),
          ),
        ),
        PopupMenuButton<String>(
          tooltip: 'Account',
          itemBuilder: (_) => [
            const PopupMenuItem(
              value: 'signout',
              child: Row(
                children: [
                  Icon(Icons.logout, size: 18),
                  SizedBox(width: 12),
                  Text('Sign out'),
                ],
              ),
            ),
          ],
          onSelected: (_) async {
            try {
              await widget.api.signOut();
            } catch (_) {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Could not clear saved credentials. Retry sign out.',
                    ),
                  ),
                );
              }
            }
          },
          icon: CircleAvatar(
            radius: 18,
            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
            child: Icon(
              Icons.person_outline_rounded,
              size: 20,
              color: Theme.of(context).colorScheme.primary,
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
            2 => OrdersScreen(api: widget.api),
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
                        const Eyebrow('Your workspace'),
                        const SizedBox(height: 10),
                        Text(
                          'Welcome, ${widget.api.user?['name'] ?? 'organizer'}',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 6),
                        const Text('Great events start with a clear view.'),
                        const SizedBox(height: 24),
                        OverviewSummary(events: events),
                        const SizedBox(height: 14),
                        ScanShortcut(onTap: () => setState(() => _tab = 3)),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Your events',
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                            ),
                            TextButton(
                              onPressed: () => setState(() => _tab = 1),
                              child: const Text('View all'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                      ] else ...[
                        const Eyebrow('Make it happen'),
                        const SizedBox(height: 10),
                        Text(
                          'Your events',
                          style: Theme.of(context).textTheme.headlineLarge,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${events.length} events · every detail in one place',
                        ),
                        const SizedBox(height: 24),
                      ],
                      Align(
                        alignment: Alignment.centerLeft,
                        child: FilledButton.icon(
                          onPressed: () => _editEvent(),
                          icon: const Icon(Icons.add_rounded),
                          label: const Text('Create event'),
                        ),
                      ),
                      const SizedBox(height: 18),
                      if (events.isEmpty)
                        const EmptyState(
                          icon: Icons.event_outlined,
                          title: 'Your next event starts here',
                          message:
                              'Create an event on TicketPulse, then refresh to manage it here.',
                        ),
                      for (final event in (_tab == 0 ? events.take(3) : events))
                        EventCard(
                          event: event,
                          onScan: () => _scan(event),
                          onMonitor: () => _monitor(event),
                          onEdit: () => _editEvent(event),
                        ),
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
    bottomNavigationBar: NavigationBar(
      selectedIndex: _tab,
      onDestinationSelected: (value) => setState(() {
        if (_eventsDirty && (value == 0 || value == 1)) {
          _events = widget.api.events();
          _eventsDirty = false;
        }
        _tab = value;
      }),
      destinations: [
        NavigationDestination(
          icon: Icon(Icons.space_dashboard_outlined),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.event_outlined),
          label: 'Events',
        ),
        NavigationDestination(
          icon: Icon(Icons.receipt_long_outlined),
          label: 'Orders',
        ),
        NavigationDestination(icon: Icon(Icons.qr_code_scanner), label: 'Scan'),
        NavigationDestination(
          icon: Icon(Icons.account_balance_wallet_outlined),
          label: widget.api.user?['role'] == 'admin' ? 'Admin' : 'Payments',
        ),
      ],
    ),
  );
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({
    required this.icon,
    required this.title,
    required this.message,
    required this.date,
    required this.priority,
    this.onTap,
  });
  final IconData icon;
  final String title, message, date, priority;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final urgent = priority == 'urgent' || priority == 'high';
    final color = urgent
        ? Theme.of(context).colorScheme.error
        : Theme.of(context).colorScheme.primary;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(vertical: 6),
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: .12),
        child: Icon(icon, color: color),
      ),
      title: Row(
        children: [
          Expanded(child: Text(title)),
          if (urgent)
            const Padding(
              padding: EdgeInsets.only(left: 8),
              child: StatusChip('attention'),
            ),
        ],
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text('$message\n$date'),
      ),
      trailing: onTap == null ? null : const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    );
  }
}

class EventCard extends StatelessWidget {
  const EventCard({
    super.key,
    required this.event,
    required this.onScan,
    required this.onMonitor,
    required this.onEdit,
  });
  final OrganizerEvent event;
  final VoidCallback onScan, onMonitor, onEdit;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final date = event.startsAt?.toLocal();
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 54,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: colors.primaryContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        Text(
                          date == null
                              ? 'TBC'
                              : DateFormat('MMM').format(date).toUpperCase(),
                          style: TextStyle(
                            color: colors.primary,
                            fontSize: 12,
                            letterSpacing: 1,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          date == null ? '—' : DateFormat('dd').format(date),
                          style: TextStyle(
                            color: colors.primary,
                            fontSize: 24,
                            height: 1,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        StatusChip(event.displayStatus),
                        const SizedBox(height: 7),
                        Text(
                          event.title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          [
                            event.venue,
                            event.city,
                          ].where((s) => s.isNotEmpty).join(' · '),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 8,
                children: [
                  Text(
                    '${event.sold} sold',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    '/ ${event.capacity} capacity',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              const SizedBox(height: 9),
              LinearProgressIndicator(
                value: event.capacity > 0
                    ? (event.sold / event.capacity).clamp(0.0, 1.0)
                    : 0,
                semanticsLabel:
                    '${event.sold} of ${event.capacity} tickets sold',
              ),
              const SizedBox(height: 14),
              const Divider(height: 1),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 12,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      '${event.checkedIn} checked in',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: onMonitor,
                    icon: const Icon(Icons.monitor_heart_outlined, size: 16),
                    label: const Text('Monitor'),
                  ),
                  TextButton.icon(
                    onPressed: onEdit,
                    icon: const Icon(Icons.edit_outlined, size: 16),
                    label: const Text('Edit'),
                  ),
                  if (event.canScan)
                    TextButton.icon(
                      onPressed: onScan,
                      icon: const Icon(Icons.qr_code_scanner, size: 16),
                      label: const Text('Scan tickets'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, required this.api});
  final OrganizerApi api;
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final List<Json> _orders = [];
  String? _status, _error;
  final _search = TextEditingController();
  String _query = '';
  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  bool _busy = false, _more = true;
  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    if (_busy) return;
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
      );
      if (mounted) {
        setState(() {
          _orders.addAll(page.orders);
          _more = page.hasMore;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: () => _load(reset: true),
    child: ListView(
      padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        Eyebrow(
          widget.api.user?['role'] == 'admin'
              ? 'Operations & support'
              : 'Every ticket counts',
        ),
        const SizedBox(height: 10),
        Text(
          'Sales & orders',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        Text(
          widget.api.user?['role'] == 'admin'
              ? 'Find a buyer, inspect an order, and resolve ticket issues.'
              : 'Sales, buyer details, and entry for your events.',
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _search,
          enabled: !_busy,
          textInputAction: TextInputAction.search,
          onSubmitted: (value) {
            _query = value.trim();
            _load(reset: true);
          },
          decoration: InputDecoration(
            labelText: 'Search orders',
            hintText: 'Buyer, email, event, or reference',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: IconButton(
              tooltip: 'Search orders',
              onPressed: _busy
                  ? null
                  : () {
                      _query = _search.text.trim();
                      _load(reset: true);
                    },
              icon: const Icon(Icons.arrow_forward_rounded),
            ),
          ),
        ),
        const SizedBox(height: 20),
        DropdownButtonFormField<String>(
          initialValue: _status ?? 'all',
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Order status'),
          items:
              [
                    'all',
                    'paid',
                    'completed',
                    'pending',
                    'awaiting_verification',
                    'refunded',
                    'cancelled',
                    'expired',
                  ]
                  .map(
                    (s) =>
                        DropdownMenuItem(value: s, child: Text(statusLabel(s))),
                  )
                  .toList(),
          onChanged: _busy
              ? null
              : (value) {
                  _status = value == 'all' ? null : value;
                  _load(reset: true);
                },
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
          const EmptyState(
            icon: Icons.receipt_long_outlined,
            title: 'No orders yet',
            message: 'Orders matching this status will appear here.',
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
      return RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const Eyebrow('The bigger picture'),
            const SizedBox(height: 10),
            Text(
              'Your money, clearly',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            const Text('Personal payout balance from your owned events.'),
            const SizedBox(height: 24),
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
            OutlinedButton.icon(
              onPressed: () => openWebsite(context, widget.api, '/payouts'),
              icon: const Icon(Icons.open_in_new),
              label: const Text('Manage payouts on the website'),
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
    _future = _fetchOverview();
  }

  Future<Json> _fetchOverview() async {
    final data = await widget.api.adminOverview();
    _recentOrders = ((data['recentOrders'] as List?) ?? const [])
        .whereType<Json>()
        .toList();
    _recentHasMore = data['recentOrdersHasMore'] == true;
    return data;
  }

  Future<void> _reload() async {
    _recentOrders = null;
    _recentHasMore = false;
    final future = _fetchOverview();
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
      final visibleRecentOrders = _recentOrders ?? const <Json>[];
      final orderCount = orders.values.fold<int>(
        0,
        (sum, value) => sum + number((value as Json)['count']).toInt(),
      );
      final paidValues =
          ((data['paidOrderValueByCurrency'] as List?) ?? const [])
              .whereType<Json>()
              .toList();
      return RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const Eyebrow('Control room'),
            const SizedBox(height: 10),
            Text(
              'Admin operations & support',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 6),
            const Text(
              'Monitor orders, payouts, events, and organizer support from one place.',
            ),
            const SizedBox(height: 24),
            LayoutBuilder(
              builder: (context, constraints) {
                final itemWidth = constraints.maxWidth >= 620
                    ? (constraints.maxWidth - 24) / 3
                    : (constraints.maxWidth - 12) / 2;
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    SizedBox(
                      width: itemWidth,
                      child: _AdminStat(
                        value:
                            '${data['liveEventCount'] ?? events['published'] ?? 0}',
                        label: 'Live events',
                        icon: Icons.wifi_tethering,
                      ),
                    ),
                    SizedBox(
                      width: itemWidth,
                      child: _AdminStat(
                        value: '$orderCount',
                        label: 'Orders',
                        icon: Icons.receipt_long_outlined,
                      ),
                    ),
                    SizedBox(
                      width: itemWidth,
                      child: _AdminStat(
                        value: '${organizers.length}',
                        label: 'Approvals',
                        icon: Icons.person_add_alt_1_outlined,
                      ),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 22),
            _AdminSection(
              title: 'Paid order value',
              child: paidValues.isEmpty
                  ? const Card(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: Text('No paid order value yet.'),
                      ),
                    )
                  : Column(
                      children: [
                        for (final value in paidValues)
                          _RevenueCard(
                            value: money(
                              value['total'],
                              value['currency']?.toString() ?? 'USD',
                            ),
                          ),
                      ],
                    ),
            ),
            _buildPayoutQueue(context, widget.api, payouts, onChanged: _reload),
            _buildOrganizerApprovals(
              context,
              widget.api,
              organizers,
              onChanged: _reload,
            ),
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
                  subtitle: Text('$buyer · ${row['status'] ?? 'pending'}'),
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
  List<Json> payouts, {
  required VoidCallback onChanged,
}) => _AdminSection(
  title: 'Payout queue',
  trailing: '${payouts.length}',
  child: _AdminList<Json>(
    items: payouts,
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
              if (await _runPayoutAction(context, api, payout, action)) {
                onChanged();
              }
            },
            itemBuilder: (_) => [
              if (payout['status'] == 'pending')
                const PopupMenuItem(value: 'approve', child: Text('Approve')),
              if (payout['status'] == 'pending' ||
                  payout['status'] == 'approved' ||
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
  List<Json> organizers, {
  required VoidCallback onChanged,
}) => _AdminSection(
  title: 'Organizer approvals',
  trailing: '${organizers.length}',
  child: _AdminList<Json>(
    items: organizers,
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
          if (await _runOrganizerAction(context, api, organizer, action)) {
            onChanged();
          }
        },
        itemBuilder: (_) => const [
          PopupMenuItem(value: 'approve', child: Text('Approve organizer')),
          PopupMenuItem(value: 'reject', child: Text('Reject organizer')),
        ],
      ),
    ),
  ),
);

Future<bool> _runPayoutAction(
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
    if (reason == null || reason.isEmpty) return false;
  } else if (action == 'paid') {
    final controller = TextEditingController();
    proofReference = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Mark payout paid'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              labelText: 'Proof reference (optional)',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.pop(dialogContext, controller.text.trim()),
              child: const Text('Mark paid'),
            ),
          ],
        );
      },
    );
    controller.dispose();
    if (proofReference == null) return false;
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
    return true;
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$error')));
    }
    return false;
  }
}

Future<bool> _runOrganizerAction(
  BuildContext context,
  OrganizerApi api,
  Json organizer,
  String action,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(
        action == 'approve' ? 'Approve organizer?' : 'Reject organizer?',
      ),
      content: Text(
        '${organizer['name'] ?? organizer['email'] ?? 'This organizer'} will ${action == 'approve' ? 'gain organizer access' : 'be removed from the approval queue'}.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          child: Text(action == 'approve' ? 'Approve' : 'Reject'),
        ),
      ],
    ),
  );
  if (confirmed != true) return false;
  try {
    await api.adminOrganizerAction(organizer['id'].toString(), action);
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Organizer updated.')));
    }
    return true;
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$error')));
    }
    return false;
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
                fontSize: 12,
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
          Icon(icon, size: 40),
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
