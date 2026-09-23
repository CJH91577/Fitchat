import styles from './AdherenceChart.module.css'

export type AdherencePoint = { date: string; ratio: number }

const W = 320
const H = 96
const PAD = { top: 8, right: 8, bottom: 8, left: 8 }
const MAX_BAR = 24

export default function AdherenceChart({ points }: { points: AdherencePoint[] }) {
  if (points.length === 0) {
    return <p className={styles.empty}>这段时间还没有饮食记录。</p>
  }

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / points.length
  // 柱宽封顶 24px，间隙至少 2px
  const barW = Math.max(1, Math.min(MAX_BAR, slot - 2))
  const baseline = PAD.top + innerH

  return (
    <figure className={styles.figure} data-testid="chart-adherence">
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="热量达标情况">
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={baseline}
          y2={baseline}
          stroke="var(--axis)"
          strokeWidth={1}
        />
        {points.map((p, i) => {
          const ratio = Math.min(Math.max(p.ratio, 0), 1)
          const h = Math.max(ratio * innerH, ratio > 0 ? 2 : 0)
          const cx = PAD.left + slot * i + slot / 2
          return (
            <rect
              key={p.date}
              x={cx - barW / 2}
              y={baseline - h}
              width={barW}
              height={h}
              rx={Math.min(4, barW / 2)}
              fill="var(--ring-calories)"
            />
          )
        })}
      </svg>
      <figcaption className={styles.caption}>柱高为当日热量达标率</figcaption>
    </figure>
  )
}
