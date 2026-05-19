import 'dart:math' as math;

import 'package:maplibre_gl/maplibre_gl.dart';

import '../../../../core/geo/haversine.dart';

class RouteDistanceCalculator {
  const RouteDistanceCalculator();

  double shortestDistanceToRouteMeters({
    required LatLng point,
    required List<LatLng> route,
  }) {
    if (route.length < 2) {
      throw ArgumentError('GPX 預設路線至少需要 2 個座標點');
    }

    var shortest = double.infinity;
    for (var i = 0; i < route.length - 1; i++) {
      final distance = distancePointToSegmentMeters(
        point: point,
        segmentStart: route[i],
        segmentEnd: route[i + 1],
      );
      if (distance < shortest) {
        shortest = distance;
      }
    }

    return shortest;
  }

  double distancePointToSegmentMeters({
    required LatLng point,
    required LatLng segmentStart,
    required LatLng segmentEnd,
  }) {
    if (_sameCoordinate(segmentStart, segmentEnd)) {
      return Haversine.distanceMeters(point, segmentStart);
    }

    final originLatRad = Haversine.degreesToRadians(point.latitude);

    ({double x, double y}) project(LatLng coordinate) {
      final x = Haversine.earthRadiusMeters *
          Haversine.degreesToRadians(coordinate.longitude - point.longitude) *
          math.cos(originLatRad);
      final y = Haversine.earthRadiusMeters *
          Haversine.degreesToRadians(coordinate.latitude - point.latitude);
      return (x: x, y: y);
    }

    const p = (x: 0.0, y: 0.0);
    final a = project(segmentStart);
    final b = project(segmentEnd);
    final abX = b.x - a.x;
    final abY = b.y - a.y;
    final apX = p.x - a.x;
    final apY = p.y - a.y;
    final abLengthSquared = abX * abX + abY * abY;

    if (abLengthSquared == 0) {
      return Haversine.distanceMeters(point, segmentStart);
    }

    final t = ((apX * abX + apY * abY) / abLengthSquared)
        .clamp(0.0, 1.0)
        .toDouble();
    final nearestX = a.x + abX * t;
    final nearestY = a.y + abY * t;
    final dx = p.x - nearestX;
    final dy = p.y - nearestY;
    return math.sqrt(dx * dx + dy * dy);
  }

  bool _sameCoordinate(LatLng a, LatLng b) {
    return a.latitude == b.latitude && a.longitude == b.longitude;
  }
}
