import 'package:flutter/material.dart';
import 'data/api.dart';
import 'design.dart';
import 'screens/sign_in.dart';
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
      const MaterialApp(
        home: Scaffold(
          body: Center(child: Text('API_BASE_URL must be an HTTPS origin.')),
        ),
      ),
    );
    return;
  }
  final api = OrganizerApi(baseUrl: uri, store: SecureSessionStore(uri.origin));
  runApp(TicketPulseApp(api: api));
  api.restore();
}

class TicketPulseApp extends StatelessWidget {
  const TicketPulseApp({super.key, required this.api});
  final OrganizerApi api;
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'TicketPulse Organizer',
    debugShowCheckedModeBanner: false,
    theme: Pulse.theme(Brightness.light),
    darkTheme: Pulse.theme(Brightness.dark),
    home: ListenableBuilder(
      listenable: api,
      builder: (context, _) {
        if (api.restoring) return const BrandLoading();
        if (api.startupError != null) {
          return Scaffold(
            body: SafeArea(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const BrandWordmark(height: BrandSize.hero),
                      const SizedBox(height: 32),
                      Icon(
                        Icons.cloud_off_outlined,
                        size: 32,
                        color: Theme.of(context).colorScheme.secondary,
                      ),
                      const SizedBox(height: 12),
                      Text(api.startupError!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: api.restore,
                        child: const Text('Retry'),
                      ),
                      TextButton(
                        onPressed: api.signOut,
                        child: const Text('Sign in again'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }
        return api.user == null
            ? SignInScreen(api: api)
            : OrganizerWorkspace(api: api);
      },
    ),
  );
}
