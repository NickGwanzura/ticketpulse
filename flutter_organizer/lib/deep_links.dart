enum TicketPulseLinkKind { order, ticket }

class TicketPulseLinkTarget {
  const TicketPulseLinkTarget({required this.kind, required this.id});

  final TicketPulseLinkKind kind;
  final String id;
}

TicketPulseLinkTarget? parseTicketPulseLink(Uri uri) {
  List<String> segments;
  if (uri.scheme == 'ticketpulse') {
    segments = [if (uri.host.isNotEmpty) uri.host, ...uri.pathSegments];
  } else if (uri.scheme == 'https' && uri.host == 'ticketpulse.tech') {
    segments = uri.pathSegments;
  } else {
    return null;
  }
  final clean = segments.where((part) => part.isNotEmpty).toList();
  if (clean.length != 2 || clean[1] == '.' || clean[1] == '..') return null;
  final kind = switch (clean[0]) {
    'orders' => TicketPulseLinkKind.order,
    'tickets' => TicketPulseLinkKind.ticket,
    _ => null,
  };
  if (kind == null) return null;
  return TicketPulseLinkTarget(kind: kind, id: clean[1]);
}
