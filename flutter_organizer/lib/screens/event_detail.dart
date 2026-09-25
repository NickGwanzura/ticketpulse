import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../design.dart';
import 'event_widgets.dart';

/// What the organizer chose on the event page, handled by the workspace.
enum EventAction { scan, orders }

/// Opens the event page. Resolves to the action the organizer picked, if any.
Future<EventAction?> showEventDetail(
  BuildContext context,
  OrganizerApi api,
  OrganizerEvent event,
) => Navigator.of(context).push<EventAction>(
  MaterialPageRoute(
    builder: (_) => EventDetailScreen(api: api, event: event),
  ),
);

/// Dark, artwork-led event page (after Luma's event screen).
class EventDetailScreen extends StatefulWidget {
  const EventDetailScreen({super.key, required this.api, required this.event});
  final OrganizerApi api;
  final OrganizerEvent event;
  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  late OrganizerEvent event = widget.event;
  OrganizerApi get api => widget.api;

  Uri? get _publicUrl =>
      event.slug == null ? null : api.baseUrl.resolve('/events/${event.slug}');

  Future<void> _refresh() async {
    try {
      final events = await api.events();
      final fresh = events.where((e) => e.id == event.id).firstOrNull;
      if (fresh != null && mounted) setState(() => event = fresh);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    }
  }

  Future<void> _share(BuildContext context) async {
    final url = _publicUrl!.toString();
    try {
      await SharePlus.instance.share(
        ShareParams(
          subject: event.title,
          text:
              '${event.title} · ${eventWhen(event.startsAt)}\nGet your tickets: $url',
        ),
      );
    } catch (_) {
      // No share sheet available (e.g. desktop/tests): fall back to copying.
      await Clipboard.setData(ClipboardData(text: url));
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Event link copied')));
      }
    }
  }

  @override
  Widget build(BuildContext context) => Theme(
    data: Pulse.theme(Brightness.dark),
    child: Builder(builder: (context) => _page(context)),
  );

  Widget _page(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final style = eventStatusStyle(context, event.displayStatus);
    final place = eventPlace(event);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFF111A24),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: RefreshIndicator(
                onRefresh: _refresh,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  children: [
                    Row(
                      children: [
                        _CircleButton(
                          icon: Icons.arrow_back_ios_new_rounded,
                          tooltip: 'Back',
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                        const Spacer(),
                        if (_publicUrl != null)
                          _CircleButton(
                            icon: Icons.ios_share_rounded,
                            tooltip: 'Share event',
                            onPressed: () => _share(context),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: Column(
                        children: [
                          AspectRatio(
                            aspectRatio: 1,
                            child: EventArtwork(event: event, radius: 0),
                          ),
                          Container(
                            width: double.infinity,
                            color: const Color(0xFF1B2533),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    color: style.color,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  style.label,
                                  style: TextStyle(
                                    color: style.color,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      event.title,
                      style: text.headlineMedium?.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      eventWhen(event.startsAt),
                      style: text.bodyLarge?.copyWith(
                        color: const Color(0xFFAFBDCC),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: _ActionTile(
                            icon: Icons.qr_code_scanner_rounded,
                            label: 'Scan tickets',
                            primary: true,
                            onPressed: event.canScan
                                ? () => Navigator.of(
                                    context,
                                  ).pop(EventAction.scan)
                                : null,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _ActionTile(
                            icon: Icons.receipt_long_rounded,
                            label: 'Orders',
                            onPressed: () =>
                                Navigator.of(context).pop(EventAction.orders),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _ActionTile(
                            icon: Icons.more_horiz_rounded,
                            label: 'Manage',
                            onPressed: () => openInBrowser(
                              context,
                              api.baseUrl.resolve(
                                '/organizer/events/${event.id}',
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (!event.canScan)
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Text(
                          event.isFinished
                              ? 'This event has finished, so scanning is closed.'
                              : 'Scanning opens once the event is live.',
                          style: text.bodyMedium,
                        ),
                      ),
                    const SizedBox(height: 32),
                    _Section(
                      title: 'Sales',
                      child: _SalesCard(event: event),
                    ),
                    if (event.tiers.isNotEmpty)
                      _Section(
                        title: 'Ticket types',
                        child: Column(
                          children: [
                            for (final tier in event.tiers)
                              _TierRow(tier: tier),
                          ],
                        ),
                      ),
                    _Section(
                      title: 'Location',
                      child: Text(
                        place.isEmpty ? 'Venue to be confirmed' : place,
                        style: text.titleMedium?.copyWith(color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    onPressed: onPressed,
    style: IconButton.styleFrom(
      backgroundColor: const Color(0xFF1F2A37),
      foregroundColor: Colors.white,
      fixedSize: const Size(48, 48),
    ),
    icon: Icon(icon, size: 20),
  );
}

/// Tall rounded action button with an icon over its label.
class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.primary = false,
  });
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool primary;
  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    final fg = primary ? Pulse.navy : Colors.white;
    return Opacity(
      opacity: enabled ? 1 : .45,
      child: Material(
        color: primary ? Colors.white : const Color(0xFF1F2A37),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 76),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: fg, size: 22),
                  const SizedBox(height: 6),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: fg,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 28),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.bodyMedium),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Divider(height: 1),
        ),
        child,
      ],
    ),
  );
}

class _SalesCard extends StatelessWidget {
  const _SalesCard({required this.event});
  final OrganizerEvent event;
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    Widget stat(String value, String label) => Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: text.titleLarge?.copyWith(color: Colors.white)),
          const SizedBox(height: 2),
          Text(label, style: text.bodyMedium?.copyWith(fontSize: 13)),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            stat('${event.sold}', 'Sold'),
            stat(event.capacity > 0 ? '${event.capacity}' : '—', 'Capacity'),
            stat('${event.checkedIn}', 'Checked in'),
          ],
        ),
        if (event.capacity > 0) ...[
          const SizedBox(height: 14),
          LinearProgressIndicator(
            value: (event.sold / event.capacity).clamp(0.0, 1.0),
            semanticsLabel: '${event.sold} of ${event.capacity} tickets sold',
          ),
        ],
      ],
    );
  }
}

/// One ticket type: name, price, and sold against its allocation.
class _TierRow extends StatelessWidget {
  const _TierRow({required this.tier});
  final TierSales tier;
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  tier.name,
                  style: text.titleMedium?.copyWith(color: Colors.white),
                ),
              ),
              Text(
                tier.price == 0 ? 'Free' : money(tier.price, tier.currency),
                style: text.bodyMedium,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: LinearProgressIndicator(
                  value: tier.capacity > 0
                      ? (tier.sold / tier.capacity).clamp(0.0, 1.0)
                      : 0,
                  semanticsLabel:
                      '${tier.sold} of ${tier.capacity} ${tier.name} sold',
                ),
              ),
              const SizedBox(width: 12),
              Text(
                tier.capacity > 0
                    ? '${tier.sold}/${tier.capacity}'
                    : '${tier.sold} sold',
                style: text.bodyMedium?.copyWith(fontSize: 13),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
