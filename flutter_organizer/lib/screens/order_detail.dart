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
    final complete = action == 'complete' || action == 'complete_and_send';
    final completeAndSend = action == 'complete_and_send';
    final paymentRefController = TextEditingController();
    final noteController = TextEditingController();
    final input = await showDialog<Json>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(completeAndSend ? 'Complete order and send tickets' : complete ? 'Confirm payment received' : 'Resend tickets?'),
        content: complete
            ? SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Confirm that ${money(order['totalAmount'], order['currency']?.toString() ?? 'USD')} has been received. This completes the order and records your action in the audit trail.',
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: paymentRefController,
                      decoration: const InputDecoration(
                        labelText: 'Payment reference (optional)',
                        hintText: 'e.g. EcoCash receipt number',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: noteController,
                      maxLines: 3,
                      maxLength: 1000,
                      decoration: const InputDecoration(
                        labelText: 'Internal note (optional)',
                        hintText: 'Add context for support staff',
                      ),
                    ),
                  ],
                ),
              )
            : Text(
                'Send the ticket email to ${order['guestEmail'] ?? order['buyerEmail'] ?? 'the buyer on file'}?',
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, {
              'paymentRef': paymentRefController.text.trim(),
              'note': noteController.text.trim(),
            }),
            child: Text(completeAndSend ? 'Complete & send' : complete ? 'Payment received' : 'Send tickets'),
          ),
        ],
      ),
    );
    paymentRefController.dispose();
    noteController.dispose();
    if (input == null || !mounted) return;
    setState(() {
      _busy = true;
      _feedback = null;
    });
    try {
      final result = await widget.api.orderAction(
        widget.id,
        action,
        paymentRef: input['paymentRef']?.toString(),
        note: input['note']?.toString(),
      );
      if (!mounted) return;
      setState(() {
        _failed = false;
        _feedback = complete
            ? '${result['message']?.toString() ?? 'Order updated.'} Audit record saved.'
            : result['message']?.toString() ?? 'Order updated.';
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

  Future<void> _whatsapp(String phone, String buyerName) async {
    final normalized = phone
        .replaceAll(RegExp(r'[^0-9+]'), '')
        .replaceFirst('+', '');
    if (normalized.isEmpty) return;
    final message = Uri.encodeComponent(
      'Hi $buyerName, this is TicketPulse support regarding your order ${widget.id}.',
    );
    final appUri = Uri.parse('whatsapp://send?phone=$normalized&text=$message');
    final webUri = Uri.parse('https://wa.me/$normalized?text=$message');
    try {
      if (await launchUrl(appUri, mode: LaunchMode.externalApplication)) return;
      if (!await launchUrl(webUri, mode: LaunchMode.externalApplication)) {
        throw Exception();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open WhatsApp. Check the buyer number.'),
          ),
        );
      }
    }
  }

  Future<void> _openSupportCase() async {
    final subject = TextEditingController();
    final note = TextEditingController();
    var priority = 'normal';
    final input = await showDialog<Json>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Open support case'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: subject,
                  maxLength: 160,
                  decoration: const InputDecoration(
                    labelText: 'Subject',
                    hintText: 'e.g. Buyer did not receive tickets',
                  ),
                ),
                DropdownButtonFormField<String>(
                  initialValue: priority,
                  decoration: const InputDecoration(labelText: 'Priority'),
                  items: const [
                    DropdownMenuItem(value: 'low', child: Text('Low')),
                    DropdownMenuItem(value: 'normal', child: Text('Normal')),
                    DropdownMenuItem(value: 'high', child: Text('High')),
                    DropdownMenuItem(value: 'urgent', child: Text('Urgent')),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => priority = value ?? 'normal'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: note,
                  maxLines: 3,
                  maxLength: 1000,
                  decoration: const InputDecoration(
                    labelText: 'Internal note (optional)',
                    alignLabelWithHint: true,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, {
                'subject': subject.text.trim(),
                'priority': priority,
                'note': note.text.trim(),
              }),
              child: const Text('Open case'),
            ),
          ],
        ),
      ),
    );
    subject.dispose();
    note.dispose();
    if (input == null ||
        input['subject']?.toString().isEmpty != false ||
        !mounted) {
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.api.supportCaseAction(
        widget.id,
        'support_open',
        subject: input['subject']?.toString(),
        priority: input['priority']?.toString(),
        note: input['note']?.toString(),
      );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Support case opened.')));
      }
      await _refresh();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resolveSupportCase() async {
    final note = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Resolve support case'),
        content: TextField(
          controller: note,
          maxLines: 3,
          maxLength: 1000,
          decoration: const InputDecoration(
            labelText: 'Resolution note (optional)',
            alignLabelWithHint: true,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Resolve case'),
          ),
        ],
      ),
    );
    final resolutionNote = note.text.trim();
    note.dispose();
    if (confirmed != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await widget.api.supportCaseAction(
        widget.id,
        'support_resolve',
        note: resolutionNote,
      );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Support case resolved.')));
      }
      await _refresh();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
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
              final scanLogs = (data['scanLogs'] as List? ?? [])
                  .whereType<Json>()
                  .toList();
              final actions = data['actions'] as Json? ?? {};
              final supportCase = data['supportCase'] is Json
                  ? data['supportCase'] as Json
                  : null;
              final currency = order['currency']?.toString() ?? 'USD';
              final buyerPhone =
                  order['guestPhone']?.toString() ??
                  order['buyerPhone']?.toString();
              final buyerName = order['buyerName']?.toString() ?? 'there';
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
                      if (buyerPhone != null && buyerPhone.isNotEmpty)
                        SelectableText(buyerPhone),
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
                          if (buyerPhone != null && buyerPhone.isNotEmpty)
                            OutlinedButton.icon(
                              onPressed: () => _contact(
                                Uri(scheme: 'tel', path: buyerPhone),
                              ),
                              icon: const Icon(Icons.call_outlined, size: 18),
                              label: const Text('Call buyer'),
                            ),
                          if (buyerPhone != null && buyerPhone.isNotEmpty)
                            OutlinedButton.icon(
                              onPressed: () => _whatsapp(buyerPhone, buyerName),
                              icon: const Icon(Icons.chat_outlined, size: 18),
                              label: const Text('WhatsApp buyer'),
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
                    _section(context, 'Scan activity', [
                      if (scanLogs.isEmpty)
                        const Text('No scan attempts recorded for this order.'),
                      for (final log in scanLogs)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            log['outcome'] == 'valid'
                                ? Icons.check_circle_outline
                                : Icons.info_outline,
                          ),
                          title: Text(
                            statusLabel(log['outcome']?.toString() ?? 'scan'),
                          ),
                          subtitle: Text(
                            [
                              if (log['reason'] != null)
                                log['reason'].toString(),
                              if (log['source'] != null)
                                log['source'].toString(),
                              dateLabel(log['createdAt']),
                            ].join(' · '),
                          ),
                        ),
                    ]),
                    _section(context, 'Support case', [
                      if (supportCase == null ||
                          supportCase['status'] == 'resolved') ...[
                        if (supportCase?['status'] == 'resolved')
                          Text(
                            'Resolved ${dateLabel(supportCase?['resolvedAt'])}',
                          ),
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: _busy ? null : _openSupportCase,
                          icon: const Icon(Icons.support_agent_outlined),
                          label: const Text('Open support case'),
                        ),
                      ] else ...[
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.support_agent_outlined),
                          title: Text(
                            supportCase['subject']?.toString() ?? 'Open case',
                          ),
                          subtitle: Text(
                            '${statusLabel(supportCase['priority']?.toString() ?? 'normal')} priority · assigned to ${supportCase['assignedTo'] ?? 'support'}',
                          ),
                        ),
                        if (supportCase['note'] != null &&
                            supportCase['note'].toString().isNotEmpty)
                          Text(supportCase['note'].toString()),
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: _busy ? null : _resolveSupportCase,
                          icon: const Icon(Icons.check_circle_outline),
                          label: const Text('Resolve case'),
                        ),
                      ],
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
                                  : () => _act('complete_and_send', order),
                              icon: const Icon(Icons.verified_outlined),
                              label: const Text('Complete & send tickets'),
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
