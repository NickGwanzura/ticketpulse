import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';

abstract final class Pulse {
  static const navy = Color(0xFF0A2540);
  static const orange = Color(0xFFC9522A);
  static const muted = Color(0xFF697386);
  static const line = Color(0xFFE3E8EE);
  static const paper = Color(0xFFF6F8FB);

  static ThemeData theme(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final ink = dark ? const Color(0xFFEEF2F6) : navy;
    final secondary = dark ? const Color(0xFFAFBDCC) : const Color(0xFF627185);
    final surface = dark ? const Color(0xFF161F2C) : Colors.white;
    final colors = ColorScheme.fromSeed(seedColor: navy, brightness: brightness)
        .copyWith(
          primary: dark ? const Color(0xFFAFCFF0) : navy,
          onPrimary: dark ? navy : Colors.white,
          secondary: dark ? const Color(0xFFFFB38F) : orange,
          surface: surface,
          onSurface: ink,
          surfaceContainerLow: surface,
          primaryContainer: dark
              ? const Color(0xFF20394E)
              : const Color(0xFFEAF0F6),
          outline: dark ? const Color(0xFF344152) : line,
        );
    final text = ThemeData(brightness: brightness).textTheme
        .apply(fontFamily: 'Inter', bodyColor: ink, displayColor: ink)
        .copyWith(
          headlineLarge: TextStyle(
            fontFamily: 'Inter',
            fontSize: 34,
            fontWeight: FontWeight.w700,
            letterSpacing: -1.3,
            height: 1.16,
            color: ink,
          ),
          headlineMedium: TextStyle(
            fontFamily: 'Inter',
            fontSize: 28,
            fontWeight: FontWeight.w700,
            letterSpacing: -.9,
            height: 1.2,
            color: ink,
          ),
          headlineSmall: TextStyle(
            fontFamily: 'Inter',
            fontSize: 25,
            fontWeight: FontWeight.w700,
            letterSpacing: -.8,
            height: 1.25,
            color: ink,
          ),
          titleLarge: TextStyle(
            fontFamily: 'Inter',
            fontSize: 20,
            fontWeight: FontWeight.w700,
            letterSpacing: -.5,
            color: ink,
          ),
          titleMedium: TextStyle(
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: -.25,
            color: ink,
          ),
          bodyLarge: TextStyle(
            fontFamily: 'Inter',
            fontSize: 16,
            height: 1.5,
            color: ink,
          ),
          bodyMedium: TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            height: 1.5,
            color: secondary,
          ),
          labelLarge: const TextStyle(
            fontFamily: 'Inter',
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        );
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
    );
    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Inter',
      colorScheme: colors,
      textTheme: text,
      scaffoldBackgroundColor: dark ? const Color(0xFF0D1520) : paper,
      appBarTheme: AppBarTheme(
        backgroundColor: dark ? const Color(0xFF0D1520) : paper,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        toolbarHeight: 64,
        titleSpacing: 24,
        iconTheme: IconThemeData(color: ink),
      ),
      cardTheme: CardThemeData(
        color: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 1,
        shadowColor: Colors.black.withValues(alpha: dark ? .28 : .07),
        margin: EdgeInsets.zero,
        shape: shape.copyWith(
          side: BorderSide(
            color: dark ? const Color(0xFF263548) : const Color(0xFFE8EDF2),
          ),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: dark ? const Color(0xFF293543) : line,
        thickness: 1,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        height: 76,
        elevation: 0,
        indicatorColor: dark
            ? const Color(0xFF20394E)
            : const Color(0xFFEEF3F8),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? ink : secondary,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 23,
            color: states.contains(WidgetState.selected) ? ink : secondary,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 18,
        ),
        labelStyle: TextStyle(color: secondary, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: colors.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: colors.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: colors.primary, width: 1.5),
        ),
      ),
      // Pill buttons throughout, like the main actions in Luma and Eventbrite.
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 54),
          shape: const StadiumBorder(),
          textStyle: text.labelLarge?.copyWith(fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 50),
          side: BorderSide(color: colors.outline),
          shape: const StadiumBorder(),
          textStyle: text.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(48, 48),
          textStyle: text.labelLarge,
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: orange,
        linearTrackColor: dark
            ? const Color(0xFF293543)
            : const Color(0xFFEDF1F5),
        linearMinHeight: 4,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

/// Logo sizes, by height. The SVG viewBox is cropped to the artwork, so the
/// height is the visible logo height and width follows the logo's proportions.
abstract final class BrandSize {
  /// App bar. The logo is two stacked lines, so it needs more height than a
  /// one-line wordmark to keep "Ticket Pulse." legible (~13px per line).
  static const double appBar = 36;

  /// Sign-in hero card.
  static const double hero = 56;

  /// Launch/loading screen.
  static const double splash = 72;
}

class BrandWordmark extends StatelessWidget {
  const BrandWordmark({
    super.key,
    this.light = false,
    this.height = BrandSize.appBar,
  });
  final bool light;
  final double height;

  /// Width / height of the cropped logo artwork (viewBox 781 × 427).
  static const double aspectRatio = 781 / 427;

  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    light || Theme.of(context).brightness == Brightness.dark
        ? 'assets/brand/ticketpulse-logo-white.svg'
        : 'assets/brand/ticketpulse-logo.svg',
    height: height,
    width: height * aspectRatio,
    fit: BoxFit.contain,
    alignment: Alignment.centerLeft,
    semanticsLabel: 'TicketPulse',
  );
}

/// Top-of-page heading used by every workspace tab so titles share one size
/// and rhythm: eyebrow, title, optional one-line description.
class PageHeading extends StatelessWidget {
  const PageHeading({
    super.key,
    required this.eyebrow,
    required this.title,
    this.subtitle,
  });
  final String eyebrow;
  final String title;
  final String? subtitle;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow(eyebrow),
        const SizedBox(height: 10),
        Text(title, style: Theme.of(context).textTheme.headlineMedium),
        if (subtitle != null) ...[const SizedBox(height: 6), Text(subtitle!)],
      ],
    ),
  );
}

/// Branded full-screen loading state, continuous with the navy launch splash.
class BrandLoading extends StatelessWidget {
  const BrandLoading({super.key});
  @override
  Widget build(BuildContext context) =>
      const AnnotatedRegion<SystemUiOverlayStyle>(
        // Light status-bar icons on the navy background.
        value: SystemUiOverlayStyle.light,
        child: Scaffold(
          backgroundColor: Pulse.navy,
          body: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                BrandWordmark(light: true, height: BrandSize.splash),
                SizedBox(height: 32),
                SizedBox(
                  width: 120,
                  child: LinearProgressIndicator(
                    color: Color(0xFFFFB38F),
                    backgroundColor: Color(0x33FFFFFF),
                    semanticsLabel: 'Loading your workspace',
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key, this.color});
  final String text;
  final Color? color;
  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.w700,
      letterSpacing: 1.7,
      color: color ?? Theme.of(context).textTheme.bodyMedium?.color,
    ),
  );
}

/// Opens [url] in the system browser, with a snackbar if that fails.
Future<void> openInBrowser(BuildContext context, Uri url) async {
  try {
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      throw Exception();
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open your browser. Please try again.'),
        ),
      );
    }
  }
}
