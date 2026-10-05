import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ticketpulse/data/api.dart';

class _Store implements SessionStore {
  String? value;
  final Map<String, String> preferences = {};
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String value) async => this.value = value;
  @override
  Future<String?> readPreference(String key) async => preferences[key];
  @override
  Future<void> writePreference(String key, String value) async =>
      preferences[key] = value;
  @override
  Future<void> clear() async => value = null;
}

http.Response _json(Map<String, dynamic> body, [int status = 200]) =>
    http.Response(jsonEncode(body), status);

TicketPulseApi _admin(
  List<http.Request> seen,
  http.Response Function(http.Request) respond,
) => TicketPulseApi(
  baseUrl: Uri.parse('https://example.test'),
  store: _Store(),
  client: MockClient((request) async {
    if (request.url.path.endsWith('/login')) {
      return _json({
        'ok': true,
        'user': {'id': 'a1', 'role': 'admin'},
        'accessToken': 'access',
        'refreshToken': 'refresh',
      });
    }
    seen.add(request);
    return respond(request);
  }),
);

void main() {
  test('support search sends the admin bearer token and encodes the query', () async {
    final seen = <http.Request>[];
    final api = _admin(
      seen,
      (_) => _json({
        'ok': true,
        'orders': [
          {'id': 'o1', 'ref': 'O1', 'status': 'pending'},
        ],
      }),
    );
    await api.signIn('admin@example.com', 'secret');
    final rows = await api.adminOrderSearch(' +263 78 ', status: 'pending');
    expect(rows.single['id'], 'o1');
    expect(seen.single.url.path, '/api/mobile/admin/orders');
    expect(seen.single.url.queryParameters['q'], '+263 78');
    expect(seen.single.url.queryParameters['status'], 'pending');
    expect(seen.single.headers['Authorization'], 'Bearer access');
  });

  test('complete and send posts the confirmation and trimmed payment reference', () async {
    final seen = <http.Request>[];
    final api = _admin(seen, (_) => _json({'ok': true, 'message': 'Order completed'}));
    await api.signIn('admin@example.com', 'secret');
    await api.orderAction('o1', 'complete_and_send', providerReference: '  EC1234567 ');
    final body = jsonDecode(seen.single.body) as Map<String, dynamic>;
    expect(body, {
      'action': 'complete_and_send',
      'confirmPayment': true,
      'providerReference': 'EC1234567',
    });
  });

  test('resend does not claim payment confirmation or send a reference', () async {
    final seen = <http.Request>[];
    final api = _admin(seen, (_) => _json({'ok': true}));
    await api.signIn('admin@example.com', 'secret');
    await api.orderAction('o1', 'resend');
    expect(jsonDecode(seen.single.body), {'action': 'resend'});
  });

  test('a rejected completion surfaces the server reason', () async {
    final api = _admin(
      <http.Request>[],
      (_) => _json({'ok': false, 'error': 'Payment reference required'}, 409),
    );
    await api.signIn('admin@example.com', 'secret');
    expect(
      api.orderAction('o1', 'complete_and_send'),
      throwsA(
        isA<ApiException>().having((e) => e.message, 'message', 'Payment reference required'),
      ),
    );
  });
}
