import styles from './HeroFigure.module.css'

/**
 * 圆心的净热量。三行竖排——标签在上、数字居中、单位在下。
 *
 * 竖排而非「数字 + 单位」同行：圆心空腔的宽度是硬约束，单位放在数字旁边
 * 会让整行宽出空腔、压到环上。字号也不是随便定的，见
 * RingGroup.test.tsx 里「圆心必须容得下净热量」那组算术断言。
 */
export default function HeroFigure({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit: string
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} num`} data-testid="hero-value">
        {value}
      </div>
      <div className={styles.unit}>{unit}</div>
    </div>
  )
}
