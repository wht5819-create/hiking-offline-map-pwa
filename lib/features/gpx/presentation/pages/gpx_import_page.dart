import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../data/models/gpx_models.dart';
import '../../data/services/gpx_parser.dart';
import '../../domain/usecases/import_gpx_route.dart';

class GpxImportPage extends StatefulWidget {
  const GpxImportPage({
    required this.onRouteImported,
    super.key,
    this.selectedRoute,
  });

  final ParsedGpx? selectedRoute;
  final ValueChanged<ParsedGpx> onRouteImported;

  @override
  State<GpxImportPage> createState() => _GpxImportPageState();
}

class _GpxImportPageState extends State<GpxImportPage> {
  final ImportGpxRoute _importRoute = const ImportGpxRoute(GpxParser());

  bool _isImporting = false;
  String? _errorMessage;
  ParsedGpx? _route;

  @override
  void initState() {
    super.initState();
    _route = widget.selectedRoute;
  }

  @override
  void didUpdateWidget(covariant GpxImportPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedRoute != widget.selectedRoute) {
      _route = widget.selectedRoute;
    }
  }

  Future<void> _pickAndImportGpx() async {
    setState(() {
      _isImporting = true;
      _errorMessage = null;
    });

    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['gpx'],
        allowMultiple: false,
      );
      final path = picked?.files.single.path;
      if (path == null) {
        return;
      }

      final route = await _importRoute(path);
      setState(() => _route = route);
      widget.onRouteImported(route);
    } on GpxParseException catch (error) {
      setState(() => _errorMessage = error.toString());
    } catch (error) {
      setState(() => _errorMessage = 'GPX 匯入失敗：$error');
    } finally {
      if (mounted) {
        setState(() => _isImporting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final route = _route;
    return Scaffold(
      appBar: AppBar(title: const Text('GPX 航跡')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          FilledButton.icon(
            onPressed: _isImporting ? null : _pickAndImportGpx,
            icon: _isImporting
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.upload_file),
            label: const Text('匯入 GPX'),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(
              _errorMessage!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 24),
          if (route == null) const _NoRouteState() else _RouteSummary(route: route),
        ],
      ),
    );
  }
}

class _NoRouteState extends StatelessWidget {
  const _NoRouteState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.only(top: 48),
        child: Text('尚未匯入 GPX 航跡'),
      ),
    );
  }
}

class _RouteSummary extends StatelessWidget {
  const _RouteSummary({required this.route});

  final ParsedGpx route;

  @override
  Widget build(BuildContext context) {
    final elevations = route.trackPoints
        .map((point) => point.elevationMeters)
        .whereType<double>()
        .toList(growable: false);
    final minElevation = elevations.isEmpty
        ? null
        : elevations.reduce((a, b) => a < b ? a : b).round();
    final maxElevation = elevations.isEmpty
        ? null
        : elevations.reduce((a, b) => a > b ? a : b).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('航跡摘要', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        _SummaryTile(label: '軌跡點', value: '${route.trackPoints.length} 點'),
        _SummaryTile(label: '航點', value: '${route.waypoints.length} 個'),
        _SummaryTile(
          label: '高度',
          value: minElevation == null ? '無高度資料' : '$minElevation - $maxElevation m',
        ),
        if (route.waypoints.isNotEmpty) ...[
          const SizedBox(height: 20),
          Text('航點', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          ...route.waypoints.map(
            (waypoint) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.place_outlined),
              title: Text(waypoint.name),
              subtitle: Text(
                '${waypoint.latitude.toStringAsFixed(5)}, '
                '${waypoint.longitude.toStringAsFixed(5)}',
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      trailing: Text(value),
    );
  }
}
