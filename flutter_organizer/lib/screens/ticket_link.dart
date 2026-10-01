import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../design.dart';

class TicketLinkScreen extends StatelessWidget {
  const TicketLinkScreen({super.key, required this.ticketId});
  final String ticketId;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Ticket')),
    body: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Your ticket QR',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Show this code at the event entrance.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Pulse.muted),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Pulse.line),
                    ),
                    child: QrImageView(
                      data: ticketId,
                      size: 240,
                      backgroundColor: Colors.white,
                      errorStateBuilder: (context, error) => const SizedBox(
                        height: 240,
                        child: Center(child: Text('Ticket code unavailable')),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SelectableText(ticketId, textAlign: TextAlign.center),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
