import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../data/models.dart';
import '../design.dart';

/// "Today, 6:00 PM", "Tomorrow, 2:00 PM", or "Sat, 18 Jul, 11:00 AM".
String eventWhen(DateTime? value, {DateTime? now}) {
  if (value == null) return 'Date to be confirmed';
  final local = value.toLocal();
  final today = DateUtils.dateOnly(now ?? DateTime.now());
  final day = DateUtils.dateOnly(local);
  final time = DateFormat('h:mm a').format(local);
  final diff = day.difference(today).inDays;
  if (diff == 0) return 'Today, $time';
  if (diff == 1) return 'Tomorrow, $time';
  if (diff == -1) return 'Yesterday, $time';
  final sameYear = day.year == today.year;
  return '${DateFormat(sameYear ? 'EEE, d MMM' : 'EEE, d MMM y').format(local)}, $time';
}

String eventPlace(OrganizerEvent event) =>
    [event.venue, event.city].where((s) => s.trim().isNotEmpty).join(', ');

/// Colour and label for an event's status pill.
({String label, Color color, Color background}) eventStatusStyle(
  BuildContext context,
  String status,
) {
  final dark = Theme.of(context).brightness == Brightness.dark;
  final (label, light, night) = switch (status) {
    'published' => ('Live', const Color(0xFF047857), const Color(0xFF6EE7B7)),
    'sold_out' => (
      'Sold out',
      const Color(0xFFB45309),
      const Color(0xFFFCD34D),
    ),
    'pending_review' => (
      'In review',
      const Color(0xFF6D28D9),
      const Color(0xFFC4B5FD),
    ),
    'cancelled' => (
      'Cancelled',
      const Color(0xFFBE123C),
      const Color(0xFFFDA4AF),
    ),
    'completed' => (
      'Finished',
      const Color(0xFF475569),
      const Color(0xFFCBD5E1),
    ),
    _ => ('Draft', const Color(0xFF9A6700), const Color(0xFFFCD34D)),
  };
  final color = dark ? night : light;
  return (
    label: label,
    color: color,
    background: dark ? const Color(0xFF1B2533) : Colors.white,
  );
}

/// Pill that sits over the bottom edge of an event thumbnail (Luma style).
class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});
  final String status;
  @override
  Widget build(BuildContext context) {
    final style = eventStatusStyle(context, status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F0A2540),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        style.label,
        style: TextStyle(
          color: style.color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Event artwork: the cover image when there is one, otherwise a branded tile.
class EventArtwork extends StatelessWidget {
  const EventArtwork({super.key, required this.event, this.radius = 14});
  final OrganizerEvent event;
  final double radius;
  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(radius),
    child: event.coverImage == null
        ? _Placeholder(event: event)
        // Cached, so covers load once and not on every visit (slow data).
        : CachedNetworkImage(
            imageUrl: event.coverImage!,
            fit: BoxFit.cover,
            placeholder: (_, _) => _Placeholder(event: event),
            errorWidget: (_, _, _) => _Placeholder(event: event),
            imageBuilder: (context, image) => Semantics(
              image: true,
              label: '${event.title} cover',
              child: DecoratedBox(
                decoration: BoxDecoration(
                  image: DecorationImage(image: image, fit: BoxFit.cover),
                ),
              ),
            ),
          ),
  );
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.event});
  final OrganizerEvent event;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Pulse.navy, Color(0xFF1C4A73)],
      ),
    ),
    child: Center(
      child: Icon(
        switch ((event.category ?? '').toLowerCase()) {
          final c when c.contains('concert') || c.contains('music') =>
            Icons.music_note_rounded,
          final c when c.contains('food') || c.contains('drink') =>
            Icons.restaurant_rounded,
          final c when c.contains('marathon') || c.contains('walk') =>
            Icons.directions_run_rounded,
          final c when c.contains('film') => Icons.movie_outlined,
          _ => Icons.confirmation_number_outlined,
        },
        color: const Color(0xFFB5C9DA),
        size: 30,
      ),
    ),
  );
}

/// Square thumbnail with the status pill overlapping its bottom edge.
class EventThumb extends StatelessWidget {
  const EventThumb({super.key, required this.event, this.size = 88});
  final OrganizerEvent event;
  final double size;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: size,
    height: size + 12,
    child: Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.topCenter,
      children: [
        SizedBox(
          width: size,
          height: size,
          child: EventArtwork(event: event),
        ),
        Positioned(bottom: 0, child: StatusPill(event.displayStatus)),
      ],
    ),
  );
}

/// Muted icon + text line (clock / pin rows under an event title).
class InfoLine extends StatelessWidget {
  const InfoLine({super.key, required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodyMedium?.color;
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(icon, size: 16, color: muted),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: muted, fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}

/// Luma-style event row: artwork on the left, title and details on the right.
class EventRow extends StatelessWidget {
  const EventRow({super.key, required this.event, required this.onTap});
  final OrganizerEvent event;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(16),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          EventThumb(event: event),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.titleMedium?.copyWith(fontSize: 17, height: 1.25),
                ),
                InfoLine(
                  icon: Icons.schedule_rounded,
                  text: eventWhen(event.startsAt),
                ),
                InfoLine(
                  icon: Icons.place_outlined,
                  text: eventPlace(event).isEmpty
                      ? 'Venue to be confirmed'
                      : eventPlace(event),
                ),
                InfoLine(
                  icon: Icons.confirmation_number_outlined,
                  text: event.capacity > 0
                      ? '${event.sold} of ${event.capacity} sold · ${event.checkedIn} in'
                      : '${event.sold} sold · ${event.checkedIn} in',
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
