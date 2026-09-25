import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../design.dart';

/// Opens the payout request flow. Resolves to true when a request was sent.
Future<bool> showPayoutRequest(
  BuildContext context,
  OrganizerApi api, {
  required double available,
  Json? lastDestination,
}) async =>
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => PayoutRequestScreen(
          api: api,
          available: available,
          lastDestination: lastDestination,
        ),
      ),
    ) ??
    false;

// Same rules as the website (lib/payout-request.ts); the server re-checks.
final _ecocashPattern = RegExp(r'^(\+?263|0)?7[1789]\d{7}$');
const _minimum = 1.0;

class PayoutRequestScreen extends StatefulWidget {
  const PayoutRequestScreen({
    super.key,
    required this.api,
    required this.available,
    this.lastDestination,
  });
  final OrganizerApi api;
  final double available;
  final Json? lastDestination;
  @override
  State<PayoutRequestScreen> createState() => _PayoutRequestScreenState();
}

class _PayoutRequestScreenState extends State<PayoutRequestScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _amount;
  late final TextEditingController _ecocash, _account, _holder, _bank;
  late String _method;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final last = widget.lastDestination ?? const {};
    _method = last['method'] == 'bank_usd' ? 'bank_usd' : 'ecocash';
    _amount = TextEditingController(text: _format(widget.available));
    _ecocash = TextEditingController(text: '${last['ecocashNumber'] ?? ''}');
    _account = TextEditingController(text: '${last['accountNumber'] ?? ''}');
    _holder = TextEditingController(text: '${last['accountName'] ?? ''}');
    _bank = TextEditingController(text: '${last['bankName'] ?? ''}');
    _amount.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    for (final c in [_amount, _ecocash, _account, _holder, _bank]) {
      c.dispose();
    }
    super.dispose();
  }

  static String _format(double value) =>
      value.toStringAsFixed(2).replaceAll(RegExp(r'\.00$'), '');

  double? get _value =>
      double.tryParse(_amount.text.replaceAll(',', '').trim());

  String? _validateAmount(String? _) {
    final value = _value;
    if (value == null) return 'Enter an amount';
    if (value < _minimum) return 'The minimum payout is ${money(_minimum)}';
    if (value > widget.available + 0.001) {
      return 'You can request up to ${money(widget.available)}';
    }
    return null;
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    final amount = double.parse(_value!.toStringAsFixed(2));
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.requestPayout(
        amount: amount,
        method: _method,
        ecocashNumber: _ecocash.text.replaceAll(' ', ''),
        accountNumber: _account.text.trim(),
        accountName: _holder.text.trim(),
        bankName: _bank.text.trim(),
      );
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => _PayoutRequested(
            amount: amount,
            destination: _method == 'ecocash'
                ? 'EcoCash · ${_ecocash.text.replaceAll(' ', '')}'
                : '${_bank.text.trim()} · ${_account.text.trim()}',
          ),
        ),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is ApiException
              ? e.message
              : 'Could not send the payout request. Please try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final value = _value;
    final amountLabel = value == null || _validateAmount(null) != null
        ? 'Request payout'
        : 'Request ${money(value)}';
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Close',
          icon: const Icon(Icons.close_rounded),
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
        ),
        title: const Text('Request payout'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Form(
              key: _form,
              child: Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                      children: [
                        const Eyebrow('Available to withdraw'),
                        const SizedBox(height: 6),
                        Text(
                          money(widget.available),
                          style: text.headlineLarge,
                        ),
                        const SizedBox(height: 24),
                        TextFormField(
                          controller: _amount,
                          enabled: !_busy,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'Amount',
                            prefixText: 'USD ',
                          ),
                          validator: _validateAmount,
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          children: [
                            for (final (label, factor) in [
                              ('Full balance', 1.0),
                              ('Half', .5),
                            ])
                              ActionChip(
                                label: Text(label),
                                onPressed: _busy
                                    ? null
                                    : () => _amount.text = _format(
                                        (widget.available * factor * 100)
                                                .floorToDouble() /
                                            100,
                                      ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 28),
                        Text('Send it to', style: text.titleMedium),
                        const SizedBox(height: 12),
                        _MethodCard(
                          icon: Icons.phone_iphone_rounded,
                          title: 'EcoCash',
                          subtitle: 'Straight to your EcoCash wallet',
                          selected: _method == 'ecocash',
                          onTap: _busy
                              ? null
                              : () => setState(() => _method = 'ecocash'),
                        ),
                        const SizedBox(height: 10),
                        _MethodCard(
                          icon: Icons.account_balance_rounded,
                          title: 'USD bank transfer',
                          subtitle: 'To a Zimbabwe USD bank account',
                          selected: _method == 'bank_usd',
                          onTap: _busy
                              ? null
                              : () => setState(() => _method = 'bank_usd'),
                        ),
                        const SizedBox(height: 20),
                        if (_method == 'ecocash')
                          TextFormField(
                            controller: _ecocash,
                            enabled: !_busy,
                            keyboardType: TextInputType.phone,
                            autofillHints: const [
                              AutofillHints.telephoneNumber,
                            ],
                            decoration: const InputDecoration(
                              labelText: 'EcoCash number',
                              hintText: '077 123 4567',
                              prefixIcon: Icon(Icons.phone_outlined),
                            ),
                            validator: (v) =>
                                _ecocashPattern.hasMatch(
                                  (v ?? '').replaceAll(' ', ''),
                                )
                                ? null
                                : 'Enter a valid Zimbabwe EcoCash number',
                          )
                        else ...[
                          TextFormField(
                            controller: _bank,
                            enabled: !_busy,
                            decoration: const InputDecoration(
                              labelText: 'Bank name',
                            ),
                            validator: (v) => (v ?? '').trim().length < 2
                                ? 'Enter the bank name'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _holder,
                            enabled: !_busy,
                            decoration: const InputDecoration(
                              labelText: 'Account holder name',
                            ),
                            validator: (v) => (v ?? '').trim().length < 2
                                ? 'Enter the account holder name'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _account,
                            enabled: !_busy,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Account number',
                            ),
                            validator: (v) => (v ?? '').trim().length < 5
                                ? 'Enter a valid account number'
                                : null,
                          ),
                        ],
                        const SizedBox(height: 20),
                        Text(
                          'An admin reviews every request. Payouts usually arrive within about 24 hours, depending on bank processing.',
                          style: text.bodyMedium?.copyWith(fontSize: 13),
                        ),
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 16),
                            child: Semantics(
                              liveRegion: true,
                              child: Text(
                                _error!,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                    child: SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _busy ? null : _submit,
                        child: Text(_busy ? 'Sending request…' : amountLabel),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Selectable payout method card (after Luma's ticket picker).
class _MethodCard extends StatelessWidget {
  const _MethodCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final bool selected;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Semantics(
      selected: selected,
      button: true,
      child: Material(
        color: selected ? colors.primaryContainer : colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(
            color: selected ? colors.primary : colors.outline,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(
                  selected
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  color: selected
                      ? colors.primary
                      : Theme.of(context).textTheme.bodyMedium?.color,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(subtitle),
                    ],
                  ),
                ),
                Icon(icon, color: colors.primary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Confirmation after a request (after Eventbrite's "order confirmed").
class _PayoutRequested extends StatelessWidget {
  const _PayoutRequested({required this.amount, required this.destination});
  final double amount;
  final String destination;
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            tooltip: 'Close',
            icon: const Icon(Icons.close_rounded),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
              children: [
                Text(
                  'Payout requested',
                  style: text.headlineLarge?.copyWith(
                    fontSize: 38,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'We’ll review it and let you know when it’s on its way.',
                  style: text.bodyLarge,
                ),
                const SizedBox(height: 36),
                const Center(
                  child: CircleAvatar(
                    radius: 56,
                    backgroundColor: Color(0xFFE7F5EE),
                    child: Icon(
                      Icons.payments_rounded,
                      size: 56,
                      color: Color(0xFF047857),
                    ),
                  ),
                ),
                const SizedBox(height: 36),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(22),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(money(amount), style: text.headlineMedium),
                        const SizedBox(height: 4),
                        Text(destination),
                        const SizedBox(height: 6),
                        Text(
                          'Usually within about 24 hours',
                          style: text.bodyMedium?.copyWith(fontSize: 13),
                        ),
                        const SizedBox(height: 20),
                        FilledButton(
                          autofocus: true,
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Done'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
