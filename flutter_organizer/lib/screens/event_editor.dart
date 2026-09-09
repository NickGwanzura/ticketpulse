import 'package:flutter/material.dart';
import '../data/api.dart';
import '../data/models.dart';

class EventEditorScreen extends StatefulWidget {
  const EventEditorScreen({super.key, required this.api, this.event});
  final OrganizerApi api;
  final OrganizerEvent? event;
  @override
  State<EventEditorScreen> createState() => _EventEditorScreenState();
}

class _EventEditorScreenState extends State<EventEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _title;
  late final TextEditingController _venue;
  late final TextEditingController _city;
  late final TextEditingController _country;
  late final TextEditingController _address;
  late final TextEditingController _description;
  late DateTime _startsAt;
  DateTime? _endsAt;
  late String _category;
  bool _saving = false;
  String? _error;

  static const _categories = [
    'Concert',
    'Festival',
    'Food & Drink',
    'Conference',
    'Sport',
    'Theatre',
    'Comedy',
    'Exhibition',
    'Other',
  ];

  @override
  void initState() {
    super.initState();
    final event = widget.event;
    _title = TextEditingController(text: event?.title ?? '');
    _venue = TextEditingController(
      text: event?.venue == 'Venue to be confirmed' ? '' : event?.venue ?? '',
    );
    _city = TextEditingController(text: event?.city ?? '');
    _country = TextEditingController(text: event?.country ?? 'Zimbabwe');
    _address = TextEditingController(text: event?.address ?? '');
    _description = TextEditingController(text: event?.description ?? '');
    _startsAt =
        event?.startsAt?.toLocal() ??
        DateTime.now().add(const Duration(days: 7));
    _endsAt = event?.endsAt?.toLocal();
    _category = _categories.contains(event?.category)
        ? event!.category
        : 'Other';
  }

  @override
  void dispose() {
    for (final controller in [
      _title,
      _venue,
      _city,
      _country,
      _address,
      _description,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  String _formatDate(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '${local.day}/${local.month}/${local.year} · $hour:$minute';
  }

  Future<DateTime?> _pickDateTime(DateTime initial) async {
    final date = await showDatePicker(
      context: context,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 730)),
      initialDate: initial,
    );
    if (date == null || !mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null) return null;
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  Future<void> _save() async {
    FocusManager.instance.primaryFocus?.unfocus();
    if (!_formKey.currentState!.validate()) return;
    if (_endsAt != null && !_endsAt!.isAfter(_startsAt)) {
      setState(() => _error = 'End time must be after the start time.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final saved = widget.event == null
          ? await widget.api.createEvent(
              title: _title.text.trim(),
              category: _category,
              venue: _venue.text.trim(),
              city: _city.text.trim(),
              country: _country.text.trim(),
              address: _address.text.trim(),
              description: _description.text.trim(),
              startsAt: _startsAt,
              endsAt: _endsAt,
            )
          : await widget.api.updateEvent(
              widget.event!.id,
              title: _title.text.trim(),
              category: _category,
              venue: _venue.text.trim(),
              city: _city.text.trim(),
              country: _country.text.trim(),
              address: _address.text.trim(),
              description: _description.text.trim(),
              startsAt: _startsAt,
              endsAt: _endsAt,
            );
      if (mounted) Navigator.of(context).pop(saved);
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.event != null;
    return Scaffold(
      appBar: AppBar(title: Text(editing ? 'Edit event' : 'Create event')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 36),
                children: [
                  Text(
                    editing
                        ? 'Shape the next version'
                        : 'Start with the essentials',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    editing
                        ? 'Keep the details current for your team and buyers.'
                        : 'Your event starts as a draft. Add ticket tiers and submit it for review from the web dashboard.',
                  ),
                  const SizedBox(height: 24),
                  _sectionLabel(context, 'Event basics'),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _title,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Event title',
                      hintText: 'e.g. Harare After Hours',
                    ),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Title is required'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    initialValue: _category,
                    decoration: const InputDecoration(labelText: 'Category'),
                    items: _categories
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text(value),
                          ),
                        )
                        .toList(),
                    onChanged: (value) =>
                        setState(() => _category = value ?? 'Other'),
                  ),
                  const SizedBox(height: 24),
                  _sectionLabel(context, 'Where it happens'),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _venue,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Venue',
                      hintText: 'e.g. The Garden',
                    ),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Venue is required'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _city,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(labelText: 'City'),
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'City is required'
                              : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _country,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'Country',
                          ),
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'Country is required'
                              : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _address,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Address (optional)',
                    ),
                  ),
                  const SizedBox(height: 24),
                  _sectionLabel(context, 'Schedule'),
                  const SizedBox(height: 12),
                  _dateField(
                    context,
                    label: 'Starts',
                    value: _startsAt,
                    onTap: () async {
                      final value = await _pickDateTime(_startsAt);
                      if (value != null) setState(() => _startsAt = value);
                    },
                  ),
                  const SizedBox(height: 12),
                  _dateField(
                    context,
                    label: 'Ends (optional)',
                    value: _endsAt,
                    onTap: () async {
                      final value = await _pickDateTime(
                        _endsAt ?? _startsAt.add(const Duration(hours: 3)),
                      );
                      if (value != null) setState(() => _endsAt = value);
                    },
                    onClear: _endsAt == null
                        ? null
                        : () => setState(() => _endsAt = null),
                  ),
                  const SizedBox(height: 24),
                  _sectionLabel(context, 'Description'),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _description,
                    maxLines: 5,
                    maxLength: 4000,
                    decoration: const InputDecoration(
                      labelText: 'What should attendees know?',
                      alignLabelWithHint: true,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.errorContainer,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.error_outline,
                            color: Theme.of(context).colorScheme.error,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _error!,
                              style: TextStyle(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onErrorContainer,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.check_rounded),
                    label: Text(
                      _saving
                          ? 'Saving…'
                          : editing
                          ? 'Save changes'
                          : 'Create draft',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Ticket pricing and publishing controls remain in the full TicketPulse dashboard.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _sectionLabel(BuildContext context, String text) => Text(
    text.toUpperCase(),
    style: Theme.of(context).textTheme.labelMedium?.copyWith(
      letterSpacing: 1.2,
      fontWeight: FontWeight.w700,
      color: Theme.of(context).colorScheme.primary,
    ),
  );

  Widget _dateField(
    BuildContext context, {
    required String label,
    required DateTime? value,
    required VoidCallback onTap,
    VoidCallback? onClear,
  }) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(14),
    child: InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: onClear == null
            ? const Icon(Icons.calendar_month_outlined)
            : IconButton(
                onPressed: onClear,
                icon: const Icon(Icons.close_rounded),
              ),
      ),
      child: Text(value == null ? 'Choose date and time' : _formatDate(value)),
    ),
  );
}
