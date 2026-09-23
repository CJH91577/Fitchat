import styles from './HeroFigure.module.css'

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
      <div className={styles.row}>
        <span className={`${styles.value} num`} data-testid="hero-value">
          {value}
        </span>
        <span className={styles.unit}>{unit}</span>
      </div>
    </div>
  )
}
