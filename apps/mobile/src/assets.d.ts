/**
 * Metro resolves font files to an opaque asset handle at bundle time. Declaring
 * the module keeps direct .ttf imports typed, which is what lets us import
 * individual faces instead of a package index that drags in every weight.
 */
declare module "*.ttf" {
  const asset: number;
  export default asset;
}
