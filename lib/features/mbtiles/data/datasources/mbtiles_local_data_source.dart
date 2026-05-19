import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../domain/entities/mbtiles_package.dart';

class MbtilesLocalDataSource {
  const MbtilesLocalDataSource();

  Future<Directory> mapsDirectory() async {
    final supportDir = await getApplicationSupportDirectory();
    final directory = Directory(p.join(supportDir.path, 'offline_maps'));
    if (!directory.existsSync()) {
      await directory.create(recursive: true);
    }
    return directory;
  }

  Future<List<MbtilesPackage>> listPackages() async {
    final directory = await mapsDirectory();
    final files = directory
        .listSync()
        .whereType<File>()
        .where((file) => p.extension(file.path).toLowerCase() == '.mbtiles')
        .toList()
      ..sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));

    return files.map(_toPackage).toList(growable: false);
  }

  Future<MbtilesPackage> copyIntoManagedDirectory(
    String sourcePath, {
    String? displayName,
  }) async {
    final source = File(sourcePath);
    if (!source.existsSync()) {
      throw StateError('找不到離線地圖檔：$sourcePath');
    }
    if (!await isValidMbtilesFile(sourcePath)) {
      throw StateError('檔案不是有效的 MBTiles：$sourcePath');
    }

    final directory = await mapsDirectory();
    final baseName = _safeFileName(
      displayName?.trim().isNotEmpty == true
          ? displayName!.trim()
          : p.basenameWithoutExtension(sourcePath),
    );
    final targetPath = await _availablePath(directory.path, '$baseName.mbtiles');
    final copied = await source.copy(targetPath);
    return _toPackage(copied);
  }

  Future<void> deletePackage(String packageId) async {
    final directory = await mapsDirectory();
    final file = File(p.join(directory.path, '$packageId.mbtiles'));
    if (file.existsSync()) {
      await file.delete();
    }
  }

  Future<bool> isValidMbtilesFile(String path) async {
    final file = File(path);
    if (!file.existsSync()) {
      return false;
    }
    if (p.extension(path).toLowerCase() != '.mbtiles') {
      return false;
    }

    final stream = file.openRead(0, 16);
    final bytes = <int>[];
    await for (final chunk in stream) {
      bytes.addAll(chunk);
    }
    return String.fromCharCodes(bytes) == 'SQLite format 3\u0000';
  }

  MbtilesPackage _toPackage(File file) {
    final stat = file.statSync();
    final id = p.basenameWithoutExtension(file.path);
    return MbtilesPackage(
      id: id,
      name: id,
      path: file.path,
      sizeBytes: stat.size,
      updatedAt: stat.modified,
    );
  }

  Future<String> _availablePath(String directoryPath, String fileName) async {
    final extension = p.extension(fileName);
    final name = p.basenameWithoutExtension(fileName);
    var candidate = p.join(directoryPath, fileName);
    var index = 2;
    while (File(candidate).existsSync()) {
      candidate = p.join(directoryPath, '$name-$index$extension');
      index += 1;
    }
    return candidate;
  }

  String _safeFileName(String input) {
    final sanitized = input
        .replaceAll(RegExp(r'[<>:"/\\|?*]'), '_')
        .replaceAll(RegExp(r'\s+'), '_');
    return sanitized.isEmpty ? 'offline_map' : sanitized;
  }
}
