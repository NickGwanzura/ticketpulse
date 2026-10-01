import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/api.dart';
import '../../data/models.dart';
import '../../design.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({
    super.key,
    required this.api,
    required this.event,
    required this.quantities,
  });
  final TicketPulseApi api;
  final BuyerEvent event;
  final Map<String, int> quantities;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  final _phone = TextEditingController();
  String _method = 'velocity-ecocash';
  bool _terms = false, _busy = false, _polling = false;
  String? _error, _paymentMessage;
  CheckoutResult? _checkout;
  Json? _quote;
  String? _quoteKey;
  final _promo = TextEditingController();
  final Map<String, TextEditingController> _answers = {};
  List<Json> _questions = [];
  Json get _payload => {
    'eventSlug': widget.event.slug,
    'name': _name.text.trim(),
    'email': _email.text.trim(),
    'phone': _phone.text.trim(),
    'paymentMethod': _method,
    'items': [
      for (final tier in _selectedTiers)
        {
          'kind': 'ticket',
          'tierId': tier.id,
          'quantity': widget.quantities[tier.id],
        },
    ],
    if (_promo.text.trim().isNotEmpty) 'promoCode': _promo.text.trim(),
    'questionResponses': {
      for (final entry in _answers.entries) entry.key: entry.value.text,
    },
  };
  Future<void> _restoreCheckout() async {
    final saved = await widget.api.activeCheckout();
    if (!mounted ||
        saved?['eventSlug'] != widget.event.slug ||
        saved?['result'] is! Json) {
      return;
    }
    setState(() {
      _checkout = CheckoutResult.fromJson(saved!['result'] as Json);
      _email.text = saved['email']?.toString() ?? '';
      _name.text = saved['name']?.toString() ?? '';
      _phone.text = saved['phone']?.toString() ?? '';
      _paymentMessage =
          'Checking your earlier recorded order before another payment.';
    });
    unawaited(_pollUntilFinal());
  }

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(
      text: widget.api.user?['name']?.toString() ?? '',
    );
    _email = TextEditingController(
      text: widget.api.user?['email']?.toString() ?? '',
    );
    unawaited(_restoreCheckout());
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _promo.dispose();
    for (final controller in _answers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  List<TicketTier> get _selectedTiers => widget.event.tiers
      .where((tier) => (widget.quantities[tier.id] ?? 0) > 0)
      .toList(growable: false);

  String get _currency => _selectedTiers.first.currency;

  double get _total {
    final now = DateTime.now();
    return _selectedTiers.fold<double>(0, (total, tier) {
      final quantity = widget.quantities[tier.id] ?? 0;
      return total + tier.unitPriceFor(quantity, now) * quantity;
    });
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    if (!_terms) {
      setState(() => _error = 'Please accept the event terms to continue.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final payload = _payload;
      final key = jsonEncode(payload);
      if (_quote == null || _quoteKey != key) {
        final quoted = await widget.api.quoteCheckout({
          ...payload,
          'checkoutRequestId': await widget.api.checkoutRequestId(
            widget.event.slug,
          ),
        });
        if (!mounted) return;
        setState(() {
          _quote = quoted['quote'] as Json;
          _questions = (_quote!['questions'] as List)
              .whereType<Json>()
              .toList();
          for (final question in _questions) {
            _answers.putIfAbsent(
              question['id'] as String,
              () => TextEditingController(),
            );
          }
          _quoteKey = jsonEncode(_payload);
        });
        return;
      }
      final checkout = await widget.api.startCheckout(
        expectedAmount: number(_quote!['amount']).toDouble(),
        expectedCurrency: _quote!['currency'] as String,
        promoCode: _promo.text.trim(),
        questionResponses: _payload['questionResponses'] as Json,
        eventSlug: widget.event.slug,
        name: _name.text,
        email: _email.text,
        phone: _phone.text,
        paymentMethod: _method,
        items: [
          for (final tier in _selectedTiers)
            {
              'kind': 'ticket',
              'tierId': tier.id,
              'quantity': widget.quantities[tier.id],
            },
        ],
      );
      if (!mounted) return;
      if (checkout.flow == 'free') {
        _checkout = checkout;
        _showConfirmation(true);
        return;
      }
      setState(() {
        _checkout = checkout;
        _paymentMessage = checkout.redirectUrl == null
            ? 'Payment request sent. Approve the prompt on your phone.'
            : 'Complete your secure card payment, then return here.';
      });
      if (checkout.redirectUrl case final url?) {
        final uri = Uri.tryParse(url);
        if (uri == null || uri.scheme != 'https') {
          throw const ApiException(
            'The secure payment link was invalid. Contact support before retrying.',
          );
        }
        final opened = await launchUrl(
          uri,
          mode: LaunchMode.externalApplication,
        );
        if (!opened && mounted) {
          setState(
            () => _paymentMessage =
                "Payment page could not open. View your recorded order before paying again.",
          );
        }
      }
      if (checkout.pollRequired) unawaited(_pollUntilFinal());
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pollUntilFinal() async {
    final checkout = _checkout;
    if (checkout == null || _polling) return;
    setState(() => _polling = true);
    for (var attempt = 0; attempt < 60 && mounted; attempt++) {
      await Future<void>.delayed(const Duration(seconds: 5));
      final outcome = await _checkStatus();
      if (outcome == 'paid') {
        _showConfirmation(true);
        return;
      }
      if (outcome == 'failed') {
        if (mounted) {
          setState(() {
            _polling = false;
            _paymentMessage =
                'The payment was not completed. You can check again or contact support if money was deducted.';
          });
        }
        return;
      }
    }
    if (!mounted) return;
    setState(() {
      _polling = false;
      _paymentMessage =
          'Your order is recorded and payment is still processing. Check again shortly; please don’t pay twice.';
    });
  }

  Future<String?> _checkStatus() async {
    final checkout = _checkout;
    if (checkout == null) return null;
    try {
      final status = await widget.api.checkoutStatus(
        checkout.orderId,
        checkout.accessSignature,
      );
      if (status['paid'] == true) return 'paid';
      final value = status['status']?.toString().toLowerCase();
      if (value == 'failed' || value == 'cancelled' || value == 'expired') {
        return 'failed';
      }
      if (mounted) {
        setState(
          () => _paymentMessage =
              status['message']?.toString() ?? 'Payment is still processing.',
        );
      }
    } catch (_) {
      // A transient status check failure must not turn a pending order into a failure.
    }
    return null;
  }

  Future<void> _checkNow() async {
    if (_polling) return;
    setState(() => _polling = true);
    final outcome = await _checkStatus();
    if (!mounted) return;
    if (outcome == 'paid') {
      _showConfirmation(true);
    } else {
      setState(() {
        _polling = false;
        if (outcome == 'failed') {
          _paymentMessage =
              'Payment was not completed. If money was deducted, please contact support before trying again.';
        } else {
          _paymentMessage =
              'We haven’t received confirmation yet. Check again in a moment; don’t submit another payment.';
        }
      });
    }
  }

  void _showConfirmation(bool paid) {
    if (paid) {
      unawaited(widget.api.store.writePreference("active_checkout", ""));
    }
    final orderId = _checkout?.orderId;
    if (orderId == null || !mounted) return;
    Navigator.of(context).pushReplacement<void, void>(
      MaterialPageRoute(
        builder: (_) => PurchaseSuccessScreen(
          orderId: orderId,
          confirmed: paid,
          orderUrl: widget.api.baseUrl
              .resolve('/orders/$orderId')
              .replace(queryParameters: {'sig': _checkout!.accessSignature}),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      leading: IconButton(
        onPressed: () => Navigator.pop(context),
        icon: const Icon(Icons.arrow_back_rounded),
      ),
      title: const Text('Payment'),
    ),
    body: SafeArea(
      child: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            const _StepLabel(step: 'STEP 3 OF 3', title: 'Complete your order'),
            const SizedBox(height: 8),
            Text(
              'Your tickets are almost yours.',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 6),
            const Text(
              'We’ll send your ticket confirmation to the email below.',
            ),
            const SizedBox(height: 20),
            _OrderSummary(
              event: widget.event,
              tiers: _selectedTiers,
              quantities: widget.quantities,
              total: _checkout?.amount ?? _total,
              currency: _checkout?.currency ?? _currency,
            ),
            if (_checkout == null) ...[
              TextFormField(
                controller: _promo,
                enabled: !_busy,
                decoration: const InputDecoration(
                  labelText: 'Promo code (optional)',
                ),
              ),
              for (final question in _questions)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: TextFormField(
                    controller: _answers[question['id']],
                    enabled: !_busy,
                    decoration: InputDecoration(
                      labelText: question['question'] as String,
                    ),
                    validator: (value) =>
                        question['required'] == true &&
                            (value == null || value.trim().isEmpty)
                        ? 'Please answer this question'
                        : null,
                  ),
                ),
              if (_quote != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'Review: ${_quote!['currency']} ${_quote!['amount']} · prompt to ${_quote!['normalizedPhone']}\nYour payment provider may charge additional fees.',
                  ),
                ),

              const SizedBox(height: 24),
              Text(
                'Your details',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _name,
                enabled: !_busy,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Full name',
                  prefixIcon: Icon(Icons.person_outline),
                ),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Enter your full name'
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                enabled: !_busy,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Email for your tickets',
                  prefixIcon: Icon(Icons.mail_outline),
                ),
                validator: (value) =>
                    value == null ||
                        !RegExp(
                          r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                        ).hasMatch(value.trim())
                    ? 'Enter a valid email address'
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                enabled: !_busy,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(
                  labelText: _method == 'velocity-ecocash'
                      ? 'EcoCash mobile number'
                      : 'Phone number (optional)',
                  prefixIcon: const Icon(Icons.phone_outlined),
                  helperText: _method == 'velocity-ecocash'
                      ? 'We’ll send a payment approval prompt to this number.'
                      : null,
                ),
                validator: (value) =>
                    _total > 0 &&
                        _method == 'velocity-ecocash' &&
                        (value == null || value.trim().length < 7)
                    ? 'Enter the number linked to EcoCash'
                    : null,
              ),
              const SizedBox(height: 24),
              Text(
                'Payment method',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              _PaymentMethodTile(
                title: 'EcoCash',
                subtitle: 'Approve a secure prompt on your phone',
                icon: Icons.phone_android_rounded,
                selected: _method == 'velocity-ecocash',
                onTap: () => setState(() => _method = 'velocity-ecocash'),
              ),
              const SizedBox(height: 8),
              _PaymentMethodTile(
                title: 'Debit or credit card',
                subtitle: 'Continue to secure card checkout',
                icon: Icons.credit_card_rounded,
                selected: _method == 'velocity-card',
                onTap: () => setState(() => _method = 'velocity-card'),
              ),
              const SizedBox(height: 12),
              CheckboxListTile(
                value: _terms,
                onChanged: _busy
                    ? null
                    : (value) => setState(() {
                        _terms = value ?? false;
                        _error = null;
                      }),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: const Text(
                  'I agree to the event terms and payment conditions.',
                  style: TextStyle(fontSize: 13),
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              FilledButton.icon(
                onPressed: _busy ? null : _submit,
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.lock_outline),
                label: Text(
                  _busy
                      ? 'Starting secure payment…'
                      : _quote == null
                      ? 'Review order'
                      : 'Confirm reviewed payment',
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text(
                  'Your payment is processed securely. TicketPulse never stores your card details.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: Pulse.muted),
                ),
              ),
            ] else ...[
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F6FA),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          _polling
                              ? Icons.sync_rounded
                              : Icons.hourglass_top_rounded,
                          color: Pulse.navy,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _polling ? 'Checking payment' : 'Order received',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _paymentMessage ??
                          'Your payment is being processed. Please don’t pay again.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Order reference: ${_checkout!.orderId}',
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                    if (_polling) ...[
                      const SizedBox(height: 14),
                      const LinearProgressIndicator(),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: _polling ? null : _checkNow,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Check payment status'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _polling ? null : () => _showConfirmation(false),
                child: const Text('View recorded order'),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class PurchaseSuccessScreen extends StatelessWidget {
  const PurchaseSuccessScreen({
    super.key,
    required this.orderId,
    required this.confirmed,
    required this.orderUrl,
  });
  final String orderId;
  final bool confirmed;
  final Uri orderUrl;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                BrandWordmark(),
                const SizedBox(height: 36),
                CircleAvatar(
                  radius: 42,
                  backgroundColor: confirmed
                      ? const Color(0xFFE5F5EB)
                      : const Color(0xFFFFF3E2),
                  child: Icon(
                    confirmed
                        ? Icons.check_rounded
                        : Icons.hourglass_top_rounded,
                    size: 42,
                    color: confirmed
                        ? const Color(0xFF25834A)
                        : const Color(0xFF9A6414),
                  ),
                ),
                const SizedBox(height: 22),
                Text(
                  confirmed ? 'You’re going!' : 'Order received',
                  style: Theme.of(context).textTheme.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  confirmed
                      ? 'Your payment is confirmed. Your tickets are on their way to your email.'
                      : 'Payment confirmation is still pending. We’ll send your tickets as soon as it clears. Please don’t pay again.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 22),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      children: [
                        const Text(
                          'ORDER REFERENCE',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1,
                          ),
                        ),
                        const SizedBox(height: 8),
                        SelectableText(
                          orderId,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                FilledButton(
                  onPressed: () =>
                      launchUrl(orderUrl, mode: LaunchMode.externalApplication),
                  child: Text(
                    confirmed ? 'View my tickets' : 'View order status',
                  ),
                ),
                TextButton(
                  onPressed: () =>
                      Navigator.of(context).popUntil((route) => route.isFirst),
                  child: const Text('Back to events'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => launchUrl(
                    Uri.parse('mailto:support@ticketpulse.tech'),
                    mode: LaunchMode.externalApplication,
                  ),
                  child: const Text('Need help? Contact support'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _OrderSummary extends StatelessWidget {
  const _OrderSummary({
    required this.event,
    required this.tiers,
    required this.quantities,
    required this.total,
    required this.currency,
  });
  final BuyerEvent event;
  final List<TicketTier> tiers;
  final Map<String, int> quantities;
  final double total;
  final String currency;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(event.title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            event.startsAt == null
                ? 'Date to be announced'
                : dateLabel(event.startsAt),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Divider(height: 24),
          for (final tier in tiers)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text('${quantities[tier.id]} × ${tier.name}'),
                  ),
                  Text(
                    money(
                      tier.unitPriceFor(
                            quantities[tier.id] ?? 0,
                            DateTime.now(),
                          ) *
                          (quantities[tier.id] ?? 0),
                      tier.currency,
                    ),
                  ),
                ],
              ),
            ),
          const Divider(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Order total',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Text(
                money(total, currency),
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(color: Pulse.navy),
              ),
            ],
          ),
          if (total > 0)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Ticket pricing is confirmed by TicketPulse when your order is created.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
        ],
      ),
    ),
  );
}

class _PaymentMethodTile extends StatelessWidget {
  const _PaymentMethodTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.onTap,
  });
  final String title, subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(16),
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: selected ? const Color(0xFFF1F5F9) : Colors.white,
        border: Border.all(
          color: selected ? Pulse.navy : Pulse.line,
          width: selected ? 1.5 : 1,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(icon, color: Pulse.navy),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Icon(
            selected ? Icons.radio_button_checked : Icons.radio_button_off,
            color: selected ? Pulse.navy : Pulse.muted,
          ),
        ],
      ),
    ),
  );
}

class _StepLabel extends StatelessWidget {
  const _StepLabel({required this.step, required this.title});
  final String step, title;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(Icons.verified_user_outlined, size: 18, color: Pulse.orange),
      const SizedBox(width: 8),
      Text(
        step,
        style: const TextStyle(
          color: Pulse.orange,
          letterSpacing: 1,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
      const Spacer(),
      Text(title, style: Theme.of(context).textTheme.labelSmall),
    ],
  );
}
