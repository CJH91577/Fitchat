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
