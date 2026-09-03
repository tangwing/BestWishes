// @bestwishes/domain —— P1 的领域逻辑。纯函数，无 IO，无框架依赖。
// 架构测试（根目录 arch/）会挡住任何违反这条的 import。

export * from './types';
export * from './config';
export * from './lifecycle';
export * from './blessing-transition';
export * from './visibility';
export * from './audience';
export * from './streak';
export * from './moderation/apply';
export * from './moderation/ruleBased';
export * as words from './moderation/words';
