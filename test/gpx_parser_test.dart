import 'package:flutter_test/flutter_test.dart';
import 'package:hiking_offline_map_app/features/gpx/data/services/gpx_parser.dart';

void main() {
  test('parses track points and waypoints from GPX XML', () {
    const gpx = '''
<gpx version="1.1">
  <wpt lat="24.1200" lon="121.2500">
    <name>水源</name>
    <ele>1850</ele>
  </wpt>
  <trk>
    <trkseg>
      <trkpt lat="24.1000" lon="121.2000"><ele>1200</ele></trkpt>
      <trkpt lat="24.1100" lon="121.2100"><ele>1300</ele></trkpt>
    </trkseg>
  </trk>
</gpx>
''';

    final result = const GpxParser().parseString(gpx);

    expect(result.trackPoints, hasLength(2));
    expect(result.trackPoints.first.latitude, 24.1000);
    expect(result.trackPoints.first.elevationMeters, 1200);
    expect(result.waypoints.single.name, '水源');
    expect(result.routeLatLngs, hasLength(2));
  });

  test('throws a readable exception for broken GPX XML', () {
    expect(
      () => const GpxParser().parseString('<gpx><trkpt></gpx>'),
      throwsA(isA<GpxParseException>()),
    );
  });
}
