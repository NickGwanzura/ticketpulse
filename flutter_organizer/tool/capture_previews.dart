// Run explicitly with flutter test tool/capture_previews.dart --update-goldens.
// All previews use synthetic data and never connect to a TicketPulse account.
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ticketpulse_organizer/data/api.dart';
import 'package:ticketpulse_organizer/main.dart';
import '../test/api_test.dart' show MemoryStore;

void main() {
  testWidgets('render sample organizer screens', (tester) async {
    final sdk = Platform.environment['FLUTTER_ROOT'];
    if (sdk == null) {
      throw StateError('Set FLUTTER_ROOT to your Flutter SDK path.');
    }
    for (final font in {
      'MonaSans': 'assets/fonts/MonaSans.ttf',
      'MaterialIcons':
          '$sdk/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
    }.entries) {
      await (FontLoader(font.key)..addFont(
            Future.value(
              ByteData.sublistView(File(font.value).readAsBytesSync()),
            ),
          ))
          .load();
    }
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final store = MemoryStore()
      ..value = jsonEncode({'accessToken': 'sample', 'refreshToken': 'sample'});
    final api = OrganizerApi(
      baseUrl: Uri.parse('https://example.com'),
      store: store,
      client: MockClient((request) async {
        final data = switch (request.url.path) {
          '/api/mobile/me' => {
            'user': {'id': 'sample', 'name': 'Alex', 'role': 'organizer'},
          },
          '/api/mobile/organizer/events' => {
            'events': [
              {
                'id': 'sample-event',
                'title': 'Harare After Hours',
                'status': 'published',
                'startsAt': '2026-09-12T17:00:00Z',
                'venue': 'The Garden',
                'city': 'Harare',
                'totalSold': 248,
                'totalCapacity': 350,
                'checkedIn': 86,
              },
              {
                'id': 'sample-event-2',
                'title': 'Sunday Social Club',
                'status': 'draft',
                'startsAt': '2026-09-20T12:00:00Z',
                'venue': 'Borrowdale',
                'city': 'Harare',
                'totalSold': 0,
                'totalCapacity': 150,
                'checkedIn': 0,
              },
            ],
          },
          '/api/mobile/organizer/orders' => {
            'hasMore': false,
            'orders': [
              {
                'id': 'TP-01042',
                'status': 'paid',
                'totalAmount': 45,
                'currency': 'USD',
                'guestName': 'Tariro M.',
                'eventTitle': 'Harare After Hours',
                'paymentMethod': 'ecocash',
                'createdAt': '2026-09-03T14:32:00Z',
              },
              {
                'id': 'TP-01041',
                'status': 'pending',
                'totalAmount': 30,
                'currency': 'USD',
                'guestName': 'Michael K.',
                'eventTitle': 'Harare After Hours',
                'paymentMethod': 'card',
                'createdAt': '2026-09-03T14:20:00Z',
              },
            ],
          },
          '/api/mobile/organizer/payments' => {
            'currency': 'USD',
            'summary': {
              'availableBalance': 2640,
              'grossRevenue': 3720,
              'platformFee': 372,
              'netRevenue': 3348,
              'paidOut': 500,
              'pendingPayouts': 208,
              'outstandingClawbacks': 0,
            },
            'payouts': [
              {
                'id': 'sample-payout',
                'status': 'processing',
                'amount': 208,
                'currency': 'USD',
                'method': 'ecocash',
                'createdAt': '2026-09-02T10:00:00Z',
              },
            ],
          },
          _ => <String, dynamic>{},
        };
        return http.Response(jsonEncode({'ok': true, ...data}), 200);
      }),
    );
    await api.restore();
    await tester.pumpWidget(TicketPulseApp(api: api));
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('../docs/preview-overview.png'),
    );
    for (final tab in {
      'Events': 'events',
      'Orders': 'orders',
      'Payments': 'payments',
      'Scan': 'scanner',
    }.entries) {
      await tester.tap(find.widgetWithText(NavigationDestination, tab.key));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(Scaffold),
        matchesGoldenFile('../docs/preview-${tab.value}.png'),
      );
    }
    await tester.tap(find.widgetWithText(NavigationDestination, 'Home'));
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('../docs/preview-overview-dark.png'),
    );
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.light;
    await api.signOut();
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('../docs/preview-sign-in.png'),
    );
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
}
