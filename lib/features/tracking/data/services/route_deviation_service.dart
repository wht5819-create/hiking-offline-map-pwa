import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../domain/services/route_distance_calculator.dart';

typedef OffRouteAlertCallback = void Function(OffRouteAlert alert);

class OffRouteAlert {
  const OffRouteAlert({
    required this.currentPosition,
    required this.distanceMeters,
    required this.thresholdMeters,
  });

  final Position currentPosition;
  final double distanceMeters;
  final double thresholdMeters;
}

class RouteDeviationService {
  RouteDeviationService({
    this.offRouteThresholdMeters = 50,
    RouteDistanceCalculator? distanceCalculator,
  }) : _distanceCalculator =
            distanceCalculator ?? const RouteDistanceCalculator();

  final double offRouteThresholdMeters;
  final RouteDistanceCalculator _distanceCalculator;
  StreamSubscription<Position>? _subscription;

  Future<void> start({
    required List<LatLng> route,
    required OffRouteAlertCallback onOffRoute,
    void Function(Position position)? onPosition,
  }) async {
    if (route.length < 2) {
      throw ArgumentError('GPX 預設路線至少需要 2 個座標點');
    }

    await _ensureLocationReady();
    await stop();

    _subscription = Geolocator.getPositionStream(
      locationSettings: _buildLocationSettings(),
    ).listen((position) {
      onPosition?.call(position);
      final distance = shortestDistanceToRouteMeters(
        currentTrack: [position],
        route: route,
      );

      if (distance > offRouteThresholdMeters) {
        onOffRoute(
          OffRouteAlert(
            currentPosition: position,
            distanceMeters: distance,
            thresholdMeters: offRouteThresholdMeters,
          ),
        );
      }
    });
  }

  Future<void> stop() async {
    await _subscription?.cancel();
    _subscription = null;
  }

  double shortestDistanceToRouteMeters({
    required List<Position> currentTrack,
    required List<LatLng> route,
  }) {
    if (currentTrack.isEmpty) {
      throw ArgumentError('目前 GPS 座標不得為空');
    }
    if (route.length < 2) {
      throw ArgumentError('GPX 預設路線至少需要 2 個座標點');
    }

    final current = currentTrack.last;
    return _distanceCalculator.shortestDistanceToRouteMeters(
      point: LatLng(current.latitude, current.longitude),
      route: route,
    );
  }

  LocationSettings _buildLocationSettings() {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return AndroidSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 10,
        intervalDuration: const Duration(seconds: 10),
      );
    }

    if (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 10,
        pauseLocationUpdatesAutomatically: true,
      );
    }

    return const LocationSettings(
      accuracy: LocationAccuracy.best,
      distanceFilter: 10,
      timeLimit: Duration(seconds: 10),
    );
  }

  Future<void> _ensureLocationReady() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw StateError('定位服務未開啟');
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw StateError('沒有 GPS 定位權限');
    }
  }
}
