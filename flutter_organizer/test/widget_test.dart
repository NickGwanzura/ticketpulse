import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ticketpulse_organizer/data/api.dart';
import 'package:ticketpulse_organizer/main.dart';
import 'api_test.dart' show MemoryStore;

void main() {
  testWidgets('sign-in validates empty fields on a small phone', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = OrganizerApi(
      baseUrl: Uri.parse('https://example.com'),
      store: MemoryStore(),
    );
    await api.restore();
    await tester.pumpWidget(TicketPulseApp(api: api));
    await tester.tap(find.text('Sign in'));
    await tester.pump();
    expect(find.text('Enter your email address'), findsOneWidget);
    expect(find.text('Enter your password'), findsOneWidget);
    expect(tester.takeException(), isNull);
    api.dispose();
  });
  for (final size in [const Size(375, 812), const Size(812, 375)]) {
    testWidgets('organizer screens support $size and large text', (
      tester,
    ) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.8;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      final store = MemoryStore()
        ..value = jsonEncode({'accessToken': 'a', 'refreshToken': 'r'});
      final api = OrganizerApi(
        baseUrl: Uri.parse('https://example.com'),
        store: store,
        client: MockClient((request) async {
          final body = switch (request.url.path) {
            '/api/mobile/me' => {
              'user': {'id': 'u', 'name': 'Alex', 'role': 'organizer'},
            },
            '/api/mobile/organizer/events' => {
              'events': [
                {
                  'id': 'event',
                  'title': 'TicketPulse Summer Sessions',
                  'status': 'published',
                  'totalSold': 34,
                  'totalCapacity': 100,
                  'checkedIn': 4,
                },
              ],
            },
            '/api/mobile/organizer/orders' => {'orders': [], 'hasMore': false},
            '/api/mobile/organizer/payments' => {
              'summary': {'availableBalance': 100.25},
              'currency': 'USD',
              'payouts': [],
            },
            _ => <String, dynamic>{},
          };
          return http.Response(jsonEncode({'ok': true, ...body}), 200);
        }),
      );
      await api.restore();
      await tester.pumpWidget(TicketPulseApp(api: api));
      await tester.pumpAndSettle();
      expect(find.text('Welcome, Alex'), findsOneWidget);
      expect(tester.takeException(), isNull);
      for (final destination in ['Events', 'Orders', 'Payments', 'Scan']) {
        await tester.tap(
          find.widgetWithText(NavigationDestination, destination),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      }
      await tester.pumpWidget(const SizedBox());
      api.dispose();
    });
  }
}
