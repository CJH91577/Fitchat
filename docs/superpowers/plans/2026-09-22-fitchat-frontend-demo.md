# Fitchat 前端 Demo 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用假数据构建 Fitchat 完整的手机端 H5 界面，使产品形态可以被实际打开、点击和评估。

**Architecture:** Next.js App Router 单体。所有数据来自本地假数据模块，不连数据库、不调外部 API、不花钱。设计令牌以 CSS 自定义属性集中定义，组件样式用 CSS Modules。四个圆环和趋势图用手写 SVG，以精确落实数据可视化规范。

**Tech Stack:** Next.js 16.3.5 · React 19.2.8 · TypeScript 5 · CSS Modules · Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-09-22-fitchat-mvp-design.md`

> 本计划是 Fitchat MVP 六份计划中的第一份。它只做界面与假数据，**不碰数据库、认证和 AI**——目的是让形态尽快可见、可评估。

---

## Global Constraints

以下约束适用于本计划的每一个任务，不再逐条重复：

- **环境**：Node 24.16.0 / npm 11.13.0。**不使用 pnpm**（本机未安装）。包管理器统一 npm。
- **不使用 Tailwind**。脚手架以 `--no-tailwind` 生成。
- **字体**：一律系统无衬线 —— `system-ui, -apple-system, "Segoe UI", sans-serif`。**禁止引入衬线体或装饰字体**，包括 hero 数字。
- **圆环配色顺序固定**（由外到内）：热量 = 槽位 1 蓝，运动 = 槽位 2 橙，蛋白质 = 槽位 3 青，碳水 = 槽位 4 黄。
  **该顺序是色盲安全性的前提，不得重排**——验证是按相邻配对做的（暗色最差相邻 CVD ΔE 8.4，亮色 9.1），重排后验证结论即失效。
- **亮色模式下青色 (#1baf7a, 2.74:1) 与黄色 (#eda100, 2.11:1) 对比度低于 3:1。** 按数据可视化规范的「补救规则」，这两个圆环**必须始终显示可见的文字标签与数值**，不得只靠颜色传达身份。本计划中四环一律带标签，天然满足。
- **禁止把状态色（good/warning/serious/critical）用作圆环色或数据系列色。**
- **体重变化方向不做好坏着色**（规格 5.4 节）：不得使用成功绿或危险红表示体重涨跌。
- **每个视图只有一个 hero 数字**（≥48px）。
- **趋势页的两个图必须分开画**，禁止双 Y 轴。体重与热量是两张图，不是一张图两条轴。
- 文案直接写在组件里，不做 i18n。
- 提交信息用 Conventional Commits 前缀（`feat:` / `test:` / `chore:` / `docs:`）。
- **每个任务必须带测试，`npm test` 全绿后才能提交**（`AGENTS.md` 规则）。

---

## Review Focus

以下五类输入或失败模式是规格隐含、但容易被实现忽略的。**每一类都在对应任务的测试里被显式钉住**——不是靠实现者自觉。

1. **跨零点的日期归属。** 用户 23:59 记录一餐，这条记录必须归属当天。若用 UTC 换算或时间戳切分，会跑到前一天或后一天。→ 任务 4
2. **圆环的边界输入。** 摄入超过目标（>100%）、运动消耗为 0、目标未设定（0）时，圆环几何**不得出现 NaN 属性、负角度或反向绘制**。→ 任务 3
3. **空数据状态。** 新用户没有任何记录时，首页与趋势页必须有明确的空状态文案，不得显示空白、`NaN` 或崩溃。→ 任务 4、6
4. **跨月与跨年翻页。** 9 月 1 日往前一天是 8 月 31 日；12 月 31 日往后一天是次年 1 月 1 日。手写日期运算极易在此出错。→ 任务 4
5. **身体数据的极端取值。** 目标热量为负或为 0 时，圆环与达标判定不得产生负值或除零。→ 任务 3

---

## 文件结构

```
app/
  layout.tsx              根布局：字体、令牌、html 属性
  globals.css             设计令牌（亮/暗两套）+ 基础重置
  page.tsx                首页（今日看板）
  page.module.css
  trends/page.tsx         趋势页
  trends/trends.module.css
  onboarding/page.tsx     首次引导
  meals/new/page.tsx      添加饮食
  workouts/new/page.tsx   添加运动
  plan/page.tsx           训练计划
  me/page.tsx             我的
components/
  BottomNav.tsx           底部标签栏（客户端组件，依赖 usePathname）
  BottomNav.module.css
  RingGroup.tsx           四环 SVG
  RingGroup.module.css
  RingGroup.test.tsx
  HeroFigure.tsx          hero 数字
  HeroFigure.module.css
  StatTile.tsx            统计小卡
  StatTile.module.css
  WeightChart.tsx         体重折线（SVG）
  WeightChart.module.css
  AdherenceChart.tsx      热量达标柱状（SVG）
  AdherenceChart.module.css
  CalendarMonth.tsx       月历 + 每日四环状态点
  CalendarMonth.module.css
  DateRangeFilter.tsx     7/30/90 天筛选行
  DateRangeFilter.module.css
lib/
  design/palette.ts       调色板唯一真源（供测试比对 globals.css）
  design/palette.test.ts
  data/types.ts           领域类型
  data/mock.ts            假数据
  data/selectors.ts       派生计算（汇总、净热量）
  data/selectors.test.ts
  data/dates.ts           本地时区日期工具
  data/dates.test.ts
tests/
  setup.ts                测试环境初始化
```

**边界划分依据：** `components/` 每个文件只负责一个视觉单元，可独立测试；`lib/data/` 与视觉完全无关，是纯函数，最容易测也最该测；`lib/design/` 只放设计令牌这一件事。

---

## Task 1: 脚手架与测试环境

**Files:**
- Create: `package.json`、`tsconfig.json`、`next.config.ts`、`eslint.config.mjs`、`.gitignore`、`app/layout.tsx`、`app/globals.css`、`app/favicon.ico`、`public/`、`README.md`（全部由脚手架生成）
- Create: `vitest.config.ts`、`tests/setup.ts`、`app/page.tsx`（改写脚手架默认页）
- Delete: `fitchat-scaffold/`（临时目录）、`app/page.module.css`（脚手架默认样式，本任务不使用）

**Interfaces:**
- Consumes: 无（本任务是起点）
- Produces: 可运行的 Next.js 项目、`npm test` 命令、`@/*` 路径别名（映射到项目根）

> **关键风险：脚手架会生成 `AGENTS.md` 和 `CLAUDE.md`。** 项目根已有一份带规则的 `AGENTS.md`，直接在项目根运行脚手架会**覆盖它**。因此必须生成到**同级的临时目录**再搬运，并在搬运后校验。下面步骤已按此设计。

- [ ] **Step 1: 在临时目录生成脚手架**

不要在当前目录运行。切到项目**父目录**：

```bash
cd /c/Users/admin/codex_project
npx --yes create-next-app@latest fitchat-scaffold \
  --no-tailwind --ts --app --eslint --use-npm --disable-git --skip-install --yes
```

预期输出末行：`Success! Created fitchat-scaffold at ...`

- [ ] **Step 2: 删除会覆盖既有文件的产物**

```bash
rm -f fitchat-scaffold/AGENTS.md fitchat-scaffold/CLAUDE.md
```

**这一步不能跳过。** 删除后搬运才不会碰坏 `AGENTS.md`。

- [ ] **Step 3: 搬运到项目根**

```bash
cp -r fitchat-scaffold/. Fitchat/
rm -rf fitchat-scaffold
cd Fitchat
```

`scaffold/.` 的写法会把隐藏文件（如 `.gitignore`）一起带上。

- [ ] **Step 4: 验证既有文件未被破坏**

```bash
git status --short
git diff --exit-code AGENTS.md .gitattributes
```

预期：`AGENTS.md` 与 `.gitattributes` **不在改动列表里**，`git diff` 无输出、退出码 0。

若二者被改动，立即恢复：

```bash
git checkout -- AGENTS.md .gitattributes
```

- [ ] **Step 5: 安装依赖**

```bash
npm install
```

- [ ] **Step 6: 安装测试依赖**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event vite-tsconfig-paths
```

不指定版本，装最新；这些包版本互相兼容。

- [ ] **Step 7: 配置 Vitest**

创建 `vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
  },
})
```

创建 `tests/setup.ts`：

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 8: 添加测试脚本**

修改 `package.json` 的 `scripts`，加入两行（保留原有的 `dev`/`build`/`start`/`lint`）：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 9: 改写首页为占位内容**

`app/page.tsx`：

```tsx
export default function Home() {
  return <main>Fitchat</main>
}
```

删除脚手架默认样式文件（本计划样式统一走 CSS Modules，这个文件已无引用）：

```bash
rm -f app/page.module.css
```

- [ ] **Step 10: 写冒烟测试**

创建 `app/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Home from './page'

describe('首页', () => {
  it('渲染应用名', () => {
    render(<Home />)
    expect(screen.getByText('Fitchat')).toBeInTheDocument()
  })
})
```

- [ ] **Step 11: 运行测试，确认通过**

```bash
npm test
```

预期：`1 passed`。这条测试同时验证了 jsdom、React Testing Library 和 `@/` 别名三者都配置正确——后续所有任务都依赖它。

- [ ] **Step 12: 手动确认开发服务器能起**

```bash
npm run dev
```

在浏览器打开 `http://localhost:3000`，应看到 `Fitchat` 字样。确认后 `Ctrl+C` 停止。

- [ ] **Step 13: 提交**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with vitest test environment"
```

---

## Task 2: 设计令牌

**Files:**
- Modify: `app/globals.css`
- Create: `lib/design/palette.ts`
- Create: `lib/design/palette.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: 以下 CSS 自定义属性，供后续所有组件使用 ——
  `--surface-page` `--surface-card` `--text-primary` `--text-secondary` `--text-muted` `--gridline` `--axis` `--border-hairline` `--ring-calories` `--ring-exercise` `--ring-protein` `--ring-carbs`

> **色值来自数据可视化技能的参考调色板**，并已用其验证脚本实测通过（暗色模式全项 PASS；亮色模式下青、黄两色的对比度低于 3:1，由「始终显示文字标签」补救）。
> **槽位顺序即色盲安全性机制**，不得重排。

- [ ] **Step 1: 写把 CSS 与 TS 拽在一起的失败测试**

调色板有两份：`globals.css`（实际生效）和 `lib/design/palette.ts`（供测试比对）。两份必然存在，因此需要一条测试**防止它们漂移**。

创建 `lib/design/palette.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { PALETTE } from './palette'

const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8')

describe('设计令牌', () => {
  it.each(['light', 'dark'] as const)('%s 模式的每个色值都出现在 globals.css 中', (mode) => {
    for (const [token, hex] of Object.entries(PALETTE[mode])) {
      expect(css, `${mode} 缺少 ${token} = ${hex}`).toContain(hex)
    }
  })
})
```

- [ ] **Step 2: 运行测试，确认它失败**

```bash
npx vitest run lib/design/palette.test.ts
```

预期：FAIL，报错指向 `Cannot find module './palette'`。

- [ ] **Step 3: 创建调色板模块**

`lib/design/palette.ts`：

```ts
export const PALETTE = {
  light: {
    '--surface-page': '#f9f9f7',
    '--surface-card': '#fcfcfb',
    '--text-primary': '#0b0b0b',
    '--text-secondary': '#52514e',
    '--text-muted': '#898781',
    '--gridline': '#e1e0d9',
    '--axis': '#c3c2b7',
    '--ring-calories': '#2a78d6',
    '--ring-exercise': '#eb6834',
    '--ring-protein': '#1baf7a',
    '--ring-carbs': '#eda100',
  },
  dark: {
    '--surface-page': '#0d0d0d',
    '--surface-card': '#1a1a19',
    '--text-primary': '#ffffff',
    '--text-secondary': '#c3c2b7',
    '--text-muted': '#898781',
    '--gridline': '#2c2c2a',
    '--axis': '#383835',
    '--ring-calories': '#3987e5',
    '--ring-exercise': '#d95926',
    '--ring-protein': '#199e70',
    '--ring-carbs': '#c98500',
  },
} as const
```

- [ ] **Step 4: 写入设计令牌**

覆盖 `app/globals.css`：

```css
:root {
  color-scheme: light;

  --surface-page: #f9f9f7;
  --surface-card: #fcfcfb;
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #898781;
  --gridline: #e1e0d9;
  --axis: #c3c2b7;
  --border-hairline: rgba(11, 11, 11, 0.1);

  --ring-calories: #2a78d6;
  --ring-exercise: #eb6834;
  --ring-protein: #1baf7a;
  --ring-carbs: #eda100;

  --font-sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --radius-card: 16px;
  --radius-tile: 12px;
}

/* 暗色：跟随系统。:not() 守卫让显式的亮色标记能压过系统暗色 */
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme='light'])) {
    color-scheme: dark;

    --surface-page: #0d0d0d;
    --surface-card: #1a1a19;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted: #898781;
    --gridline: #2c2c2a;
    --axis: #383835;
    --border-hairline: rgba(255, 255, 255, 0.1);

    --ring-calories: #3987e5;
    --ring-exercise: #d95926;
    --ring-protein: #199e70;
    --ring-carbs: #c98500;
  }
}

