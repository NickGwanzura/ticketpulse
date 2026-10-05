import 'package:flutter/material.dart';
import '../data/api.dart';

/// Lets the signed-in user require their phone's biometrics or screen lock
/// before the app opens. The preference is stored on this device only.
class AppLockSettingsScreen extends StatefulWidget {
  const AppLockSettingsScreen({super.key, required this.api});
  final TicketPulseApi api;

  @override
  State<AppLockSettingsScreen> createState() => _AppLockSettingsScreenState();
}

class _AppLockSettingsScreenState extends State<AppLockSettingsScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _toggle(bool enabled) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.setBiometricLockEnabled(enabled);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('App lock')),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Require unlock to open the app'),
            subtitle: const Text(
              'Use your fingerprint, face, or screen lock to protect your tickets and account on this device.',
            ),
            value: widget.api.biometricLockEnabled,
            onChanged: _busy ? null : _toggle,
          ),
          if (_busy) const LinearProgressIndicator(semanticsLabel: 'Saving'),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}
