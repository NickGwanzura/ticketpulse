import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ticketpulse_organizer/data/api.dart';
import 'package:ticketpulse_organizer/data/models.dart';
import 'package:ticketpulse_organizer/design.dart';
import 'package:ticketpulse_organizer/screens/overview_widgets.dart';
import 'package:ticketpulse_organizer/screens/payout_request.dart';
import 'api_test.dart' show MemoryStore;

void main() {
  Future<(OrganizerApi, List<Map<String, dynamic>>)> signedIn() async {
    final posted = <Map<String, dynamic>>[];
    final api = OrganizerApi(
      baseUrl: Uri.parse('https://example.com'),
      store: MemoryStore()
        ..value = jsonEncode({'accessToken': 'a', 'refreshToken': 'r'}),
      client: MockClient((request) async {
        if (request.url.path == '/api/mobile/me') {
          return http.Response(
            jsonEncode({
              'ok': true,
              'user': {'id': 'u', 'role': 'organizer'},
            }),
            200,
          );
        }
        if (request.url.path == '/api/mobile/organizer/payouts') {
          posted.add(jsonDecode(request.body) as Map<String, dynamic>);
          return http.Response(jsonEncode({'ok': true, 'payoutId': 'p1'}), 201);
        }
        return http.Response(jsonEncode({'ok': true}), 200);
      }),
    );
    await api.restore();
    return (api, posted);
  }

  Future<void> open(WidgetTester tester, OrganizerApi api, {Json? last}) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: Pulse.theme(Brightness.light),
        home: PayoutRequestScreen(
          api: api,
          available: 120.5,
          lastDestination: last,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('blocks amounts above the available balance', (tester) async {
    final (api, posted) = await signedIn();
    await open(
      tester,
      api,
      last: {'method': 'ecocash', 'ecocashNumber': '0771234567'},
    );
    await tester.enterText(find.widgetWithText(TextFormField, 'Amount'), '500');
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
    expect(find.textContaining('You can request up to'), findsOneWidget);
    expect(posted, isEmpty);
    api.dispose();
  });

  testWidgets('sends an EcoCash request prefilled from the last payout', (
    tester,
  ) async {
    final (api, posted) = await signedIn();
    await open(
      tester,
      api,
      last: {'method': 'ecocash', 'ecocashNumber': '0771234567'},
    );
    expect(find.text('Request USD 120.50'), findsOneWidget);
    await tester.tap(find.text('Half'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
    expect(posted.single, {
      'amount': 60.25,
      'currency': 'USD',
      'method': 'ecocash',
      'ecocashNumber': '0771234567',
    });
    expect(find.text('Payout requested'), findsOneWidget);
    api.dispose();
  });

  testWidgets('requires bank details for a bank transfer', (tester) async {
    final (api, posted) = await signedIn();
    await open(tester, api);
    await tester.tap(find.text('USD bank transfer'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byType(FilledButton));
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
    expect(find.text('Enter the bank name'), findsOneWidget);
    expect(posted, isEmpty);
    api.dispose();
  });

  test('countdown wording', () {
    final now = DateTime(2026, 10, 4, 12);
    OrganizerEvent at(DateTime start, [DateTime? end]) =>
        OrganizerEvent.fromJson({
          'id': 'e',
          'title': 'Show',
          'startsAt': start.toUtc().toIso8601String(),
          if (end != null) 'endsAt': end.toUtc().toIso8601String(),
        });
    expect(
      countdownLabel(at(now.add(const Duration(minutes: 20))), now),
      'Starts in 20 min',
    );
    expect(
      countdownLabel(at(now.add(const Duration(hours: 2, minutes: 40))), now),
      'Starts in 2 h 40 min',
    );
    expect(
      countdownLabel(at(now.add(const Duration(hours: 30))), now),
      'Starts tomorrow',
    );
    expect(
      countdownLabel(
        at(
          now.subtract(const Duration(hours: 1)),
          now.add(const Duration(hours: 3)),
        ),
        now,
      ),
      'Happening now',
    );
  });
}
