import 'dart:math' as math;

import 'package:maplibre_gl/maplibre_gl.dart';

class Haversine {
  static const double earthRadiusMeters = 6371008.8;

  const Haversine._();

  static double distanceMeters(LatLng from, LatLng to) {
    final lat1 = _degreesToRadians(from.latitude);
    final lat2 = _degreesToRadians(to.latitude);
    final deltaLat = _degreesToRadians(to.latitude - from.latitude);
    final deltaLng = _degreesToRadians(to.longitude - from.longitude);

    final a = math.pow(math.sin(deltaLat / 2), 2) +
        math.cos(lat1) *
            math.cos(lat2) *
            math.pow(math.sin(deltaLng / 2), 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadiusMeters * c;
  }

  static double degreesToRadians(double degrees) => _degreesToRadians(degrees);

  static double _degreesToRadians(double degrees) => degrees * math.pi / 180;
}
