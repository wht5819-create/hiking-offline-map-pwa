import 'package:flutter_test/flutter_test.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import 'package:hiking_offline_map_app/features/tracking/domain/services/route_distance_calculator.dart';

void main() {
  test('returns near zero when point is on route segment', () {
    const calculator = RouteDistanceCalculator();
    final distance = calculator.shortestDistanceToRouteMeters(
      point: const LatLng(24.0, 121.005),
      route: const [
        LatLng(24.0, 121.0),
        LatLng(24.0, 121.01),
      ],
    );

    expect(distance, lessThan(1));
  });

  test('calculates distance from point to route segment', () {
    const calculator = RouteDistanceCalculator();
    final distance = calculator.shortestDistanceToRouteMeters(
      point: const LatLng(24.001, 121.005),
      route: const [
        LatLng(24.0, 121.0),
        LatLng(24.0, 121.01),
      ],
    );

    expect(distance, greaterThan(100));
    expect(distance, lessThan(125));
  });
}
