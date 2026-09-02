import type { BlessingState } from '../../domain/types';

export const STATE_LABEL: Record<BlessingState, string> = {
  draft: '草稿',
  verifying: '审核中',
  published: '已送达',
  rejected: '未通过',
  taken_down: '已下架',
  withdrawn: '已撤回',
  deleted: '已删除',
  expired: '已过期',
};
