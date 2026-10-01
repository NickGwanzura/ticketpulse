import 'package:flutter_test/flutter_test.dart';
import 'package:ticketpulse/deep_links.dart';

void main() {
  test('parses supported custom-scheme and verified web order links', () {
    final custom = parseTicketPulseLink(Uri.parse('ticketpulse://orders/abc'));
    expect(custom?.kind, TicketPulseLinkKind.order);
    expect(custom?.id, 'abc');

    final web = parseTicketPulseLink(
      Uri.parse('https://ticketpulse.tech/tickets/ticket-42?source=email'),
    );
    expect(web?.kind, TicketPulseLinkKind.ticket);
    expect(web?.id, 'ticket-42');
  });

  test('rejects unrelated hosts, routes, and malformed paths', () {
    expect(
      parseTicketPulseLink(Uri.parse('https://example.com/orders/1')),
      isNull,
    );
    expect(
      parseTicketPulseLink(Uri.parse('https://ticketpulse.tech/events/1')),
      isNull,
    );
    expect(parseTicketPulseLink(Uri.parse('ticketpulse://orders/')), isNull);
    expect(
      parseTicketPulseLink(Uri.parse('ticketpulse://orders/1/extra')),
      isNull,
    );
  });
}
