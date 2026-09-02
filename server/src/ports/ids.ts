// id 和 slug 的生成器是注入的，方便测试用确定性实现。

export interface IdGenerator {
  next(prefix: string): string;
}

export interface SlugGenerator {
  /** 公开链接用的 slug：不可枚举、够长。 */
  next(): string;
}
