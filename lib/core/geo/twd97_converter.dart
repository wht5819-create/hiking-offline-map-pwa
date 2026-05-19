import 'dart:math' as math;

class Twd97Coordinate {
  const Twd97Coordinate({
    required this.x,
    required this.y,
  });

  final double x;
  final double y;
}

class Wgs84Coordinate {
  const Wgs84Coordinate({
    required this.latitude,
    required this.longitude,
  });

  final double latitude;
  final double longitude;
}

abstract interface class CoordinateConverter {
  Twd97Coordinate wgs84ToTwd97(Wgs84Coordinate coordinate);
}

class Twd97Converter implements CoordinateConverter {
  static const double _a = 6378137.0;
  static const double _b = 6356752.314245;
  static const double _lon0 = 121 * 0.017453292519943295;
  static const double _k0 = 0.9999;
  static const double _dx = 250000.0;

  const Twd97Converter();

  @override
  Twd97Coordinate wgs84ToTwd97(Wgs84Coordinate coordinate) {
    final lat = coordinate.latitude * 0.017453292519943295;
    final lon = coordinate.longitude * 0.017453292519943295;
    final e = (1 - (_b * _b) / (_a * _a));
    final e2 = e / (1 - e);
    final n = _a / math.sqrt(1 - e * math.sin(lat) * math.sin(lat));
    final t = math.tan(lat) * math.tan(lat);
    final c = e2 * math.cos(lat) * math.cos(lat);
    final a = math.cos(lat) * (lon - _lon0);
    final m = _a *
        ((1.0 - e / 4.0 - 3.0 * e * e / 64.0 - 5.0 * e * e * e / 256.0) *
                lat -
            (3.0 * e / 8.0 + 3.0 * e * e / 32.0 + 45.0 * e * e * e / 1024.0) *
                math.sin(2.0 * lat) +
            (15.0 * e * e / 256.0 + 45.0 * e * e * e / 1024.0) *
                math.sin(4.0 * lat) -
            (35.0 * e * e * e / 3072.0) * math.sin(6.0 * lat));

    final x = _dx +
        _k0 *
            n *
            (a +
                (1.0 - t + c) * a * a * a / 6.0 +
                (5.0 - 18.0 * t + t * t + 72.0 * c - 58.0 * e2) *
                    a *
                    a *
                    a *
                    a *
                    a /
                    120.0);
    final y = _k0 *
        (m +
            n *
                math.tan(lat) *
                (a * a / 2.0 +
                    (5.0 - t + 9.0 * c + 4.0 * c * c) * a * a * a * a / 24.0 +
                    (61.0 - 58.0 * t + t * t + 600.0 * c - 330.0 * e2) *
                        a *
                        a *
                        a *
                        a *
                        a *
                        a /
                        720.0));

    return Twd97Coordinate(x: x, y: y);
  }
}
