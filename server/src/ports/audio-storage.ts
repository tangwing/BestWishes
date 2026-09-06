// 音频文件存储。本机落盘用于开发 / 测试 / 演示；生产换对象存储时只换实现，
// 不改调用方——同 PGlite -> drizzle-orm/postgres-js 的"换驱动不换契约"模式。

export interface AudioStoragePort {
  /** 存一段音频，返回一个可用于回放的引用（本机实现是文件路径/URL，对象存储实现是其 URL）。 */
  save(id: string, data: Buffer): Promise<string>;
  read(id: string): Promise<Buffer>;
}
