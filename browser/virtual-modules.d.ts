/** schema ถูกฝังเป็นสตริงตอน build ดูรายละเอียดใน browser/build.mjs */
declare module "virtual:migrations" {
  const migrationSql: string;
  export default migrationSql;
}
