import type { Occasion } from '../domain/types';
import { RELIGIOUS_SOLICITATION_GUARD } from '../domain/moderation/words';

export interface Template {
  id: string;
  occasion: Occasion;
  title: string;
  prompt: string;
  sample: string;
}

const RAW: Omit<Template, 'id'>[] = [
  {
    occasion: 'birthday',
    title: '给朋友的生日祝福',
    prompt: '想想 TA 这一年里让你印象最深的一件小事，从这里说起。',
    sample: '又长了一岁。愿你新的一岁里，睡得安稳，笑得开怀，被这个世界温柔以待。',
  },
  {
    occasion: 'birthday',
    title: '给长辈的生日祝福',
    prompt: '写下你希望 TA 保重的地方，语气可以慢一点。',
    sample: '生日快乐。愿您身体康健，日子从容，我们都在您身边。',
  },
  {
    occasion: 'birthday',
    title: '给自己的生日寄语',
    prompt: '像对一位老朋友说话那样，对自己说几句。',
    sample: '谢谢你走到今天。愿你继续善良，也别忘了对自己好一点。',
  },
  {
    occasion: 'festival',
    title: '新年祝福',
    prompt: '回想过去一年你们之间发生的好事。',
    sample: '新的一年，愿你所求皆有回应，所行皆有归途，平安顺遂。',
  },
  {
    occasion: 'festival',
    title: '中秋祝福',
    prompt: '写给一个此刻不在身边的人。',
    sample: '月亮圆的时候，就当我在你身边。愿你团圆，愿你安好。',
  },
  {
    occasion: 'festival',
    title: '节日问候（通用）',
    prompt: '简单一句，把心意说清楚就好。',
    sample: '节日快乐，想起你，愿你这些天过得松弛而温暖。',
  },
  {
    occasion: 'encouragement',
    title: '给正在低谷的人',
    prompt: '不评判、不建议，只是陪着 TA。',
    sample: '这段日子不好过，我知道。你不用马上好起来，慢慢来，我一直在。',
  },
  {
    occasion: 'encouragement',
    title: '考前 / 面试前',
    prompt: '写下你相信 TA 的具体理由。',
    sample: '你准备得很认真，我都看在眼里。放平心态，正常发挥就很好。',
  },
  {
    occasion: 'encouragement',
    title: '换工作 / 新开始',
    prompt: '为 TA 的选择鼓劲。',
    sample: '新的开始总有点忐忑。相信你的判断，往前走，会越来越顺的。',
  },
  {
    occasion: 'recovery',
    title: '给生病的人',
    prompt: '语气轻一点，别用力过猛。',
    sample: '好好休息，别操心别的事。愿你一天比一天有力气，我们都等你。',
  },
  {
    occasion: 'recovery',
    title: '术后 / 康复中',
    prompt: '把"慢慢来"说给 TA 听。',
    sample: '恢复是件急不来的事。愿你每天都好一点点，疼痛少一点点。',
  },
  {
    occasion: 'recovery',
    title: '为家人的健康祈愿',
    prompt: '写下你想对 TA 说却平时没说的话。',
    sample: '愿你被岁月善待，少些病痛，多些安稳。我们一直在。',
  },
  {
    occasion: 'remembrance',
    title: '追思一位离开的人',
    prompt: '写下你最想让 TA 知道的一句话。',
    sample: '好久没和你说话了。我们都还好，你也要安心。谢谢你曾经那样爱我们。',
  },
  {
    occasion: 'remembrance',
    title: '纪念日',
    prompt: '回到那一天，写下当时的感觉。',
    sample: '又到这一天。时间过得很快，想你的心情一直没变。',
  },
  {
    occasion: 'remembrance',
    title: '为逝者的祈愿',
    prompt: '简单、平静地送 TA 一程。',
    sample: '愿你所去的地方没有病痛，只有安宁。一路平安。',
  },
  {
    occasion: 'daily',
    title: '日常问候',
    prompt: '不需要理由，想到了就说。',
    sample: '突然想起你，就来说一声：愿你今天顺顺利利，好好吃饭。',
  },
  {
    occasion: 'daily',
    title: '好久没联系的朋友',
    prompt: '承认那份生疏，也表达惦记。',
    sample: '好久没联系了，但一直记着你。愿你这些年过得踏实、开心。',
  },
  {
    occasion: 'daily',
    title: '给正在努力的人',
    prompt: '看见 TA 的努力本身。',
    sample: '你一直很拼，别忘了也歇一歇。愿你努力有回报，身体也扛得住。',
  },
];

/** 运营侧护栏词校验。对应 blessing-authoring「范本库」的护栏 scenario。 */
export function templateViolatesGuard(text: string): boolean {
  return RELIGIOUS_SOLICITATION_GUARD.some((w) => text.includes(w));
}

export function seedTemplates(): Template[] {
  return RAW.map((t, i) => {
    if (templateViolatesGuard(t.sample) || templateViolatesGuard(t.title)) {
      throw new Error(`范本 "${t.title}" 命中宗教敛财护栏词，拒绝发布`);
    }
    return { ...t, id: `tpl_${i + 1}` };
  });
}

export const OCCASION_LABEL: Record<Occasion, string> = {
  birthday: '生日',
  festival: '节日',
  encouragement: '鼓励',
  recovery: '康复祈愿',
  remembrance: '纪念 / 追思',
  daily: '日常问候',
};
