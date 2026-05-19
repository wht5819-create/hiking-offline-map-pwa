import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../data/datasources/mbtiles_local_data_source.dart';
import '../../data/repositories/local_mbtiles_repository.dart';
import '../../domain/entities/mbtiles_package.dart';
import '../../domain/usecases/import_mbtiles_package.dart';

class MbtilesManagementPage extends StatefulWidget {
  const MbtilesManagementPage({
    required this.onPackageSelected,
    required this.onStyleSelected,
    super.key,
    this.selectedPackageId,
    this.selectedStylePath,
  });

  final String? selectedPackageId;
  final String? selectedStylePath;
  final ValueChanged<MbtilesPackage> onPackageSelected;
  final ValueChanged<String> onStyleSelected;

  @override
  State<MbtilesManagementPage> createState() => _MbtilesManagementPageState();
}

class _MbtilesManagementPageState extends State<MbtilesManagementPage> {
  final LocalMbtilesRepository _repository = const LocalMbtilesRepository(
    MbtilesLocalDataSource(),
  );

  bool _isLoading = true;
  bool _isImporting = false;
  String? _errorMessage;
  List<MbtilesPackage> _packages = const [];

  @override
  void initState() {
    super.initState();
    _loadPackages();
  }

  Future<void> _loadPackages() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final packages = await _repository.listPackages();
      setState(() => _packages = packages);
    } catch (error) {
      setState(() => _errorMessage = '地圖包讀取失敗：$error');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _pickAndImportPackage() async {
    setState(() {
      _isImporting = true;
      _errorMessage = null;
    });

    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['mbtiles'],
        allowMultiple: false,
      );
      final path = picked?.files.single.path;
      if (path == null) {
        return;
      }

      final imported = await ImportMbtilesPackage(_repository)(path);
      await _loadPackages();
      widget.onPackageSelected(imported);
    } catch (error) {
      setState(() => _errorMessage = '地圖包匯入失敗：$error');
    } finally {
      if (mounted) {
        setState(() => _isImporting = false);
      }
    }
  }

  Future<void> _pickStyleJson() async {
    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['json'],
        allowMultiple: false,
      );
      final path = picked?.files.single.path;
      if (path == null) {
        return;
      }
      widget.onStyleSelected(path);
    } catch (error) {
      setState(() => _errorMessage = 'Style JSON 選擇失敗：$error');
    }
  }

  Future<void> _deletePackage(MbtilesPackage package) async {
    await _repository.deletePackage(package.id);
    await _loadPackages();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('離線地圖包'),
        actions: [
          IconButton(
            tooltip: '重新整理',
            onPressed: _isLoading ? null : _loadPackages,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadPackages,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            FilledButton.icon(
              onPressed: _isImporting ? null : _pickAndImportPackage,
              icon: _isImporting
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add),
              label: const Text('匯入 .mbtiles'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _pickStyleJson,
              icon: const Icon(Icons.palette_outlined),
              label: const Text('選擇 Rudy Map Style JSON'),
            ),
            const SizedBox(height: 8),
            _StyleStatus(path: widget.selectedStylePath),
            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 16),
            if (_isLoading)
              const Center(child: CircularProgressIndicator())
            else if (_packages.isEmpty)
              const _NoMapPackageState()
            else
              ..._packages.map(_buildPackageTile),
          ],
        ),
      ),
    );
  }

  Widget _buildPackageTile(MbtilesPackage package) {
    final selected = package.id == widget.selectedPackageId;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(selected ? Icons.check_circle : Icons.map_outlined),
      title: Text(package.name),
      subtitle: Text(
        '${package.sizeMegabytes.toStringAsFixed(1)} MB · '
        '${package.updatedAt.year}/${package.updatedAt.month}/${package.updatedAt.day}',
      ),
      onTap: () => widget.onPackageSelected(package),
      trailing: IconButton(
        tooltip: selected ? '目前使用中的地圖包不可直接刪除' : '刪除',
        onPressed: selected ? null : () => _deletePackage(package),
        icon: const Icon(Icons.delete_outline),
      ),
    );
  }
}

class _StyleStatus extends StatelessWidget {
  const _StyleStatus({required this.path});

  final String? path;

  @override
  Widget build(BuildContext context) {
    final selectedPath = path;
    final text = selectedPath == null
        ? '目前使用內建 Style template'
        : selectedPath.startsWith('asset:')
            ? '目前使用內建 Rudy Map Style template'
            : selectedPath;

    return Row(
      children: [
        const Icon(Icons.palette_outlined, size: 18),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
      ],
    );
  }
}

class _NoMapPackageState extends StatelessWidget {
  const _NoMapPackageState();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(top: 48),
      child: Center(
        child: Text('尚未匯入離線地圖包'),
      ),
    );
  }
}