/* 暗色：跟随手动切换。必须放在媒体查询之后，手动选择才能两向都赢 */
:root[data-theme='dark'] {
  color-scheme: dark;

  --surface-page: #0d0d0d;
  --surface-card: #1a1a19;
  --text-primary: #ffffff;
  --text-secondary: #c3c2b7;
  --text-muted: #898781;
  --gridline: #2c2c2a;
  --axis: #383835;
  --border-hairline: rgba(255, 255, 255, 0.1);

  --ring-calories: #3987e5;
  --ring-exercise: #d95926;
  --ring-protein: #199e70;
  --ring-carbs: #c98500;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  background: var(--surface-page);
  color: var(--text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* 大号独立数字用比例数字。tabular-nums 只用于需要纵向对齐的列 */
.num {
  font-variant-numeric: normal;
}

.num-tabular {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
npx vitest run lib/design/palette.test.ts
```

预期：`2 passed`。

- [ ] **Step 6: 提交**

```bash
git add app/globals.css lib/design/
git commit -m "feat: add design tokens for light and dark modes"
```

---

## Task 3: 四环组件

**Files:**
- Create: `components/RingGroup.tsx`
- Create: `components/RingGroup.module.css`
- Create: `components/RingGroup.test.tsx`

**Interfaces:**
- Consumes: Task 2 的四个圆环令牌 `--ring-calories` `--ring-exercise` `--ring-protein` `--ring-carbs`；类名 `.num` / `.num-tabular`
- Produces:
  ```ts
  export type RingSpec = {
    kind: 'calories' | 'exercise' | 'protein' | 'carbs'
    label: string
    value: number
    goal: number
    unit: string
  }
  export default function RingGroup(props: { rings: RingSpec[] }): JSX.Element
  ```
  后续任务 5 按此签名调用。

> **为什么手写 SVG 而不用图表库：** 四个同心圆需要精确控制 2px 的环间隙与描边宽度，图表库在这些细节上会打架，且为一张图引入依赖不划算。

- [ ] **Step 1: 写失败的测试**

创建 `components/RingGroup.test.tsx`：

```tsx
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
    expect(svgOf().textContent).toContain('超出')
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
```

- [ ] **Step 2: 运行测试，确认它失败**

```bash
npx vitest run components/RingGroup.test.tsx
```

预期：FAIL，`Cannot find module './RingGroup'`。

- [ ] **Step 3: 实现组件**

创建 `components/RingGroup.tsx`：

```tsx
import styles from './RingGroup.module.css'

export type RingKind = 'calories' | 'exercise' | 'protein' | 'carbs'

export type RingSpec = {
  kind: RingKind
  label: string
  value: number
  goal: number
  unit: string
}

// 顺序即安全性机制：外→内固定对应调色板槽位 1..4，不得重排
const COLOR_VAR: Record<RingKind, string> = {
  calories: 'var(--ring-calories)',
  exercise: 'var(--ring-exercise)',
  protein: 'var(--ring-protein)',
  carbs: 'var(--ring-carbs)',
}

const SIZE = 176
const CENTER = SIZE / 2
const STROKE = 11
const GAP = 2
const OUTER_RADIUS = 72
const PITCH = STROKE + GAP

export function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export default function RingGroup({ rings }: { rings: RingSpec[] }) {
  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className={styles.svg}
        role="img"
        aria-label="今日目标进度"
      >
        {rings.map((ring, i) => {
          const radius = OUTER_RADIUS - i * PITCH
          const circumference = 2 * Math.PI * radius
          const hasGoal = ring.goal > 0
          const ratio = hasGoal ? Math.min(ring.value / ring.goal, 1) : 0
          const offset = circumference * (1 - ratio)
          const color = COLOR_VAR[ring.kind]

          return (
            <g key={ring.kind} transform={`rotate(-90 ${CENTER} ${CENTER})`}>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={STROKE}
                strokeOpacity={0.18}
              />
              {hasGoal && (
                <circle
                  data-ring-fill={ring.kind}
                  cx={CENTER}
                  cy={CENTER}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
              )}
            </g>
          )
        })}
      </svg>

      <ul className={styles.legend}>
        {rings.map((ring) => {
          const hasGoal = ring.goal > 0
          const over = hasGoal && ring.value > ring.goal

          return (
            <li key={ring.kind} className={styles.item}>
              <span
                className={styles.swatch}
                style={{ background: COLOR_VAR[ring.kind] }}
                aria-hidden="true"
              />
              <span className={styles.label}>{ring.label}</span>
              <span className={`${styles.value} num`}>
                {hasGoal ? (
                  <>
                    {formatValue(ring.value)} / {formatValue(ring.goal)}
                  </>
                ) : (
                  '未设定'
                )}
              </span>
              <span className={styles.unit}>{hasGoal ? ring.unit : ''}</span>
              {over && <span className={styles.over}>超出</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

创建 `components/RingGroup.module.css`：

```css
.wrap {
  display: flex;
  align-items: center;
  gap: 16px;
}

.svg {
  flex: 0 0 auto;
}

.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.item {
  display: grid;
  grid-template-columns: 10px auto 1fr;
  align-items: baseline;
  gap: 8px;
}

/* 色块承载身份，文字一律走文字令牌——文字绝不穿数据色 */
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.label {
  color: var(--text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.value {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  text-align: right;
}

.unit {
  color: var(--text-muted);
  font-size: 12px;
}

.over {
  grid-column: 3;
  color: var(--text-secondary);
  font-size: 12px;
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run components/RingGroup.test.tsx
```

预期：`5 passed`。

若 `未设定` 那条失败，检查是否在 `goal <= 0` 时仍然渲染了 `<circle data-ring-fill>`——那会同时触发 `NaN` 断言失败。

- [ ] **Step 5: 提交**

```bash
git add components/RingGroup.tsx components/RingGroup.module.css components/RingGroup.test.tsx
git commit -m "feat: add four-ring goal progress component"
```

---

## Task 4: 假数据层与派生计算

**Files:**
- Create: `lib/data/types.ts`
- Create: `lib/data/dates.ts`
- Create: `lib/data/dates.test.ts`
- Create: `lib/data/mock.ts`
- Create: `lib/data/selectors.ts`
- Create: `lib/data/selectors.test.ts`

**Interfaces:**
- Consumes: 无（纯函数层，不依赖 UI）
- Produces: 后续所有页面依赖的类型与函数 ——
  ```ts
  // dates.ts
  export function toDateKey(d: Date): string            // 本地时区 YYYY-MM-DD
  export function addDays(key: string, delta: number): string
  export function weekdayOf(key: string): number        // 1=周一 … 7=周日
  export function monthGrid(year: number, month: number): (string | null)[]
  export function lastNDays(endKey: string, n: number): string[]

  // selectors.ts
  export function sumMacros(entries: FoodEntry[]): MacroTotals
  export function netCalories(day: DayLog): number
  export function adherence(day: DayLog, goal: UserGoal): number  // 0..1
  ```
  类型定义见 `types.ts`（下方 Step 3 给出全部）。

> **这一层是整个 demo 里最该有测试的地方。** 它没有 UI、全是纯函数，而日期运算和热量汇总恰恰是最容易出隐蔽错误的两处。

- [ ] **Step 1: 写日期工具的失败测试**

创建 `lib/data/dates.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { toDateKey, addDays, weekdayOf, lastNDays, monthGrid } from './dates'

describe('toDateKey', () => {
  it('使用本地时区，跨零点不偏移', () => {
    // 本地时间 23:59，若误用 UTC 换算会跑到次日
    expect(toDateKey(new Date(2026, 8, 22, 23, 59))).toBe('2026-09-22')
  })

  it('本地时间 00:01 归属当天', () => {
    expect(toDateKey(new Date(2026, 8, 22, 0, 1))).toBe('2026-09-22')
  })

  it('月份与日补零', () => {
    expect(toDateKey(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('跨月向前', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('跨月向后', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('跨年前', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('跨年后', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('闰年 2 月', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('weekdayOf', () => {
  it('2026-09-22 是周二', () => {
    expect(weekdayOf('2026-09-22')).toBe(2)
  })

  it('2026-09-21 是周一', () => {
    expect(weekdayOf('2026-09-21')).toBe(1)
  })
})

describe('lastNDays', () => {
  it('含末尾当天，长度等于 n，升序', () => {
    const days = lastNDays('2026-09-22', 3)
    expect(days).toEqual(['2026-09-20', '2026-09-21', '2026-09-22'])
  })
})

describe('monthGrid', () => {
  it('9 月 1 日是周二，首格前应补 1 个空位', () => {
    const grid = monthGrid(2026, 9)
    expect(grid[0]).toBeNull()
    expect(grid[1]).toBe('2026-09-01')
  })

  it('总格数为 7 的倍数', () => {
    for (const m of [1, 2, 4, 9, 12]) {
      expect(monthGrid(2026, m).length % 7).toBe(0)
    }
  })
})
```

- [ ] **Step 2: 运行测试，确认它失败**

```bash
npx vitest run lib/data/dates.test.ts
```

预期：FAIL，`Cannot find module './dates'`。

- [ ] **Step 3: 实现日期工具**

创建 `lib/data/dates.ts`：

```ts
// 全部使用本地时区日期分量构造，不经过 UTC，避免跨零点偏移
function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(key: string, delta: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + delta)
  return toDateKey(d)
}

// 1 = 周一 … 7 = 周日
export function weekdayOf(key: string): number {
  const jsDay = parseKey(key).getDay() // 0 = 周日
  return jsDay === 0 ? 7 : jsDay
}

export function lastNDays(endKey: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(endKey, i - (n - 1)))
}

// 周一为一周之首；月首之前的空位用 null 填充
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const lead = first.getDay() === 0 ? 6 : first.getDay() - 1

  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${pad(month)}-${pad(day)}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run lib/data/dates.test.ts
```

预期：全部通过。**若跨月/跨年两条失败，检查是否误用了 `toISOString()`——那会走 UTC 并产生偏移。**

- [ ] **Step 5: 定义领域类型**

创建 `lib/data/types.ts`：

```ts
export type GoalDirection = 'cut' | 'bulk' | 'maintain'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type FoodSource = 'open-data' | 'curated' | 'user' | 'ai-estimate'

export type MacroTotals = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type FoodEntry = {
  id: string
  slot: MealSlot
  name: string
  grams: number
  source: FoodSource
  totals: MacroTotals
}

export type StrengthSet = {
  reps: number
  weightKg: number
}

export type ExerciseEntry = {
  id: string
  kind: 'cardio' | 'strength'
  name: string
  minutes?: number
  sets?: StrengthSet[]
  caloriesBurned: number
}

export type WeightEntry = {
  date: string
  kg: number
}

export type PlanItem = {
  name: string
  sets: number
  reps: string
}

export type PlanDay = {
  weekday: number
  theme: string
  items: PlanItem[]
}

export type DayLog = {
  date: string
  foods: FoodEntry[]
  exercises: ExerciseEntry[]
}

export type UserGoal = {
  direction: GoalDirection
  calories: number
  protein: number
  carbs: number
  fat: number
  exerciseCalories: number
  targetWeightKg: number
}

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}
```

- [ ] **Step 6: 写派生计算的失败测试**

创建 `lib/data/selectors.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { sumMacros, netCalories, adherence, emptyMacros } from './selectors'
import type { DayLog, FoodEntry, UserGoal } from './types'

function food(calories: number, protein = 0, carbs = 0, fat = 0): FoodEntry {
  return {
    id: `f${calories}`,
    slot: 'lunch',
    name: '测试食物',
    grams: 100,
    source: 'curated',
    totals: { calories, protein, carbs, fat },
  }
}

const goal: UserGoal = {
  direction: 'cut',
  calories: 1800,
  protein: 120,
  carbs: 220,
  fat: 60,
  exerciseCalories: 500,
  targetWeightKg: 65,
}

describe('emptyMacros', () => {
  it('全为 0', () => {
    expect(emptyMacros()).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })
})

describe('sumMacros', () => {
  it('空数组返回全 0，不返回 NaN', () => {
    expect(sumMacros([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })

  it('逐项求和', () => {
    const total = sumMacros([food(380, 20, 40, 10), food(620, 30, 60, 20)])
    expect(total).toEqual({ calories: 1000, protein: 50, carbs: 100, fat: 30 })
  })
})

describe('netCalories', () => {
  it('净热量 = 摄入 − 运动消耗', () => {
    const day: DayLog = {
      date: '2026-09-22',
      foods: [food(1420)],
      exercises: [
        {
          id: 'e1',
          kind: 'cardio',
          name: '跑步',
          minutes: 30,
          caloriesBurned: 380,
        },
      ],
    }
    expect(netCalories(day)).toBe(1040)
  })

  it('无记录时为 0', () => {
    expect(netCalories({ date: '2026-09-22', foods: [], exercises: [] })).toBe(0)
  })
})

describe('adherence', () => {
  it('恰好达标为 1', () => {
    const day: DayLog = { date: '2026-09-22', foods: [food(1800)], exercises: [] }
    expect(adherence(day, goal)).toBe(1)
  })

  it('超出目标不超过 1', () => {
    const day: DayLog = { date: '2026-09-22', foods: [food(2400)], exercises: [] }
    expect(adherence(day, goal)).toBe(1)
  })

  it('目标为 0 时返回 0，不产生除零', () => {
    const zeroGoal: UserGoal = { ...goal, calories: 0 }
    const day: DayLog = { date: '2026-09-22', foods: [food(500)], exercises: [] }
    expect(adherence(day, zeroGoal)).toBe(0)
  })

  it('没有任何记录时为 0', () => {
    expect(adherence({ date: '2026-09-22', foods: [], exercises: [] }, goal)).toBe(0)
  })
})
```

- [ ] **Step 7: 运行测试，确认它失败**

```bash
npx vitest run lib/data/selectors.test.ts
```

预期：FAIL，`Cannot find module './selectors'`（`types.ts` 已存在，不会报它）。

- [ ] **Step 8: 实现派生计算**

创建 `lib/data/selectors.ts`：

```ts
import type { DayLog, FoodEntry, MacroTotals, UserGoal } from './types'

export function emptyMacros(): MacroTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 }
}

export function sumMacros(entries: FoodEntry[]): MacroTotals {
  return entries.reduce<MacroTotals>((acc, e) => {
    acc.calories += e.totals.calories
    acc.protein += e.totals.protein
    acc.carbs += e.totals.carbs
    acc.fat += e.totals.fat
    return acc
  }, emptyMacros())
}

export function burnedCalories(day: DayLog): number {
  return day.exercises.reduce((sum, e) => sum + e.caloriesBurned, 0)
}

export function netCalories(day: DayLog): number {
  return sumMacros(day.foods).calories - burnedCalories(day)
}

// 达标率 0..1。目标未设定或没有记录时为 0，绝不返回 NaN 或负值
export function adherence(day: DayLog, goal: UserGoal): number {
  if (goal.calories <= 0) return 0
  const intake = sumMacros(day.foods).calories
  if (intake <= 0) return 0
  return Math.min(intake / goal.calories, 1)
}
```

- [ ] **Step 9: 运行测试，确认通过**

```bash
npx vitest run lib/data/selectors.test.ts
```

预期：全部通过。

- [ ] **Step 10: 创建假数据**

创建 `lib/data/mock.ts`。数据要**故意包含边界情况**，好让界面在 demo 阶段就暴露问题：至少一天摄入超出目标、至少一天完全没有记录、至少一条 `ai-estimate` 来源的饮食、至少一次力量训练。

```ts
import { lastNDays } from './dates'
import type {
  DayLog,
  FoodEntry,
  PlanDay,
  UserGoal,
  WeightEntry,
} from './types'

export const TODAY = '2026-09-22'

export const MOCK_USER = {
  name: '演示用户',
  heightCm: 175,
  age: 30,
  sex: 'male' as const,
}

export const MOCK_GOAL: UserGoal = {
  direction: 'cut',
  calories: 1800,
  protein: 120,
  carbs: 220,
  fat: 60,
  exerciseCalories: 500,
  targetWeightKg: 65,
}

export const MOCK_PLAN: PlanDay[] = [
  {
    weekday: 1,
    theme: '胸 + 三头',
    items: [
      { name: '卧推', sets: 4, reps: '8–10' },
      { name: '上斜哑铃卧推', sets: 3, reps: '12' },
      { name: '绳索下压', sets: 3, reps: '15' },
    ],
  },
  { weekday: 2, theme: '休息', items: [] },
  {
    weekday: 3,
    theme: '背 + 二头',
    items: [
      { name: '引体向上', sets: 4, reps: '力竭' },
      { name: '杠铃划船', sets: 4, reps: '10' },
      { name: '哑铃弯举', sets: 3, reps: '12' },
    ],
  },
  {
    weekday: 4,
    theme: '腿',
    items: [
      { name: '深蹲', sets: 5, reps: '5' },
      { name: '罗马尼亚硬拉', sets: 3, reps: '10' },
    ],
  },
  { weekday: 5, theme: '休息', items: [] },
  {
    weekday: 6,
    theme: '肩 + 核心',
    items: [
      { name: '推举', sets: 4, reps: '8' },
      { name: '侧平举', sets: 4, reps: '15' },
    ],
  },
  { weekday: 7, theme: '有氧', items: [{ name: '慢跑', sets: 1, reps: '40 分钟' }] },
]

function entry(id: string, slot: FoodEntry['slot'], name: string, calories: number, protein: number, carbs: number, fat: number, source: FoodEntry['source'] = 'curated'): FoodEntry {
  return {
    id,
    slot,
    name,
    grams: 100,
    source,
    totals: { calories, protein, carbs, fat },
  }
}

// 今天：摄入略低于目标，含一条 AI 估算和一次力量训练
const today: DayLog = {
  date: TODAY,
  foods: [
    entry('t1', 'breakfast', '燕麦牛奶', 380, 18, 55, 9),
    entry('t2', 'lunch', '鸡胸肉盖饭', 620, 42, 70, 14),
    entry('t3', 'dinner', '清炒时蔬 + 米饭', 420, 12, 68, 8),
    entry('t4', 'snack', '红烧肉（AI 估算）', 180, 8, 4, 14, 'ai-estimate'),
  ],
  exercises: [
    {
      id: 'tx1',
      kind: 'strength',
      name: '卧推',
      sets: [
        { reps: 10, weightKg: 60 },
        { reps: 9, weightKg: 65 },
        { reps: 8, weightKg: 65 },
      ],
      caloriesBurned: 180,
    },
    {
      id: 'tx2',
      kind: 'cardio',
      name: '慢跑',
      minutes: 30,
      caloriesBurned: 300,
    },
  ],
}

// 昨天：超出目标，用于验证「超出」提示
const yesterday: DayLog = {
  date: '2026-09-21',
  foods: [
    entry('y1', 'breakfast', '豆浆油条', 520, 14, 62, 24, 'open-data'),
    entry('y2', 'lunch', '火锅', 1100, 55, 70, 65, 'ai-estimate'),
    entry('y3', 'dinner', '面条', 480, 16, 80, 8),
  ],
  exercises: [],
}

// 前天：完全空记录，用于验证空状态
const emptyDay: DayLog = { date: '2026-09-20', foods: [], exercises: [] }

const older: DayLog = {
  date: '2026-09-19',
  foods: [entry('o1', 'lunch', '牛肉饭', 700, 38, 82, 18)],
  exercises: [
    { id: 'ox1', kind: 'strength', name: '深蹲', sets: [{ reps: 5, weightKg: 100 }], caloriesBurned: 220 },
  ],
}

export const MOCK_DAYS: Record<string, DayLog> = {
  [today.date]: today,
  [yesterday.date]: yesterday,
  [emptyDay.date]: emptyDay,
  [older.date]: older,
}

// 覆盖 90 天的体重序列（带噪点，不是直线），以及最近 30 天的达标记录
export const MOCK_WEIGHTS: WeightEntry[] = lastNDays(TODAY, 90).map((date, i) => ({
  date,
  kg: Number((72.4 - i * 0.06 + Math.sin(i * 1.7) * 0.35).toFixed(1)),
}))

export function dayLogFor(date: string): DayLog {
  return MOCK_DAYS[date] ?? { date, foods: [], exercises: [] }
}

export function weightFor(date: string): number | undefined {
  return MOCK_WEIGHTS.find((w) => w.date === date)?.kg
}
```

- [ ] **Step 11: 加一条测试，钉住假数据本身的边界覆盖**

创建 `lib/data/mock.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { MOCK_DAYS, MOCK_WEIGHTS, dayLogFor } from './mock'
import { sumMacros, netCalories } from './selectors'
import { MOCK_GOAL } from './mock'

describe('假数据', () => {
  it('包含一天摄入超出目标', () => {
    const over = Object.values(MOCK_DAYS).some(
      (d) => sumMacros(d.foods).calories > MOCK_GOAL.calories,
    )
    expect(over).toBe(true)
  })

  it('包含一天无任何记录', () => {
    const empty = Object.values(MOCK_DAYS).some(
      (d) => d.foods.length === 0 && d.exercises.length === 0,
    )
    expect(empty).toBe(true)
  })

  it('包含至少一条 AI 估算来源的饮食', () => {
    const hasAi = Object.values(MOCK_DAYS).some((d) =>
      d.foods.some((f) => f.source === 'ai-estimate'),
    )
    expect(hasAi).toBe(true)
  })

  it('包含至少一次力量训练记录', () => {
    const hasStrength = Object.values(MOCK_DAYS).some((d) =>
      d.exercises.some((e) => e.kind === 'strength'),
    )
    expect(hasStrength).toBe(true)
  })

  it('查询未记录的日期返回空日志而非 undefined', () => {
    expect(dayLogFor('2020-01-01').foods).toEqual([])
    expect(dayLogFor('2020-01-01').exercises).toEqual([])
  })

  it('体重序列覆盖 90 天且不含 NaN', () => {
    expect(MOCK_WEIGHTS).toHaveLength(90)
    expect(MOCK_WEIGHTS.every((w) => Number.isFinite(w.kg))).toBe(true)
  })

  it('净热量计算对空记录返回 0', () => {
    expect(netCalories(dayLogFor('2020-01-01'))).toBe(0)
  })
})
```

- [ ] **Step 12: 运行全部测试，确认通过**

```bash
npm test
```

预期：全部通过。

- [ ] **Step 13: 提交**

```bash
git add lib/data/
git commit -m "feat: add domain types, local-timezone date utils and mock data"
```

---

## Task 5: 首页

**Files:**
- Create: `components/HeroFigure.tsx`、`components/HeroFigure.module.css`
- Create: `components/BottomNav.tsx`、`components/BottomNav.module.css`
- Create: `components/AiBadge.tsx`、`components/AiBadge.module.css`
- Modify: `app/page.tsx`
- Create: `app/page.module.css`
- Modify: `app/layout.tsx`（挂载底部导航、设定 `lang="zh-CN"`）
- Create: `app/page.test.tsx`（覆盖 Task 1 的占位测试）

**Interfaces:**
- Consumes: `RingGroup`（Task 3）、`MOCK_GOAL`/`dayLogFor`/`MOCK_PLAN`（Task 4）、`netCalories`/`sumMacros`/`burnedCalories`（Task 4）
- Produces: `HeroFigure(props: { label: string; value: string; unit: string })`、`BottomNav()`、`AiBadge()`

> **规格要点：**「净热量」是闭环核心，作为**本页唯一的 hero 数字**（规格 5.1 节）。**AI 估算的条目必须有可见标记**（规格 5.4 节其二）。**体重涨跌不做颜色提示**（规格 5.4 节其三）。

- [ ] **Step 1: 写失败的首页测试**

覆盖 `app/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Home from './page'

// usePathname 需要 Next 路由上下文；本页不依赖它，直接桩掉
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

describe('首页', () => {
  it('净热量作为 hero 数字出现', () => {
    render(<Home />)
    expect(screen.getByText('净热量')).toBeInTheDocument()
    expect(screen.getByTestId('hero-value')).toBeInTheDocument()
  })

  it('展示四个圆环', () => {
    render(<Home />)
    expect(screen.getByText('蛋白质')).toBeInTheDocument()
    expect(screen.getByText('碳水')).toBeInTheDocument()
  })

  it('展示今天该练什么（来自训练计划）', () => {
    render(<Home />)
    expect(screen.getByText('今天该练')).toBeInTheDocument()
  })

  it('四餐都列出', () => {
    render(<Home />)
    for (const slot of ['早餐', '午餐', '晚餐', '加餐']) {
      expect(screen.getByText(slot)).toBeInTheDocument()
    }
  })

  it('AI 估算的条目带可见标记', () => {
    render(<Home />)
    expect(screen.getAllByText('AI 估算').length).toBeGreaterThan(0)
  })

  it('体重涨跌不使用成功或危险状态色', () => {
    const { container } = render(<Home />)
    const html = container.innerHTML
    // 状态色是保留色，绝不用于体重方向
    expect(html).not.toContain('#0ca30c')
    expect(html).not.toContain('#d03b3b')
    expect(html).not.toContain('#006300')
  })
})
```

需要在文件顶部补上 `import { vi } from 'vitest'`（所有测试文件统一从 `vitest` 显式导入 `vi`，不依赖全局注入——显式导入在编辑器里能正确跳转，也不受配置变动影响）。

- [ ] **Step 2: 运行测试，确认它失败**

```bash
npx vitest run app/page.test.tsx
```

预期：FAIL，找不到 `净热量` 等文本。

- [ ] **Step 3: 实现 hero 数字组件**

`components/HeroFigure.tsx`：

```tsx
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
```

`components/HeroFigure.module.css`：

```css
.wrap {
  text-align: center;
}

.label {
  color: var(--text-secondary);
  font-size: 14px;
}

.row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
}

/* 全页唯一的 hero 数字。系统无衬线，比例数字，不用 tabular-nums */
.value {
  color: var(--text-primary);
  font-size: 56px;
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.02em;
}

.unit {
  color: var(--text-muted);
  font-size: 16px;
}
```

- [ ] **Step 4: 实现 AI 估算标记**

`components/AiBadge.tsx`：

```tsx
import styles from './AiBadge.module.css'

export default function AiBadge() {
  return (
    <span className={styles.badge} title="此条数值由大模型估算，仅供参考">
      AI 估算
    </span>
  )
}
```

`components/AiBadge.module.css`：

```css
/* 用文字与底色区分，不占用圆环的四个数据色，也不使用状态色 */
.badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 6px;
  background: color-mix(in oklab, var(--text-primary) 12%, transparent);
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}
```

- [ ] **Step 5: 实现底部导航**

`components/BottomNav.tsx`：

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'

const ITEMS = [
  { href: '/', label: '今日' },
  { href: '/trends', label: '趋势' },
  { href: '/meals/new', label: '记录', primary: true },
  { href: '/me', label: '我的' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav} aria-label="主导航">
      {ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[styles.item, active && styles.active, item.primary && styles.primary]
              .filter(Boolean)
              .join(' ')}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

`components/BottomNav.module.css`：

```css
.nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--surface-card);
  border-top: 1px solid var(--border-hairline);
  padding-bottom: env(safe-area-inset-bottom);
}

.item {
  padding: 14px 0;
  text-align: center;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 13px;
}

.active {
  color: var(--text-primary);
  font-weight: 600;
}

.primary {
  color: var(--text-primary);
  font-size: 20px;
  line-height: 1;
}
```

- [ ] **Step 6: 实现首页**

覆盖 `app/page.tsx`：

```tsx
import HeroFigure from '@/components/HeroFigure'
import RingGroup, { type RingSpec } from '@/components/RingGroup'
import AiBadge from '@/components/AiBadge'
import { MOCK_PLAN, MOCK_GOAL, TODAY, dayLogFor, weightFor, MOCK_WEIGHTS } from '@/lib/data/mock'
import { burnedCalories, netCalories, sumMacros } from '@/lib/data/selectors'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/data/types'
import { weekdayOf } from '@/lib/data/dates'
import styles from './page.module.css'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export default function Home() {
  const day = dayLogFor(TODAY)
  const macros = sumMacros(day.foods)
  const burned = burnedCalories(day)
  const net = netCalories(day)

  const rings: RingSpec[] = [
    { kind: 'calories', label: '热量', value: macros.calories, goal: MOCK_GOAL.calories, unit: '千卡' },
    { kind: 'exercise', label: '运动', value: burned, goal: MOCK_GOAL.exerciseCalories, unit: '千卡' },
    { kind: 'protein', label: '蛋白质', value: macros.protein, goal: MOCK_GOAL.protein, unit: 'g' },
    { kind: 'carbs', label: '碳水', value: macros.carbs, goal: MOCK_GOAL.carbs, unit: 'g' },
  ]

  const todayPlan = MOCK_PLAN.find((p) => p.weekday === weekdayOf(TODAY))
  const latestWeight = MOCK_WEIGHTS[MOCK_WEIGHTS.length - 1]
  const prevWeight = MOCK_WEIGHTS[MOCK_WEIGHTS.length - 2]
  const delta = latestWeight && prevWeight ? Number((latestWeight.kg - prevWeight.kg).toFixed(1)) : 0

  const slotCalories = (slot: MealSlot) =>
    day.foods.filter((f) => f.slot === slot).reduce((s, f) => s + f.totals.calories, 0)

  return (
    <main className={styles.page}>
      <header className={styles.dateBar}>
        <span className={styles.dateText}>9月22日 周二</span>
      </header>

      <section className={styles.card}>
        <RingGroup rings={rings} />
        <div className={styles.netSection}>
          <HeroFigure label="净热量" value={String(net)} unit="千卡" />
        </div>
      </section>

      {todayPlan && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>今天该练 · {todayPlan.theme}</h2>
          </div>
          {todayPlan.items.length === 0 ? (
            <p className={styles.empty}>今天休息，好好恢复。</p>
          ) : (
            <ul className={styles.list}>
              {todayPlan.items.map((item) => (
                <li key={item.name} className={styles.row}>
                  <span className={styles.rowName}>{item.name}</span>
                  <span className={`${styles.rowMeta} num-tabular`}>
                    {item.sets} × {item.reps}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>今日饮食</h2>
        </div>
        <ul className={styles.list}>
          {SLOTS.map((slot) => {
            const foods = day.foods.filter((f) => f.slot === slot)
            const calories = slotCalories(slot)
            return (
              <li key={slot} className={styles.row}>
                <span className={styles.rowName}>{MEAL_SLOT_LABEL[slot]}</span>
                <span className={styles.rowTags}>
                  {foods.some((f) => f.source === 'ai-estimate') && <AiBadge />}
                </span>
                <span className={`${styles.rowMeta} num-tabular`}>
                  {foods.length === 0 ? '未记录' : `${calories} 千卡`}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>今日运动</h2>
        </div>
        {day.exercises.length === 0 ? (
          <p className={styles.empty}>今天还没有运动记录。</p>
        ) : (
          <ul className={styles.list}>
            {day.exercises.map((e) => (
              <li key={e.id} className={styles.row}>
                <span className={styles.rowName}>{e.name}</span>
                <span className={`${styles.rowMeta} num-tabular`}>
                  {e.kind === 'cardio' ? `${e.minutes} 分钟 · ` : `${e.sets?.length ?? 0} 组 · `}
                  -{e.caloriesBurned}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>最近体重</h2>
        </div>
        {latestWeight ? (
          <p className={styles.weight}>
            <span className={`${styles.weightValue} num`}>{latestWeight.kg} kg</span>
            {/* 涨跌只显示方向与数值，不使用成功/危险色 */}
            <span className={`${styles.weightDelta} num-tabular`}>
              {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : '持平'}
            </span>
          </p>
        ) : (
          <p className={styles.empty}>还没有体重记录。</p>
        )}
      </section>
    </main>
  )
}
```

创建 `app/page.module.css`：

```css
.page {
  padding: 16px 16px 88px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 520px;
  margin: 0 auto;
}

.dateBar {
  padding: 4px 0 8px;
}

.dateText {
  color: var(--text-secondary);
  font-size: 15px;
}

.card {
  background: var(--surface-card);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-card);
  padding: 16px;
}

.cardHead {
  margin-bottom: 12px;
}

.cardTitle {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.netSection {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-hairline);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 0;
  border-bottom: 1px solid var(--border-hairline);
}

.row:last-child {
  border-bottom: none;
}

.rowName {
  flex: 1;
  color: var(--text-primary);
  font-size: 14px;
}

.rowTags {
  display: flex;
  gap: 6px;
}

.rowMeta {
  color: var(--text-secondary);
  font-size: 14px;
}

.empty {
  margin: 0;
  padding: 8px 0;
  color: var(--text-muted);
  font-size: 14px;
}

.weight {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.weightValue {
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 600;
}

/* 中性色。体重涨跌本身不是好坏——增肌期上涨正是目标 */
.weightDelta {
  color: var(--text-secondary);
  font-size: 14px;
}
```

- [ ] **Step 7: 更新根布局**

覆盖 `app/layout.tsx`：

```tsx
import type { Metadata } from 'next'
import BottomNav from '@/components/BottomNav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fitchat',
  description: '饮食与健身管理',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
```

- [ ] **Step 8: 运行测试，确认通过**

```bash
npm test
```

预期：全部通过。

- [ ] **Step 9: 手动查看**

```bash
npm run dev
```

打开 `http://localhost:3000`，逐项确认：

1. 「净热量」是页面上最大的数字，且**全页只有它一个 hero 尺寸的数字**
2. 四个圆环颜色由外到内是 蓝 / 橙 / 青 / 黄
3. 「加餐」那一行带「AI 估算」小标签
4. 体重涨跌是中性灰色，**不是绿色也不是红色**
5. 底部导航四项可见，且「今日」高亮

- [ ] **Step 10: 提交**

```bash
git add app/ components/
git commit -m "feat: add home dashboard with four rings and net calorie hero"
```

---

## Task 6: 趋势页

**Files:**
- Create: `components/DateRangeFilter.tsx`、`components/DateRangeFilter.module.css`
- Create: `components/WeightChart.tsx`、`components/WeightChart.module.css`
- Create: `components/AdherenceChart.tsx`、`components/AdherenceChart.module.css`
- Create: `components/CalendarMonth.tsx`、`components/CalendarMonth.module.css`
- Create: `app/trends/page.tsx`、`app/trends/trends.module.css`
- Create: `app/trends/page.test.tsx`

**Interfaces:**
- Consumes: `MOCK_WEIGHTS`、`MOCK_DAYS`、`dayLogFor`、`MOCK_GOAL`（Task 4）、`adherence`、`monthGrid`、`lastNDays`、`weekdayOf`（Task 4）、四个圆环令牌（Task 2）
- Produces: `DateRangeFilter(props: { value: RangeKey; onChange: (v: RangeKey) => void })`、`WeightChart(props: { points: { date: string; kg: number }[] })`、`AdherenceChart(props: { points: { date: string; ratio: number }[] })`、`CalendarMonth(props: { year: number; month: number; ratiosByDate: Record<string, number[]> })`

> **必须避免的头号错误：双 Y 轴。** 体重与热量达标率量纲不同，**必须是两张独立的图**，不是一张图两条轴。
>
> **筛选行必须只有一处**，位于两张图之上，一次切换同时作用于两者。

- [ ] **Step 1: 写失败的趋势页测试**

创建 `app/trends/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Trends from './page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/trends',
}))

describe('趋势页', () => {
  it('区间筛选行只有一处', () => {
    render(<Trends />)
    expect(screen.getAllByRole('group', { name: '时间区间' })).toHaveLength(1)
  })

  it('三个区间选项都在', () => {
    render(<Trends />)
    for (const label of ['7 天', '30 天', '90 天']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('体重与达标率是两张独立的图，不共用坐标轴', () => {
    render(<Trends />)
    expect(screen.getByTestId('chart-weight')).toBeInTheDocument()
    expect(screen.getByTestId('chart-adherence')).toBeInTheDocument()
    expect(screen.getByTestId('chart-weight')).not.toBe(
      screen.getByTestId('chart-adherence'),
    )
  })

  it('体重图是单系列，因此不出现图例框', () => {
    render(<Trends />)
    expect(screen.queryByTestId('legend-weight')).not.toBeInTheDocument()
  })

  it('月历渲染出当月日期', () => {
    render(<Trends />)
    expect(screen.getByText('2026 年 9 月')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
  })

  it('每张图都有等价的表格视图', () => {
    render(<Trends />)
    expect(screen.getByRole('button', { name: /体重.*表格/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /达标.*表格/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试，确认它失败**

```bash
npx vitest run app/trends/page.test.tsx
```

预期：FAIL，找不到 `./page`。

- [ ] **Step 3: 实现区间筛选行**

`components/DateRangeFilter.tsx`：

```tsx
'use client'

import styles from './DateRangeFilter.module.css'

export type RangeKey = 7 | 30 | 90

const OPTIONS: RangeKey[] = [7, 30, 90]

export default function DateRangeFilter({
  value,
  onChange,
}: {
  value: RangeKey
  onChange: (v: RangeKey) => void
}) {
  return (
    <div className={styles.row} role="group" aria-label="时间区间">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`${styles.button} ${value === option ? styles.selected : ''}`}
        >
          {/* 选中态靠字形加粗与底色，不只靠颜色 */}
          <span className={styles.check} aria-hidden="true">
            {value === option ? '✓' : ''}
          </span>
          {option} 天
        </button>
      ))}
    </div>
  )
}
```

`components/DateRangeFilter.module.css`：

```css
/* 全页唯一的筛选行，位于所有图之上 */
.row {
  display: flex;
  gap: 8px;
}

.button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 9px 0;
  border: 1px solid var(--border-hairline);
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}

.selected {
  background: color-mix(in oklab, var(--text-primary) 8%, transparent);
  color: var(--text-primary);
  font-weight: 600;
}

/* 16px 加粗对勾，是被选中的非颜色信号 */
.check {
  width: 16px;
  font-size: 12px;
  font-weight: 700;
}
```

- [ ] **Step 4: 实现体重折线图**

`components/WeightChart.tsx`：

```tsx
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
```

`components/WeightChart.module.css`：

```css
.figure {
  margin: 0;
}

.svg {
  width: 100%;
  height: auto;
  display: block;
}

.caption {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 6px;
}

.captionLabel {
  color: var(--text-muted);
  font-size: 12px;
}

.captionValue {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
```

- [ ] **Step 5: 实现达标率柱状图**

`components/AdherenceChart.tsx`：

```tsx
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
```

`components/AdherenceChart.module.css`：

```css
.figure {
  margin: 0;
}

.svg {
  width: 100%;
  height: auto;
  display: block;
}

.caption {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
```

- [ ] **Step 6: 实现月历**

`components/CalendarMonth.tsx`：

```tsx
import styles from './CalendarMonth.module.css'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export type CalendarMonthProps = {
  year: number
  month: number
  cells: (string | null)[]
  /** 每个日期对应四个环的达标情况，顺序固定：热量、运动、蛋白质、碳水 */
  ratiosByDate: Record<string, number[]>
  today: string
}

const RING_ORDER = ['热量', '运动', '蛋白质', '碳水'] as const

export default function CalendarMonth({
  year,
  month,
  cells,
  ratiosByDate,
  today,
}: CalendarMonthProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        {year} 年 {month} 月
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((w) => (
          <div key={w} className={styles.weekday}>
            {w}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className={styles.emptyCell} />

          const dayNum = Number(date.slice(-2))
          const ratios = ratiosByDate[date] ?? [0, 0, 0, 0]
          const isToday = date === today

          return (
            <div key={date} className={`${styles.cell} ${isToday ? styles.today : ''}`}>
              <span className={`${styles.dayNum} num-tabular`}>{dayNum}</span>
              <span className={styles.dots}>
                {RING_ORDER.map((name, ringIndex) => {
                  // 实心 / 空心 是非颜色的第二通道；位置顺序固定，颜色只作强化
                  const done = (ratios[ringIndex] ?? 0) >= 1
                  return (
                    <span
                      key={name}
                      data-ring={name}
                      title={`${name}：${done ? '达成' : '未达成'}`}
                      className={`${styles.dot} ${done ? styles.dotDone : ''}`}
                      style={
                        {
                          '--dot-color': [
                            'var(--ring-calories)',
                            'var(--ring-exercise)',
                            'var(--ring-protein)',
                            'var(--ring-carbs)',
                          ][ringIndex],
                        } as React.CSSProperties
                      }
                    />
                  )
                })}
              </span>
            </div>
          )
        })}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotDone}`} style={{ '--dot-color': 'var(--text-primary)' } as React.CSSProperties} />
          达成
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ '--dot-color': 'var(--text-primary)' } as React.CSSProperties} />
          未达成
        </span>
      </div>
    </div>
  )
}
```

`components/CalendarMonth.module.css`：

```css
.wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.weekdays,
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.weekday {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  padding-bottom: 2px;
}

.cell,
.emptyCell {
  aspect-ratio: 1 / 1.15;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.cell {
  background: color-mix(in oklab, var(--text-primary) 4%, transparent);
}

.today {
  outline: 1px solid var(--axis);
  outline-offset: -1px;
}

.dayNum {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1;
}

.dots {
  display: flex;
  gap: 2px;
}

/* 4px 小点。实心=达成，空心=未达成，形状差异是非颜色通道 */
.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  border: 1px solid var(--dot-color, var(--text-muted));
  background: transparent;
}

.dotDone {
  background: var(--dot-color, var(--text-muted));
}

.legend {
  display: flex;
  gap: 14px;
  margin-top: 2px;
}

.legendItem {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}
```

- [ ] **Step 7: 实现趋势页**

创建 `app/trends/page.tsx`：

```tsx
'use client'

import { useMemo, useState } from 'react'
import DateRangeFilter, { type RangeKey } from '@/components/DateRangeFilter'
import WeightChart from '@/components/WeightChart'
import AdherenceChart from '@/components/AdherenceChart'
import CalendarMonth from '@/components/CalendarMonth'
import { lastNDays, monthGrid } from '@/lib/data/dates'
import { MOCK_DAYS, MOCK_GOAL, MOCK_WEIGHTS, TODAY } from '@/lib/data/mock'
import { adherence, burnedCalories, sumMacros } from '@/lib/data/selectors'
import { emptyDayLog } from '@/lib/data/selectors'
import styles from './trends.module.css'

export default function Trends() {
  const [range, setRange] = useState<RangeKey>(30)

  const days = useMemo(() => lastNDays(TODAY, range), [range])

  const weightPoints = useMemo(
    () => MOCK_WEIGHTS.filter((w) => days.includes(w.date)).map((w) => ({ date: w.date, kg: w.kg })),
    [days],
  )

  const adherencePoints = useMemo(
    () =>
      days.map((date) => ({
        date,
        ratio: adherence(MOCK_DAYS[date] ?? emptyDayLog(date), MOCK_GOAL),
      })),
    [days],
  )

  const cells = useMemo(() => monthGrid(2026, 9), [])

  // 月历上每个日期的四个环达标情况，顺序固定：热量、运动、蛋白质、碳水
  const ratiosByDate = useMemo(() => {
    const out: Record<string, number[]> = {}
    for (const date of cells) {
      if (!date) continue
      const day = MOCK_DAYS[date] ?? emptyDayLog(date)
      const macros = sumMacros(day.foods)
      out[date] = [
        MOCK_GOAL.calories > 0 ? Math.min(macros.calories / MOCK_GOAL.calories, 1) : 0,
        MOCK_GOAL.exerciseCalories > 0
          ? Math.min(burnedCalories(day) / MOCK_GOAL.exerciseCalories, 1)
          : 0,
        MOCK_GOAL.protein > 0 ? Math.min(macros.protein / MOCK_GOAL.protein, 1) : 0,
        MOCK_GOAL.carbs > 0 ? Math.min(macros.carbs / MOCK_GOAL.carbs, 1) : 0,
      ]
    }
    return out
  }, [cells])

  const [showWeightTable, setShowWeightTable] = useState(false)
  const [showAdherenceTable, setShowAdherenceTable] = useState(false)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>趋势</h1>

      {/* 唯一一处筛选行，位于两张图之上，一次切换同时作用于两者 */}
      <DateRangeFilter value={range} onChange={setRange} />

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>体重</h2>
          <button
            type="button"
            className={styles.tableToggle}
            onClick={() => setShowWeightTable((v) => !v)}
          >
            {showWeightTable ? '隐藏' : '显示'}体重表格
          </button>
        </div>

        {showWeightTable ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>日期</th>
                <th>体重 (kg)</th>
              </tr>
            </thead>
            <tbody>
              {weightPoints.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td className="num-tabular">{p.kg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <WeightChart points={weightPoints} />
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>热量达标</h2>
          <button
            type="button"
            className={styles.tableToggle}
            onClick={() => setShowAdherenceTable((v) => !v)}
          >
            {showAdherenceTable ? '隐藏' : '显示'}达标表格
          </button>
        </div>

        {showAdherenceTable ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>日期</th>
                <th>达标率</th>
              </tr>
            </thead>
            <tbody>
              {adherencePoints.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td className="num-tabular">{Math.round(p.ratio * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <AdherenceChart points={adherencePoints} />
        )}
      </section>

      <section className={styles.card}>
        <CalendarMonth
          year={2026}
          month={9}
          cells={cells}
          ratiosByDate={ratiosByDate}
          today={TODAY}
        />
      </section>
    </main>
  )
}
```

创建 `app/trends/trends.module.css`：

```css
.page {
  padding: 16px 16px 88px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 520px;
  margin: 0 auto;
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.card {
  background: var(--surface-card);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-card);
  padding: 16px;
}

.cardHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cardTitle {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.tableToggle {
  background: none;
  border: none;
  padding: 0;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th {
  text-align: left;
  color: var(--text-muted);
  font-weight: 500;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-hairline);
}

.table td {
  padding: 6px 0;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-hairline);
}
```

- [ ] **Step 8: 在 selectors 中补 `emptyDayLog`**

上面的页面用到了 `emptyDayLog`，需加到 `lib/data/selectors.ts`：

```ts
import type { DayLog } from './types'

export function emptyDayLog(date: string): DayLog {
  return { date, foods: [], exercises: [] }
}
```

并在 `lib/data/selectors.test.ts` 补一条测试：

```ts
describe('emptyDayLog', () => {
  it('返回空日志，日期原样保留', () => {
    expect(emptyDayLog('2026-09-22')).toEqual({
      date: '2026-09-22',
      foods: [],
      exercises: [],
    })
  })
})
```

- [ ] **Step 9: 运行全部测试，确认通过**

```bash
npm test
```

预期：全部通过。

- [ ] **Step 10: 手动查看**

```bash
npm run dev
```

打开 `http://localhost:3000/trends`，逐项确认：

1. **筛选行只有一处**，且位于两张图之上——切换 7/30/90 时两张图同时变化
2. 体重是折线、达标是柱状，**两张图各自有独立坐标轴，没有双 Y 轴**
3. 体重图**没有图例框**（单系列不需要）
4. 点「显示体重表格」「显示达标表格」，各自出现表格
5. 月历中 9 月 22 日有今天的高亮外框
6. 每个日期格里有四个小点，位置顺序始终是 热量 / 运动 / 蛋白质 / 碳水

- [ ] **Step 11: 提交**

```bash
git add app/trends/ components/ lib/data/
git commit -m "feat: add trends page with range filter, charts and calendar"
```

---

## Task 7: 其余界面与导航打通

**Files:**
- Create: `app/meals/new/page.tsx`、`app/meals/new/new.module.css`
- Create: `app/workouts/new/page.tsx`、`app/workouts/new/new.module.css`
- Create: `app/plan/page.tsx`、`app/plan/plan.module.css`
- Create: `app/onboarding/page.tsx`、`app/onboarding/onboarding.module.css`
- Create: `app/me/page.tsx`、`app/me/me.module.css`
- Create: `app/login/page.tsx`、`app/login/login.module.css`
- Create: `app/*/页面.test.tsx`（每个界面一条最小渲染测试）

**Interfaces:**
- Consumes: Task 4 的假数据与类型、Task 2 的令牌
- Produces: 各页面的默认导出组件；无后续任务依赖

> **这些页面在 demo 阶段只做静态呈现与交互骨架**，不产生真实数据写入。按钮点击可以只切换本地状态，但**视觉与文案必须是最终形态**，因为 demo 的目的就是评估形态。
>
> **力量训练录入必须允许用户改掉计划预填的内容**（规格 6.2 节：记录反映实际发生的，不是计划的）。

- [ ] **Step 1: 写各页面的最小渲染测试**

为每个新页面创建一条测试，确认它在无数据、无上下文时不崩溃。以添加饮食页为例，创建 `app/meals/new/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NewMeal from './page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/meals/new',
}))

describe('添加饮食页', () => {
  it('提供搜索与一句话描述两个入口', () => {
    render(<NewMeal />)
    expect(screen.getByPlaceholderText('搜索食物')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/描述你吃了什么/)).toBeInTheDocument()
  })

  it('列出四个餐次供选择', () => {
    render(<NewMeal />)
    for (const slot of ['早餐', '午餐', '晚餐', '加餐']) {
      expect(screen.getByRole('button', { name: slot })).toBeInTheDocument()
    }
  })
})
```

`app/workouts/new/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NewWorkout from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/workouts/new' }))

describe('添加运动页', () => {
  it('提供有氧与力量两条路径', () => {
    render(<NewWorkout />)
    expect(screen.getByRole('button', { name: '有氧' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '力量' })).toBeInTheDocument()
  })

  it('力量模式下可增删组', () => {
    render(<NewWorkout />)
    expect(screen.getByRole('button', { name: '添加一组' })).toBeInTheDocument()
  })
})
```

`app/plan/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Plan from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/plan' }))

describe('训练计划页', () => {
  it('渲染七个星期', () => {
    render(<Plan />)
    for (const w of ['周一', '周二', '周三', '周四', '周五', '周六', '周日']) {
      expect(screen.getByText(w)).toBeInTheDocument()
    }
  })
})
```

`app/onboarding/page.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Onboarding from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/onboarding' }))

describe('首次引导页', () => {
  it('提供三种目标方向，且默认不选中减脂', () => {
    render(<Onboarding />)
    const cut = screen.getByRole('button', { name: '减脂' })
    const bulk = screen.getByRole('button', { name: '增肌' })
    const maintain = screen.getByRole('button', { name: '维持' })
    // 规格 8.1 节：默认值不得设为减脂，必须要求用户明确选择
    expect(cut).toHaveAttribute('aria-pressed', 'false')
    expect(bulk).toHaveAttribute('aria-pressed', 'false')
    expect(maintain).toHaveAttribute('aria-pressed', 'false')
  })
})
```

`app/me/page.test.tsx` 与 `app/login/page.test.tsx` 各写一条渲染测试：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Me from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/me' }))

describe('我的页', () => {
  it('渲染当前目标', () => {
    render(<Me />)
    expect(screen.getByText('每日目标')).toBeInTheDocument()
  })
})
```

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Login from './page'

vi.mock('next/navigation', () => ({ usePathname: () => '/login' }))

describe('登录页', () => {
  it('要求填写邀请码', () => {
    render(<Login />)
    expect(screen.getByPlaceholderText('邀请码')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试，确认它们失败**

```bash
npm test
```

预期：新增的 6 个页面测试全部 FAIL（`Cannot find module './page'`）。

- [ ] **Step 3: 实现添加饮食页**

创建 `app/meals/new/page.tsx`：

```tsx
'use client'

import { useState } from 'react'
import AiBadge from '@/components/AiBadge'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/data/types'
import styles from './new.module.css'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

// demo 阶段：解析结果是可编辑列表，用户逐条确认才入库（规格 5.4 节其一）
const MOCK_PARSED = [
  { id: 'p1', name: '鸡蛋', grams: 100, calories: 144, source: 'curated' as const },
  { id: 'p2', name: '米饭', grams: 200, calories: 232, source: 'curated' as const },
  { id: 'p3', name: '红烧肉', grams: 100, calories: 472, source: 'ai-estimate' as const },
]

export default function NewMeal() {
  const [slot, setSlot] = useState<MealSlot>('lunch')
  const [sentence, setSentence] = useState('')
  const [parsed, setParsed] = useState<typeof MOCK_PARSED | null>(null)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>记录饮食</h1>

      <div className={styles.slots} role="group" aria-label="餐次">
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSlot(s)}
            aria-pressed={slot === s}
            className={`${styles.slot} ${slot === s ? styles.slotActive : ''}`}
          >
            {MEAL_SLOT_LABEL[s]}
          </button>
        ))}
      </div>

      <input className={styles.input} placeholder="搜索食物" />

      <div className={styles.divider}>或者</div>

      <textarea
        className={styles.textarea}
        placeholder="用一句话描述你吃了什么，例如：中午吃了两个鸡蛋一碗米饭"
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
      />
      <button
        type="button"
        className={styles.primaryButton}
        disabled={sentence.trim().length === 0}
        onClick={() => setParsed(MOCK_PARSED)}
      >
        解析
      </button>

      {parsed && (
        <section className={styles.parsed}>
          <h2 className={styles.parsedTitle}>确认这些条目</h2>
          <p className={styles.parsedHint}>模型可能认错食物或估错份量，请核对后保存。</p>
          <ul className={styles.list}>
            {parsed.map((item) => (
              <li key={item.id} className={styles.row}>
                <span className={styles.rowName}>{item.name}</span>
                <span className={styles.rowTags}>
                  {item.source === 'ai-estimate' && <AiBadge />}
                </span>
                <span className={`${styles.rowMeta} num-tabular`}>{item.calories} 千卡</span>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.primaryButton}>
            保存到{MEAL_SLOT_LABEL[slot]}
          </button>
        </section>
      )}
    </main>
  )
}
```

创建 `app/meals/new/new.module.css`：

```css
.page {
  padding: 16px 16px 88px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 520px;
  margin: 0 auto;
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.slot {
  padding: 9px 0;
  border: 1px solid var(--border-hairline);
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}

.slotActive {
  background: color-mix(in oklab, var(--text-primary) 8%, transparent);
  color: var(--text-primary);
  font-weight: 600;
}

.input,
.textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-tile);
  background: var(--surface-card);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
}

.textarea {
  min-height: 84px;
  resize: vertical;
}

.divider {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.primaryButton {
  padding: 12px;
  border: none;
  border-radius: var(--radius-tile);
  background: var(--text-primary);
  color: var(--surface-page);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.primaryButton:disabled {
  opacity: 0.4;
  cursor: default;
}

.parsed {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.parsedTitle {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.parsedHint {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 0;
  border-bottom: 1px solid var(--border-hairline);
}

.rowName {
  flex: 1;
  font-size: 14px;
}

.rowTags {
  display: flex;
  gap: 6px;
}

.rowMeta {
  color: var(--text-secondary);
  font-size: 14px;
}
```

- [ ] **Step 4: 实现添加运动页**

创建 `app/workouts/new/page.tsx`：

```tsx
'use client'

import { useState } from 'react'
import styles from './new.module.css'

type Mode = 'cardio' | 'strength'

type SetRow = { id: number; weightKg: string; reps: string }

export default function NewWorkout() {
  const [mode, setMode] = useState<Mode>('strength')
  const [sets, setSets] = useState<SetRow[]>([
    { id: 1, weightKg: '60', reps: '10' },
  ])

  const addSet = () =>
    setSets((prev) => [...prev, { id: Date.now(), weightKg: '', reps: '' }])

  const removeSet = (id: number) => setSets((prev) => prev.filter((s) => s.id !== id))

  // 计划内容只作预填，用户可任意修改——记录反映实际发生的，不是计划的
  const updateSet = (id: number, field: 'weightKg' | 'reps', value: string) =>
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>记录运动</h1>

      <div className={styles.modes} role="group" aria-label="运动类型">
        {(['cardio', 'strength'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`${styles.mode} ${mode === m ? styles.modeActive : ''}`}
          >
            {m === 'cardio' ? '有氧' : '力量'}
          </button>
        ))}
      </div>

      {mode === 'strength' ? (
        <>
          <input className={styles.input} placeholder="动作名称，例如：卧推" />
          <p className={styles.hint}>计划里的目标：4 组 × 8–10 次。以下是实际完成的，可任意修改。</p>

          <div className={styles.sets}>
            {sets.map((set, i) => (
              <div key={set.id} className={styles.setRow}>
                <span className={`${styles.setIndex} num-tabular`}>{i + 1}</span>
                <input
                  className={styles.setInput}
                  inputMode="decimal"
                  placeholder="重量 kg"
                  value={set.weightKg}
                  onChange={(e) => updateSet(set.id, 'weightKg', e.target.value)}
                />
                <span className={styles.times}>×</span>
                <input
                  className={styles.setInput}
                  inputMode="numeric"
                  placeholder="次数"
                  value={set.reps}
                  onChange={(e) => updateSet(set.id, 'reps', e.target.value)}
                />
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => removeSet(set.id)}
                  aria-label={`删除第 ${i + 1} 组`}
                >
                  −
                </button>
              </div>
            ))}
          </div>

          <button type="button" className={styles.secondaryButton} onClick={addSet}>
            添加一组
          </button>
        </>
      ) : (
        <>
          <input className={styles.input} placeholder="运动名称，例如：慢跑" />
          <input className={styles.input} inputMode="numeric" placeholder="时长（分钟）" />
          <div className={styles.modes} role="group" aria-label="强度">
            {['轻松', '中等', '剧烈'].map((level) => (
              <button key={level} type="button" className={styles.mode}>
                {level}
              </button>
            ))}
          </div>
        </>
      )}

      <button type="button" className={styles.primaryButton}>
        保存
      </button>
    </main>
  )
}
```

创建 `app/workouts/new/new.module.css`：

```css
.page {
  padding: 16px 16px 88px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 520px;
  margin: 0 auto;
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.modes {
  display: grid;
  grid-auto-flow: column;
  gap: 8px;
}

.mode {
  padding: 9px 0;
  border: 1px solid var(--border-hairline);
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}

.modeActive {
  background: color-mix(in oklab, var(--text-primary) 8%, transparent);
  color: var(--text-primary);
  font-weight: 600;
}

.input,
.setInput {
  padding: 12px;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-tile);
  background: var(--surface-card);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
}

.input {
  width: 100%;
}

.hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.sets {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setRow {
  display: grid;
  grid-template-columns: 24px 1fr auto 1fr auto;
  align-items: center;
  gap: 8px;
}

.setIndex {
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

.setInput {
  width: 100%;
  min-width: 0;
}

.times {
  color: var(--text-muted);
  font-size: 13px;
}

.remove {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-hairline);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
}

.secondaryButton {
  padding: 11px;
  border: 1px dashed var(--axis);
  border-radius: var(--radius-tile);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
}

.primaryButton {
  margin-top: 4px;
  padding: 12px;
  border: none;
  border-radius: var(--radius-tile);
  background: var(--text-primary);
  color: var(--surface-page);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 5: 实现训练计划页**

创建 `app/plan/page.tsx`：

```tsx
import Link from 'next/link'
import { MOCK_PLAN, TODAY } from '@/lib/data/mock'
import { weekdayOf } from '@/lib/data/dates'
import styles from './plan.module.css'

const WEEKDAY_LABEL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export default function Plan() {
  const todayWeekday = weekdayOf(TODAY)

  return (
    <main className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>训练计划</h1>
        <Link href="/meals/new" className={styles.edit}>
          编辑
        </Link>
      </div>

      <ul className={styles.days}>
        {MOCK_PLAN.map((day) => {
          const isToday = day.weekday === todayWeekday
          return (
            <li key={day.weekday} className={`${styles.day} ${isToday ? styles.today : ''}`}>
              <div className={styles.dayHead}>
                <span className={styles.weekday}>{WEEKDAY_LABEL[day.weekday - 1]}</span>
                <span className={styles.theme}>{day.theme}</span>
                {isToday && <span className={styles.todayTag}>今天</span>}
              </div>

              {day.items.length === 0 ? (
                <p className={styles.rest}>休息</p>
              ) : (
                <ul className={styles.items}>
                  {day.items.map((item) => (
                    <li key={item.name} className={styles.item}>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={`${styles.itemMeta} num-tabular`}>
                        {item.sets} 组 × {item.reps}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
```

创建 `app/plan/plan.module.css`：

```css
.page {
  padding: 16px 16px 88px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 520px;
  margin: 0 auto;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.edit {
  color: var(--text-secondary);
  font-size: 14px;
  text-decoration: none;
}

.days {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.day {
  background: var(--surface-card);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-card);
  padding: 14px 16px;
}

/* 今天靠左侧竖条与外框标记，不引入新颜色 */
.today {
  border-color: var(--axis);
  box-shadow: inset 3px 0 0 var(--text-primary);
}

.dayHead {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.weekday {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.theme {
  flex: 1;
  color: var(--text-secondary);
  font-size: 14px;
}

.todayTag {
  color: var(--text-secondary);
  font-size: 12px;
}

.rest {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.items {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-hairline);
}

.item:last-child {
  border-bottom: none;
}

.itemName {
  flex: 1;
  color: var(--text-primary);
  font-size: 14px;
}

.itemMeta {
  color: var(--text-secondary);
  font-size: 13px;
}
```

- [ ] **Step 6: 实现首次引导页**

创建 `app/onboarding/page.tsx`：

```tsx
'use client'

import { useState } from 'react'
import type { GoalDirection } from '@/lib/data/types'
import styles from './onboarding.module.css'

const OPTIONS: { key: GoalDirection; label: string; hint: string }[] = [
  { key: 'cut', label: '减脂', hint: '在需要量基础上制造热量赤字' },
  { key: 'bulk', label: '增肌', hint: '在需要量基础上制造热量盈余' },
  { key: 'maintain', label: '维持', hint: '保持当前体重，不做热量调整' },
]

export default function Onboarding() {
  // 规格 8.1 节：默认值不得设为减脂，必须由用户明确选择
  const [direction, setDirection] = useState<GoalDirection | null>(null)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>你的目标是？</h1>
      <p className={styles.subtitle}>这一步决定每日热量目标是往下调还是往上调。</p>

      <div className={styles.options}>
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setDirection(option.key)}
            aria-pressed={direction === option.key}
            className={`${styles.option} ${direction === option.key ? styles.selected : ''}`}
          >
            <span className={styles.optionLabel}>{option.label}</span>
            <span className={styles.optionHint}>{option.hint}</span>
          </button>
        ))}
      </div>

      <div className={styles.fields}>
        <input className={styles.input} inputMode="numeric" placeholder="身高 cm" />
        <input className={styles.input} inputMode="decimal" placeholder="当前体重 kg" />
        <input className={styles.input} inputMode="numeric" placeholder="年龄" />
      </div>

      <button type="button" className={styles.primaryButton} disabled={!direction}>
        {direction ? '生成我的目标' : '请先选择目标'}
      </button>

      <p className={styles.note}>
        算出的目标是估计值，下一步可以手动调整。
      </p>
    </main>
  )
}
```

创建 `app/onboarding/onboarding.module.css`：

```css
.page {
  padding: 24px 16px 88px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 520px;
  margin: 0 auto;
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  text-align: left;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  font-family: inherit;
  cursor: pointer;
}

.selected {
  border-color: var(--text-primary);
  box-shadow: inset 0 0 0 1px var(--text-primary);
}

.optionLabel {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
}

.optionHint {
  color: var(--text-muted);
  font-size: 12px;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input {
  padding: 12px;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-tile);
  background: var(--surface-card);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
}

.primaryButton {
  padding: 13px;
  border: none;
  border-radius: var(--radius-tile);
  background: var(--text-primary);
  color: var(--surface-page);
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.primaryButton:disabled {
  opacity: 0.4;
  cursor: default;
}

.note {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}
```

- [ ] **Step 7: 实现我的页与登录页**

创建 `app/me/page.tsx`：

```tsx
import Link from 'next/link'
import { MOCK_GOAL, MOCK_USER } from '@/lib/data/mock'
import styles from './me.module.css'

const DIRECTION_LABEL = { cut: '减脂', bulk: '增肌', maintain: '维持' } as const

export default function Me() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>我的</h1>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>个人资料</h2>
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.rowName}>身高</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_USER.heightCm} cm</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>年龄</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_USER.age}</span>
          </li>
        </ul>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>每日目标</h2>
        <ul className={styles.list}>
          <li className={styles.row}>
            <span className={styles.rowName}>目标方向</span>
            <span className={styles.rowMeta}>{DIRECTION_LABEL[MOCK_GOAL.direction]}</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>热量</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_GOAL.calories} 千卡</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>蛋白质</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_GOAL.protein} g</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>碳水</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_GOAL.carbs} g</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>脂肪</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_GOAL.fat} g</span>
          </li>
          <li className={styles.row}>
            <span className={styles.rowName}>目标体重</span>
            <span className={`${styles.rowMeta} num-tabular`}>{MOCK_GOAL.targetWeightKg} kg</span>
          </li>
        </ul>
      </section>

      <Link href="/plan" className={styles.link}>
        训练计划
      </Link>
      <Link href="/login" className={styles.link}>
        退出登录
      </Link>
    </main>
  )
}
```

创建 `app/me/me.module.css`：

```css
.page {
  padding: 16px 16px 88px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 520px;
  margin: 0 auto;
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.card {
  background: var(--surface-card);
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-card);
  padding: 16px;
}

.cardTitle {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  padding: 11px 0;
  border-bottom: 1px solid var(--border-hairline);
}

.row:last-child {
  border-bottom: none;
}

.rowName {
  flex: 1;
  color: var(--text-primary);
  font-size: 14px;
}

.rowMeta {
  color: var(--text-secondary);
  font-size: 14px;
}

.link {
  padding: 13px;
  text-align: center;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-tile);
  color: var(--text-primary);
  font-size: 14px;
  text-decoration: none;
}
```

创建 `app/login/page.tsx`：

```tsx
import styles from './login.module.css'

export default function Login() {
  return (
    <main className={styles.page}>
      <h1 className={styles.logo}>Fitchat</h1>
      <p className={styles.subtitle}>当前为邀请制，需要邀请码才能注册。</p>

      <input className={styles.input} placeholder="邀请码" />
      <button type="button" className={styles.primaryButton}>
        进入
      </button>

      <p className={styles.hint}>邀请码不正确时，这里会明确告诉你哪里不对。</p>
    </main>
  )
}
```

创建 `app/login/login.module.css`：

```css
.page {
  min-height: 100dvh;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  max-width: 420px;
  margin: 0 auto;
}

.logo {
  margin: 0;
  font-size: 30px;
  font-weight: 600;
  text-align: center;
}

.subtitle {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: center;
}

.input {
  padding: 13px;
  border: 1px solid var(--border-hairline);
  border-radius: var(--radius-tile);
  background: var(--surface-card);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 15px;
}

.primaryButton {
  padding: 13px;
  border: none;
  border-radius: var(--radius-tile);
  background: var(--text-primary);
  color: var(--surface-page);
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}
```

- [ ] **Step 8: 运行全部测试，确认通过**

```bash
npm test
```

预期：全部通过。

- [ ] **Step 9: 手动走查所有页面**

```bash
npm run dev
```

依次打开并确认：`/login`、`/onboarding`、`/meals/new`、`/workouts/new`、`/plan`、`/me`。

重点确认两条：

1. `/onboarding` 三个目标方向**初始都没被选中**，「生成我的目标」按钮处于禁用态
2. `/workouts/new` 切到「力量」后可增删组，且重量与次数都可手工编辑

- [ ] **Step 10: 提交**

```bash
git add app/ components/
git commit -m "feat: add meal, workout, plan, onboarding, profile and login screens"
```

---

## Task 8: 手机端走查与静态预览

**Files:**
- Create: `docs/superpowers/plans/demo-走查清单.md`
- Modify: `.gitignore`（若需要）

**Interfaces:**
- Consumes: 前七个任务的全部产物
- Produces: 一份可重复执行的走查清单；一个可分享的预览构建

> **这一步不能省，也不能只靠自动化测试。** 测试验证的是逻辑，不是布局。布局问题（文字溢出、标签碰撞、点击区域过小）只有实际渲染出来看才会发现。

- [ ] **Step 1: 构建生产版本，确认没有类型与构建错误**

```bash
npm run build
```

预期：构建成功。若失败，**先修完再继续**——构建失败通常意味着类型错误，而后面的走查没有意义。

- [ ] **Step 2: 启动生产构建并在手机尺寸下走查**

```bash
npm run start
```

在浏览器打开 `http://localhost:3000`，打开开发者工具切到手机视图（iPhone 尺寸，390×844），逐页走查：

| 检查项 | 通过标准 |
|---|---|
| 横向溢出 | 任何页面都不出现横向滚动条 |
| 文字截断 | 没有文字被裁掉或溢出容器 |
| 点击区域 | 所有可点元素不小于约 44×44px |
| 底部导航遮挡 | 页面内容不被固定导航挡住（每页底部留白足够） |
| 净热量唯一性 | 首页只有「净热量」一处 hero 尺寸数字 |
| 圆环配色顺序 | 由外到内为 蓝 / 橙 / 青 / 黄 |
| AI 标记 | 「加餐」行有可见的「AI 估算」标签 |
| 体重中性色 | 体重涨跌是灰的，不是绿或红 |
| 筛选行唯一 | 趋势页只有一处 7/30/90 筛选 |
| 无双 Y 轴 | 体重与达标是两张独立图 |
| 月历今日高亮 | 9 月 22 日有外框标记 |
| 空状态 | 趋势页 7 天视图下，9 月 20 日无记录时不显示空白或 NaN |
| 深色模式 | 切换系统到深色，配色与对比度仍然可用 |
| 浅色模式 | 切换系统到浅色，青/黄两个圆环旁的文字标签依然清晰可读 |

- [ ] **Step 3: 记录走查中发现的问题**

创建 `docs/superpowers/plans/demo-走查清单.md`，把发现的问题逐条写下（每条包含：页面、现象、复现步骤、期望行为）。**不要在这一步顺手修**——先记录完整清单，再统一决定哪些进本次修复、哪些留到后续计划。这样避免边走查边改导致的返工。

- [ ] **Step 4: 修完清单中本次要修的问题**

对每一项：先补一条能复现该问题的测试，确认它失败，再修，再确认通过。修完运行：

```bash
npm test && npm run build
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "fix: address issues found in mobile walkthrough"
```

- [ ] **Step 6: 交付预览给用户**

```bash
npm run dev
```

告诉用户在本机浏览器打开 `http://localhost:3000`。

**若用户希望用手机直接打开**（推荐——这是手机优先的产品，在电脑上缩窗口看终究隔了一层），需要让同一局域网内的手机能访问。运行：

```bash
npm run dev -- --hostname 0.0.0.0
```

然后查看本机局域网 IP：

```bash
ipconfig | grep -A5 "无线局域网适配器 WLAN" | grep "IPv4"
```

把 `http://<该IP>:3000` 发到手机上打开。

> **注意：** 这会把开发服务器暴露给同一局域网内的其他设备。仅在可信网络下这样做，用完停止服务。

- [ ] **Step 7: 记录 demo 阶段的已知限制**

在 `docs/superpowers/plans/demo-走查清单.md` 末尾追加一节，写清 demo 与真实产品的差距，避免被误认为已完成：

- 所有数据都是假的，不落库、不持久化，刷新即复原
- 没有登录与权限，任何页面都可直接访问
- 「保存」「解析」按钮没有真实副作用（解析返回的是预设的假结果）
- 没有接 DeepSeek，界面上「AI 估算」标签是写死的
- 目标热量是写死的数字，没有实现真实的目标计算
- 没有错误监控

---

## 自审记录

**1. 规格覆盖检查**

| 规格章节 | 覆盖任务 |
|---|---|
| 2.1 功能 1（注册登录） | 任务 7（登录页，仅界面） |
| 2.1 功能 2（资料与目标） | 任务 7（引导页 + 我的页，目标计算留待后续计划） |
| 2.1 功能 3（饮食记录） | 任务 5、7 |
| 2.1 功能 4（食物数据） | 本计划不涉及（需后端与数据源，属后续计划） |
| 2.1 功能 5（自然语言记饮食） | 任务 7（界面与交互骨架，AI 调用属后续计划） |
| 2.1 功能 6（运动记录） | 任务 5、7 |
| 2.1 功能 7（训练计划） | 任务 5（今天该练）、任务 7（计划页） |
| 2.1 功能 8（体重记录） | 任务 5、6 |
| 2.1 功能 9（今日看板） | 任务 5 |
| 2.1 功能 10（历史与趋势） | 任务 6 |
| 3.2 四个圆环 | 任务 3、5 |
| 5.1 首页 | 任务 5 |
| 5.2 趋势页 | 任务 6 |
| 5.3 其余界面 | 任务 7 |
| 5.4 三条交互细节 | 任务 5（AI 标记、体重中性色）、任务 7（可编辑确认列表） |
| 6.2 计划与记录分离 | 任务 7（力量录入可改预填值） |
| 8.1 目标方向不默认减脂 | 任务 7（引导页测试钉住） |
| 9 测试策略 | 全任务（每任务均含测试） |

**未覆盖且刻意如此：** 食物数据源、AI 调用、认证、数据库、目标计算、错误监控——均属后续计划。

**2. 占位符扫描**：无 TBD / TODO / 「稍后补充」；每个代码步骤都给出完整可运行代码。

**3. 类型一致性检查**：`RingSpec`（任务 3 定义）在任务 5 按同签名使用；`DayLog`/`UserGoal`/`FoodEntry`（任务 4 定义）在任务 5、6、7 中字段名一致；`emptyDayLog` 在任务 6 的 Step 8 中补入 `selectors.ts` 并同步补测试；`RangeKey` 在 `DateRangeFilter` 中定义并由 `app/trends/page.tsx` 导入。

**4. Review Focus 对应**：五条均有归属测试——跨零点与跨月跨年在任务 4 Step 1；圆环边界在任务 3 Step 1；空数据状态在任务 4 Step 11、任务 6 Step 1；极端身体数据在任务 3 Step 1 与任务 4 Step 6。

---

## 后续计划（不在本计划范围）

本计划是六份中的第一份。其余计划按依赖顺序：

| 计划 | 内容 | 依赖 |
|---|---|---|
| 2 | 数据库、Prisma schema、认证与邀请码 | 无（可与 1 并行） |
| 3 | 目标计算与身体数据（含公式核实） | 计划 2 |
| 4 | 饮食记录与食物库（含开放数据源接入） | 计划 2 |
| 5 | AI 解析层（DeepSeek 接入、校验、缓存、降级） | 计划 4 |
| 6 | 运动记录与训练计划落库 | 计划 2 |

**计划 3 的前置事项：** 规格第 8 节的能量需要量公式尚未核实（编写规格时权威站点被网络策略拦截）。**该项必须在计划 3 开始前完成**，否则首次引导算出的目标是错的。
