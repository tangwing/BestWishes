// 时间是注入的，不在业务代码里直接 new Date() —— 这样才能测。

export interface Clock {
  now(): Date;
}
