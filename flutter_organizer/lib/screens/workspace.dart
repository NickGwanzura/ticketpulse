import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/api.dart';
import '../data/models.dart';
import 'scanner.dart';
import 'overview_widgets.dart';
import '../design.dart';
import 'package:intl/intl.dart';

class OrganizerWorkspace extends StatefulWidget {
  const OrganizerWorkspace({super.key, required this.api});
  final OrganizerApi api;
  @override
  State<OrganizerWorkspace> createState() => _OrganizerWorkspaceState();
}

class _OrganizerWorkspaceState extends State<OrganizerWorkspace> {
  int _tab = 0;
  bool _eventsDirty = false;
  OrganizerEvent? _scanEvent;
  late Future<List<OrganizerEvent>> _events;
  @override
  void initState() {
    super.initState();
    _events = widget.api.events();
  }

  Future<void> _reload() async {
    final future = widget.api.events();
    setState(() => _events = future);
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
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const BrandWordmark(),
      actions: [
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
                      if (events.isEmpty)
                        const EmptyState(
                          icon: Icons.event_outlined,
                          title: 'Your next event starts here',
                          message:
                              'Create an event on TicketPulse, then refresh to manage it here.',
                        ),
                      for (final event in (_tab == 0 ? events.take(3) : events))
                        EventCard(event: event, onScan: () => _scan(event)),
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

class EventCard extends StatelessWidget {
  const EventCard({super.key, required this.event, required this.onScan});
  final OrganizerEvent event;
  final VoidCallback onScan;
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
                            fontSize: 10,
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
                        StatusChip(event.status),
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
        const Eyebrow('Every ticket counts'),
        const SizedBox(height: 10),
        Text(
          'Sales & orders',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        const Text('Customer orders for the events you manage.'),
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
          Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusChip(order['status'] as String? ?? 'pending'),
                  const SizedBox(height: 8),
                  Text(
                    order['eventTitle'] as String,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    money(order['totalAmount'], order['currency'] as String),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  Text(order['guestName'] as String? ?? 'Guest'),
                  const SizedBox(height: 8),
                  Text(dateLabel(order['createdAt'])),
                  Text(
                    'Payment: ${statusLabel(order['paymentMethod'] as String? ?? 'Not specified')}',
                  ),
                  SelectableText(
                    'Order ${order['id']}',
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
                ],
              ),
            ),
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
    setState(() => _future = future);
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
  @override
  void initState() {
    super.initState();
    _future = widget.api.adminOverview();
  }

  Future<void> _reload() async {
    final future = widget.api.adminOverview();
    setState(() => _future = future);
    try {
      await future;
    } catch (_) {}
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
      final payouts = (data['pendingPayouts'] as List).cast<Json>();
      final organizers = (data['pendingOrganizers'] as List).cast<Json>();
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
            const Eyebrow('Control room'),
            const SizedBox(height: 10),
            Text(
              'TicketPulse admin',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 6),
            const Text(
              'Platform health at a glance. Operational actions remain audited on the web console.',
            ),
            const SizedBox(height: 24),
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
            _buildPayoutQueue(context, payouts),
            _buildOrganizerApprovals(context, organizers),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => openWebsite(context, widget.api, '/admin'),
              icon: const Icon(Icons.open_in_new),
              label: const Text('Open full admin console'),
            ),
          ],
        ),
      );
    },
  );
}

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
      trailing: Text(
        money(payout['amount'], payout['currency'] as String),
        style: Theme.of(context).textTheme.labelLarge,
      ),
    ),
  ),
);

Widget _buildOrganizerApprovals(BuildContext context, List<Json> organizers) =>
    _AdminSection(
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
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 18,
            vertical: 4,
          ),
          leading: const Icon(Icons.person_outline),
          title: Text(organizer['name'] as String? ?? 'Unnamed organizer'),
          subtitle: Text(organizer['email'] as String? ?? 'No email'),
          trailing: const Icon(Icons.chevron_right),
        ),
      ),
    );

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
      ? empty
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
