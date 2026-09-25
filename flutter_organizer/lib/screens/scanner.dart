import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../design.dart';
import 'event_widgets.dart';

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

  /// "Event · Tier" for the last scanned ticket, shown on the result card.
  String? _ticketLine;

  /// After a valid ticket the scanner returns to the camera by itself, so
  /// staff don't tap between every guest. Problems still wait for a tap.
  static const _autoNextDelay = Duration(milliseconds: 1500);
  Timer? _autoNext;

  /// Guests admitted from this device since the scanner opened, per event, so
  /// the live counter moves without waiting for the next events refresh.
  final Map<String, int> _admittedHere = {};
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
    _autoNext?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _manual.dispose();
    _camera.dispose();
    // Let the screen sleep again once the scanner is closed.
    WakelockPlus.disable().catchError((_) {});
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
    // Scanning a queue: the phone must not dim or lock between guests.
    WakelockPlus.enable().catchError((_) {});
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
        _message = duplicate
            ? 'This ticket was already scanned. Do not admit again.'
            : 'Valid ticket. Let them through.';
        _ticketLine = [
          ticket['eventTitle'],
          ticket['tierName'],
        ].where((v) => v != null && '$v'.isNotEmpty).join(' · ');
      });
      if (duplicate) {
        await _alertFeedback(twice: true);
      } else {
        HapticFeedback.lightImpact();
        _admittedHere.update(_event!.id, (n) => n + 1, ifAbsent: () => 1);
        if (_cameraOpen) {
          _autoNext?.cancel();
          _autoNext = Timer(_autoNextDelay, () {
            if (mounted && _needsReset && _outcome == 'new') _reset();
          });
        }
      }
      widget.onScanned();
    } catch (e) {
      if (mounted) {
        if (e is ApiException && e.status == 0) {
          await widget.api.queueScan(code, _event!.id);
          final count = await widget.api.pendingScanCount();
          if (!mounted) return;
          unawaited(_alertFeedback());
          setState(() {
            _queuedScans = count;
            _outcome = 'queued';
            _message =
                'Connection unavailable. Scan saved for later verification.\n$count scan${count == 1 ? '' : 's'} pending.';
          });
          return;
        }
        unawaited(_alertFeedback());
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

  /// Strong feedback for anything that should stop the guest: a heavy buzz
  /// (twice for a duplicate) and the system alert sound, distinct from the
  /// light tap of a valid ticket, so staff notice without looking.
  Future<void> _alertFeedback({bool twice = false}) async {
    HapticFeedback.heavyImpact();
    SystemSound.play(SystemSoundType.alert);
    if (twice) {
      await Future<void>.delayed(const Duration(milliseconds: 180));
      HapticFeedback.heavyImpact();
    }
  }

  void _reset() {
    _autoNext?.cancel();
    setState(() {
      _needsReset = false;
      _message = null;
      _ticketLine = null;
      _manual.clear();
    });
    if (_cameraOpen) _startCamera();
  }

  Future<void> _pickEvent(List<OrganizerEvent> eligible) async {
    final picked = await showModalBottomSheet<OrganizerEvent>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) =>
          _EventPickerSheet(events: eligible, selectedId: _event?.id),
    );
    if (picked != null && mounted) {
      setState(() {
        _event = picked;
        _message = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final eligible = widget.events.where((e) => e.canScan).toList();
    if (_needsReset && !_busy && _message != null) {
      return _ScanResult(
        outcome: _outcome,
        message: _message!,
        ticketLine: _ticketLine,
        autoAdvance: _outcome == 'new' && _cameraOpen,
        onNext: _reset,
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 4, 24, 24),
      children: [
        const PageHeading(
          eyebrow: 'At the door',
          title: 'Welcome them in.',
          subtitle:
              'Check tickets online. If the connection drops, scans are saved as unconfirmed and retried when you reconnect.',
        ),
        if (eligible.isEmpty)
          const Text(
            'No live events to scan. Publish an event on TicketPulse and refresh your events.',
          ),
        if (eligible.isNotEmpty) ...[
          _EventSelector(
            event: _event,
            checkedIn: _event == null
                ? 0
                : _event!.checkedIn + (_admittedHere[_event!.id] ?? 0),
            enabled: !_busy && !_needsReset,
            onTap: () => _pickEvent(eligible),
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
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 420),
                child: AspectRatio(
                  aspectRatio: 1,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      MobileScanner(
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
                      const IgnorePointer(child: _ScanFrame()),
                      Positioned(
                        right: 12,
                        bottom: 12,
                        child: Row(
                          children: [
                            _ViewfinderButton(
                              tooltip: 'Torch',
                              icon: Icons.flashlight_on_rounded,
                              onPressed: () => _camera.toggleTorch(),
                            ),
                            const SizedBox(width: 8),
                            _ViewfinderButton(
                              tooltip: 'Switch camera',
                              icon: Icons.cameraswitch_rounded,
                              onPressed: () => _camera.switchCamera(),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
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
          // Errors before a scan (camera, empty code) stay inline.
          if (_message != null && !_needsReset)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  _message!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

/// Aiming frame over the camera preview: a centred square that shows guests
/// and staff where to hold the ticket's QR code.
class _ScanFrame extends StatelessWidget {
  const _ScanFrame();
  @override
  Widget build(BuildContext context) => Center(
    child: FractionallySizedBox(
      widthFactor: .62,
      heightFactor: .62,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white, width: 3),
          borderRadius: BorderRadius.circular(18),
        ),
      ),
    ),
  );
}

/// Tappable summary of the event being scanned, opening the picker sheet.
class _EventSelector extends StatelessWidget {
  const _EventSelector({
    required this.event,
    required this.checkedIn,
    required this.enabled,
    required this.onTap,
  });
  final OrganizerEvent? event;
  final int checkedIn;
  final bool enabled;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'Event being scanned: ${event?.title ?? 'none'}. Change event',
    excludeSemantics: true,
    child: Card(
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              if (event != null)
                SizedBox(
                  width: 52,
                  height: 52,
                  child: EventArtwork(event: event!, radius: 12),
                ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Eyebrow('Scanning for'),
                    const SizedBox(height: 4),
                    Text(
                      event?.title ?? 'Choose an event',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (event != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        '$checkedIn of ${event!.sold} checked in',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ],
                ),
              ),
              Icon(
                Icons.unfold_more_rounded,
                color: Theme.of(context).textTheme.bodyMedium?.color,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Bottom sheet of selectable event cards (after Luma's ticket picker).
class _EventPickerSheet extends StatelessWidget {
  const _EventPickerSheet({required this.events, required this.selectedId});
  final List<OrganizerEvent> events;
  final String? selectedId;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * .8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Select event', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                itemCount: events.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final event = events[i];
                  final selected = event.id == selectedId;
                  return Material(
                    color: selected ? colors.primaryContainer : colors.surface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                      side: BorderSide(
                        color: selected ? colors.primary : colors.outline,
                        width: selected ? 1.5 : 1,
                      ),
                    ),
                    child: InkWell(
                      onTap: () => Navigator.pop(context, event),
                      borderRadius: BorderRadius.circular(20),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              selected
                                  ? Icons.check_circle_rounded
                                  : Icons.radio_button_unchecked_rounded,
                              color: selected
                                  ? colors.primary
                                  : Theme.of(
                                      context,
                                    ).textTheme.bodyMedium?.color,
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    event.title,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleMedium,
                                  ),
                                  InfoLine(
                                    icon: Icons.schedule_rounded,
                                    text: eventWhen(event.startsAt),
                                  ),
                                  InfoLine(
                                    icon: Icons.how_to_reg_outlined,
                                    text:
                                        '${event.checkedIn} of ${event.sold} checked in',
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Full-screen scan result (after Eventbrite's order confirmation): big clear
/// verdict, the ticket, and one action to scan the next guest.
class _ScanResult extends StatelessWidget {
  const _ScanResult({
    required this.outcome,
    required this.message,
    required this.ticketLine,
    required this.autoAdvance,
    required this.onNext,
  });
  final String outcome, message;
  final String? ticketLine;

  /// True when the scanner will return to the camera by itself.
  final bool autoAdvance;
  final VoidCallback onNext;
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final (headline, icon, accent) = switch (outcome) {
      'new' => (
        'Welcome in',
        Icons.check_circle_rounded,
        const Color(0xFF047857),
      ),
      'duplicate' => (
        'Already checked in',
        Icons.warning_rounded,
        const Color(0xFFB45309),
      ),
      'queued' => (
        'Saved offline',
        Icons.cloud_off_rounded,
        const Color(0xFF1D4ED8),
      ),
      _ => (
        'Can\'t admit this ticket',
        Icons.cancel_rounded,
        const Color(0xFFBE123C),
      ),
    };
    final tint = Color.alphaBlend(
      accent.withValues(alpha: dark ? .22 : .10),
      Theme.of(context).scaffoldBackgroundColor,
    );
    return Semantics(
      liveRegion: true,
      child: Container(
        color: tint,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          children: [
            Icon(icon, size: 72, color: accent),
            const SizedBox(height: 24),
            Text(
              headline,
              style: Theme.of(
                context,
              ).textTheme.headlineLarge?.copyWith(fontSize: 38, height: 1.1),
            ),
            const SizedBox(height: 12),
            Text(message, style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 32),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (ticketLine != null && ticketLine!.isNotEmpty) ...[
                      Text(
                        ticketLine!,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 20),
                    ],
                    FilledButton(
                      autofocus: true,
                      onPressed: onNext,
                      child: const Text('Check another ticket'),
                    ),
                    if (autoAdvance) ...[
                      const SizedBox(height: 10),
                      Text(
                        'Back to the camera in a moment…',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Round translucent button over the camera preview.
class _ViewfinderButton extends StatelessWidget {
  const _ViewfinderButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });
  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    onPressed: onPressed,
    style: IconButton.styleFrom(
      backgroundColor: const Color(0x99000000),
      foregroundColor: Colors.white,
      fixedSize: const Size(48, 48),
    ),
    icon: Icon(icon, size: 22),
  );
}
