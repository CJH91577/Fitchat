import styles from './SurplusTable.module.css'

export type SurplusRow = { date: string; surplus: number }

export function formatSurplus(surplus: number): string {
  if (surplus === 0) return '0'
  return surplus > 0 ? `+${surplus}` : `−${Math.abs(surplus)}`
}

export default function SurplusTable({
  rows,
  emptyText = '这段时间还没有饮食记录。',
}: {
  rows: SurplusRow[]
  /**
   * 空态文案由页面决定：热量卡空掉有两种不同的原因——「没有目标」
   * 与「没有记录」，把两种状态都说成同一种会误导用户。
   */
  emptyText?: string
}) {
  if (rows.length === 0) {
    return <p className={styles.empty}>{emptyText}</p>
  }

  return (
    <div className={styles.scroll} data-testid="surplus-table-scroll">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>日期</th>
            <th className={styles.num}>热量盈余</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td>{row.date}</td>
              {/* 盈余不做好坏着色——减脂期负数是预期的 */}
              <td className={`${styles.num} ${styles.surplus} num-tabular`}>
                {formatSurplus(row.surplus)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
