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

String? _httpsUrl(dynamic value) {
  final uri = Uri.tryParse('${value ?? ''}');
  return uri != null && uri.scheme == 'https' && uri.hasAuthority
      ? uri.toString()
      : null;
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
      slug = json['slug'] as String?,
      category = json['category'] as String?,
      coverImage = _httpsUrl(json['coverImage']),
      sold = number(json['totalSold']).toInt(),
      capacity = number(json['totalCapacity']).toInt(),
      checkedIn = number(json['checkedIn']).toInt(),
      tiers = (json['tiers'] is List)
          ? (json['tiers'] as List)
                .whereType<Json>()
                .map(TierSales.fromJson)
                .toList()
          : const [];
  final String id, title, status, venue, city;
  final String? slug, category;

  /// Cover artwork URL, only when it is an absolute https URL.
  final String? coverImage;
  final DateTime? startsAt, endsAt;
  final int sold, capacity, checkedIn;

  /// Sales by ticket type (empty on older servers).
  final List<TierSales> tiers;

  bool get isUpcoming =>
      !isFinished &&
      (startsAt == null ||
          startsAt!.isAfter(
            DateTime.now().subtract(const Duration(hours: 12)),
          ));
  bool get isFinished => endsAt != null && !endsAt!.isAfter(DateTime.now());
  bool get canScan =>
      !isFinished && (status == 'published' || status == 'sold_out');
  String get displayStatus => isFinished ? 'completed' : status;
}

class ScanHistoryEntry {
  const ScanHistoryEntry({
    required this.title,
    required this.status,
    required this.checkedAt,
  });

  final String title;
  final String status;
  final DateTime checkedAt;
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

class BuyerEvent {
  BuyerEvent.fromJson(Json json)
    : id = json['id']?.toString() ?? '',
      title = json['title']?.toString() ?? 'Untitled event',
      slug = json['slug']?.toString() ?? '',
      category = json['category']?.toString() ?? 'Event',
      venue = json['venue']?.toString() ?? 'Venue to be confirmed',
      city = json['city']?.toString() ?? '',
      startsAt = DateTime.tryParse('${json['startsAt']}'),
      coverImage = json['coverImage']?.toString(),
      featured = json['featured'] == true,
      organizerName = json['organizerName']?.toString(),
      lowestPrice = json['lowestPrice'] == null
          ? null
          : number(json['lowestPrice']).toDouble(),
      currency = json['currency']?.toString() ?? 'USD',
      description = json['description']?.toString(),
      address = json['address']?.toString(),
      tiers = ((json['tiers'] as List?) ?? const [])
          .whereType<Json>()
          .map(TicketTier.fromJson)
          .toList(growable: false);

  final String id, title, slug, category, venue, city, currency;
  final DateTime? startsAt;
  final String? coverImage, organizerName, description, address;
  final bool featured;
  final double? lowestPrice;
  final List<TicketTier> tiers;
}

class TicketTier {
  TicketTier.fromJson(Json json)
    : id = json['id']?.toString() ?? '',
      name = json['name']?.toString() ?? 'General admission',
      description = json['description']?.toString(),
      price = number(json['price']).toDouble(),
      currency = json['currency']?.toString() ?? 'USD',
      remaining = number(json['remaining']).toInt(),
      maxPerOrder = number(
        json['maxPerOrder'] ?? 10,
      ).toInt().clamp(1, 50).toInt(),
      earlyBirdPrice = json['earlyBirdPrice'] == null
          ? null
          : number(json['earlyBirdPrice']).toDouble(),
      earlyBirdUntil = DateTime.tryParse('${json['earlyBirdUntil']}'),
      groupPrice = json['groupPrice'] == null
          ? null
          : number(json['groupPrice']).toDouble(),
      groupMinQty = json['groupMinQty'] == null
          ? null
          : number(json['groupMinQty']).toInt();

  final String id, name, currency;
  final String? description;
  final double price;
  final int remaining, maxPerOrder;
  final double? earlyBirdPrice, groupPrice;
  final DateTime? earlyBirdUntil;
  final int? groupMinQty;

  double unitPriceFor(int quantity, DateTime now) {
    if (earlyBirdPrice != null &&
        (earlyBirdUntil == null || earlyBirdUntil!.isAfter(now))) {
      return earlyBirdPrice!;
    }
    if (groupPrice != null && groupMinQty != null && quantity >= groupMinQty!) {
      return groupPrice!;
    }
    return price;
  }
}

class CheckoutResult {
  CheckoutResult.fromJson(Json json)
    : accessSignature = json['accessSignature']?.toString() ?? '',
      flow = json['flow']?.toString() ?? '',
      orderId = json['orderId']?.toString() ?? '',
      redirectUrl = json['redirectUrl']?.toString(),
      amount = json['amount'] == null
          ? null
          : number(json['amount']).toDouble(),
      currency = json['currency']?.toString() ?? 'USD',
      pollRequired = json['flow'] != 'free';

  final String orderId, currency, accessSignature, flow;
  final String? redirectUrl;
  final double? amount;
  final bool pollRequired;
}
