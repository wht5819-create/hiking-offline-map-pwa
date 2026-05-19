class MbtilesPackage {
  const MbtilesPackage({
    required this.id,
    required this.name,
    required this.path,
    required this.sizeBytes,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String path;
  final int sizeBytes;
  final DateTime updatedAt;

  double get sizeMegabytes => sizeBytes / 1024 / 1024;
}
