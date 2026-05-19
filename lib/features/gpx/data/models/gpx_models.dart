import 'dart:convert';

import 'package:maplibre_gl/maplibre_gl.dart';

class GpxTrackPoint {
  const GpxTrackPoint({
    required this.latitude,
    required this.longitude,
    this.elevationMeters,
  });

  final double latitude;
  final double longitude;
  final double? elevationMeters;

  LatLng toLatLng() => LatLng(latitude, longitude);
}

class GpxWaypoint {
  const GpxWaypoint({
    required this.name,
    required this.latitude,
    required this.longitude,
    this.elevationMeters,
  });

  final String name;
  final double latitude;
  final double longitude;
  final double? elevationMeters;

  LatLng toLatLng() => LatLng(latitude, longitude);
}

class ParsedGpx {
  const ParsedGpx({
    required this.trackPoints,
    required this.waypoints,
  });

  final List<GpxTrackPoint> trackPoints;
  final List<GpxWaypoint> waypoints;

  List<LatLng> get routeLatLngs =>
      trackPoints.map((point) => point.toLatLng()).toList(growable: false);

  LineOptions toRouteLineOptions({
    String color = '#f05a28',
    double width = 4,
    double opacity = 0.9,
  }) {
    return LineOptions(
      geometry: routeLatLngs,
      lineColor: color,
      lineWidth: width,
      lineOpacity: opacity,
    );
  }

  String toGeoJsonLineString() {
    final coordinates = trackPoints
        .map((point) => [
              point.longitude,
              point.latitude,
              if (point.elevationMeters != null) point.elevationMeters,
            ])
        .toList(growable: false);

    return jsonEncode({
      'type': 'Feature',
      'geometry': {
        'type': 'LineString',
        'coordinates': coordinates,
      },
      'properties': {
        'source': 'gpx',
        'point_count': trackPoints.length,
      },
    });
  }
}
