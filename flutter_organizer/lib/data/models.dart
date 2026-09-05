import 'package:intl/intl.dart';

typedef Json = Map<String, dynamic>;

num number(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
String money(dynamic value, [String currency = 'USD']) => NumberFormat.currency(
  name: currency,
  symbol: '$currency ',
  decimalDigits: 2,
).format(number(value));
String dateLabel(dynamic value) {
  final date = DateTime.tryParse('$value');
  return date == null
      ? 'Date to be confirmed'
      : DateFormat('d MMM y · HH:mm').format(date.toLocal());
}

String statusLabel(String value) {
  final label = value.replaceAll('_', ' ');
  return label.isEmpty
      ? 'Unknown'
      : label[0].toUpperCase() + label.substring(1);
}

class OrganizerEvent {
  OrganizerEvent.fromJson(Json json)
    : id = json['id'] as String,
      title = json['title'] as String,
      status = json['status'] as String? ?? 'draft',
      startsAt = DateTime.tryParse('${json['startsAt']}'),
      endsAt = DateTime.tryParse('${json['endsAt']}'),
      venue = json['venue'] as String? ?? 'Venue to be confirmed',
      city = json['city'] as String? ?? '',
      sold = number(json['totalSold']).toInt(),
      capacity = number(json['totalCapacity']).toInt(),
      checkedIn = number(json['checkedIn']).toInt();
  final String id, title, status, venue, city;
  final DateTime? startsAt, endsAt;
  final int sold, capacity, checkedIn;
  bool get isFinished => endsAt != null && !endsAt!.isAfter(DateTime.now());
  bool get canScan =>
      !isFinished && (status == 'published' || status == 'sold_out');
  String get displayStatus => isFinished ? 'completed' : status;
}

class OrderPage {
  OrderPage.fromJson(Json json)
    : orders = (json['orders'] is List)
          ? (json['orders'] as List).whereType<Json>().toList()
          : const [],
      hasMore = json['hasMore'] == true;
  final List<Json> orders;
  final bool hasMore;
}
