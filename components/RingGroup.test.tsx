import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RingGroup, { type RingSpec } from './RingGroup'

const rings: RingSpec[] = [
  { kind: 'calories', label: '热量', value: 1420, goal: 1800, unit: '千卡' },
  { kind: 'exercise', label: '运动', value: 380, goal: 500, unit: '千卡' },
  { kind: 'protein', label: '蛋白质', value: 76, goal: 120, unit: 'g' },
  { kind: 'carbs', label: '碳水', value: 180, goal: 220, unit: 'g' },
]

function svgOf(): SVGSVGElement {
  return document.querySelector('svg') as SVGSVGElement
}

describe('RingGroup', () => {
  it('四个环的标签与数值都可见', () => {
    render(<RingGroup rings={rings} />)
    expect(screen.getByText('热量')).toBeInTheDocument()
    expect(screen.getByText('运动')).toBeInTheDocument()
    expect(screen.getByText('蛋白质')).toBeInTheDocument()
    expect(screen.getByText('碳水')).toBeInTheDocument()
    expect(screen.getByText('1420 / 1800')).toBeInTheDocument()
    expect(screen.getByText('380 / 500')).toBeInTheDocument()
    expect(screen.getByText('76 / 120')).toBeInTheDocument()
    expect(screen.getByText('180 / 220')).toBeInTheDocument()
  })

  it('按固定顺序使用四个圆环色令牌', () => {
    render(<RingGroup rings={rings} />)
    const strokes = [...svgOf().querySelectorAll('[data-ring-fill]')].map((el) =>
      el.getAttribute('stroke'),
    )
    expect(strokes).toEqual([
      'var(--ring-calories)',
      'var(--ring-exercise)',
      'var(--ring-protein)',
      'var(--ring-carbs)',
    ])
  })

  it('目标为 0 时不产生 NaN 属性', () => {
    const zeroGoal: RingSpec[] = [{ kind: 'carbs', label: '碳水', value: 50, goal: 0, unit: 'g' }]
    const { container } = render(<RingGroup rings={zeroGoal} />)
    expect(container.innerHTML).not.toContain('NaN')
    expect(screen.getByText('未设定')).toBeInTheDocument()
  })

  it('摄入超过目标时进度不超过整圈', () => {
    const over: RingSpec[] = [
      { kind: 'calories', label: '热量', value: 2400, goal: 1800, unit: '千卡' },
    ]
    render(<RingGroup rings={over} />)
    const arc = svgOf().querySelector('[data-ring-fill]')!
    const offset = Number(arc.getAttribute('stroke-dashoffset'))
    expect(offset).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(offset)).toBe(true)
    expect(screen.getByText('超出')).toBeInTheDocument()
  })

  it('数值为 0 时进度为整圈空，且不产生负值', () => {
    const empty: RingSpec[] = [
      { kind: 'exercise', label: '运动', value: 0, goal: 500, unit: '千卡' },
    ]
    render(<RingGroup rings={empty} />)
    const arc = svgOf().querySelector('[data-ring-fill]')!
    const offset = Number(arc.getAttribute('stroke-dashoffset'))
    const circumference = Number(arc.getAttribute('stroke-dasharray'))
    expect(offset).toBeCloseTo(circumference, 5)
  })
})

describe('圆心插槽', () => {
  const twoRings: RingSpec[] = [
    { kind: 'calories', label: '热量', value: 1600, goal: 1800, unit: '千卡' },
    { kind: 'exercise', label: '运动', value: 480, goal: 500, unit: '千卡' },
  ]

  it('不传 center 时圆心为空', () => {
    render(<RingGroup rings={twoRings} />)
    expect(screen.queryByTestId('ring-center')).not.toBeInTheDocument()
  })

  it('传入 center 时圆心渲染其内容', () => {
    render(<RingGroup rings={twoRings} center={<span>1120</span>} />)
    expect(screen.getByTestId('ring-center')).toBeInTheDocument()
    expect(screen.getByText('1120')).toBeInTheDocument()
  })

  it('两个环时仍使用固定的颜色顺序', () => {
    render(<RingGroup rings={twoRings} />)
    const strokes = [...document.querySelectorAll('[data-ring-fill]')].map((el) =>
      el.getAttribute('stroke'),
    )
    expect(strokes).toEqual(['var(--ring-calories)', 'var(--ring-exercise)'])
  })

  it('两个环的半径不同，且都为正、都完整落在 viewBox 内', () => {
    render(<RingGroup rings={twoRings} />)
    const radii = [...document.querySelectorAll('circle')]
      .map((el) => Number(el.getAttribute('r')))
      .filter((r) => Number.isFinite(r))
    const distinct = [...new Set(radii)].sort((a, b) => b - a)
    expect(distinct.length).toBeGreaterThanOrEqual(2)
    const stroke = 11 // 与实现中的 STROKE 常量一致
    for (const r of distinct) {
      expect(r).toBeGreaterThan(0)
      expect(r + stroke / 2).toBeLessThanOrEqual(88) // viewBox 176 的半宽
    }
  })

  it('只有两个环时半径必须铺开，而不是沿用四环的环间距', () => {
    render(<RingGroup rings={twoRings} />)
    const radii = [...document.querySelectorAll('circle')]
      .map((el) => Number(el.getAttribute('r')))
      .filter((r) => Number.isFinite(r))
    const distinct = [...new Set(radii)].sort((a, b) => b - a)
    // 四环时的环间距是 STROKE+GAP = 13。若两环仍沿用这个间距，两个环会挤在
    // 外侧、圆心留出一个巨大的空洞——而圆心正是要放净热量的地方。
    expect(distinct[0] - distinct[1]).toBeGreaterThan(13)
  })

  it('目标为 0 时圆心插槽仍渲染，且页面无 NaN', () => {
    const zeroGoal: RingSpec[] = [
      { kind: 'calories', label: '热量', value: 0, goal: 0, unit: '千卡' },
    ]
    const { container } = render(<RingGroup rings={zeroGoal} center={<span>0</span>} />)
    expect(container.innerHTML).not.toContain('NaN')
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
