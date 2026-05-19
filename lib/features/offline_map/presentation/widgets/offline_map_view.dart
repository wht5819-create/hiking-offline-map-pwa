import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../../mbtiles/data/services/mbtiles_tile_server.dart';
import '../../../tracking/data/services/route_deviation_service.dart';

class OfflineMapView extends StatefulWidget {
  const OfflineMapView({
    required this.mbtilesPath,
    required this.styleJsonPath,
    super.key,
    this.initialCameraPosition = const CameraPosition(
      target: LatLng(23.6978, 120.9605),
      zoom: 8,
    ),
    this.contourLayerIds = const [
      'contour',
      'contour-line',
      'contour-label',
      'rudy-contour',
      'rudy-contour-label',
    ],
    this.traditionalRoadLayerIds = const [
      'ypd-road',
      'ypd-road-label',
      'traditional-route',
      'traditional-route-label',
      'rudy-trail',
      'rudy-trail-label',
    ],
    this.routePoints = const <LatLng>[],
  });

  final String mbtilesPath;
  final String styleJsonPath;
  final CameraPosition initialCameraPosition;
  final List<String> contourLayerIds;
  final List<String> traditionalRoadLayerIds;
  final List<LatLng> routePoints;

  @override
  State<OfflineMapView> createState() => OfflineMapViewState();
}

class OfflineMapViewState extends State<OfflineMapView> {
  final Completer<MapLibreMapController> _controller = Completer();

  String? _styleString;
  Object? _loadError;
  Line? _routeLine;
  final RouteDeviationService _routeDeviationService = RouteDeviationService();
  MbtilesTileServer? _tileServer;
  bool _styleLoaded = false;
  bool _contoursVisible = true;
  bool _traditionalRoadsVisible = true;
  bool _trackingEnabled = false;
  OffRouteAlert? _lastOffRouteAlert;

  @override
  void initState() {
    super.initState();
    _loadOfflineStyle();
  }

