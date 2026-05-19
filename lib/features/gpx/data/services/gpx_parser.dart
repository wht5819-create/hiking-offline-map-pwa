import 'dart:io';

import 'package:xml/xml.dart';

import '../models/gpx_models.dart';

class GpxParseException implements Exception {
  const GpxParseException(this.message, [this.cause]);

  final String message;
  final Object? cause;

  @override
  String toString() => cause == null ? message : '$message：$cause';
}

class GpxParser {
  const GpxParser();

  Future<ParsedGpx> parseFile(String path) async {
    try {
      final content = await File(path).readAsString();
      return parseString(content);
    } on GpxParseException {
      rethrow;
    } catch (error) {
      throw GpxParseException('GPX 檔案讀取失敗', error);
    }
  }

  ParsedGpx parseString(String content) {
    try {
      final document = XmlDocument.parse(content);
      final trackPoints = document
          .findAllElements('trkpt')
          .map(_parseTrackPoint)
          .toList(growable: false);
      final waypoints = document
          .findAllElements('wpt')
          .map(_parseWaypoint)
          .toList(growable: false);

      if (trackPoints.isEmpty && waypoints.isEmpty) {
        throw const GpxParseException('GPX 內沒有 trkpt 或 wpt 資料');
      }

      return ParsedGpx(trackPoints: trackPoints, waypoints: waypoints);
    } on GpxParseException {
      rethrow;
    } catch (error) {
      throw GpxParseException('GPX XML 格式毀損或無法解析', error);
    }
  }

  GpxTrackPoint _parseTrackPoint(XmlElement element) {
    return GpxTrackPoint(
      latitude: _requiredDoubleAttribute(element, 'lat'),
      longitude: _requiredDoubleAttribute(element, 'lon'),
      elevationMeters: _optionalDoubleChild(element, 'ele'),
    );
  }

  GpxWaypoint _parseWaypoint(XmlElement element) {
    return GpxWaypoint(
      name: _optionalTextChild(element, 'name') ?? '未命名航點',
      latitude: _requiredDoubleAttribute(element, 'lat'),
      longitude: _requiredDoubleAttribute(element, 'lon'),
      elevationMeters: _optionalDoubleChild(element, 'ele'),
    );
  }

  double _requiredDoubleAttribute(XmlElement element, String name) {
    final value = element.getAttribute(name);
    if (value == null || value.isEmpty) {
      throw GpxParseException('GPX 節點缺少必要座標欄位 $name');
    }

    final parsed = double.tryParse(value);
    if (parsed == null) {
      throw GpxParseException('GPX 座標欄位 $name 不是有效數值');
    }

    return parsed;
  }

  double? _optionalDoubleChild(XmlElement element, String name) {
    final text = _optionalTextChild(element, name);
    if (text == null || text.isEmpty) {
      return null;
    }
    return double.tryParse(text);
  }

  String? _optionalTextChild(XmlElement element, String name) {
    final children = element.findElements(name);
    if (children.isEmpty) {
      return null;
    }
    return children.first.innerText.trim();
  }
}
