import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../design.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({
    super.key,
    required this.api,
    required this.events,
    this.initialEvent,
    required this.onScanned,
  });
  final OrganizerApi api;
  final List<OrganizerEvent> events;
  final OrganizerEvent? initialEvent;
  final VoidCallback onScanned;
  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen>
    with WidgetsBindingObserver {
  final _manual = TextEditingController();
  final _camera = MobileScannerController(
    autoStart: false,
    formats: const [BarcodeFormat.qrCode],
  );
  OrganizerEvent? _event;
  bool _cameraOpen = false, _busy = false, _needsReset = false;
  int _queuedScans = 0;
  String? _message;
  String _outcome = '';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final eligible = widget.events.where((e) => e.canScan);
    _event =
        eligible.where((e) => e.id == widget.initialEvent?.id).firstOrNull ??
        eligible.firstOrNull;
    _syncQueue();
  }

  Future<void> _syncQueue() async {
    try {
      final remaining = await widget.api.syncQueuedScans();
      if (mounted) setState(() => _queuedScans = remaining);
    } catch (_) {}
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _manual.dispose();
    _camera.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_cameraOpen) return;
    if (state == AppLifecycleState.resumed && !_busy && !_needsReset) {
      _startCamera();
    } else if (state != AppLifecycleState.resumed) {
      _camera.stop();
    }
  }

  Future<void> _startCamera() async {
    try {
      await _camera.start();
    } catch (_) {
      if (mounted) {
        setState(() {
          _message =
              'Camera unavailable. Allow camera access in Settings, or enter the ticket code below.';
          _outcome = 'error';
        });
      }
    }
  }

  Future<void> _scan(String raw) async {
    final code = raw.trim();
    if (_busy || _needsReset || _event == null) return;
    if (code.isEmpty) {
      setState(() {
        _outcome = 'error';
        _message = 'Enter a ticket code or scan a QR code.';
      });
      return;
    }
    if (code.length > 2000) {
      setState(() {
        _outcome = 'error';
        _message = 'Ticket code is too long.';
      });
      return;
    }
    setState(() {
      _busy = true;
      _needsReset = true;
      _message = null;
    });
    try {
      if (_cameraOpen) await _camera.stop();
      final result = await widget.api.scan(code, _event!.id);
      if (!mounted) return;
      final duplicate = result['status'] == 'duplicate';
      final ticket = result['ticket'];
      if (ticket is! Json) {
        throw const ApiException(
          'The server returned an incomplete scan result. Scan the ticket again.',
        );
      }
      setState(() {
        _outcome = duplicate ? 'duplicate' : 'new';
        _message =
            '${duplicate ? 'Already checked in — do not admit again.' : 'Valid ticket — welcome in!'}\n${ticket['eventTitle']} · ${ticket['tierName']}';
      });
      HapticFeedback.mediumImpact();
      widget.onScanned();
    } catch (e) {
      if (mounted) {
        if (e is ApiException && e.status == 0) {
          await widget.api.queueScan(code, _event!.id);
          final count = await widget.api.pendingScanCount();
          if (!mounted) return;
          setState(() {
            _queuedScans = count;
            _outcome = 'queued';
            _message =
                'Connection unavailable. Scan saved for later verification.\n$count scan${count == 1 ? '' : 's'} pending.';
          });
          return;
        }
        setState(() {
          _outcome = 'error';
          _message = e is ApiException && e.status == 0
              ? '${e.message}\nEntry is unconfirmed. Check the ticket again when connected.'
              : '$e';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final eligible = widget.events.where((e) => e.canScan).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
      children: [
        const Eyebrow('At the door'),
        const SizedBox(height: 10),
        Text(
          'Welcome them in.',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        const Text(
          'Check tickets online. If the connection drops, scans are saved as unconfirmed and retried when you reconnect.',
        ),
        const SizedBox(height: 24),
        if (eligible.isEmpty)
          const Text(
            'No live events to scan. Publish an event on TicketPulse and refresh your events.',
          ),
        if (eligible.isNotEmpty) ...[
          DropdownButtonFormField<String>(
            initialValue: _event?.id,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Event'),
            items: eligible
                .map(
                  (e) => DropdownMenuItem(
                    value: e.id,
                    child: Text(
                      e.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            onChanged: _busy || _needsReset
                ? null
                : (id) => setState(() {
                    _event = eligible.firstWhere((e) => e.id == id);
                    _message = null;
                  }),
          ),
          const SizedBox(height: 20),
          if (_queuedScans > 0)
            Card(
              color: Theme.of(context).colorScheme.tertiaryContainer,
              child: ListTile(
                leading: const Icon(Icons.sync_problem_outlined),
                title: Text(
                  '$_queuedScans scan${_queuedScans == 1 ? '' : 's'} pending',
                ),
                subtitle: const Text(
                  'These entries are unconfirmed until the server verifies them.',
                ),
                trailing: IconButton(
                  tooltip: 'Sync scans',
                  onPressed: _syncQueue,
                  icon: const Icon(Icons.sync),
                ),
              ),
            ),
          if (_cameraOpen)
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: SizedBox(
                height: 260,
                child: MobileScanner(
                  controller: _camera,
                  errorBuilder: (context, error) => const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Text(
                        'Camera unavailable. Enable camera permission in Settings or enter a code below.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                  onDetect: (capture) {
                    final code = capture.barcodes.firstOrNull?.rawValue;
                    if (code != null) _scan(code);
                  },
                ),
              ),
            ),
          if (!_cameraOpen)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Pulse.navy,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFF35526E)),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(
                      Icons.qr_code_scanner,
                      size: 64,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'A warm welcome. One quick scan.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Point your camera at a guest’s ticket.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFFB5C9DA), fontSize: 12),
                  ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: Pulse.orange,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _busy || _needsReset
                        ? null
                        : () {
                            setState(() => _cameraOpen = true);
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              if (mounted) _startCamera();
                            });
                          },
                    icon: const Icon(Icons.camera_alt_outlined, size: 18),
                    label: const Text('Open camera'),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 24),
          const Eyebrow('Or enter a ticket code'),
          const SizedBox(height: 12),
          TextField(
            controller: _manual,
            enabled: !_busy && !_needsReset,
            maxLength: 2000,
            decoration: const InputDecoration(
              labelText: 'Ticket code or verification link',
              counterText: '',
              prefixIcon: Icon(Icons.qr_code),
            ),
            onSubmitted: _scan,
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _busy || _needsReset ? null : () => _scan(_manual.text),
            icon: const Icon(Icons.verified_outlined),
            label: Text(_busy ? 'Checking ticket…' : 'Check ticket'),
          ),
          if (_busy)
            const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (_message != null)
            Card(
              color: _outcome == 'error'
                  ? Theme.of(context).colorScheme.errorContainer
                  : _outcome == 'queued'
                  ? Theme.of(context).colorScheme.tertiaryContainer
                  : Theme.of(context).colorScheme.secondaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Semantics(
                  liveRegion: true,
                  child: Column(
                    children: [
                      Icon(
                        _outcome == 'new'
                            ? Icons.check_circle_outline
                            : _outcome == 'duplicate'
                            ? Icons.warning_amber
                            : _outcome == 'queued'
                            ? Icons.cloud_off_outlined
                            : Icons.error_outline,
                        size: 48,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _message!,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          if (_needsReset && !_busy)
            OutlinedButton(
              onPressed: () {
                setState(() {
                  _needsReset = false;
                  _message = null;
                  _manual.clear();
                });
                if (_cameraOpen) _startCamera();
              },
              child: const Text('Check another ticket'),
            ),
        ],
      ],
    );
  }
}
