import '../entities/mbtiles_package.dart';
import '../repositories/mbtiles_repository.dart';

class ImportMbtilesPackage {
  const ImportMbtilesPackage(this.repository);

  final MbtilesRepository repository;

  Future<MbtilesPackage> call(String sourcePath, {String? displayName}) {
    return repository.importPackage(sourcePath, displayName: displayName);
  }
}
