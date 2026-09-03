import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ticketpulse_organizer/data/api.dart';
import 'package:ticketpulse_organizer/design.dart';
import 'package:ticketpulse_organizer/screens/workspace.dart';
import 'api_test.dart' show MemoryStore;

void main() {
  final preview = Platform.environment['ORDER_PREVIEWS'] == '1';
  setUpAll(() async {
    if (!preview) return;
    for (final font in {
      'Manrope': 'assets/fonts/Manrope.ttf',
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
  });
  for (final role in ['admin', 'organizer']) {
    for (final size in [const Size(375, 812), const Size(812, 375)]) {
      testWidgets('$role order drilldown, actions and layout at $size', (
        tester,
      ) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final dark = role == 'organizer';
        var posted = 0;
        final api = OrganizerApi(
          baseUrl: Uri.parse('https://example.com'),
          store: MemoryStore()
            ..value = jsonEncode({
              'accessToken': 'sample',
              'refreshToken': 'sample',
            }),
          client: MockClient((request) async {
            if (request.url.path.endsWith('/me')) {
              return http.Response(
                jsonEncode({
                  'ok': true,
                  'user': {'id': 'sample', 'role': role},
                }),
                200,
              );
            }
            if (request.method == 'POST') {
              posted++;
              return http.Response(
                jsonEncode({
                  'ok': true,
                  'message': 'Tickets sent to buyer@example.com',
                }),
                200,
              );
            }
            final order = {
              'id': 'sample-order',
              'status': 'paid',
              'totalAmount': 90,
              'currency': 'USD',
              'guestName': 'Tariro Moyo',
              'buyerName': 'Tariro Moyo',
              'buyerEmail': 'buyer@example.com',
              'guestEmail': 'buyer@example.com',
              'eventTitle': 'Harare After Hours',
              'eventStartsAt': '2026-09-12T17:00:00Z',
              'eventVenue': 'The Garden · Harare',
              'createdAt': '2026-09-03T08:15:00Z',
              'paidAt': '2026-09-03T08:16:00Z',
              'paymentMethod': 'ecocash',
            };
            if (request.url.path.endsWith('/orders')) {
              return http.Response(
                jsonEncode({
                  'ok': true,
                  'orders': [order],
                  'hasMore': false,
                }),
                200,
              );
            }
            return http.Response(
              jsonEncode({
                'ok': true,
                'order': order,
                'items': [
                  {
                    'name': 'General admission',
                    'quantity': 2,
                    'unitPrice': 45,
                    'total': 90,
                  },
                ],
                'tickets': null,
                'actions': {'resend': true, 'complete': role == 'admin'},
              }),
              200,
            );
          }),
        );
        await api.restore();
        await tester.pumpWidget(
          MaterialApp(
            theme: Pulse.theme(dark ? Brightness.dark : Brightness.light),
            home: Scaffold(body: OrdersScreen(api: api)),
          ),
        );
        await tester.pumpAndSettle();
        if (preview && size.width == 375) {
          await expectLater(
            find.byType(Scaffold),
            matchesGoldenFile('../docs/orders-$role-list.png'),
          );
        }
        await tester.scrollUntilVisible(
          find.text('Details'),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Details'));
        await tester.pumpAndSettle();
        expect(find.text('Order details'), findsOneWidget);
        expect(tester.takeException(), isNull);
        if (preview && size.width == 375) {
          await expectLater(
            find.byType(Scaffold).last,
            matchesGoldenFile('../docs/orders-$role-detail.png'),
          );
        }
        await tester.scrollUntilVisible(
          find.text('Resend tickets'),
          400,
          scrollable: find.byType(Scrollable).last,
        );
        await tester.tap(find.text('Resend tickets'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Cancel'));
        await tester.pumpAndSettle();
        expect(posted, 0);
        await tester.tap(find.text('Resend tickets'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Send tickets'));
        await tester.pumpAndSettle();
        expect(posted, 1);
        expect(find.text('Tickets sent to buyer@example.com'), findsOneWidget);
        await tester.scrollUntilVisible(
          find.text('Order actions'),
          400,
          scrollable: find.byType(Scrollable).last,
        );
        expect(
          find.text('Mark payment received'),
          role == 'admin' ? findsOneWidget : findsNothing,
        );
        if (preview && size.width == 375) {
          await expectLater(
            find.byType(Scaffold).last,
            matchesGoldenFile('../docs/orders-$role-actions.png'),
          );
        }
        tester.platformDispatcher.textScaleFactorTestValue = 1.8;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        api.dispose();
      });
    }
  }
}
