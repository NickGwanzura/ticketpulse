import 'package:flutter/material.dart';

import '../../data/api.dart';
import '../../data/models.dart';
import '../../design.dart';
import 'checkout.dart';

class EventDetailScreen extends StatefulWidget {
  const EventDetailScreen({
    super.key,
    required this.api,
    required this.eventId,
  });
  final TicketPulseApi api;
  final String eventId;

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  late Future<BuyerEvent> _event;
  @override
  void initState() {
    super.initState();
    _event = widget.api.publicEvent(widget.eventId);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      leading: IconButton(
        onPressed: () => Navigator.pop(context),
        icon: const Icon(Icons.arrow_back_rounded),
      ),
      title: const Text('Event details'),
    ),
    body: FutureBuilder<BuyerEvent>(
      future: _event,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError || !snapshot.hasData) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.event_busy_outlined, size: 44),
                  const SizedBox(height: 12),
                  Text(
                    snapshot.error?.toString() ?? 'Event not found',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () => setState(
                      () => _event = widget.api.publicEvent(widget.eventId),
                    ),
                    child: const Text('Try again'),
                  ),
                ],
              ),
            ),
          );
        }
        final event = snapshot.data!;
        return Stack(
          children: [
            _eventContent(event),
            Positioned(
              left: 16,
              right: 16,
              bottom: 12,
              child: SafeArea(
                top: false,
                child: FilledButton(
                  onPressed: event.tiers.any((tier) => tier.remaining > 0)
                      ? () => Navigator.of(context).push<void>(
                          MaterialPageRoute(
                            builder: (_) => TicketSelectionScreen(
                              api: widget.api,
                              event: event,
                            ),
                          ),
                        )
                      : null,
                  child: Text(
                    event.tiers.isEmpty
                        ? 'Tickets coming soon'
                        : 'Choose tickets${event.tiers.isEmpty ? '' : ' · from ${money(event.tiers.map((tier) => tier.price).reduce((a, b) => a < b ? a : b), event.tiers.first.currency)}'}',
                  ),
                ),
              ),
            ),
          ],
        );
      },
    ),
  );

  Widget _eventContent(BuyerEvent event) {
    final venue = [event.venue, event.city, event.address]
        .whereType<String>()
        .where((value) => value.trim().isNotEmpty)
        .toSet()
        .join(', ');
    return ListView(
      padding: const EdgeInsets.only(bottom: 104),
      children: [
        SizedBox(
          height: 250,
          child: event.coverImage == null || event.coverImage!.isEmpty
              ? Container(
                  color: const Color(0xFFEAF0F6),
                  child: const Icon(
                    Icons.event_rounded,
                    size: 64,
                    color: Pulse.navy,
                  ),
                )
              : Image.network(
                  event.coverImage!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => Container(
                    color: const Color(0xFFEAF0F6),
                    child: const Icon(
                      Icons.event_rounded,
                      size: 64,
                      color: Pulse.navy,
                    ),
                  ),
                ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                event.category.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Pulse.orange,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                event.title,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 12),
              _DetailInfo(
                icon: Icons.calendar_month_outlined,
                label: event.startsAt == null
                    ? 'Date to be announced'
                    : dateLabel(event.startsAt),
              ),
              _DetailInfo(
                icon: Icons.location_on_outlined,
                label: venue.isEmpty ? 'Venue to be confirmed' : venue,
              ),
              if (event.organizerName?.isNotEmpty == true)
                _DetailInfo(
                  icon: Icons.event_available_outlined,
                  label: 'Presented by ${event.organizerName}',
                ),
              if (event.description?.trim().isNotEmpty == true) ...[
                const SizedBox(height: 20),
                Text(
                  'About this event',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  event.description!,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ],
              const SizedBox(height: 24),
              Text('Tickets', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(
                event.tiers.isEmpty
                    ? 'Ticket information will be available soon.'
                    : 'Choose the ticket that is right for you.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 14),
              for (final tier in event.tiers)
                Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFFEEF3F8),
                      child: Icon(
                        Icons.confirmation_number_outlined,
                        color: Pulse.navy,
                      ),
                    ),
                    title: Text(tier.name),
                    subtitle: Text(
                      tier.remaining > 0
                          ? '${tier.remaining} available'
                          : 'Sold out',
                    ),
                    trailing: Text(
                      money(tier.price, tier.currency),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class TicketSelectionScreen extends StatefulWidget {
  const TicketSelectionScreen({
    super.key,
    required this.api,
    required this.event,
  });
  final TicketPulseApi api;
  final BuyerEvent event;
  @override
  State<TicketSelectionScreen> createState() => _TicketSelectionScreenState();
}

class _TicketSelectionScreenState extends State<TicketSelectionScreen> {
  final Map<String, int> _quantities = {};
  String? _notice;

  int _quantity(TicketTier tier) => _quantities[tier.id] ?? 0;
  double _total() {
    final now = DateTime.now();
    return widget.event.tiers.fold<double>(0, (sum, tier) {
      final quantity = _quantity(tier);
      return sum + tier.unitPriceFor(quantity, now) * quantity;
    });
  }

  String get _currency => widget.event.tiers
      .firstWhere(
        (tier) => _quantity(tier) > 0,
        orElse: () => widget.event.tiers.first,
      )
      .currency;

  void _setQuantity(TicketTier tier, int quantity) {
    final requested = quantity
        .clamp(
          0,
          tier.remaining < tier.maxPerOrder ? tier.remaining : tier.maxPerOrder,
        )
        .toInt();
    final otherCurrencySelected = widget.event.tiers.any(
      (other) =>
          other.id != tier.id &&
          _quantity(other) > 0 &&
          other.currency != tier.currency,
    );
    if (requested > 0 && otherCurrencySelected) {
      setState(
        () => _notice =
            'Tickets in different currencies must be purchased separately.',
      );
      return;
    }
    setState(() {
      _notice = null;
      if (requested == 0) {
        _quantities.remove(tier.id);
      } else {
        _quantities[tier.id] = requested;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final selectedCount = _quantities.values.fold<int>(
      0,
      (sum, quantity) => sum + quantity,
    );
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: const Text('Select tickets'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          Text(
            widget.event.title,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 6),
          const Text('Choose your ticket and quantity.'),
          const SizedBox(height: 18),
          if (_notice != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3E9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _notice!,
                style: const TextStyle(color: Color(0xFF8C3C1C)),
              ),
            ),
          for (final tier in widget.event.tiers)
            _TicketTierCard(
              tier: tier,
              quantity: _quantity(tier),
              onChanged: (value) => _setQuantity(tier, value),
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Pulse.line)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$selectedCount ticket${selectedCount == 1 ? '' : 's'}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    Text(
                      money(_total(), _currency),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ],
                ),
              ),
              FilledButton(
                onPressed: selectedCount == 0
                    ? null
                    : () => Navigator.of(context).push<void>(
                        MaterialPageRoute(
                          builder: (_) => PaymentScreen(
                            api: widget.api,
                            event: widget.event,
                            quantities: Map.unmodifiable(_quantities),
                          ),
                        ),
                      ),
                child: const Text('Continue to payment'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TicketTierCard extends StatelessWidget {
  const _TicketTierCard({
    required this.tier,
    required this.quantity,
    required this.onChanged,
  });
  final TicketTier tier;
  final int quantity;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) {
    final max = tier.remaining < tier.maxPerOrder
        ? tier.remaining
        : tier.maxPerOrder;
    final unitPrice = tier.unitPriceFor(quantity, DateTime.now());
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const CircleAvatar(
                  backgroundColor: Color(0xFFEEF3F8),
                  child: Icon(
                    Icons.confirmation_number_outlined,
                    color: Pulse.navy,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tier.name,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        money(unitPrice, tier.currency),
                        style: const TextStyle(
                          color: Pulse.orange,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  max == 0 ? 'Sold out' : '$max max',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
            if (tier.description?.trim().isNotEmpty == true)
              Padding(
                padding: const EdgeInsets.only(left: 52, top: 10),
                child: Text(
                  tier.description!,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                IconButton(
                  onPressed: quantity == 0
                      ? null
                      : () => onChanged(quantity - 1),
                  icon: const Icon(Icons.remove_circle_outline),
                  tooltip: 'Remove one ${tier.name} ticket',
                ),
                SizedBox(
                  width: 32,
                  child: Text(
                    '$quantity',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  onPressed: quantity >= max
                      ? null
                      : () => onChanged(quantity + 1),
                  icon: const Icon(Icons.add_circle_outline),
                  tooltip: 'Add one ${tier.name} ticket',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailInfo extends StatelessWidget {
  const _DetailInfo({required this.icon, required this.label});
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 19, color: Pulse.muted),
        const SizedBox(width: 9),
        Expanded(
          child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
        ),
      ],
    ),
  );
}
