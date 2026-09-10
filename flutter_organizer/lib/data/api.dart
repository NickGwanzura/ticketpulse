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

class ScanQueueSyncResult {
  const ScanQueueSyncResult({
    required this.pending,
    required this.rejected,
    required this.synced,
    required this.duplicates,
  });

  final int pending;
  final int rejected;
  final int synced;
  final int duplicates;

  int get totalRemaining => pending + rejected;
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

  Future<Json> _send(
    String path, {
    Json? body,
    String? token,
    String method = 'GET',
  }) async {
    try {
      final headers = <String, String>{
        'Accept': 'application/json',
        if (body != null) 'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };
      final uri = baseUrl.resolve(path);
      final encoded = body == null ? null : jsonEncode(body);
      final effectiveMethod = body != null && method == 'GET' ? 'POST' : method;
      final response = await switch (effectiveMethod) {
        'PATCH' => _client.patch(uri, headers: headers, body: encoded),
        'POST' => _client.post(uri, headers: headers, body: encoded),
        _ => _client.get(uri, headers: headers),
      }.timeout(const Duration(seconds: 20));
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

  Future<Json> request(String path, {Json? body, String method = 'GET'}) async {
    final generation = _generation;
    final token = _access;
    if (token == null) throw const ApiException('Please sign in again.', 401);
    try {
      return await _send(path, body: body, token: token, method: method);
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
        return await _send(path, body: body, token: _access, method: method);
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

  Future<Json> eventMonitor(String id) => request(
    '/api/mobile/organizer/events/${Uri.encodeComponent(id)}/monitor',
  );

  Future<OrganizerEvent> createEvent({
    required String title,
    required String category,
    required String venue,
    required String city,
    required String country,
    String? address,
    String? description,
    required DateTime startsAt,
    DateTime? endsAt,
  }) async {
    final data = await request(
      '/api/mobile/organizer/events',
      body: {
        'title': title,
        'category': category,
        'venue': venue,
        'city': city,
        'country': country,
        'address': address,
        'description': description,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'endsAt': endsAt?.toUtc().toIso8601String(),
      },
    );
    final event = data['event'];
    if (event is! Json) {
      throw const ApiException('Event was created but could not be loaded.');
    }
    return OrganizerEvent.fromJson(event);
  }

  Future<OrganizerEvent> updateEvent(
    String id, {
    required String title,
    required String category,
    required String venue,
    required String city,
    required String country,
    String? address,
    String? description,
    required DateTime startsAt,
    DateTime? endsAt,
  }) async {
    final data = await request(
      '/api/mobile/organizer/events/${Uri.encodeComponent(id)}',
      method: 'PATCH',
      body: {
        'title': title,
        'category': category,
        'venue': venue,
        'city': city,
        'country': country,
        'address': address,
        'description': description,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'endsAt': endsAt?.toUtc().toIso8601String(),
      },
    );
    final event = data['event'];
    if (event is! Json) {
      throw const ApiException('Event was saved but could not be loaded.');
    }
    return OrganizerEvent.fromJson(event);
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
  Future<Json> orderAction(
    String id,
    String action, {
    String? paymentRef,
    String? note,
  }) => request(
    '/api/mobile/organizer/orders/${Uri.encodeComponent(id)}',
    body: {
      'action': action,
      if (action == 'complete') 'confirmPayment': true,
      if (paymentRef != null && paymentRef.trim().isNotEmpty)
        'paymentRef': paymentRef.trim(),
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    },
  );
  Future<Json> supportCaseAction(
    String id,
    String action, {
    String? subject,
    String? priority,
    String? note,
  }) => request(
    '/api/mobile/organizer/orders/${Uri.encodeComponent(id)}',
    body: {
      'action': action,
      ...?subject == null ? null : {'subject': subject},
      ...?priority == null ? null : {'priority': priority},
      ...?note == null ? null : {'note': note},
    },
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
    final queue = await _readScanQueue();
    if (queue.length >= 100) {
      throw const ApiException(
        'The offline scan queue is full. Connect and sync before scanning more tickets.',
      );
    }
    final now = DateTime.now().toUtc();
    queue.add({
      'id': now.microsecondsSinceEpoch.toString(),
      'code': code,
      'eventId': eventId,
      'queuedAt': now.toIso8601String(),
      'state': 'pending',
      'attempts': 0,
    });
    await _writeScanQueue(queue);
  }

  Future<int> pendingScanCount() async {
    return (await _readScanQueue()).length;
  }

  Future<void> discardRejectedScans() async {
    final queue = await _readScanQueue();
    await _writeScanQueue(
      queue.where((item) => item['state'] != 'rejected').toList(),
    );
  }

  Future<ScanQueueSyncResult> syncQueuedScans() async {
    final queue = await _readScanQueue();
    var synced = 0;
    var duplicates = 0;
    var stoppedForConnection = false;
    final remaining = <Json>[];
    for (final item in queue) {
      if (item['state'] == 'rejected' || stoppedForConnection) {
        remaining.add(item);
        continue;
      }
      final code = item['code']?.toString() ?? '';
      final eventId = item['eventId']?.toString() ?? '';
      if (code.isEmpty || eventId.isEmpty) {
        remaining.add({
          ...item,
          'state': 'rejected',
          'lastError': 'Saved scan data is incomplete.',
        });
        continue;
      }
      try {
        final result = await scan(code, eventId);
        if (result['status'] == 'duplicate') {
          duplicates++;
        } else {
          synced++;
        }
      } on ApiException catch (error) {
        final retryable =
            error.status == 0 || error.status == 429 || error.status >= 500;
        if (retryable || error.status == 401 || error.status == 403) {
          remaining.add(item);
          stoppedForConnection = true;
          if (error.status == 401 || error.status == 403) rethrow;
        } else {
          remaining.add({
            ...item,
            'state': 'rejected',
            'lastError': error.message,
            'lastAttemptAt': DateTime.now().toUtc().toIso8601String(),
            'attempts': number(item['attempts']).toInt() + 1,
          });
        }
      }
    }
    await _writeScanQueue(remaining);
    final rejected = remaining
        .where((item) => item['state'] == 'rejected')
        .length;
    return ScanQueueSyncResult(
      pending: remaining.length - rejected,
      rejected: rejected,
      synced: synced,
      duplicates: duplicates,
    );
  }

  Future<List<Json>> _readScanQueue() async {
    final raw = await _scanStorage.read(key: _scanQueueKey);
    if (raw == null || raw.isEmpty) return <Json>[];
    try {
      return ((jsonDecode(raw) as List?) ?? const [])
          .whereType<Json>()
          .toList();
    } catch (_) {
      throw const ApiException(
        'Saved offline scans could not be read. Contact TicketPulse support before clearing app data.',
      );
    }
  }

  Future<void> _writeScanQueue(List<Json> queue) async {
    await _scanStorage.write(key: _scanQueueKey, value: jsonEncode(queue));
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
