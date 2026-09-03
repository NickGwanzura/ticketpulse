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
