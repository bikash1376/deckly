const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Swap ML Kit text recognition from the bundled models to the Play Services
 * delivered ones.
 *
 * `@react-native-ml-kit/text-recognition` unconditionally pulls five bundled
 * artifacts in its own build.gradle:
 *
 *   com.google.mlkit:text-recognition            (Latin,      ~4 MB)
 *   com.google.mlkit:text-recognition-chinese                 (~4 MB)
 *   com.google.mlkit:text-recognition-devanagari              (~4 MB)
 *   com.google.mlkit:text-recognition-japanese                (~4 MB)
 *   com.google.mlkit:text-recognition-korean                  (~4 MB)
 *
 * That is roughly 20 MB of models baked into the APK, for an app whose users
 * are overwhelmingly photographing printed English notes.
 *
 * The unbundled artifact exposes the identical classes, including
 * `com.google.mlkit.vision.text.latin.TextRecognizerOptions`, so the wrapper's
 * Java needs no change. The model is downloaded once by Play Services on first
 * use instead of shipping inside the binary. Deckly is Android only and Play
 * Store only, so Play Services is always present.
 *
 * The cost is that the very first scan can need a moment while the model
 * downloads. `prefetchOcrModel()` in src/features/ocr covers that during
 * onboarding.
 *
 * Excludes are applied with `configurations.all` rather than by editing the
 * library's own build.gradle, because node_modules is rewritten on every
 * install and an edit there would silently revert.
 */

const BUNDLED_MODULES = [
  "text-recognition",
  "text-recognition-chinese",
  "text-recognition-devanagari",
  "text-recognition-japanese",
  "text-recognition-korean",
];

const UNBUNDLED = "com.google.android.gms:play-services-mlkit-text-recognition:19.0.1";

const MARKER = "// deckly: unbundled ML Kit";

function buildBlock() {
  // `exclude` is a method on Configuration itself, not on resolutionStrategy.
  const excludes = BUNDLED_MODULES.map(
    (module) => `    exclude group: 'com.google.mlkit', module: '${module}'`,
  ).join("\n");

  return [
    "",
    MARKER,
    "configurations.all {",
    excludes,
    "}",
    "",
    "dependencies {",
    `    implementation '${UNBUNDLED}'`,
    "}",
    "",
  ].join("\n");
}

module.exports = function withUnbundledMlKit(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        "with-unbundled-mlkit expects a Groovy app/build.gradle. Update the plugin if the template moved to Kotlin DSL.",
      );
    }

    // Prebuild runs repeatedly against the same file. Without this guard the
    // block accumulates and the build fails on a duplicate configuration.
    if (cfg.modResults.contents.includes(MARKER)) return cfg;

    cfg.modResults.contents += buildBlock();
    return cfg;
  });
};
