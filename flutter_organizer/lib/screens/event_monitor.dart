import 'dart:async';

import 'package:flutter/material.dart';

import '../data/api.dart';
import '../data/models.dart';
import '../design.dart';

class EventMonitorScreen extends StatefulWidget {
  const EventMonitorScreen({
    super.key,
    required this.api,
    required this.initialEvent,
  });

  final OrganizerApi api;
  final OrganizerEvent initialEvent;

  @override
  State<EventMonitorScreen> createState() => _EventMonitorScreenState();
}

class _EventMonitorScreenState extends State<EventMonitorScreen>
    with WidgetsBindingObserver {
  late OrganizerEvent _event = widget.initialEvent;
  Timer? _timer;
  bool _refreshing = false;
  String? _error;
  DateTime? _updatedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _refresh());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    if (_refreshing) return;
    setState(() => _refreshing = true);
    try {
      final events = await widget.api.events();
      final event = events.where((item) => item.id == _event.id).firstOrNull;
      if (event == null) {
        throw const ApiException('This event is no longer available.');
      }
      if (mounted) {
        setState(() {
          _event = event;
          _updatedAt = DateTime.now();
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final remaining = (_event.capacity - _event.sold).clamp(0, _event.capacity);
    final soldRatio = _event.capacity == 0
        ? 0.0
        : _event.sold / _event.capacity;
    final checkInRatio = _event.sold == 0
        ? 0.0
        : _event.checkedIn / _event.sold;
    final lowInventory =
        _event.capacity > 0 && remaining <= (_event.capacity * .1).ceil();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Event monitor'),
        actions: [
          IconButton(
            tooltip: 'Refresh monitor',
            onPressed: _refreshing ? null : _refresh,
            icon: _refreshing
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const Eyebrow('Live operations'),
            const SizedBox(height: 8),
            Text(
              _event.title,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 5),
            Text(
              _updatedAt == null
                  ? 'Connecting to live event data…'
                  : 'Updates automatically every 15 seconds',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: ListTile(
                  leading: const Icon(Icons.cloud_off_outlined),
                  title: const Text('Live refresh paused'),
                  subtitle: Text(_error!),
                  trailing: TextButton(
                    onPressed: _refresh,
                    child: const Text('Retry'),
                  ),
                ),
              ),
            ],
            if (_event.isFinished || lowInventory) ...[
              const SizedBox(height: 14),
              Card(
                color: _event.isFinished
                    ? Theme.of(context).colorScheme.surfaceContainerHighest
                    : Theme.of(context).colorScheme.tertiaryContainer,
                child: ListTile(
                  leading: Icon(
                    _event.isFinished
                        ? Icons.event_busy_outlined
                        : Icons.inventory_2_outlined,
                  ),
                  title: Text(
                    _event.isFinished
                        ? 'Event has finished'
                        : 'Only $remaining tickets remain',
                  ),
                  subtitle: Text(
                    _event.isFinished
                        ? 'Gate scanning is closed for this event.'
                        : 'Capacity is at least 90% sold.',
                  ),
                ),
              ),
            ],
            const SizedBox(height: 18),
            LayoutBuilder(
              builder: (context, constraints) {
                final width = (constraints.maxWidth - 12) / 2;
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _MetricCard(
                      width: width,
                      icon: Icons.confirmation_number_outlined,
                      value: '${_event.sold}',
                      label: 'Tickets sold',
                    ),
                    _MetricCard(
                      width: width,
                      icon: Icons.how_to_reg_outlined,
                      value: '${_event.checkedIn}',
                      label: 'Checked in',
                    ),
                    _MetricCard(
                      width: width,
                      icon: Icons.event_seat_outlined,
                      value: '$remaining',
                      label: 'Remaining',
                    ),
                    _MetricCard(
                      width: width,
                      icon: Icons.percent_rounded,
                      value: '${(checkInRatio * 100).clamp(0, 100).round()}%',
                      label: 'Admission rate',
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 22),
            Text(
              'Ticket capacity',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text('${_event.sold} sold')),
                        Text('${_event.capacity} capacity'),
                      ],
                    ),
                    const SizedBox(height: 12),
                    LinearProgressIndicator(
                      minHeight: 9,
                      borderRadius: BorderRadius.circular(999),
                      value: soldRatio.clamp(0, 1),
                      semanticsLabel:
                          '${_event.sold} of ${_event.capacity} tickets sold',
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.width,
    required this.icon,
    required this.value,
    required this.label,
  });

  final double width;
  final IconData icon;
  final String value, label;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: Pulse.orange, size: 22),
            const SizedBox(height: 16),
            Text(value, style: Theme.of(context).textTheme.headlineSmall),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    ),
  );
}
