import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../data/api.dart';
import '../../data/models.dart';
import '../../design.dart';

class BuyerOrderDetailScreen extends StatefulWidget {
  const BuyerOrderDetailScreen({
    super.key,
    required this.api,
    required this.orderId,
  });
  final TicketPulseApi api;
  final String orderId;

  @override
  State<BuyerOrderDetailScreen> createState() => _BuyerOrderDetailScreenState();
}

class _BuyerOrderDetailScreenState extends State<BuyerOrderDetailScreen> {
  late Future<Json> _order;
  @override
  void initState() {
    super.initState();
    _order = widget.api.buyerOrderDetail(widget.orderId);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      leading: IconButton(
        onPressed: () => Navigator.pop(context),
        icon: const Icon(Icons.arrow_back_rounded),
      ),
      title: const Text('Order details'),
    ),
    body: FutureBuilder<Json>(
      future: _order,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.receipt_long_outlined, size: 44),
                  const SizedBox(height: 12),
                  Text('${snapshot.error}', textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () => setState(
                      () =>
                          _order = widget.api.buyerOrderDetail(widget.orderId),
                    ),
                    child: const Text('Try again'),
                  ),
                ],
              ),
            ),
          );
        }
        final response = snapshot.data!;
        final order = response['order'] is Json
            ? response['order'] as Json
            : <String, dynamic>{};
        final event = order['event'] is Json
            ? order['event'] as Json
            : <String, dynamic>{};
        final tickets = ((response['tickets'] as List?) ?? const [])
            .whereType<Json>()
            .toList();
        final paid = [
          'paid',
          'completed',
        ].contains(order['status']?.toString().toLowerCase());
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            Text(
              event['title']?.toString() ?? 'TicketPulse event',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            if (response['_offlineCache'] == true) ...[
              const SizedBox(height: 8),
              const Text(
                'Offline mode · showing your saved ticket details',
                style: TextStyle(
                  color: Pulse.orange,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: 8),
            _OrderFact(
              label: 'Order status',
              value: statusLabel(order['status']?.toString() ?? 'pending'),
            ),
            if (event['startsAt'] != null)
              _OrderFact(
                label: 'Event date',
                value: dateLabel(event['startsAt']),
              ),
            if ([
              event['venue'],
              event['city'],
            ].whereType<String>().where((value) => value.isNotEmpty).isNotEmpty)
              _OrderFact(
                label: 'Venue',
                value: [event['venue'], event['city']]
                    .whereType<String>()
                    .where((value) => value.isNotEmpty)
                    .join(' · '),
              ),
            _OrderFact(
              label: 'Order total',
              value: money(
                order['totalAmount'],
                order['currency']?.toString() ?? 'USD',
              ),
            ),
            const SizedBox(height: 14),
            Text('Your tickets', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            if (!paid)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Text(
                    'Tickets will appear here after payment is confirmed. We’ll also send them to ${order['guestEmail'] ?? 'your email'}.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              )
            else if (tickets.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(18),
                  child: Text(
                    'Payment is confirmed. Ticket delivery is being prepared; check your email shortly.',
                  ),
                ),
              )
            else
              for (final ticket in tickets) _TicketPass(ticket: ticket),
            const SizedBox(height: 12),
            SelectableText(
              'Order reference: ${order['id'] ?? widget.orderId}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        );
      },
    ),
  );
}

class _TicketPass extends StatelessWidget {
  const _TicketPass({required this.ticket});
  final Json ticket;

  @override
  Widget build(BuildContext context) {
    final id = ticket['id']?.toString() ?? '';
    final qrCode = ticket['qrCode']?.toString();
    final scanStatus = ticket['scannedAt'] == null
        ? 'Ready to use'
        : 'Checked in';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: [
            Row(
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
                        ticket['tierName']?.toString() ?? 'Ticket',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        scanStatus,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                if (ticket['isStaffTicket'] == true)
                  const Chip(label: Text('Staff')),
              ],
            ),
            const SizedBox(height: 16),
            if ((qrCode ?? id).isNotEmpty)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Pulse.line),
                ),
                child: QrImageView(
                  data: qrCode?.isNotEmpty == true ? qrCode! : id,
                  version: QrVersions.auto,
                  size: 216,
                  backgroundColor: Colors.white,
                  errorStateBuilder: (context, error) => const SizedBox(
                    width: 216,
                    height: 216,
                    child: Center(child: Text('Ticket code unavailable')),
                  ),
                ),
              ),
            const SizedBox(height: 12),
            SelectableText(
              id,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 4),
            const Text(
              'Show this QR code at the event entrance.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Pulse.muted, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderFact extends StatelessWidget {
  const _OrderFact({required this.label, required this.value});
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 108,
          child: Text(label, style: Theme.of(context).textTheme.bodySmall),
        ),
        Expanded(
          child: Text(value, style: Theme.of(context).textTheme.bodyMedium),
        ),
      ],
    ),
  );
}
