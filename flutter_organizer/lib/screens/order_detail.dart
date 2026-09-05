import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../design.dart';
import 'workspace.dart' show Failure, StatusChip;

Future<void> showOrderDetail(
  BuildContext context,
  OrganizerApi api,
  String id,
) => Navigator.of(context).push<void>(
  MaterialPageRoute(
    builder: (_) => OrderDetailScreen(api: api, id: id),
  ),
);

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.api, required this.id});
  final OrganizerApi api;
  final String id;
  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late Future<Json> _future;
  bool _busy = false;
  String? _feedback;
  bool _failed = false;
  @override
  void initState() {
    super.initState();
    _future = widget.api.orderDetail(widget.id);
  }

  Future<void> _refresh() async {
    final future = widget.api.orderDetail(widget.id);
    setState(() {
      _future = future;
    });
    try {
      await future;
    } catch (_) {
      /* Shown by the detail error state. */
    }
  }

  Future<void> _act(String action, Json order) async {
    if (_busy) return;
    final complete = action == 'complete';
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(complete ? 'Confirm payment received' : 'Resend tickets?'),
        content: Text(
          complete
              ? 'Confirm that ${money(order['totalAmount'], order['currency']?.toString() ?? 'USD')} has been received for this order. This records payment, marks the order completed, and logs your account in the audit trail. Tickets can be resent afterwards.'
              : 'Send the ticket email to ${order['guestEmail'] ?? order['buyerEmail'] ?? 'the buyer on file'}?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(complete ? 'Payment received' : 'Send tickets'),
          ),
        ],
      ),
    );
    if (accepted != true || !mounted) return;
    setState(() {
      _busy = true;
      _feedback = null;
    });
    try {
      final result = await widget.api.orderAction(widget.id, action);
      if (!mounted) return;
      setState(() {
        _failed = false;
        _feedback = result['message']?.toString() ?? 'Order updated.';
      });
      await _refresh();
    } catch (error) {
      if (mounted) {
        setState(() {
          _failed = true;
          _feedback = '$error';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copy(String value, String label) async {
    try {
      await Clipboard.setData(ClipboardData(text: value));
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$label copied')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not copy. Please try again.')),
        );
      }
    }
  }

  Future<void> _contact(Uri uri) async {
    try {
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw Exception();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open the contact action.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Order details'),
      actions: [
        IconButton(
          tooltip: 'Refresh order',
          onPressed: _busy ? null : _refresh,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: FutureBuilder<Json>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done &&
                  !snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return Failure(message: '${snapshot.error}', retry: _refresh);
              }
              final data = snapshot.data!;
              final order = data['order'];
              if (order is! Json) {
                return Failure(
                  message: 'Order details are unavailable. Please refresh.',
                  retry: _refresh,
                );
              }
              final items = (data['items'] as List? ?? [])
                  .whereType<Json>()
                  .toList();
              final tickets = (data['tickets'] as List? ?? [])
                  .whereType<Json>()
                  .toList();
              final actions = data['actions'] as Json? ?? {};
              final currency = order['currency']?.toString() ?? 'USD';
              final colors = Theme.of(context).colorScheme;
              return RefreshIndicator(
                onRefresh: _refresh,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: colors.primaryContainer,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Eyebrow('Order overview'),
                          const SizedBox(height: 16),
                          Text(
                            money(order['totalAmount'], currency),
                            style: Theme.of(context).textTheme.headlineLarge,
                          ),
                          const SizedBox(height: 12),
                          StatusChip(order['status']?.toString() ?? 'pending'),
                          const SizedBox(height: 20),
                          Text(
                            order['eventTitle']?.toString() ?? 'Event',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 6),
                          Text(dateLabel(order['eventStartsAt'])),
                          if (order['eventVenue'] != null)
                            Text('${order['eventVenue']}'),
                          const SizedBox(height: 16),
                          Text(
                            'Order reference',
                            style: Theme.of(context).textTheme.labelMedium,
                          ),
                          SelectableText(
                            widget.id,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    _section(context, 'Buyer', [
                      Text(
                        order['buyerName']?.toString() ?? 'Guest buyer',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      if (order['buyerEmail'] != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: SelectableText('${order['buyerEmail']}'),
                        ),
                      if (order['guestPhone'] != null)
                        SelectableText('${order['guestPhone']}'),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          OutlinedButton.icon(
                            onPressed: () =>
                                _copy(widget.id, 'Order reference'),
                            icon: const Icon(Icons.copy_outlined, size: 18),
                            label: const Text('Copy reference'),
                          ),
                          if (order['buyerEmail'] != null)
                            OutlinedButton.icon(
                              onPressed: () => _copy(
                                '${order['buyerEmail']}',
                                'Buyer email',
                              ),
                              icon: const Icon(Icons.mail_outline, size: 18),
                              label: const Text('Copy email'),
                            ),
                          if (order['buyerEmail'] != null)
                            OutlinedButton.icon(
                              onPressed: () => _contact(
                                Uri(
                                  scheme: 'mailto',
                                  path: order['buyerEmail'].toString(),
                                  queryParameters: {
                                    'subject': 'TicketPulse order ${widget.id}',
                                  },
                                ),
                              ),
                              icon: const Icon(Icons.email_outlined, size: 18),
                              label: const Text('Email buyer'),
                            ),
                          if (order['guestPhone'] != null)
                            OutlinedButton.icon(
                              onPressed: () => _contact(
                                Uri(scheme: 'tel', path: order['guestPhone'].toString()),
                              ),
                              icon: const Icon(Icons.call_outlined, size: 18),
                              label: const Text('Call buyer'),
                            ),
                        ],
                      ),
                    ]),
                    _section(context, 'Order items', [
                      if (items.isEmpty)
                        const Text('No item details available.'),
                      for (final item in items)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['name']?.toString() ??
                                    statusLabel(
                                      item['type']?.toString() ?? 'item',
                                    ),
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${item['quantity']} × ${money(item['unitPrice'], currency)}',
                              ),
                              Text(
                                money(item['total'], currency),
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                            ],
                          ),
                        ),
                    ]),
                    _section(context, 'Payment & history', [
                      _fact(
                        'Payment method',
                        statusLabel(
                          order['paymentMethod']?.toString() ?? 'not specified',
                        ),
                      ),
                      if (order['paymentRef'] != null)
                        _fact('Payment reference', '${order['paymentRef']}'),
                      _fact('Order created', dateLabel(order['createdAt'])),
                      if (order['paidAt'] != null)
                        _fact('Payment received', dateLabel(order['paidAt'])),
                      if (order['completedAt'] != null)
                        _fact('Completed', dateLabel(order['completedAt'])),
                    ]),
                    _section(context, 'Tickets & entry', [
                      Text(
                        '${tickets.where((t) => t['scannedAt'] != null).length} checked in · ${tickets.length} tickets',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      if (tickets.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text('No tickets issued yet.'),
                        ),
                      for (final ticket in tickets)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            ticket['scannedAt'] != null
                                ? Icons.check_circle_outline
                                : Icons.confirmation_number_outlined,
                          ),
                          title: Text(
                            ticket['tierName']?.toString() ?? 'Ticket',
                          ),
                          subtitle: Text(
                            ticket['scannedAt'] != null
                                ? 'Checked in ${dateLabel(ticket['scannedAt'])}'
                                : statusLabel(
                                    ticket['status']?.toString() ??
                                        'not checked in',
                                  ),
                          ),
                        ),
                    ]),
                    _section(context, 'Order actions', [
                      if (_feedback != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Semantics(
                            liveRegion: true,
                            child: Text(
                              _feedback!,
                              style: TextStyle(
                                color: _failed
                                    ? colors.error
                                    : colors.onSurface,
                              ),
                            ),
                          ),
                        ),
                      if (_busy)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 16),
                          child: LinearProgressIndicator(
                            semanticsLabel: 'Updating order',
                          ),
                        ),
                      if (actions['resend'] == true)
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: _busy
                                ? null
                                : () => _act('resend', order),
                            icon: const Icon(Icons.forward_to_inbox_outlined),
                            label: const Text('Resend tickets'),
                          ),
                        ),
                      if (actions['complete'] == true)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: _busy
                                  ? null
                                  : () => _act('complete', order),
                              icon: const Icon(Icons.verified_outlined),
                              label: const Text('Mark payment received'),
                            ),
                          ),
                        ),
                      if (actions['resend'] != true &&
                          actions['complete'] != true)
                        const Text(
                          'No order actions are available for this status and account.',
                        ),
                    ]),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    ),
  );
}

Widget _fact(String label, String value) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 8),
  child: Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontSize: 12)),
      const SizedBox(height: 4),
      SelectableText(value),
    ],
  ),
);
Widget _section(BuildContext context, String title, List<Widget> children) =>
    Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: SizedBox(
                width: double.infinity,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: children,
                ),
              ),
            ),
          ),
        ],
      ),
    );

class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order, required this.onTap});
  final Json order;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              spacing: 12,
              runSpacing: 8,
              children: [
                StatusChip(order['status']?.toString() ?? 'pending'),
                Text(
                  money(
                    order['totalAmount'],
                    order['currency']?.toString() ?? 'USD',
                  ),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              order['eventTitle']?.toString() ?? 'Event',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(
              (order['guestName'] ??
                      order['buyerName'] ??
                      order['guestEmail'] ??
                      'Guest buyer')
                  .toString(),
            ),
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    dateLabel(order['createdAt']),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
                const SizedBox(width: 8),
                const Text('Details'),
                const Icon(Icons.chevron_right_rounded),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}
