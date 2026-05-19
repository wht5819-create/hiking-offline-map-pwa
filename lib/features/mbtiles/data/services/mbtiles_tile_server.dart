import 'dart:io';
import 'dart:typed_data';

import 'package:sqlite3/sqlite3.dart';

class MbtilesTileServer {
  MbtilesTileServer(this.mbtilesPath);

  final String mbtilesPath;

  HttpServer? _server;
  Database? _database;

  Uri? get baseUri {
    final server = _server;
    if (server == null) {
      return null;
    }
    return Uri.parse('http://127.0.0.1:${server.port}');
  }

  String get tileUrlTemplate {
    final uri = baseUri;
    if (uri == null) {
      throw StateError('MBTiles tile server 尚未啟動');
    }
    return '${uri.toString()}/tiles/{z}/{x}/{y}.pbf';
  }

  Future<void> start() async {
    if (_server != null) {
      return;
    }

    final file = File(mbtilesPath);
    if (!file.existsSync()) {
      throw StateError('找不到離線地圖包：$mbtilesPath');
    }

    _database = sqlite3.open(mbtilesPath);
    _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server!.listen(_handleRequest);
  }

  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
    _database?.dispose();
    _database = null;
  }

  Future<void> _handleRequest(HttpRequest request) async {
    try {
      final pathSegments = request.uri.pathSegments;
      if (pathSegments.length == 4 && pathSegments.first == 'tiles') {
        await _serveTile(request, pathSegments);
        return;
      }
      if (pathSegments.length == 1 && pathSegments.first == 'health') {
        request.response
          ..statusCode = HttpStatus.ok
          ..write('ok');
        await request.response.close();
        return;
      }

      request.response.statusCode = HttpStatus.notFound;
      await request.response.close();
    } catch (_) {
      request.response.statusCode = HttpStatus.internalServerError;
      await request.response.close();
    }
  }

  Future<void> _serveTile(HttpRequest request, List<String> pathSegments) async {
    final database = _database;
    if (database == null) {
      request.response.statusCode = HttpStatus.serviceUnavailable;
      await request.response.close();
      return;
    }

    final z = int.tryParse(pathSegments[1]);
    final x = int.tryParse(pathSegments[2]);
    final yWithExtension = pathSegments[3];
    final y = int.tryParse(yWithExtension.split('.').first);
    if (z == null || x == null || y == null || z < 0 || x < 0 || y < 0) {
      request.response.statusCode = HttpStatus.badRequest;
      await request.response.close();
      return;
    }

    final tmsY = (1 << z) - 1 - y;
    final result = database.select(
      '''
      SELECT tile_data
      FROM tiles
      WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?
      LIMIT 1
      ''',
      [z, x, tmsY],
    );

    if (result.isEmpty) {
      request.response.statusCode = HttpStatus.notFound;
      await request.response.close();
      return;
    }

    final tileData = _normalizeTileData(result.first['tile_data']);
    request.response.headers
      ..contentType = ContentType('application', 'x-protobuf')
      ..set(HttpHeaders.cacheControlHeader, 'public, max-age=86400');
    if (_isGzip(tileData)) {
      request.response.headers.set(HttpHeaders.contentEncodingHeader, 'gzip');
    }
    request.response.add(tileData);
    await request.response.close();
  }

  Uint8List _normalizeTileData(Object? value) {
    if (value is Uint8List) {
      return value;
    }
    if (value is List<int>) {
      return Uint8List.fromList(value);
    }
    throw StateError('MBTiles tile_data 格式不是 binary blob');
  }

  bool _isGzip(Uint8List bytes) {
    return bytes.length >= 2 && bytes[0] == 0x1f && bytes[1] == 0x8b;
  }
}
