// 双滑块区间选择器：两端触到边界即代表"不限"，避免数字输入框的两个老毛病——
// 得打字才知道填什么、上下调节的小箭头一点就从"空"变成"0/1"却毫无察觉
// （这正是 B-83 那次"标签明明匹配却筛出空列表"的根因：年龄框被意外碰出一个
// 杂散值，候选人没填出生年就被这个本不该生效的年龄条件排除掉了）。

import s from '../app.module.css';

export interface RangeSliderProps {
  min: number;
  max: number;
  /** null = 下限不限（滑块推到最左） */
  valueMin: number | null;
  /** null = 上限不限（滑块推到最右） */
  valueMax: number | null;
  onChange: (min: number | null, max: number | null) => void;
  formatValue?: (v: number) => string;
}

export function RangeSlider(props: RangeSliderProps) {
  const { min, max, valueMin, valueMax, onChange, formatValue } = props;
  const lo = valueMin ?? min;
  const hi = valueMax ?? max;
  const fmt = formatValue ?? ((v: number) => String(v));

  function setLo(raw: number) {
    const next = Math.min(raw, hi);
    onChange(next <= min ? null : next, valueMax);
  }
  function setHi(raw: number) {
    const next = Math.max(raw, lo);
    onChange(valueMin, next >= max ? null : next);
  }

  const loPct = ((lo - min) / (max - min)) * 100;
  const hiPct = ((hi - min) / (max - min)) * 100;

  return (
    <div className={s.rangeSlider}>
      <div className={s.rangeTrack}>
        <div className={s.rangeFill} style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }} />
      </div>
      <input
        type="range"
        className={s.rangeThumb}
        min={min}
        max={max}
        value={lo}
        aria-label="下限"
        onChange={(e) => {
          setLo(Number(e.target.value));
        }}
      />
      <input
        type="range"
        className={s.rangeThumb}
        min={min}
        max={max}
        value={hi}
        aria-label="上限"
        onChange={(e) => {
          setHi(Number(e.target.value));
        }}
      />
      <div className={s.rangeLabels}>
        <span>{valueMin === null ? '不限' : fmt(lo)}</span>
        <span>{valueMax === null ? '不限' : `${fmt(hi)}${hi >= max ? '+' : ''}`}</span>
      </div>
    </div>
  );
}
