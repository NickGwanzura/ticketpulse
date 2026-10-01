import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'models.dart';

class ApiException implements Exception {
  const ApiException(this.message, [this.status = 0, this.details]);
  final Json? details;
  final String message;
  final int status;
  @override
  String toString() => message;
}

abstract class SessionStore {
  Future<String?> read();
  Future<void> write(String value);
  Future<String?> readPreference(String key);
  Future<void> writePreference(String key, String value);
  Future<void> clear();
}

class SecureSessionStore implements SessionStore {
  SecureSessionStore(this.origin);
  final String origin;
  final _storage = const FlutterSecureStorage();
  String get _key => 'ticketpulse.organizer.session.$origin';
  String _preferenceKey(String key) => 'ticketpulse.preference.$origin.$key';
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);
  @override
  Future<String?> readPreference(String key) =>
      _storage.read(key: _preferenceKey(key));
  @override
  Future<void> writePreference(String key, String value) =>
      _storage.write(key: _preferenceKey(key), value: value);
  @override
  Future<void> clear() async {
    await _storage.delete(key: _key);
    await _storage.delete(key: _preferenceKey('biometric_lock'));
  }
}

class TicketPulseApi extends ChangeNotifier {
  TicketPulseApi({
    required this.baseUrl,
    required this.store,
    http.Client? client,
  }) : _client = client ?? http.Client();
  final Uri baseUrl;
  final SessionStore store;
  final http.Client _client;
  final FlutterSecureStorage _scanStorage = const FlutterSecureStorage();
  Json? user;
  String? startupError;
  bool restoring = true;
  bool biometricLockEnabled = false;
  bool biometricUnlocked = false;
  String? _access, _refresh;
  Future<void>? _refreshing;
  int _generation = 0;

  String get _scanQueueKey => 'ticketpulse.organizer.scan-queue.$baseUrl';
  String get _buyerOrdersPrefix =>
      'ticketpulse.buyer.${user?['id']?.toString() ?? 'signed-out'}.';

