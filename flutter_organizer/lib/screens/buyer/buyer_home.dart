import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/api.dart';
import '../../data/models.dart';
import '../../design.dart';
import '../app_lock_settings.dart';
import '../sign_in.dart';
import 'buyer_order_detail.dart';
import 'event_detail.dart';

class BuyerHomeScreen extends StatefulWidget {
  const BuyerHomeScreen({super.key, required this.api, this.onOpenWorkspace});

  final TicketPulseApi api;
  final VoidCallback? onOpenWorkspace;

  @override
  State<BuyerHomeScreen> createState() => _BuyerHomeScreenState();
}

class _BuyerHomeScreenState extends State<BuyerHomeScreen> {
  final _search = TextEditingController();
  late Future<List<BuyerEvent>> _events;
  int _tab = 0;
  int _notificationUnread = 0;
  String? _category;

  @override
  void initState() {
    super.initState();
    _events = widget.api.publicEvents();
    if (widget.api.user != null) _loadNotificationCount();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _searchEvents(String query) async {
    setState(() {
      _category = null;
      _events = widget.api.publicEvents(query: query);
    });
  }

  Future<void> _openSignIn() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => SignInScreen(api: widget.api)),
    );
    if (mounted) setState(() {});
  }

  Future<void> _openSecuritySettings() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => AppLockSettingsScreen(api: widget.api)),
    );
    if (mounted) setState(() {});
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

  Future<void> _showNotifications() async {
    try {
      final data = await widget.api.notifications();
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
          child: SizedBox(
            height: MediaQuery.sizeOf(context).height * .65,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              children: [
                Text(
                  'Notifications',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                if (rows.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: Text('You’re all caught up.')),
                  ),
                for (final row in rows.take(40))
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: const Color(0xFFEEF3F8),
                      child: Icon(
                        row['read'] == true
                            ? Icons.notifications_none
                            : Icons.notifications_active_outlined,
                        color: Pulse.navy,
                      ),
                    ),
                    title: Text(
                      row['title']?.toString() ?? 'TicketPulse update',
                    ),
                    subtitle: Text(
                      '${row['body'] ?? ''}\n${dateLabel(row['createdAt'])}',
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    }
  }

  Future<void> _signOut() async {
    try {
      await widget.api.signOut();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not sign out. Please try again.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = widget.api.user != null;
    return Scaffold(
      appBar: AppBar(
        title: const BrandWordmark(),
        actions: [
          if (signedIn)
            IconButton(
              tooltip: 'Notifications',
              onPressed: _showNotifications,
              icon: Badge(
                isLabelVisible: _notificationUnread > 0,
                label: Text('$_notificationUnread'),
                child: const Icon(Icons.notifications_none_rounded),
              ),
            ),
          if (widget.onOpenWorkspace != null)
            IconButton(
              tooltip: 'Organizer workspace',
              onPressed: widget.onOpenWorkspace,
              icon: const Icon(Icons.dashboard_outlined),
            ),
          PopupMenuButton<String>(
            tooltip: 'Account',
            onSelected: (value) {
              if (value == 'signin') _openSignIn();
              if (value == 'signout') _signOut();
              if (value == 'security') _openSecuritySettings();
              if (value == 'help') {
                launchUrl(
                  widget.api.baseUrl.resolve('/help'),
                  mode: LaunchMode.externalApplication,
                );
              }
            },
            itemBuilder: (_) => [
              if (!signedIn)
                const PopupMenuItem(
                  value: 'signin',
                  child: ListTile(
                    leading: Icon(Icons.login),
                    title: Text('Sign in'),
                    contentPadding: EdgeInsets.zero,
                  ),
                )
              else ...[
                PopupMenuItem(
                  enabled: false,
                  child: Text(
                    widget.api.user?['name']?.toString() ?? 'Account',
                  ),
                ),
                const PopupMenuItem(
                  value: 'security',
                  child: ListTile(
                    leading: Icon(Icons.fingerprint_rounded),
                    title: Text('App security'),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
                const PopupMenuItem(
                  value: 'signout',
                  child: ListTile(
                    leading: Icon(Icons.logout),
                    title: Text('Sign out'),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ],
              const PopupMenuItem(
                value: 'help',
                child: ListTile(
                  leading: Icon(Icons.help_outline),
                  title: Text('Help & support'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
            icon: CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFFF1F3F7),
              child: Icon(
                signedIn ? Icons.person_rounded : Icons.person_outline_rounded,
                size: 20,
                color: Pulse.navy,
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(child: _tab == 0 ? _discover() : _myTickets()),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore_rounded),
            label: 'Discover',
          ),
          NavigationDestination(
            icon: Icon(Icons.confirmation_number_outlined),
            selectedIcon: Icon(Icons.confirmation_number_rounded),
            label: 'My tickets',
          ),
        ],
      ),
    );
  }

  Widget _discover() => FutureBuilder<List<BuyerEvent>>(
    future: _events,
    builder: (context, snapshot) {
      final events = snapshot.data ?? const <BuyerEvent>[];
      final categories =
          events
              .map((event) => event.category)
              .where((value) => value.trim().isNotEmpty)
              .toSet()
              .toList()
            ..sort();
      final shown = _category == null
          ? events
          : events.where((event) => event.category == _category).toList();
      return RefreshIndicator(
        onRefresh: () async {
          final fresh = widget.api.publicEvents(query: _search.text);
          setState(() => _events = fresh);
          try {
            await fresh;
          } catch (_) {}
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Text(
              'YOUR NEXT GREAT NIGHT OUT',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Pulse.orange,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Find your\nnext favourite.',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'The best experiences, all in one place.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: _searchEvents,
              decoration: InputDecoration(
                hintText: 'Artist, event or venue',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: IconButton(
                  tooltip: 'Search events',
                  onPressed: () => _searchEvents(_search.text),
                  icon: const Icon(Icons.arrow_forward_rounded),
                ),
              ),
            ),
            const SizedBox(height: 14),
            if (snapshot.connectionState == ConnectionState.waiting &&
                events.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 72),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (snapshot.hasError && events.isEmpty)
              _BuyerMessage(
                icon: Icons.cloud_off_outlined,
                title: 'Could not load events',
                message: '${snapshot.error}',
                action: FilledButton.tonal(
                  onPressed: () => setState(
                    () =>
                        _events = widget.api.publicEvents(query: _search.text),
                  ),
                  child: const Text('Try again'),
                ),
              )
            else if (events.isEmpty)
              const _BuyerMessage(
                icon: Icons.event_busy_outlined,
                title: 'Nothing on the calendar just yet',
                message: 'Check back soon for new TicketPulse events.',
              )
            else ...[
              if (categories.isNotEmpty) ...[
                SizedBox(
                  height: 42,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _CategoryChip(
                        label: 'All',
                        selected: _category == null,
                        onTap: () => setState(() => _category = null),
                      ),
                      for (final category in categories)
                        _CategoryChip(
                          label: category,
                          selected: _category == category,
                          onTap: () => setState(() => _category = category),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],
              if (_category == null && _search.text.isEmpty)
                ...shown
                    .where((event) => event.featured)
                    .take(1)
                    .map(
                      (event) => Padding(
                        padding: const EdgeInsets.only(bottom: 22),
                        child: _FeaturedEventCard(
                          event: event,
                          api: widget.api,
                        ),
                      ),
                    ),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _category ??
                          (_search.text.isEmpty
                              ? 'Coming up'
                              : 'Search results'),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  Text(
                    '${shown.length} events',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              for (final event in shown)
                _EventCard(event: event, api: widget.api),
            ],
          ],
        ),
      );
    },
  );

  Widget _myTickets() {
    if (widget.api.user == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.confirmation_number_outlined,
                size: 52,
                color: Pulse.navy,
              ),
              const SizedBox(height: 16),
              Text(
                'Your tickets, together.',
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Sign in to see tickets and orders linked to your TicketPulse account.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _openSignIn,
                child: const Text('Sign in'),
              ),
            ],
          ),
        ),
      );
    }
    return _BuyerOrders(api: widget.api);
  }
}

class _BuyerOrders extends StatefulWidget {
  const _BuyerOrders({required this.api});
  final TicketPulseApi api;
  @override
  State<_BuyerOrders> createState() => _BuyerOrdersState();
}

class _BuyerOrdersState extends State<_BuyerOrders> {
  late Future<List<Json>> _orders;
  @override
  void initState() {
    super.initState();
    _orders = widget.api.buyerOrders();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Json>>(
    future: _orders,
    builder: (context, snapshot) {
      if (snapshot.connectionState == ConnectionState.waiting) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return _BuyerMessage(
          icon: Icons.cloud_off_outlined,
          title: 'Tickets could not load',
          message: '${snapshot.error}',
          action: TextButton(
            onPressed: () => setState(() => _orders = widget.api.buyerOrders()),
            child: const Text('Retry'),
          ),
        );
      }
      final orders = snapshot.data ?? const <Json>[];
      if (orders.isEmpty) {
        return const _BuyerMessage(
          icon: Icons.confirmation_number_outlined,
          title: 'Your next memory starts here',
          message: 'Tickets you buy while signed in will show up here.',
        );
      }
      final fromCache = orders.first['_offlineCache'] == true;
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'MY TICKETPULSE',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Pulse.orange,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Your orders',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          if (fromCache) ...[
            const SizedBox(height: 10),
            const Text(
              'Offline mode · showing your saved tickets',
              style: TextStyle(
                color: Pulse.orange,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 18),
          for (final order in orders)
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                contentPadding: const EdgeInsets.all(16),
                leading: const CircleAvatar(
                  child: Icon(Icons.confirmation_number_outlined),
                ),
                title: Text(
                  order['eventTitle']?.toString() ?? 'TicketPulse event',
                ),
                subtitle: Text(
                  '${statusLabel(order['status']?.toString() ?? 'pending')} · ${dateLabel(order['createdAt'])}',
                ),
                trailing: Text(
                  money(
                    order['totalAmount'],
                    order['currency']?.toString() ?? 'USD',
                  ),
                  textAlign: TextAlign.end,
                ),
                onTap: () => Navigator.of(context).push<void>(
                  MaterialPageRoute(
                    builder: (_) => BuyerOrderDetailScreen(
                      api: widget.api,
                      orderId: order['id'].toString(),
                    ),
                  ),
                ),
              ),
            ),
        ],
      );
    },
  );
}

class _FeaturedEventCard extends StatelessWidget {
  const _FeaturedEventCard({required this.event, required this.api});
  final BuyerEvent event;
  final TicketPulseApi api;
  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(24),
    onTap: () => _openEvent(context, api, event),
    child: Ink(
      decoration: BoxDecoration(
        color: Pulse.navy,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            child: _EventImage(url: event.coverImage, height: 190),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Eyebrow('Featured event', color: Color(0xFFFFC8A8)),
                const SizedBox(height: 8),
                Text(
                  event.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                    fontSize: 21,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _eventMeta(event),
                  style: const TextStyle(color: Color(0xFFD8E0EA)),
                ),
                if (event.lowestPrice != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    'From ${money(event.lowestPrice, event.currency)}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event, required this.api});
  final BuyerEvent event;
  final TicketPulseApi api;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => _openEvent(context, api, event),
      child: Row(
        children: [
          SizedBox(
            width: 112,
            child: _EventImage(url: event.coverImage, height: 124),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.category.toUpperCase(),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Pulse.orange,
                      fontWeight: FontWeight.w700,
                      letterSpacing: .8,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    event.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _eventMeta(event),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    event.lowestPrice == null
                        ? 'Tickets available'
                        : 'From ${money(event.lowestPrice, event.currency)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Pulse.navy,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.only(right: 12),
            child: Icon(Icons.chevron_right_rounded),
          ),
        ],
      ),
    ),
  );
}

class _EventImage extends StatelessWidget {
  const _EventImage({required this.url, required this.height});
  final String? url;
  final double height;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    height: height,
    child: url == null || url!.isEmpty
        ? Container(
            color: const Color(0xFFEAF0F6),
            child: const Icon(Icons.event_rounded, size: 48, color: Pulse.navy),
          )
        : Image.network(
            url!,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => Container(
              color: const Color(0xFFEAF0F6),
              child: const Icon(
                Icons.event_rounded,
                size: 48,
                color: Pulse.navy,
              ),
            ),
          ),
  );
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
    ),
  );
}

class _BuyerMessage extends StatelessWidget {
  const _BuyerMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });
  final IconData icon;
  final String title, message;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 64),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 44, color: Pulse.navy),
        const SizedBox(height: 14),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Text(message, textAlign: TextAlign.center),
        if (action != null) ...[const SizedBox(height: 18), action!],
      ],
    ),
  );
}

String _eventMeta(BuyerEvent event) {
  final date = event.startsAt == null
      ? 'Date to be announced'
      : dateLabel(event.startsAt);
  return [
    date,
    event.venue,
    event.city,
  ].where((part) => part.trim().isNotEmpty).join(' · ');
}

void _openEvent(BuildContext context, TicketPulseApi api, BuyerEvent event) {
  Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) => EventDetailScreen(api: api, eventId: event.id),
    ),
  );
}