  @override
  void didUpdateWidget(covariant OfflineMapView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mbtilesPath != widget.mbtilesPath ||
        oldWidget.styleJsonPath != widget.styleJsonPath) {
      _styleLoaded = false;
      _routeLine = null;
      unawaited(_loadOfflineStyle());
    }
    if (oldWidget.routePoints != widget.routePoints) {
      if (_trackingEnabled) {
        unawaited(_routeDeviationService.stop());
        _trackingEnabled = false;
        _lastOffRouteAlert = null;
      }
      _drawRouteOverlay();
    }
  }

  @override
  void dispose() {
    unawaited(_routeDeviationService.stop());
    unawaited(_tileServer?.stop());
    super.dispose();
  }

  Future<void> setContoursVisible(bool visible) async {
    _contoursVisible = visible;
    await _setLayerVisibility(widget.contourLayerIds, visible);
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> setTraditionalRoadsVisible(bool visible) async {
    _traditionalRoadsVisible = visible;
    await _setLayerVisibility(widget.traditionalRoadLayerIds, visible);
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _toggleTracking() async {
    if (_trackingEnabled) {
      await _routeDeviationService.stop();
      if (mounted) {
        setState(() {
          _trackingEnabled = false;
          _lastOffRouteAlert = null;
        });
      }
      return;
    }

    if (widget.routePoints.length < 2) {
      _showMessage('請先匯入 GPX 航跡，再啟動偏離警報');
      return;
    }

    try {
      await _routeDeviationService.start(
        route: widget.routePoints,
        onPosition: (_) {
          if (mounted && !_trackingEnabled) {
            setState(() => _trackingEnabled = true);
          }
        },
        onOffRoute: (alert) {
          if (!mounted) {
            return;
          }
          setState(() => _lastOffRouteAlert = alert);
          _showMessage(
            '偏離航線 ${alert.distanceMeters.toStringAsFixed(0)} 公尺',
          );
        },
      );
      if (mounted) {
        setState(() => _trackingEnabled = true);
        _showMessage('偏離航線警報已啟動');
      }
    } catch (error) {
      _showMessage('無法啟動定位：$error');
    }
  }

  void _showMessage(String message) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _loadOfflineStyle() async {
    try {
      final styleFile = File(widget.styleJsonPath);
      if (!widget.styleJsonPath.startsWith('asset:') && !styleFile.existsSync()) {
        throw StateError('找不到地圖樣式檔：${widget.styleJsonPath}');
      }

      final mbtilesFile = File(widget.mbtilesPath);
      if (!mbtilesFile.existsSync()) {
        throw StateError('找不到離線地圖包：${widget.mbtilesPath}');
      }

      await _tileServer?.stop();
      final tileServer = MbtilesTileServer(widget.mbtilesPath);
      await tileServer.start();
      _tileServer = tileServer;

      final rawStyle = await _readStyleJson(widget.styleJsonPath);
      final resolvedStyle = _resolveStylePlaceholders(
        rawStyle,
        widget.mbtilesPath,
        tileServer.tileUrlTemplate,
      );

      if (mounted) {
        setState(() {
          _styleString = resolvedStyle;
          _loadError = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _loadError = error);
      }
    }
  }

  Future<String> _readStyleJson(String path) {
    if (path.startsWith('asset:')) {
      return rootBundle.loadString(path.substring('asset:'.length));
    }
    return File(path).readAsString();
  }

  String _resolveStylePlaceholders(
    String rawStyle,
    String mbtilesPath,
    String tileUrlTemplate,
  ) {
    final normalizedPath = mbtilesPath.replaceAll('\\', '/');
    final mbtilesUri = 'mbtiles://$normalizedPath';
    final style = rawStyle
        .replaceAll('{{MBTILES_PATH}}', normalizedPath)
        .replaceAll('{{MBTILES_URI}}', mbtilesUri)
        .replaceAll('{{TILE_URL_TEMPLATE}}', tileUrlTemplate);

    final decoded = jsonDecode(style) as Map<String, dynamic>;
    _rewriteVectorSources(decoded, tileUrlTemplate, mbtilesUri);
    return jsonEncode(decoded);
  }

  void _rewriteVectorSources(
    Map<String, dynamic> style,
    String tileUrlTemplate,
    String mbtilesUri,
  ) {
    final sources = style['sources'];
    if (sources is! Map<String, dynamic>) {
      return;
    }

    for (final source in sources.values) {
      if (source is! Map<String, dynamic>) {
        continue;
      }
      if (source['type'] != 'vector') {
        continue;
      }

      final url = source['url'];
      final tiles = source['tiles'];
      final shouldRewriteUrl = url is String &&
          (url == mbtilesUri || url.startsWith('mbtiles://'));
      final shouldRewriteTiles = tiles is List &&
          tiles.any((tile) => tile is String && tile.contains('{{TILE_URL_TEMPLATE}}'));

      if (shouldRewriteUrl || shouldRewriteTiles) {
        source
          ..remove('url')
          ..['tiles'] = [tileUrlTemplate]
          ..putIfAbsent('minzoom', () => 0)
          ..putIfAbsent('maxzoom', () => 16);
      }
    }
  }

  Future<void> _setLayerVisibility(List<String> layerIds, bool visible) async {
    if (!_styleLoaded || !_controller.isCompleted) {
      return;
    }

    final controller = await _controller.future;
    for (final layerId in layerIds) {
      try {
        await controller.setLayerVisibility(layerId, visible);
      } catch (_) {
        // Rudy Map style names can vary by build. Missing optional layers are ignored.
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadError != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('離線地圖')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              '地圖載入失敗\n$_loadError',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final styleString = _styleString;
    if (styleString == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('離線地圖'),
        actions: [
          IconButton(
            tooltip: '等高線',
            onPressed: () => setContoursVisible(!_contoursVisible),
            icon: Icon(_contoursVisible ? Icons.terrain : Icons.terrain_outlined),
          ),
          IconButton(
            tooltip: '傳統路網',
            onPressed: () => setTraditionalRoadsVisible(!_traditionalRoadsVisible),
            icon: Icon(
              _traditionalRoadsVisible ? Icons.alt_route : Icons.route_outlined,
            ),
          ),
          IconButton(
            tooltip: '偏離警報',
            onPressed: _toggleTracking,
            icon: Icon(
              _trackingEnabled ? Icons.gps_fixed : Icons.gps_not_fixed,
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          MapLibreMap(
            initialCameraPosition: widget.initialCameraPosition,
            styleString: styleString,
            myLocationEnabled: true,
            myLocationTrackingMode: MyLocationTrackingMode.tracking,
            compassEnabled: true,
            onMapCreated: (controller) {
              if (!_controller.isCompleted) {
                _controller.complete(controller);
              }
            },
            onStyleLoadedCallback: () async {
              _styleLoaded = true;
              await setContoursVisible(_contoursVisible);
              await setTraditionalRoadsVisible(_traditionalRoadsVisible);
              await _drawRouteOverlay();
            },
          ),
          Positioned(
            left: 12,
            right: 12,
            bottom: 12,
            child: _SafetyStatusBar(
              trackingEnabled: _trackingEnabled,
              hasRoute: widget.routePoints.length >= 2,
              lastAlert: _lastOffRouteAlert,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _drawRouteOverlay() async {
    if (!_styleLoaded || !_controller.isCompleted) {
      return;
    }

    final controller = await _controller.future;
    final existingLine = _routeLine;
    if (existingLine != null) {
      await controller.removeLine(existingLine);
      _routeLine = null;
    }

    if (widget.routePoints.length < 2) {
      return;
    }

    _routeLine = await controller.addLine(
      LineOptions(
        geometry: widget.routePoints,
        lineColor: '#f05a28',
        lineOpacity: 0.95,
        lineWidth: 4,
      ),
    );
  }
}

class _SafetyStatusBar extends StatelessWidget {
  const _SafetyStatusBar({
    required this.trackingEnabled,
    required this.hasRoute,
    required this.lastAlert,
  });

  final bool trackingEnabled;
  final bool hasRoute;
  final OffRouteAlert? lastAlert;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final alert = lastAlert;
    final label = !hasRoute
        ? '尚未載入 GPX'
        : trackingEnabled
            ? alert == null
                ? '偏離警報運作中'
                : '偏離 ${alert.distanceMeters.toStringAsFixed(0)} 公尺'
            : '偏離警報未啟動';
    final backgroundColor = alert == null
        ? colorScheme.surface.withOpacity(0.92)
        : colorScheme.errorContainer.withOpacity(0.95);
    final foregroundColor =
        alert == null ? colorScheme.onSurface : colorScheme.onErrorContainer;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
        boxShadow: const [
          BoxShadow(
            blurRadius: 8,
            color: Color(0x26000000),
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            Icon(
              trackingEnabled ? Icons.shield : Icons.shield_outlined,
              color: foregroundColor,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: foregroundColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
