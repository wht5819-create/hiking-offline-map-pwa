import '../entities/mbtiles_package.dart';

abstract interface class MbtilesRepository {
  Future<List<MbtilesPackage>> listPackages();

  Future<MbtilesPackage> importPackage(String sourcePath, {String? displayName});

  Future<void> deletePackage(String packageId);

  Future<bool> isValidMbtilesFile(String path);
}
