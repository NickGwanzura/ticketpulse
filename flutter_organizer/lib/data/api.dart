import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'models.dart';

class ApiException implements Exception {
  const ApiException(this.message, [this.status = 0]);
  final String message;
  final int status;
  @override
  String toString() => message;
}

abstract class SessionStore {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> clear();
}

class SecureSessionStore implements SessionStore {
  SecureSessionStore(this.origin);
  final String origin;
  final _storage = const FlutterSecureStorage();
  String get _key => 'ticketpulse.organizer.session.$origin';
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);
  @override
  Future<void> clear() => _storage.delete(key: _key);
}

class OrganizerApi extends ChangeNotifier {
  OrganizerApi({
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
  String? _access, _refresh;
  Future<void>? _refreshing;
  int _generation = 0;

  String get _scanQueueKey => 'ticketpulse.organizer.scan-queue.$baseUrl';

  Future<Json> _send(String path, {Json? body, String? token}) async {
    try {
      final headers = <String, String>{
        'Accept': 'application/json',
        if (body != null) 'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
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
    notifyListeners();
    try {
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

  Future<void> signIn(String email, String password) async {
    final generation = ++_generation;
    final data = await _send(
      '/api/mobile/auth/login',
      body: {'email': email.trim(), 'password': password},
    );
    final profile = data['user'] as Json;
    if (!['organizer', 'admin'].contains(profile['role'])) {
      throw const ApiException(
        'Sign in with an organizer account. Set up your organizer profile on the website.',
        403,
      );
    }
    await _savePair(data, generation);
    user = profile;
    startupError = null;
    notifyListeners();
  }

  Future<void> _loadUser() async {
    final profile = (await request('/api/mobile/me'))['user'] as Json;
    if (!['organizer', 'admin'].contains(profile['role'])) {
      throw const ApiException('Organizer access required.', 403);
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
    await store.clear();
    _access = _refresh = null;
    user = null;
    startupError = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _client.close();
    super.dispose();
  }
}
