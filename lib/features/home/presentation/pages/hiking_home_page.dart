import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../../gpx/data/models/gpx_models.dart';
import '../../../gpx/presentation/pages/gpx_import_page.dart';
import '../../../mbtiles/domain/entities/mbtiles_package.dart';
import '../../../mbtiles/presentation/pages/mbtiles_management_page.dart';
import '../../../offline_map/presentation/widgets/offline_map_view.dart';

class HikingHomePage extends StatefulWidget {
  const HikingHomePage({super.key});

  @override
  State<HikingHomePage> createState() => _HikingHomePageState();
}

class _HikingHomePageState extends State<HikingHomePage> {
  static const _defaultStylePath =
      'asset:assets/map_styles/rudy_map_offline_style.template.json';

  int _tabIndex = 0;
  ParsedGpx? _route;
  MbtilesPackage? _selectedMapPackage;
  String _stylePath = _defaultStylePath;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _tabIndex,
        children: [
          _buildMapTab(),
          GpxImportPage(
            selectedRoute: _route,
            onRouteImported: (route) {
              setState(() {
                _route = route;
                _tabIndex = 0;
              });
            },
          ),
          MbtilesManagementPage(
            selectedPackageId: _selectedMapPackage?.id,
            selectedStylePath: _stylePath,
            onPackageSelected: (package) {
              setState(() {
                _selectedMapPackage = package;
                _tabIndex = 0;
              });
            },
            onStyleSelected: (path) {
              setState(() {
                _stylePath = path;
                _tabIndex = 0;
              });
            },
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (index) => setState(() => _tabIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: '地圖',
          ),
          NavigationDestination(
            icon: Icon(Icons.route_outlined),
            selectedIcon: Icon(Icons.route),
            label: 'GPX',
          ),
          NavigationDestination(
            icon: Icon(Icons.layers_outlined),
            selectedIcon: Icon(Icons.layers),
            label: '地圖包',
          ),
        ],
      ),
    );
  }

  Widget _buildMapTab() {
    final mapPackage = _selectedMapPackage;
    if (mapPackage == null) {
      return const _EmptyMapState();
    }

    return OfflineMapView(
      key: ValueKey(mapPackage.path),
      mbtilesPath: mapPackage.path,
      styleJsonPath: _stylePath,
      routePoints: _route?.routeLatLngs ?? const <LatLng>[],
    );
  }
}

class _EmptyMapState extends StatelessWidget {
  const _EmptyMapState();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('離線地圖')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.layers_clear, size: 48),
              const SizedBox(height: 16),
              Text(
                '尚未選擇離線地圖包',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              const Text(
                '請到「地圖包」匯入並選擇 .mbtiles 檔案後，再回到地圖查看。',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
