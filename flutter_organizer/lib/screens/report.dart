import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/models.dart';

class AdminReportScreen extends StatefulWidget {
  const AdminReportScreen({super.key, required this.api});
  final OrganizerApi api;

  @override
  State<AdminReportScreen> createState() => _AdminReportScreenState();
}

class _AdminReportScreenState extends State<AdminReportScreen> {
  late Future<Json> _report;
  @override
  void initState() {
    super.initState();
    _report = widget.api.adminReport();
  }

  void _reload() => setState(() => _report = widget.api.adminReport());

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Orders report'), actions: [IconButton(onPressed: _reload, icon: const Icon(Icons.refresh))]),
    body: FutureBuilder<Json>(
      future: _report,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError) return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('Report unavailable. ${snapshot.error}')));
        final data = snapshot.data ?? <String, dynamic>{};
        final totals = (data['totals'] as Json?) ?? <String, dynamic>{};
        final rows = (data['rows'] as List?)?.whereType<Json>().toList() ?? const <Json>[];
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Secure report generated inside the app', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _Metric(label: 'Orders', value: '${totals['orderCount'] ?? 0}'),
              _Metric(label: 'Paid', value: '${totals['paidOrders'] ?? 0}'),
              _Metric(label: 'Pending', value: '${totals['pendingOrders'] ?? 0}'),
              _Metric(label: 'Gross', value: '${totals['gross'] ?? 0}'),
            ]),
            const SizedBox(height: 20),
            for (final row in rows) Card(child: ListTile(
              title: Text('${row['eventTitle'] ?? 'Event'} · ${row['status'] ?? 'unknown'}'),
              subtitle: Text('${row['customerName'] ?? row['customerEmail'] ?? 'Buyer'}\n${row['ticketCount'] ?? 0} tickets · ${row['amount'] ?? 0} ${row['currency'] ?? ''}'),
              isThreeLine: true,
            )),
            if (rows.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('No orders match this report.')),
          ],
        );
      },
    ),
  );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label, value;
  @override
  Widget build(BuildContext context) => Chip(label: Text('$label: $value'));
}
