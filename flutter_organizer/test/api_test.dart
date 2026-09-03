import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ticketpulse_organizer/data/api.dart';

class MemoryStore implements SessionStore {
  String? value;
  bool failClear = false;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String value) async {
    this.value = value;
  }

  @override
  Future<void> clear() async {
    if (failClear) throw Exception('Storage locked');
    value = null;
  }
}

http.Response json(Map<String, dynamic> value, [int status = 200]) =>
    http.Response(jsonEncode(value), status);
const organizer = {'id': 'u1', 'role': 'organizer', 'name': 'Alex'};
void main() {
  test(
    'signs in, stores token pair, and sends bearer headers for organizer sales',
    () async {
      final store = MemoryStore();
      final api = OrganizerApi(
        baseUrl: Uri.parse('https://example.com'),
        store: store,
        client: MockClient((request) async {
          if (request.url.path.endsWith('/login')) {
            expect(jsonDecode(request.body), {
              'email': 'alex@example.com',
              'password': 'secret',
            });
            return json({
              'ok': true,
              'user': organizer,
              'accessToken': 'access',
              'refreshToken': 'refresh',
            });
          }
          expect(request.url.path, '/api/mobile/organizer/orders');
          expect(request.headers['Authorization'], 'Bearer access');
          return json({'ok': true, 'orders': [], 'hasMore': false});
        }),
      );
      await api.signIn(' alex@example.com ', 'secret');
      expect(api.user?['name'], 'Alex');
      expect(jsonDecode(store.value!)['refreshToken'], 'refresh');
      expect((await api.orders()).hasMore, false);
      await api.signOut();
      expect(store.value, isNull);
      expect(api.user, isNull);
      api.dispose();
    },
  );
  test(
    'concurrent expired requests share one refresh and replay once',
    () async {
      final store = MemoryStore()
        ..value = jsonEncode({'accessToken': 'old', 'refreshToken': 'refresh'});
      var refreshes = 0;
      final api = OrganizerApi(
        baseUrl: Uri.parse('https://example.com'),
        store: store,
        client: MockClient((request) async {
          if (request.url.path.endsWith('/me')) {
            return json({'ok': true, 'user': organizer});
          }
          if (request.url.path.endsWith('/refresh')) {
            refreshes++;
            await Future<void>.delayed(const Duration(milliseconds: 10));
            return json({
              'ok': true,
              'accessToken': 'new',
              'refreshToken': 'rotated',
            });
          }
          if (request.headers['Authorization'] == 'Bearer old') {
            return json({'ok': false, 'error': 'Expired'}, 401);
          }
          expect(request.headers['Authorization'], 'Bearer new');
          return json({'ok': true, 'events': []});
        }),
      );
      await api.restore();
      await Future.wait([api.events(), api.events()]);
      expect(refreshes, 1);
      expect(jsonDecode(store.value!)['refreshToken'], 'rotated');
      api.dispose();
    },
  );
  test('invalid refresh clears the session', () async {
    final store = MemoryStore()
      ..value = jsonEncode({'accessToken': 'old', 'refreshToken': 'bad'});
    final api = OrganizerApi(
      baseUrl: Uri.parse('https://example.com'),
      store: store,
      client: MockClient(
        (_) async => json({'ok': false, 'error': 'Expired'}, 401),
      ),
    );
    await api.restore();
    expect(api.user, isNull);
    expect(store.value, isNull);
    expect(api.startupError, isNull);
    api.dispose();
  });
  test(
    'a network outage preserves saved credentials and offers startup retry',
    () async {
      final store = MemoryStore()
        ..value = jsonEncode({'accessToken': 'old', 'refreshToken': 'refresh'});
      final api = OrganizerApi(
        baseUrl: Uri.parse('https://example.com'),
        store: store,
        client: MockClient((_) async => throw http.ClientException('offline')),
      );
      await api.restore();
      expect(api.startupError, contains('connect'));
      expect(store.value, isNotNull);
      api.dispose();
    },
  );
  test('buyer accounts cannot establish an organizer session', () async {
    final store = MemoryStore();
    final api = OrganizerApi(
      baseUrl: Uri.parse('https://example.com'),
      store: store,
      client: MockClient(
        (_) async => json({
          'ok': true,
          'user': {'role': 'attendee'},
          'accessToken': 'a',
          'refreshToken': 'r',
        }),
      ),
    );
    await expectLater(
      api.signIn('buyer@example.com', 'password'),
      throwsA(isA<ApiException>()),
    );
    expect(api.user, isNull);
    expect(store.value, isNull);
    api.dispose();
  });
  test(
    'sign-out storage failures remain retryable without pretending credentials were cleared',
    () async {
      final store = MemoryStore()
        ..value = jsonEncode({'accessToken': 'a', 'refreshToken': 'r'});
      final api = OrganizerApi(
        baseUrl: Uri.parse('https://example.com'),
        store: store,
        client: MockClient((_) async => json({'ok': true, 'user': organizer})),
      );
      await api.restore();
      store.failClear = true;
      await expectLater(api.signOut(), throwsException);
      expect(api.user, isNotNull);
      store.failClear = false;
      await api.signOut();
      expect(store.value, isNull);
      api.dispose();
    },
  );
  test('scan validation errors are not retried as admission success', () async {
    final store = MemoryStore()
      ..value = jsonEncode({'accessToken': 'a', 'refreshToken': 'r'});
    var scans = 0;
    final api = OrganizerApi(
      baseUrl: Uri.parse('https://example.com'),
      store: store,
      client: MockClient((request) async {
        if (request.url.path.endsWith('/me')) {
          return json({'ok': true, 'user': organizer});
        }
        scans++;
        expect(jsonDecode(request.body), {
          'code': 'ticket',
          'eventId': 'event',
        });
        return json({
          'ok': false,
          'error': 'This ticket belongs to a different event',
        }, 400);
      }),
    );
    await api.restore();
    await expectLater(
      api.scan('ticket', 'event'),
      throwsA(isA<ApiException>()),
    );
    expect(scans, 1);
    api.dispose();
  });
}
