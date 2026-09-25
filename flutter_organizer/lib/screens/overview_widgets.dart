import 'dart:async';
import 'package:flutter/material.dart';
import '../data/models.dart';
import '../design.dart';

class OverviewSummary extends StatelessWidget {
  const OverviewSummary({super.key, required this.events});
  final List<OrganizerEvent> events;
  @override
  Widget build(BuildContext context) {
    final sold = events.fold<int>(0, (sum, e) => sum + e.sold);
    final checked = events.fold<int>(0, (sum, e) => sum + e.checkedIn);
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Pulse.navy, Color(0xFF163D60)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Eyebrow('At a glance', color: Color(0xFFB5C9DA)),
              Spacer(),
              Icon(Icons.insights_rounded, color: Color(0xFFB5C9DA), size: 20),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            '$sold',
            style: const TextStyle(
              fontSize: 48,
              fontWeight: FontWeight.w600,
              letterSpacing: -2.5,
              height: 1,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 7),
          const Text(
            'Tickets sold across your events',
            style: TextStyle(color: Color(0xFFB5C9DA), fontSize: 13),
          ),
          const SizedBox(height: 22),
          const Divider(color: Color(0xFF35526E), height: 1),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _Detail(
                  value: '${events.length}',
                  label: 'Events',
                  icon: Icons.event_outlined,
                ),
              ),
              Expanded(
                child: _Detail(
                  value: '$checked',
                  label: 'Checked in',
                  icon: Icons.how_to_reg_outlined,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.value, required this.label, required this.icon});
  final String value, label;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Icon(icon, size: 18, color: const Color(0xFF91ACC3)),
      ),
      const SizedBox(width: 10),
      Flexible(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w600,
                height: 1.1,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(fontSize: 12, color: Color(0xFFB5C9DA)),
            ),
          ],
        ),
      ),
    ],
  );
}

class ScanShortcut extends StatelessWidget {
  const ScanShortcut({super.key, required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: Pulse.orange,
    borderRadius: BorderRadius.circular(18),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: .14),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.qr_code_scanner,
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Ready for arrivals',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: 3),
                  Text(
                    'Open ticket scanner',
                    style: TextStyle(color: Color(0xFFFFEAE1), fontSize: 12),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_rounded,
              color: Colors.white,
              size: 21,
            ),
          ],
        ),
      ),
    ),
  );
}

/// "Starts in 2 h 40 min", "Happening now", or "Tomorrow" style countdown.
String countdownLabel(OrganizerEvent event, DateTime now) {
  final start = event.startsAt?.toLocal();
  if (start == null) return 'Date to be confirmed';
  final end = event.endsAt?.toLocal();
  if (!start.isAfter(now)) {
    return end == null || end.isAfter(now) ? 'Happening now' : 'Finished';
  }
  final diff = start.difference(now);
  if (diff.inMinutes < 60) {
    return 'Starts in ${diff.inMinutes.clamp(1, 59)} min';
  }
  if (diff.inHours < 24) {
    final minutes = diff.inMinutes % 60;
    return 'Starts in ${diff.inHours} h${minutes == 0 ? '' : ' $minutes min'}';
  }
  // Calendar days, so an event at 6pm tomorrow reads "tomorrow", not "2 days".
  final days = DateUtils.dateOnly(
    start,
  ).difference(DateUtils.dateOnly(now)).inDays;
  return days <= 1 ? 'Starts tomorrow' : 'Starts in $days days';
}

/// The organizer's next (or current) event, front and centre on Home.
class NextEventCard extends StatefulWidget {
  const NextEventCard({
    super.key,
    required this.event,
    required this.onOpen,
    required this.onScan,
  });
  final OrganizerEvent event;
  final VoidCallback onOpen, onScan;
  @override
  State<NextEventCard> createState() => _NextEventCardState();
}

class _NextEventCardState extends State<NextEventCard> {
  late DateTime _now = DateTime.now();
  Timer? _tick;
  @override
  void initState() {
    super.initState();
    // Keep the countdown honest while the app stays open.
    _tick = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final live = countdownLabel(event, _now) == 'Happening now';
    const muted = Color(0xFFB5C9DA);
    return Semantics(
      container: true,
      child: Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: Pulse.navy,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (live)
                  Container(
                    width: 8,
                    height: 8,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: const BoxDecoration(
                      color: Color(0xFF34D399),
                      shape: BoxShape.circle,
                    ),
                  ),
                Eyebrow(live ? 'Happening now' : 'Next up', color: muted),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              event.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700,
                height: 1.2,
                letterSpacing: -.4,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              live
                  ? '${event.checkedIn} of ${event.sold} checked in'
                  : countdownLabel(event, _now),
              style: const TextStyle(
                color: Color(0xFFFFB38F),
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              event.capacity > 0
                  ? '${event.sold} of ${event.capacity} tickets sold'
                  : '${event.sold} tickets sold',
              style: const TextStyle(color: muted, fontSize: 13),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                if (event.canScan) ...[
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: Pulse.orange,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: widget.onScan,
                      icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                      label: const Text('Scan'),
                    ),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Color(0xFF35526E)),
                      minimumSize: const Size(48, 54),
                    ),
                    onPressed: widget.onOpen,
                    child: const Text('Details'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