  Future<Json> _send(
    String path, {
    Json? body,
    String? token,
    Map<String, String> extraHeaders = const {},
  }) async {
    try {
      final headers = <String, String>{
        'Accept': 'application/json',
        if (body != null) 'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
        ...extraHeaders,
      };
      final uri = baseUrl.resolve(path);
      final response =
          await (body == null
                  ? _client.get(uri, headers: headers)
                  : _client.post(uri, headers: headers, body: jsonEncode(body)))
              .timeout(const Duration(seconds: 20));
      Json data;
      try {
        data = jsonDecode(response.body) as Json;
      } catch (_) {
        throw ApiException(
          response.statusCode == 404
              ? 'This server does not have the organizer API yet.'
              : 'The server returned an unreadable response. Try again.',
          response.statusCode,
        );
      }
      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          data['ok'] == false) {
        throw ApiException(
          data['error'] is String ? data['error'] : 'Request failed.',
          response.statusCode,
          data,
        );
      }
      return data;
    } on TimeoutException {
      throw const ApiException(
        'Connection timed out. Check your connection and try again.',
      );
    } on http.ClientException {
      throw const ApiException(
        'Cannot connect to TicketPulse. Check your connection.',
      );
    }
  }

  Future<void> _savePair(Json data, int generation) async {
    if (_generation != generation) {
      throw const ApiException('Session changed. Sign in again.', 401);
    }
    final access = data['accessToken'] as String;
    final refresh = data['refreshToken'] as String;
    await store.write(
      jsonEncode({'accessToken': access, 'refreshToken': refresh}),
    );
    if (_generation != generation) {
      await store.clear();
      throw const ApiException('Session changed. Sign in again.', 401);
    }
    _access = access;
    _refresh = refresh;
  }

  Future<void> restore() async {
    restoring = true;
    startupError = null;
    biometricUnlocked = false;
    notifyListeners();
    try {
      biometricLockEnabled =
          await store.readPreference('biometric_lock') == 'true';
      final saved = await store.read();
      if (saved != null) {
        final pair = jsonDecode(saved) as Json;
        _access = pair['accessToken'] as String;
        _refresh = pair['refreshToken'] as String;
        await _loadUser();
      }
    } on ApiException catch (e) {
      if (e.status == 401 || e.status == 403) {
        await signOut();
      } else {
        startupError = e.message;
      }
    } catch (_) {
      startupError =
          'Unable to restore your saved session. Retry or sign in again.';
    } finally {
      restoring = false;
      notifyListeners();
    }
  }

  Future<void> setBiometricLockEnabled(bool enabled) async {
    if (user == null) {
      throw const ApiException('Sign in to change app lock settings.', 401);
    }
    await store.writePreference('biometric_lock', enabled ? 'true' : 'false');
    biometricLockEnabled = enabled;
    biometricUnlocked = true;
    notifyListeners();
  }

  void completeBiometricUnlock() {
    biometricUnlocked = true;
    notifyListeners();
  }

  void requireBiometricUnlock() {
    if (!biometricLockEnabled || user == null) return;
    biometricUnlocked = false;
    notifyListeners();
  }

  Future<void> signIn(String email, String password) async {
    final generation = ++_generation;
    final data = await _send(
      '/api/mobile/auth/login',
      body: {'email': email.trim(), 'password': password},
    );
    final profile = data['user'] as Json;
    await _savePair(data, generation);
    user = profile;
    startupError = null;
    notifyListeners();
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final generation = ++_generation;
    final data = await _send(
      '/api/mobile/auth/register',
      body: {'name': name.trim(), 'email': email.trim(), 'password': password},
    );
    final profile = data['user'] as Json;
    await _savePair(data, generation);
    user = profile;
    startupError = null;
    notifyListeners();
  }

  Future<void> _loadUser() async {
    final profile = (await request('/api/mobile/me'))['user'] as Json;
    if (profile['id'] == null || profile['role'] == null) {
      throw const ApiException(
        'Your account profile could not be loaded.',
        403,
      );
    }
    user = profile;
  }

  Future<void> _renew() async {
    final generation = _generation;
    if (_refresh == null) {
      throw const ApiException('Please sign in again.', 401);
    }
    try {
      final data = await _send(
        '/api/mobile/auth/refresh',
        body: {'refreshToken': _refresh},
      );
      await _savePair(data, generation);
    } on ApiException catch (e) {
      if (e.status == 401 && generation == _generation) await signOut();
      rethrow;
    }
  }

  Future<Json> request(String path, {Json? body}) async {
    final generation = _generation;
    final token = _access;
    if (token == null) throw const ApiException('Please sign in again.', 401);
    try {
      return await _send(path, body: body, token: token);
    } on ApiException catch (e) {
      if (e.status != 401 || generation != _generation) rethrow;
      // Concurrent 401s share one refresh. A late 401 uses the already renewed token.
      if (token == _access) {
        final future = _refreshing ??= _renew();
        try {
          await future;
        } finally {
          if (identical(_refreshing, future)) _refreshing = null;
        }
      }
      if (generation != _generation) {
        throw const ApiException('Please sign in again.', 401);
      }
      try {
        return await _send(path, body: body, token: _access);
      } on ApiException catch (retryError) {
        if (retryError.status == 401) await signOut();
        rethrow;
      }
    }
  }

  Future<List<OrganizerEvent>> events() async {
    final raw = (await request('/api/mobile/organizer/events'))['events'];
    if (raw is! List) {
      throw const ApiException(
        'Event data is unavailable. Refresh and try again.',
      );
    }
    return raw.whereType<Json>().map(OrganizerEvent.fromJson).toList();
  }

  Future<List<BuyerEvent>> publicEvents({String? query, int limit = 30}) async {
    final params = <String, String>{'limit': '$limit'};
    if (query != null && query.trim().isNotEmpty) params['q'] = query.trim();
    final data = await _send(
      '/api/mobile/events?${Uri(queryParameters: params).query}',
    );
    final raw = data['events'];
    if (raw is! List) {
      throw const ApiException(
        'Events are unavailable. Refresh and try again.',
      );
    }
    return raw.whereType<Json>().map(BuyerEvent.fromJson).toList();
  }

  Future<BuyerEvent> publicEvent(String id) async {
    final data = await _send('/api/mobile/events/${Uri.encodeComponent(id)}');
    final event = data['event'];
    if (event is! Json) {
      throw const ApiException('Event details are unavailable.');
    }
    return BuyerEvent.fromJson(event);
  }

  Future<Json?> activeCheckout() async {
    final raw = await store.readPreference('active_checkout');
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Json;
    } catch (_) {
      return null;
    }
  }

  Future<String> checkoutRequestId(String eventSlug) async {
    final existing = await activeCheckout();
    if (existing?['eventSlug'] == eventSlug &&
        existing?['checkoutRequestId'] is String) {
      return existing!['checkoutRequestId'] as String;
    }
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    final hex = bytes.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
    final id =
        '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
    await store.writePreference(
      'active_checkout',
      jsonEncode({'eventSlug': eventSlug, 'checkoutRequestId': id}),
    );
    return id;
  }

  Future<Json> quoteCheckout(Json payload) =>
      _send('/api/checkout/velocity', body: {...payload, 'quoteOnly': true});
  Future<CheckoutResult> startCheckout({
    required String eventSlug,
    required String name,
    required String email,
    required String phone,
    required String paymentMethod,
    required List<Json> items,
    required double expectedAmount,
    required String expectedCurrency,
    String? promoCode,
    Json questionResponses = const {},
  }) async {
    final payload = <String, dynamic>{
      'checkoutRequestId': await checkoutRequestId(eventSlug),
      'eventSlug': eventSlug,
      'name': name.trim(),
      'email': email.trim(),
      'phone': phone.trim(),
      'paymentMethod': paymentMethod,
      'items': items,
      'expectedAmount': expectedAmount,
      'expectedCurrency': expectedCurrency,
      'questionResponses': questionResponses,
      if (promoCode != null && promoCode.isNotEmpty) 'promoCode': promoCode,
    };
    await store.writePreference('active_checkout', jsonEncode(payload));
    Json data;
    try {
      data = await _send('/api/checkout/velocity', body: payload);
    } on ApiException catch (error) {
      if (error.details?['orderId'] == null) rethrow;
      data = {
        ...error.details!,
        'amount': expectedAmount,
        'currency': expectedCurrency,
        'pollRequired': true,
      };
    }
    if (data['orderId'] == null) {
      throw const ApiException(
        'Checkout could not be confirmed. Retry this recorded order; do not start another payment.',
      );
    }
    await store.writePreference(
      'active_checkout',
      jsonEncode({...payload, 'result': data}),
    );
    return CheckoutResult.fromJson(data);
  }

  Future<Json> checkoutStatus(String orderId, String signature) => _send(
    '/api/checkout/velocity/status/${Uri.encodeComponent(orderId)}',
    extraHeaders: {'x-ticket-signature': signature},
  );

  Future<List<Json>> buyerOrders() async {
    final ownerId = user?['id']?.toString();
    final cacheKey = '${_buyerOrdersPrefix}orders';
    try {
      final raw = (await request('/api/mobile/orders?limit=50'))['orders'];
      if (raw is! List) return const [];
      final orders = raw.whereType<Json>().toList();
      await _scanStorage.write(key: cacheKey, value: jsonEncode(orders));
      return orders;
    } on ApiException catch (error) {
      final saved = ownerId == null
          ? null
          : await _scanStorage.read(key: cacheKey);
      if (ownerId != null &&
          user?['id']?.toString() == ownerId &&
          (error.status == 0 || error.status >= 500) &&
          saved != null) {
        final rows = (jsonDecode(saved) as List?)?.whereType<Json>().toList();
        if (rows != null) {
          return rows.map((row) => {...row, '_offlineCache': true}).toList();
        }
      }
      rethrow;
    }
  }

  Future<Json> buyerOrderDetail(String id) async {
    final ownerId = user?['id']?.toString();
    final cacheKey = '${_buyerOrdersPrefix}order.$id';
    try {
      final detail = await request(
        '/api/mobile/orders/${Uri.encodeComponent(id)}',
      );
      await _scanStorage.write(key: cacheKey, value: jsonEncode(detail));
      return detail;
    } on ApiException catch (error) {
      final saved = ownerId == null
          ? null
          : await _scanStorage.read(key: cacheKey);
      if (ownerId != null &&
          user?['id']?.toString() == ownerId &&
          (error.status == 0 || error.status >= 500) &&
          saved != null) {
        final detail = jsonDecode(saved);
        if (detail is Json) return {...detail, '_offlineCache': true};
      }
      rethrow;
    }
  }

  Future<OrderPage> orders({
    int offset = 0,
    String? status,
    String? query,
  }) async => OrderPage.fromJson(
    await request(
      '/api/mobile/organizer/orders?limit=25&offset=$offset${status == null ? '' : '&status=${Uri.encodeQueryComponent(status)}'}${query == null || query.isEmpty ? '' : '&q=${Uri.encodeQueryComponent(query)}'}',
    ),
  );
  Future<Json> payments() => request('/api/mobile/organizer/payments');
  Future<Json> orderDetail(String id) =>
      request('/api/mobile/organizer/orders/${Uri.encodeComponent(id)}');
  Future<Json> orderAction(String id, String action) => request(
    '/api/mobile/organizer/orders/${Uri.encodeComponent(id)}',
    body: {'action': action, if (action == 'complete') 'confirmPayment': true},
  );
  Future<Json> adminOverview({
    int recentOffset = 0,
    int recentLimit = 25,
  }) => request(
    '/api/mobile/admin/overview?recentOffset=$recentOffset&recentLimit=$recentLimit',
  );
  Future<Json> adminPayoutAction(
    String id,
    String action, {
    String? reason,
    String? proofReference,
  }) => request(
    '/api/mobile/admin/payouts/${Uri.encodeComponent(id)}',
    body: {
      'action': action,
      ...?reason == null ? null : {'reason': reason},
      ...?proofReference == null ? null : {'proofReference': proofReference},
    },
  );
  Future<Json> adminOrganizerAction(String id, String action) => request(
    '/api/mobile/admin/organizers/${Uri.encodeComponent(id)}',
    body: {'action': action},
  );
  Future<Json> notifications() => request('/api/mobile/notifications');
  Future<Json> markNotificationsRead() =>
      request('/api/mobile/notifications', body: {'all': true});
  Future<Json> scan(String code, String eventId) => request(
    '/api/mobile/organizer/scan',
    body: {'code': code, 'eventId': eventId},
  );

  Future<void> queueScan(String code, String eventId) async {
    final raw = await _scanStorage.read(key: _scanQueueKey);
    final queue = raw == null
        ? <Json>[]
        : ((jsonDecode(raw) as List?) ?? const []).whereType<Json>().toList();
    queue.add({
      'code': code,
      'eventId': eventId,
      'queuedAt': DateTime.now().toUtc().toIso8601String(),
    });
    await _scanStorage.write(
      key: _scanQueueKey,
      value: jsonEncode(queue.take(100).toList()),
    );
  }

  Future<int> pendingScanCount() async {
    final raw = await _scanStorage.read(key: _scanQueueKey);
    return raw == null ? 0 : ((jsonDecode(raw) as List?) ?? const []).length;
  }

  Future<int> syncQueuedScans() async {
    final raw = await _scanStorage.read(key: _scanQueueKey);
    final queue = raw == null
        ? <Json>[]
        : ((jsonDecode(raw) as List?) ?? const []).whereType<Json>().toList();
    final remaining = <Json>[];
    for (var index = 0; index < queue.length; index++) {
      final item = queue[index];
      try {
        await scan(item['code'].toString(), item['eventId'].toString());
      } on ApiException catch (error) {
        if (error.status == 0) {
          remaining.addAll(queue.sublist(index));
          break;
        }
      }
    }
    await _scanStorage.write(key: _scanQueueKey, value: jsonEncode(remaining));
    return remaining.length;
  }

  Future<void> signOut() async {
    ++_generation;
    final ownerId = user?['id']?.toString();
    await store.clear();
    if (ownerId != null) {
      try {
        final keys = await _scanStorage.readAll();
        for (final key in keys.keys.where(
          (key) => key.startsWith('ticketpulse.buyer.$ownerId.'),
        )) {
          await _scanStorage.delete(key: key);
        }
      } catch (_) {
        // A stale encrypted cache cannot grant server access after the token is cleared.
      }
    }
    _access = _refresh = null;
    user = null;
    biometricLockEnabled = false;
    biometricUnlocked = false;
    startupError = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _client.close();
    super.dispose();
  }
}

/// Kept as an alias for the existing organizer workspace and its tests.
typedef OrganizerApi = TicketPulseApi;
