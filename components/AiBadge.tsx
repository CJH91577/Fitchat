import styles from './AiBadge.module.css'

export default function AiBadge() {
  return (
    <span className={styles.badge} title="此条数值由大模型估算，仅供参考">
      AI 估算
    </span>
  )
}
