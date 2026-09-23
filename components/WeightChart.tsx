import styles from './WeightChart.module.css'

export type WeightPoint = { date: string; kg: number }

const W = 320
const H = 140
const PAD = { top: 12, right: 12, bottom: 24, left: 36 }

export default function WeightChart({ points }: { points: WeightPoint[] }) {
  if (points.length === 0) {
    return <p className={styles.empty}>这段时间还没有体重记录。</p>
  }

  const values = points.map((p) => p.kg)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // 全部体重相同时给出非零值域，避免除零
  const span = max - min || 1

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (kg: number) => PAD.top + innerH - ((kg - min) / span) * innerH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.kg)}`).join(' ')
  const areaPath = `${linePath} L ${x(points.length - 1)} ${PAD.top + innerH} L ${x(0)} ${
    PAD.top + innerH
  } Z`

  const last = points[points.length - 1]

  return (
    <figure className={styles.figure} data-testid="chart-weight">
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label="体重趋势">
        {/* 网格：1px 实线发丝线，绝不用虚线 */}
        {[0, 0.5, 1].map((t) => {
          const gy = PAD.top + innerH * t
          return (
            <line
              key={t}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={gy}
              y2={gy}
              stroke="var(--gridline)"
              strokeWidth={1}
            />
          )
        })}

        {/* 面积：系列色 10% 淡淡一层，不做实心块 */}
        <path d={areaPath} fill="var(--ring-calories)" opacity={0.1} />
        {/* 线：2px，圆角连接 */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--ring-calories)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* 末端点：直径 8px，带 2px 表面环 */}
        <circle cx={x(points.length - 1)} cy={y(last.kg)} r={4} fill="var(--ring-calories)" />
        <circle
          cx={x(points.length - 1)}
          cy={y(last.kg)}
          r={6}
          fill="none"
          stroke="var(--surface-card)"
          strokeWidth={2}
        />
      </svg>

      <figcaption className={styles.caption}>
        <span className={styles.captionLabel}>最新</span>
        <span className={`${styles.captionValue} num`}>{last.kg} kg</span>
      </figcaption>
    </figure>
  )
}
