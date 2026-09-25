// Screenshot regression tests for the main organizer screens.
//
// Golden images depend on fonts and the rendering platform, so these only run
// when UI_GOLDENS=1 (like ORDER_PREVIEWS in order_detail_test.dart):
//
//   UI_GOLDENS=1 flutter test test/screens_golden_test.dart               # compare
//   UI_GOLDENS=1 flutter test test/screens_golden_test.dart --update-goldens  # re-record
//
// Baselines live in test/goldens/ and double as up-to-date app screenshots.
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ticketpulse_organizer/data/api.dart';
import 'package:ticketpulse_organizer/design.dart';
import 'package:ticketpulse_organizer/main.dart';
import 'package:ticketpulse_organizer/screens/payout_request.dart';
import 'api_test.dart' show MemoryStore;

final _enabled = Platform.environment['UI_GOLDENS'] == '1';

Future<void> _loadFonts() async {
  for (final font in {
    'Inter': 'assets/fonts/Inter.ttf',
    'MaterialIcons':
        '${Platform.environment['FLUTTER_ROOT']}/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  }.entries) {
    await (FontLoader(font.key)..addFont(
          Future.value(
            ByteData.sublistView(File(font.value).readAsBytesSync()),
          ),
        ))
        .load();
  }
}

// Fixed "now" offsets keep countdown text stable between runs.
final _soon = DateTime.now().add(const Duration(hours: 5, minutes: 30)).toUtc();

Map<String, dynamic> _responseFor(String path, {String scanStatus = 'new'}) =>
    switch (path) {
      '/api/mobile/me' => {
        'user': {
          'id': 'u',
          'name': 'Alex Moyo',
          'email': 'alex@example.com',
          'role': 'organizer',
        },
      },
      '/api/mobile/organizer/events' => {
        'events': [
          {
            'id': 'e1',
            'slug': 'harare-sunset-sessions',
            'title': 'Harare Sunset Sessions',
            'status': 'published',
            'category': 'Concert',
            'venue': 'Old Hararians',
            'city': 'Harare',
            'startsAt': _soon.toIso8601String(),
            'totalSold': 134,
            'totalCapacity': 300,
            'checkedIn': 12,
            'tiers': [
              {
                'name': 'General Admission',
                'price': 15,
                'capacity': 250,
                'sold': 118,
              },
              {'name': 'VIP', 'price': 40, 'capacity': 50, 'sold': 16},
            ],
          },
          {
            'id': 'e2',
            'title': 'Sunday Jazz Brunch at the Gardens',
            'status': 'sold_out',
            'category': 'Food & Drink',
            'venue': 'Borrowdale Gardens',
            'city': 'Harare',
            'startsAt': '2026-10-18T09:00:00Z',
            'totalSold': 80,
            'totalCapacity': 80,
            'checkedIn': 0,
          },
          {
            'id': 'e3',
            'title': 'Winter Wine Tasting',
            'status': 'published',
            'category': 'Food & Drink',
            'venue': 'Meikles Hotel',
            'city': 'Harare',
            'startsAt': '2026-06-20T17:00:00Z',
            'endsAt': '2026-06-20T21:00:00Z',
            'totalSold': 64,
            'totalCapacity': 70,
            'checkedIn': 58,
          },
        ],
      },
      '/api/mobile/organizer/orders' => {
        'orders': [
          {
            'id': 'o1',
            'status': 'paid',
            'totalAmount': 30,
            'currency': 'USD',
            'eventTitle': 'Harare Sunset Sessions',
            'guestName': 'Tendai Moyo',
            'paymentMethod': 'velocity-ecocash',
            'createdAt': '2026-09-24T10:00:00Z',
          },
        ],
        'hasMore': false,
      },
      '/api/mobile/organizer/payments' => {
        'currency': 'USD',
        'summary': {
          'availableBalance': 1284.5,
          'grossRevenue': 2010,
          'platformFee': 120.6,
          'netRevenue': 1889.4,
          'paidOut': 604.9,
          'pendingPayouts': 0,
          'outstandingClawbacks': 0,
        },
        'activePayout': false,
        'lastDestination': {'method': 'ecocash', 'ecocashNumber': '0771234567'},
        'payouts': [
          {
            'id': 'p1',
            'amount': 604.9,
            'currency': 'USD',
            'status': 'paid',
            'method': 'ecocash',
            'createdAt': '2026-09-01T10:00:00Z',
            'processedAt': '2026-09-02T08:00:00Z',
          },
        ],
      },
      '/api/mobile/organizer/scan' => {
        'status': scanStatus,
        'ticket': {
          'eventTitle': 'Harare Sunset Sessions',
          'tierName': 'General Admission',
        },
      },
      _ => <String, dynamic>{},
    };

OrganizerApi _api({String scanStatus = 'new'}) => OrganizerApi(
  baseUrl: Uri.parse('https://example.com'),
  store: MemoryStore()
    ..value = jsonEncode({'accessToken': 'a', 'refreshToken': 'r'}),
  client: MockClient(
    (request) async => http.Response(
      jsonEncode({
        'ok': true,
        ..._responseFor(request.url.path, scanStatus: scanStatus),
      }),
      200,
    ),
  ),
);

void main() {
  setUpAll(() async {
    if (_enabled) await _loadFonts();
  });

  Future<OrganizerApi> boot(
    WidgetTester tester, {
    String scanStatus = 'new',
  }) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = _api(scanStatus: scanStatus);
    await api.restore();
    await tester.pumpWidget(TicketPulseApp(api: api));
    await tester.pumpAndSettle();
    return api;
  }

  Future<void> golden(WidgetTester tester, String name) => expectLater(
    find.byType(MaterialApp).first,
    matchesGoldenFile('goldens/$name.png'),
  );

  Future<void> tab(WidgetTester tester, String label) async {
    await tester.tap(find.text(label).last);
    await tester.pumpAndSettle();
  }

  testWidgets('home', skip: !_enabled, (tester) async {
    final api = await boot(tester);
    await golden(tester, 'home');
    api.dispose();
  });

  testWidgets('events and event page', skip: !_enabled, (tester) async {
    final api = await boot(tester);
    await tab(tester, 'Events');
    await golden(tester, 'events');
    await tester.tap(find.text('Harare Sunset Sessions').first);
    await tester.pumpAndSettle();
    await golden(tester, 'event-detail');
    await tester.drag(find.byType(ListView).last, const Offset(0, -700));
    await tester.pumpAndSettle();
    await golden(tester, 'event-detail-sales');
    api.dispose();
  });

  testWidgets('orders', skip: !_enabled, (tester) async {
    final api = await boot(tester);
    await tab(tester, 'Orders');
    await golden(tester, 'orders');
    api.dispose();
  });

  testWidgets('payments and payout request', skip: !_enabled, (tester) async {
    final api = await boot(tester);
    await tab(tester, 'Payments');
    await golden(tester, 'payments');
    await tester.tap(find.text('Request payout'));
    await tester.pumpAndSettle();
    await golden(tester, 'payout-request');
    await tester.tap(find.byType(FilledButton).last);
    await tester.pumpAndSettle();
    await golden(tester, 'payout-requested');
    api.dispose();
  });

  for (final status in ['new', 'duplicate']) {
    testWidgets('scanner $status', skip: !_enabled, (tester) async {
      final api = await boot(tester, scanStatus: status);
      await tab(tester, 'Scan');
      if (status == 'new') await golden(tester, 'scanner');
      await tester.enterText(find.byType(TextField).last, 'TICKET-123');
      await tester.ensureVisible(find.text('Check ticket'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Check ticket'));
      await tester.pumpAndSettle();
      await golden(tester, 'scan-$status');
      api.dispose();
    });
  }

  testWidgets('loading', skip: !_enabled, (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: Pulse.theme(Brightness.light),
        home: const BrandLoading(),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));
    await golden(tester, 'loading');
  });

  testWidgets('payout request screen alone', skip: !_enabled, (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = _api();
    await api.restore();
    await tester.pumpWidget(
      MaterialApp(
        theme: Pulse.theme(Brightness.light),
        home: PayoutRequestScreen(api: api, available: 1284.5),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('USD bank transfer'));
    await tester.pumpAndSettle();
    await golden(tester, 'payout-request-bank');
    api.dispose();
  });
}
