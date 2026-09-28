import styles from './RingGroup.module.css'

export type RingKind = 'calories' | 'exercise' | 'protein' | 'carbs'

export type RingSpec = {
  kind: RingKind
  label: string
  value: number
  goal: number
  unit: string
}

// 顺序即安全性机制：外→内固定对应调色板槽位 1..2，不得重排
const COLOR_VAR: Record<RingKind, string> = {
  calories: 'var(--ring-calories)',
  exercise: 'var(--ring-exercise)',
  protein: 'var(--ring-protein)',
  carbs: 'var(--ring-carbs)',
}

const SIZE = 176
const CENTER = SIZE / 2
const STROKE = 8
const GAP = 2

// 环数变少时半径向外铺开，使环填满圆面、圆心留出可放净热量的空间。
// MIN_INNER_RADIUS 不是随便取的：圆心空腔直径 = 2×(MIN_INNER_RADIUS − STROKE/2)，
// 它必须容得下四位数在最坏情况下的宽度。改这三个常量前先看
// RingGroup.test.tsx 里「圆心必须容得下净热量」那组断言——
// 实测过 STROKE=11 / MIN_INNER_RADIUS=34 时空腔只有 57px，而 56px 的
// 「1563」需要 134px，数字会横跨两个环。
const MAX_OUTER_RADIUS = 72
const MIN_INNER_RADIUS = 50

export function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export default function RingGroup({
  rings,
  center,
}: {
  rings: RingSpec[]
  center?: React.ReactNode
}) {
  const count = Math.max(rings.length, 1)
  // 单环时不存在间距；多环时取「铺满圆面」与「环不重叠」两者中较大的一个
  const pitch =
    count > 1
      ? Math.max(STROKE + GAP, (MAX_OUTER_RADIUS - MIN_INNER_RADIUS) / (count - 1))
      : 0
  const radiusFor = (index: number) => MAX_OUTER_RADIUS - index * pitch

  return (
    <div className={styles.wrap}>
      <div className={styles.svgWrap}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          className={styles.svg}
          role="img"
          aria-label="目标进度"
        >
          {rings.map((ring, i) => {
            const radius = radiusFor(i)
            const circumference = 2 * Math.PI * radius
            const hasGoal = ring.goal > 0
            const ratio = hasGoal ? Math.min(ring.value / ring.goal, 1) : 0
            const offset = circumference * (1 - ratio)
            const color = COLOR_VAR[ring.kind]

            return (
              <g key={ring.kind} transform={`rotate(-90 ${CENTER} ${CENTER})`}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={STROKE}
                  strokeOpacity={0.18}
                />
                {hasGoal && (
                  <circle
                    data-ring-fill={ring.kind}
                    cx={CENTER}
                    cy={CENTER}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                  />
                )}
              </g>
            )
          })}
        </svg>

        {center && (
          <div className={styles.center} data-testid="ring-center">
            {center}
          </div>
        )}
      </div>

      <ul className={styles.legend}>
        {rings.map((ring) => {
          const hasGoal = ring.goal > 0
          const over = hasGoal && ring.value > ring.goal

          return (
            <li key={ring.kind} className={styles.item}>
              <span
                className={styles.swatch}
                style={{ background: COLOR_VAR[ring.kind] }}
                aria-hidden="true"
              />
              <span className={styles.label}>{ring.label}</span>
              <span className={`${styles.value} num`}>
                {hasGoal ? (
                  <>
                    {formatValue(ring.value)} / {formatValue(ring.goal)}
                  </>
                ) : (
                  '未设定'
                )}
              </span>
              <span className={styles.unit}>{hasGoal ? ring.unit : ''}</span>
              {over && <span className={styles.over}>超出</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
