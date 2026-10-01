import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import RingGroup, { type RingSpec } from './RingGroup'
import { PALETTE } from '@/lib/design/palette'

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

  it('数值恰好等于目标时画成完整一圈，且不产生 NaN', () => {
    // 这是圆环边界的第四种情况。它曾经只靠实机走查覆盖——而「满环时圆头
    // 线帽在 12 点重叠可能凸出一个小点」正需要这一态才看得到，所以它值得
    // 被单元测试钉住，而不只是靠人眼。
    const exact: RingSpec[] = [
      { kind: 'calories', label: '热量', value: 1800, goal: 1800, unit: '千卡' },
    ]
    const { container } = render(<RingGroup rings={exact} />)
    expect(container.innerHTML).not.toContain('NaN')
    const arc = svgOf().querySelector('[data-ring-fill]')!
    // 恰好满环：位移为 0，即整圈都填满
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBe(0)
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

describe('底轨必须仍然是该指标的颜色', () => {
  // 用计算代替肉眼：把「填充色 + 底轨不透明度 + 卡片底色」按 sRGB 合成
  // （strokeOpacity 的默认混合空间），再转到 OKLCH 看**色度保留率**。
  //
  // 实测过：0.18 的 alpha 让橙色底轨的色度只剩填充色的 17%（混合得 #F9E1D7，
  // 视觉上就是浅粉），而色相角只偏 3.4°——所以问题不是色相漂移，是色度塌了。
  // 对照蓝色在同样比例下保留 16%，仍被认作蓝：冷色比暖色耐去饱和，因此
  // 同一个机制对蓝环可接受、对橙环就成了「颜色不对」。
  function srgbToLinear(c: number): number {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }

  function chroma(hex: string): number {
    const r = srgbToLinear(parseInt(hex.slice(1, 3), 16))
    const g = srgbToLinear(parseInt(hex.slice(3, 5), 16))
    const b = srgbToLinear(parseInt(hex.slice(5, 7), 16))
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return Math.hypot(A, B)
  }

  function blend(fg: string, bg: string, alpha: number): string {
    const channel = (i: number) => {
      const f = parseInt(fg.slice(i, i + 2), 16)
      const back = parseInt(bg.slice(i, i + 2), 16)
      return Math.round(alpha * f + (1 - alpha) * back)
        .toString(16)
        .padStart(2, '0')
    }
    return `#${channel(1)}${channel(3)}${channel(5)}`
  }

  const src = readFileSync(join(process.cwd(), 'components', 'RingGroup.tsx'), 'utf8')
  const trackAlpha = Number(/strokeOpacity=\{(\d+(?:\.\d+)?)\}/.exec(src)?.[1])
  const MODES = [
    ['浅色', PALETTE.light],
    ['深色', PALETTE.dark],
  ] as const

  it('两种模式下、两个环的底轨色度保留率都不低于 35%', () => {
    expect(Number.isFinite(trackAlpha), '没能从 RingGroup.tsx 读到 strokeOpacity').toBe(true)

    for (const [modeName, tokens] of MODES) {
      const surface = tokens['--surface-card']
      for (const key of ['--ring-calories', '--ring-exercise'] as const) {
        const fill = tokens[key]
        const track = blend(fill, surface, trackAlpha)
        const retention = chroma(track) / chroma(fill)
        expect(
          retention,
          `${modeName}模式下 ${key} 的底轨 ${track} 只保留了 ${(retention * 100).toFixed(0)}% 的色度`,
        ).toBeGreaterThanOrEqual(0.35)
      }
    }
  })
})

describe('圆心必须容得下净热量', () => {
  // 这个环境没有布局引擎，「圆心内容有没有压到环上」无法直接测。
  // 但那条要求可以化简成一条算术不变式：圆心空腔的直径必须大于一个
  // 四位数在该字号下的宽度。
  //
  // 字宽系数取 0.6em——比系统无衬线数字的实际字宽（约 0.52~0.55em）
  // 更保守，因此用它通过的不变式在真实渲染中也成立。
  //
  // 实测过：STROKE=11、MIN_INNER_RADIUS=34、字号=56px 时，空腔 57px
  // 而四位数需 134px——数字会横跨内环、穿过 2px 间隙、压到外环上。
  function readNumber(source: string, pattern: RegExp, label: string): number {
    const match = pattern.exec(source)
    if (!match) throw new Error(`没能从源码里读到 ${label}`)
    return Number(match[1])
  }

  const ringSrc = readFileSync(join(process.cwd(), 'components', 'RingGroup.tsx'), 'utf8')
  const stroke = readNumber(ringSrc, /const STROKE = (\d+(?:\.\d+)?)/, 'STROKE')
  const innerRadius = readNumber(
    ringSrc,
    /const MIN_INNER_RADIUS = (\d+(?:\.\d+)?)/,
    'MIN_INNER_RADIUS',
  )
  const holeDiameter = 2 * (innerRadius - stroke / 2)

  const heroCss = readFileSync(join(process.cwd(), 'components', 'HeroFigure.module.css'), 'utf8')
  const valueBlock = /\.value\s*\{[^}]*\}/.exec(heroCss)
  if (!valueBlock) throw new Error('没能从 HeroFigure.module.css 里读到 .value 规则')
  const heroFontSize = readNumber(valueBlock[0], /font-size:\s*(\d+(?:\.\d+)?)px/, '字号')

  it('空腔直径大于一个四位数在该字号下的宽度', () => {
    const widestRealisticValue = 4 * 0.6 * heroFontSize
    expect(holeDiameter).toBeGreaterThan(widestRealisticValue)
  })

  it('空腔直径也大于「标签 + 数字 + 单位」叠放所需的高度', () => {
    // 三行叠放：标签 12px、数字、单位 12px，行高按 1.1 与 1.2 估
    const stackedHeight = 12 * 1.2 + heroFontSize * 1.1 + 12 * 1.2
    expect(holeDiameter).toBeGreaterThan(stackedHeight)
  })
})
