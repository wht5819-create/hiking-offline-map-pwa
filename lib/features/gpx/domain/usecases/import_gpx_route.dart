import '../../data/models/gpx_models.dart';
import '../../data/services/gpx_parser.dart';

class ImportGpxRoute {
  const ImportGpxRoute(this.parser);

  final GpxParser parser;

  Future<ParsedGpx> call(String path) {
    return parser.parseFile(path);
  }
}
