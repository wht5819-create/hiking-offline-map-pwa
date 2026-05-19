import '../../domain/entities/mbtiles_package.dart';
import '../../domain/repositories/mbtiles_repository.dart';
import '../datasources/mbtiles_local_data_source.dart';

class LocalMbtilesRepository implements MbtilesRepository {
  const LocalMbtilesRepository(this.localDataSource);

  final MbtilesLocalDataSource localDataSource;

  @override
  Future<void> deletePackage(String packageId) {
    return localDataSource.deletePackage(packageId);
  }

  @override
  Future<MbtilesPackage> importPackage(String sourcePath, {String? displayName}) {
    return localDataSource.copyIntoManagedDirectory(
      sourcePath,
      displayName: displayName,
    );
  }

  @override
  Future<bool> isValidMbtilesFile(String path) {
    return localDataSource.isValidMbtilesFile(path);
  }

  @override
  Future<List<MbtilesPackage>> listPackages() {
    return localDataSource.listPackages();
  }
}
