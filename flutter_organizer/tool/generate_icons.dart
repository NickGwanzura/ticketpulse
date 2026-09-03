// Render the official SVG into native launcher icon sizes. Run with flutter test.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('generate native TicketPulse launcher icons', () async {
    final picture = await vg.loadPicture(
      SvgStringLoader(
        File('assets/brand/ticketpulse-logo.svg').readAsStringSync(),
      ),
      null,
    );
    final targets = <String, int>{};
    for (final density in {
      'mdpi': 48,
      'hdpi': 72,
      'xhdpi': 96,
      'xxhdpi': 144,
      'xxxhdpi': 192,
    }.entries) {
      targets['android/app/src/main/res/mipmap-${density.key}/ic_launcher.png'] =
          density.value;
    }
    const ios = 'ios/Runner/Assets.xcassets/AppIcon.appiconset';
    final catalog =
        jsonDecode(File('$ios/Contents.json').readAsStringSync())
            as Map<String, dynamic>;
    for (final entry in catalog['images'] as List) {
      final size = double.parse((entry['size'] as String).split('x').first);
      final scale = double.parse(
        (entry['scale'] as String).replaceAll('x', ''),
      );
      targets['$ios/${entry['filename']}'] = (size * scale).round();
    }
    for (final target in targets.entries) {
      final size = target.value;
      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);
      canvas.drawRect(
        ui.Rect.fromLTWH(0, 0, size.toDouble(), size.toDouble()),
        ui.Paint()..color = const ui.Color(0xFFFFFFFF),
      );
      final scale = size * .84 / picture.size.width;
      canvas.translate(size * .08, (size - picture.size.height * scale) / 2);
      canvas.scale(scale);
      canvas.drawPicture(picture.picture);
      final drawing = recorder.endRecording();
      final image = await drawing.toImage(size, size);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await File(target.key).writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
      drawing.dispose();
    }
    picture.picture.dispose();
  });
}
