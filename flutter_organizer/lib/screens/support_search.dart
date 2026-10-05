import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/models.dart';
import 'order_detail.dart';
import 'workspace.dart' show EmptyState;

/// Support: find any order by number, buyer name, email or phone, then open it
/// to complete the order, resend the ticket, or share the buyer's ticket link.
/// Admin only; the server enforces this independently of the app.
class SupportSearchScreen extends StatefulWidget {
  const SupportSearchScreen({super.key, required this.api});
  final OrganizerApi api;
  @override
  State<SupportSearchScreen> createState() => _SupportSearchScreenState();
}

class _SupportSearchScreenState extends State<SupportSearchScreen> {
  final _controller = TextEditingController();
  List<Json>? _results;
  String? _error;
  bool _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final query = _controller.text.trim();
    if (query.length < 2) {
      setState(() {
        _error = 'Enter at least 2 characters.';
        _results = null;
      });
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await widget.api.adminOrderSearch(query);
      if (!mounted) return;
      setState(() => _results = rows);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = '$error';
        _results = null;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Order support')),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          TextField(
            controller: _controller,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _search(),
            decoration: InputDecoration(
              labelText: 'Order number, name, email or phone',
              hintText: 'e.g. 9871B5C9 or +263 78 890 8470',
              suffixIcon: IconButton(
                tooltip: 'Search',
                onPressed: _loading ? null : _search,
                icon: const Icon(Icons.search),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (_loading) const LinearProgressIndicator(semanticsLabel: 'Searching'),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            ),
          if (_results != null && _results!.isEmpty && !_loading)
            const EmptyState(
              icon: Icons.search_off_outlined,
              title: 'No orders found',
              message: 'Try the order number, the buyer\'s email, or part of their phone number.',
            ),
          for (final order in _results ?? const <Json>[]) ...[
            OrderCard(
              order: order,
              onTap: () => showOrderDetail(
                context,
                widget.api,
                order['id'].toString(),
              ),
            ),
            if (order['deliveryStatus'] == 'EMAIL_FAILED')
              Padding(
                padding: const EdgeInsets.only(bottom: 12, left: 4),
                child: Text(
                  'Ref ${order['ref'] ?? ''}: ticket email failed. Open the order to resend.',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
          ],
        ],
      ),
    ),
  );
}
