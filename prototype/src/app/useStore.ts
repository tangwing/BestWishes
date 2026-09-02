import { useSyncExternalStore } from 'react';
import { store } from '../store/repo';

let version = 0;
const bump = () => {
  version += 1;
};
store.subscribe(bump);

/** 订阅 store 变化并触发重渲染。返回单例 store。 */
export function useStore() {
  useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => version,
    () => version,
  );
  return store;
}
