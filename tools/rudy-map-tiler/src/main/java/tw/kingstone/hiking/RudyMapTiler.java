package tw.kingstone.hiking;

import org.mapsforge.core.graphics.TileBitmap;
import org.mapsforge.core.graphics.GraphicFactory;
import org.mapsforge.core.model.BoundingBox;
import org.mapsforge.core.model.Tile;
import org.mapsforge.core.util.MercatorProjection;
import org.mapsforge.map.awt.graphics.AwtGraphicFactory;
import org.mapsforge.map.layer.cache.InMemoryTileCache;
import org.mapsforge.map.layer.renderer.DatabaseRenderer;
import org.mapsforge.map.layer.renderer.RendererJob;
import org.mapsforge.map.model.DisplayModel;
import org.mapsforge.map.reader.MapFile;
import org.mapsforge.map.rendertheme.internal.MapsforgeThemes;
import org.mapsforge.map.rendertheme.rule.RenderThemeFuture;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class RudyMapTiler {
    private static final int TILE_SIZE = 256;

    private RudyMapTiler() {
    }

    public static void main(String[] args) throws Exception {
        Options options = Options.parse(args);
        File input = options.requiredFile("input");
        File output = options.outputFile();

        if (output.getParentFile() != null) {
            Files.createDirectories(output.getParentFile().toPath());
        }
        if (output.exists() && !output.delete()) {
            throw new IllegalStateException("Cannot replace output file: " + output);
        }

        GraphicFactory graphicFactory = AwtGraphicFactory.INSTANCE;
        DisplayModel displayModel = new DisplayModel();
        displayModel.setFixedTileSize(TILE_SIZE);
        displayModel.setUserScaleFactor(options.floatValue("scale", 1.0f));

        MapFile mapFile = new MapFile(input, options.value("language", "zh"));
        try {
            BoundingBox mapBounds = mapFile.boundingBox();
            Bounds bounds = options.boundsOr(mapBounds);
            ZoomRange zooms = options.zoomRange();
            int maxTiles = options.intValue("maxTiles", 20000);
            String themeName = options.value("theme", "DEFAULT").toUpperCase(Locale.ROOT);
            MapsforgeThemes theme = MapsforgeThemes.valueOf(themeName);

            long totalTiles = countTiles(bounds, zooms);
            if (maxTiles > 0 && totalTiles > maxTiles) {
                throw new IllegalArgumentException("Tile count " + totalTiles
                        + " exceeds --maxTiles " + maxTiles
                        + ". Narrow --bbox, lower --maxZoom, or pass --maxTiles 0.");
            }

            System.out.println("Input: " + input.getAbsolutePath());
            System.out.println("Output: " + output.getAbsolutePath());
            System.out.println("Bounds: " + bounds);
            System.out.println("Zooms: " + zooms.min + "-" + zooms.max);
            System.out.println("Tiles: " + totalTiles);
            System.out.println("Theme: " + themeName);

            RenderThemeFuture renderTheme = new RenderThemeFuture(graphicFactory, theme, displayModel);
            Thread themeThread = new Thread(renderTheme, "mapsforge-render-theme");
            themeThread.setDaemon(true);
            themeThread.start();

            DatabaseRenderer renderer = new DatabaseRenderer(
                    mapFile,
                    graphicFactory,
                    new InMemoryTileCache(256),
                    null,
                    true,
                    false,
                    null);

            try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + output.getAbsolutePath())) {
                connection.setAutoCommit(false);
                createMbtiles(connection, bounds, zooms, input.getName(), themeName);

                try (PreparedStatement insert = connection.prepareStatement(
                        "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)")) {
                    long done = 0;
                    for (int z = zooms.min; z <= zooms.max; z++) {
                        TileRange range = tileRange(bounds, (byte) z);
                        for (int x = range.minX; x <= range.maxX; x++) {
                            for (int y = range.minY; y <= range.maxY; y++) {
                                byte[] png = renderPng(renderer, renderTheme, displayModel, mapFile, x, y, (byte) z);
                                if (png != null && png.length > 0) {
                                    insert.setInt(1, z);
                                    insert.setInt(2, x);
                                    insert.setInt(3, y);
                                    insert.setBytes(4, png);
                                    insert.addBatch();
                                }
                                done++;
                                if (done % 250 == 0) {
                                    insert.executeBatch();
                                    connection.commit();
                                    System.out.println("Rendered " + done + "/" + totalTiles + " tiles");
                                }
                            }
                        }
                    }
                    insert.executeBatch();
                }
                connection.commit();
            } finally {
                renderTheme.decrementRefCount();
            }

            System.out.println("Done.");
        } finally {
            mapFile.close();
        }
    }

    private static byte[] renderPng(DatabaseRenderer renderer, RenderThemeFuture renderTheme,
                                    DisplayModel displayModel, MapFile mapFile,
                                    int x, int y, byte zoom) throws Exception {
        Tile tile = new Tile(x, y, zoom, TILE_SIZE);
        RendererJob job = new RendererJob(tile, mapFile, renderTheme, displayModel, 1.0f, false, false);
        TileBitmap bitmap = renderer.executeJob(job);
        if (bitmap == null) {
            return null;
        }
        try (ByteArrayOutputStream output = new ByteArrayOutputStream(64 * 1024)) {
            bitmap.compress(output);
            return output.toByteArray();
        } finally {
            bitmap.decrementRefCount();
        }
    }

    private static void createMbtiles(Connection connection, Bounds bounds, ZoomRange zooms,
                                     String sourceName, String themeName) throws Exception {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE TABLE metadata (name TEXT PRIMARY KEY, value TEXT)");
            statement.executeUpdate("CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)");
            statement.executeUpdate("CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)");
        }
        putMetadata(connection, "name", "Rudy Taiwan TOPO web tiles");
        putMetadata(connection, "type", "baselayer");
        putMetadata(connection, "version", "1");
        putMetadata(connection, "description", "Rendered from " + sourceName + " with Mapsforge " + themeName);
        putMetadata(connection, "format", "png");
        putMetadata(connection, "scheme", "xyz");
        putMetadata(connection, "minzoom", Integer.toString(zooms.min));
        putMetadata(connection, "maxzoom", Integer.toString(zooms.max));
        putMetadata(connection, "bounds", bounds.minLon + "," + bounds.minLat + "," + bounds.maxLon + "," + bounds.maxLat);
    }

    private static void putMetadata(Connection connection, String name, String value) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("INSERT INTO metadata (name, value) VALUES (?, ?)")) {
            statement.setString(1, name);
            statement.setString(2, value);
            statement.executeUpdate();
        }
    }

    private static long countTiles(Bounds bounds, ZoomRange zooms) {
        long total = 0;
        for (int z = zooms.min; z <= zooms.max; z++) {
            TileRange range = tileRange(bounds, (byte) z);
            total += (long) (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);
        }
        return total;
    }

    private static TileRange tileRange(Bounds bounds, byte zoom) {
        int minX = MercatorProjection.longitudeToTileX(bounds.minLon, zoom);
        int maxX = MercatorProjection.longitudeToTileX(bounds.maxLon, zoom);
        int minY = MercatorProjection.latitudeToTileY(bounds.maxLat, zoom);
        int maxY = MercatorProjection.latitudeToTileY(bounds.minLat, zoom);
        return new TileRange(minX, maxX, minY, maxY);
    }

    private record Bounds(double minLon, double minLat, double maxLon, double maxLat) {
        static Bounds fromMap(BoundingBox box) {
            return new Bounds(box.minLongitude, box.minLatitude, box.maxLongitude, box.maxLatitude);
        }

        static Bounds parse(String value) {
            String[] parts = value.split(",");
            if (parts.length != 4) {
                throw new IllegalArgumentException("--bbox must be minLon,minLat,maxLon,maxLat");
            }
            return new Bounds(
                    Double.parseDouble(parts[0].trim()),
                    Double.parseDouble(parts[1].trim()),
                    Double.parseDouble(parts[2].trim()),
                    Double.parseDouble(parts[3].trim()));
        }
    }

    private record ZoomRange(int min, int max) {
    }

    private record TileRange(int minX, int maxX, int minY, int maxY) {
    }

    private static final class Options {
        private final Map<String, String> values;

        private Options(Map<String, String> values) {
            this.values = values;
        }

        static Options parse(String[] args) {
            Map<String, String> values = new HashMap<>();
            for (int i = 0; i < args.length; i++) {
                String key = args[i];
                if (!key.startsWith("--")) {
                    throw new IllegalArgumentException("Unexpected argument: " + key);
                }
                if (i + 1 >= args.length) {
                    throw new IllegalArgumentException("Missing value for " + key);
                }
                values.put(key.substring(2), args[++i]);
            }
            return new Options(values);
        }

        File requiredFile(String key) {
            String value = values.get(key);
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException("Missing --" + key);
            }
            File file = new File(value);
            if (!file.isFile()) {
                throw new IllegalArgumentException("File not found: " + file);
            }
            return file;
        }

        File outputFile() {
            String value = values.get("output");
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException("Missing --output");
            }
            return new File(value);
        }

        Bounds boundsOr(BoundingBox fallback) {
            String bbox = values.get("bbox");
            return bbox == null || bbox.isBlank() ? Bounds.fromMap(fallback) : Bounds.parse(bbox);
        }

        ZoomRange zoomRange() {
            int min = intValue("minZoom", 10);
            int max = intValue("maxZoom", 14);
            if (min < 0 || max < min || max > 21) {
                throw new IllegalArgumentException("Invalid zoom range: " + min + "-" + max);
            }
            return new ZoomRange(min, max);
        }

        String value(String key, String fallback) {
            return values.getOrDefault(key, fallback);
        }

        int intValue(String key, int fallback) {
            String value = values.get(key);
            return value == null || value.isBlank() ? fallback : Integer.parseInt(value);
        }

        float floatValue(String key, float fallback) {
            String value = values.get(key);
            return value == null || value.isBlank() ? fallback : Float.parseFloat(value);
        }
    }
}
