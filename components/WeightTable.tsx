import styles from './WeightTable.module.css'

export type WeightRow = { date: string; kg: number; delta: number | null }

function formatDelta(delta: number | null): string {
  if (delta === null) return '—'
  if (delta === 0) return '0'
  return delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`
}

export default function WeightTable({ rows }: { rows: WeightRow[] }) {
  if (rows.length === 0) {
    return <p className={styles.empty}>这段时间还没有体重记录。</p>
  }

  return (
    <div className={styles.scroll} data-testid="weight-table-scroll">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>日期</th>
            <th className={styles.num}>体重</th>
            <th className={styles.num}>与昨日</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td>{row.date}</td>
              <td className={`${styles.num} num-tabular`}>{row.kg}</td>
              {/* 涨跌只用文字令牌，不用成功/危险色 */}
              <td className={`${styles.num} ${styles.delta} num-tabular`}>
                {formatDelta(row.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
