import styles from './RingGroup.module.css'

export type RingKind = 'calories' | 'exercise' | 'protein' | 'carbs'

export type RingSpec = {
  kind: RingKind
  label: string
  value: number
  goal: number
  unit: string
}

// 顺序即安全性机制：外→内固定对应调色板槽位 1..4，不得重排
const COLOR_VAR: Record<RingKind, string> = {
  calories: 'var(--ring-calories)',
  exercise: 'var(--ring-exercise)',
  protein: 'var(--ring-protein)',
  carbs: 'var(--ring-carbs)',
}

const SIZE = 176
const CENTER = SIZE / 2
const STROKE = 11
const GAP = 2
const OUTER_RADIUS = 72
const PITCH = STROKE + GAP

export function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export default function RingGroup({ rings }: { rings: RingSpec[] }) {
  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className={styles.svg}
        role="img"
        aria-label="今日目标进度"
      >
        {rings.map((ring, i) => {
          const radius = OUTER_RADIUS - i * PITCH
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
