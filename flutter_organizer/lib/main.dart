import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'data/api.dart';
import 'deep_links.dart';
import 'design.dart';
import 'screens/buyer/buyer_home.dart';
import 'screens/buyer/buyer_order_detail.dart';
import 'screens/sign_in.dart';
import 'screens/ticket_link.dart';
import 'screens/workspace.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  const origin = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://ticketpulse.tech',
  );
  final uri = Uri.parse(origin);
  if (!uri.hasAuthority ||
      uri.scheme != 'https' ||
      uri.path.isNotEmpty && uri.path != '/' ||
      uri.hasQuery ||
      uri.hasFragment ||
      uri.userInfo.isNotEmpty) {
    runApp(
      MaterialApp(
        theme: Pulse.theme(Brightness.light),
        themeMode: ThemeMode.light,
        home: const Scaffold(
          body: Center(child: Text('API_BASE_URL must be an HTTPS origin.')),
        ),
      ),
    );
    return;
  }
  final api = TicketPulseApi(
    baseUrl: uri,
    store: SecureSessionStore(uri.origin),
  );
  runApp(TicketPulseApp(api: api, appLinks: AppLinks()));
  api.restore();
}

class TicketPulseApp extends StatelessWidget {
  const TicketPulseApp({super.key, required this.api, this.appLinks});
  final TicketPulseApi api;
  final AppLinks? appLinks;
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'TicketPulse',
    debugShowCheckedModeBanner: false,
    theme: Pulse.theme(Brightness.light),
    themeMode: ThemeMode.light,
    home: _TicketPulseRoot(api: api, appLinks: appLinks),
  );
}

class _TicketPulseRoot extends StatefulWidget {
  const _TicketPulseRoot({required this.api, this.appLinks});
  final TicketPulseApi api;
  final AppLinks? appLinks;

  @override
  State<_TicketPulseRoot> createState() => _TicketPulseRootState();
}

class _TicketPulseRootState extends State<_TicketPulseRoot>
    with WidgetsBindingObserver {
  final _authentication = LocalAuthentication();
  bool _buyerMode = false;
  bool _authenticating = false;
  bool _unlockPromptScheduled = false;
  bool _linkScheduled = false;
  bool _handlingLink = false;
  String? _unlockError;
  TicketPulseLinkTarget? _pendingLink;
  StreamSubscription<Uri>? _linkSubscription;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.api.addListener(_onApiChanged);
    _linkSubscription = widget.appLinks?.uriLinkStream.listen(_receiveLink);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.api.removeListener(_onApiChanged);
    _linkSubscription?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      widget.api.requireBiometricUnlock();
    } else if (state == AppLifecycleState.resumed &&
        widget.api.biometricLockEnabled &&
        !widget.api.biometricUnlocked) {
      _scheduleUnlockPrompt();
    }
  }

  void _onApiChanged() {
    _schedulePendingLink();
  }

  void _receiveLink(Uri uri) {
    final target = parseTicketPulseLink(uri);
    if (target == null) return;
    _pendingLink = target;
    _schedulePendingLink();
  }

  void _schedulePendingLink() {
    if (_linkScheduled) return;
    _linkScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _linkScheduled = false;
      if (!mounted ||
          _pendingLink == null ||
          widget.api.restoring ||
          widget.api.startupError != null ||
          (widget.api.biometricLockEnabled && !widget.api.biometricUnlocked)) {
        return;
      }
      unawaited(_openPendingLink());
    });
  }

  Future<void> _openPendingLink() async {
    if (_handlingLink || _pendingLink == null || !mounted) return;
    _handlingLink = true;
    final target = _pendingLink!;
    _pendingLink = null;
    try {
      if (widget.api.user == null) {
        await Navigator.of(context).push<void>(
          MaterialPageRoute(builder: (_) => SignInScreen(api: widget.api)),
        );
        if (widget.api.user == null || !mounted) return;
      }
      final screen = target.kind == TicketPulseLinkKind.order
          ? BuyerOrderDetailScreen(api: widget.api, orderId: target.id)
          : TicketLinkScreen(ticketId: target.id);
      await Navigator.of(
        context,
      ).push<void>(MaterialPageRoute(builder: (_) => screen));
    } finally {
      _handlingLink = false;
      _schedulePendingLink();
    }
  }

  void _scheduleUnlockPrompt() {
    if (_unlockPromptScheduled || _authenticating) return;
    _unlockPromptScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _unlockPromptScheduled = false;
      if (mounted &&
          widget.api.biometricLockEnabled &&
          !widget.api.biometricUnlocked) {
        unawaited(_unlock());
      }
    });
  }

  Future<void> _unlock() async {
    if (_authenticating || !mounted) return;
    setState(() {
      _authenticating = true;
      _unlockError = null;
    });
    try {
      final authenticated = await _authentication.authenticate(
        localizedReason: 'Unlock TicketPulse to continue.',
        biometricOnly: true,
        persistAcrossBackgrounding: true,
      );
      if (authenticated) {
        widget.api.completeBiometricUnlock();
        _schedulePendingLink();
      } else if (mounted) {
        setState(() => _unlockError = 'Authentication was not completed.');
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _unlockError = 'Could not verify your biometrics. Try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _authenticating = false);
    }
  }

  Future<void> _signOutWhileLocked() async {
    try {
      await widget.api.signOut();
    } catch (_) {
      if (mounted) {
        setState(() => _unlockError = 'Could not sign out. Please retry.');
      }
    }
  }

  Widget _lockScreen() => Scaffold(
    body: SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircleAvatar(
                radius: 34,
                backgroundColor: Color(0xFFEEF3F8),
                child: Icon(
                  Icons.fingerprint_rounded,
                  size: 34,
                  color: Pulse.navy,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'TicketPulse is locked',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              const Text(
                'Verify your identity to view your account and tickets.',
                textAlign: TextAlign.center,
              ),
              if (_unlockError != null) ...[
                const SizedBox(height: 12),
                Text(
                  _unlockError!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _authenticating ? null : _unlock,
                icon: const Icon(Icons.lock_open_rounded),
                label: Text(_authenticating ? 'Verifying…' : 'Unlock'),
              ),
              TextButton(
                onPressed: _signOutWhileLocked,
                child: const Text('Sign out'),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.api,
    builder: (context, _) {
      if (widget.api.restoring) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      if (widget.api.startupError != null) {
        return Scaffold(
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.cloud_off_outlined, size: 48),
                    const SizedBox(height: 16),
                    Text(widget.api.startupError!, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: widget.api.restore,
                      child: const Text('Retry'),
                    ),
                    TextButton(
                      onPressed: widget.api.signOut,
                      child: const Text('Sign in again'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }
      if (widget.api.user != null &&
          widget.api.biometricLockEnabled &&
          !widget.api.biometricUnlocked) {
        _scheduleUnlockPrompt();
        return _lockScreen();
      }
      final role = widget.api.user?['role']?.toString();
      final canManage = role == 'organizer' || role == 'admin';
      if (canManage && !_buyerMode) {
        return OrganizerWorkspace(
          api: widget.api,
          onBrowseEvents: () => setState(() => _buyerMode = true),
        );
      }
      return BuyerHomeScreen(
        api: widget.api,
        onOpenWorkspace: canManage
            ? () => setState(() => _buyerMode = false)
            : null,
      );
    },
  );
}
