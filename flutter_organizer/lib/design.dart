import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

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
        .apply(fontFamily: 'Manrope', bodyColor: ink, displayColor: ink)
        .copyWith(
          headlineLarge: TextStyle(
            fontFamily: 'Manrope',
            fontSize: 34,
            fontWeight: FontWeight.w700,
            letterSpacing: -1.3,
            height: 1.16,
            color: ink,
          ),
          headlineMedium: TextStyle(
            fontFamily: 'Manrope',
            fontSize: 28,
            fontWeight: FontWeight.w700,
            letterSpacing: -.9,
            height: 1.2,
            color: ink,
          ),
          headlineSmall: TextStyle(
            fontFamily: 'Manrope',
            fontSize: 25,
            fontWeight: FontWeight.w700,
            letterSpacing: -.8,
            height: 1.25,
            color: ink,
          ),
          titleLarge: TextStyle(
            fontFamily: 'Manrope',
            fontSize: 20,
            fontWeight: FontWeight.w700,
            letterSpacing: -.5,
            color: ink,
          ),
          titleMedium: TextStyle(
            fontFamily: 'Manrope',
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: -.25,
            color: ink,
          ),
          bodyLarge: TextStyle(
            fontFamily: 'Manrope',
            fontSize: 16,
            height: 1.5,
            color: ink,
          ),
          bodyMedium: TextStyle(
            fontFamily: 'Manrope',
            fontSize: 14,
            height: 1.5,
            color: secondary,
          ),
          labelLarge: const TextStyle(
            fontFamily: 'Manrope',
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        );
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
    );
    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Manrope',
      colorScheme: colors,
      textTheme: text,
      scaffoldBackgroundColor: dark ? const Color(0xFF0D1520) : paper,
      appBarTheme: AppBarTheme(
        backgroundColor: dark ? const Color(0xFF0D1520) : paper,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        toolbarHeight: 76,
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
            fontFamily: 'Manrope',
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
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(48, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: text.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 48),
          side: BorderSide(color: colors.outline),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
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

class BrandWordmark extends StatelessWidget {
  const BrandWordmark({super.key, this.light = false});
  final bool light;
  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    light || Theme.of(context).brightness == Brightness.dark
        ? 'assets/brand/ticketpulse-logo-white.svg'
        : 'assets/brand/ticketpulse-logo.svg',
    width: 112,
    height: 56,
    fit: BoxFit.contain,
    alignment: Alignment.centerLeft,
    semanticsLabel: 'TicketPulse',
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
