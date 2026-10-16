import { expect, test } from '@playwright/test'

/**
 * 完整链路：打开登录页 → 点「先看看演示账号」→ 记录一条运动 → 首页看到它。
 *
 * 「点登录按钮真的能进」是当前唯一没有机器验证过的一步（React 的
 * Server Action 协议没法手写请求，组件级与 action 级测试都覆盖不到），
 * 这条 E2E 把它连同「记一条 → 首页可见」整条链路一起钉住。
 */
test('打开 → 一键进演示账号 → 记一条运动 → 首页看到它', async ({ page }) => {
  await page.goto('/login')

  // 未登录时没有直达首页的入口，登录表单在
  await expect(page.getByPlaceholder('邮箱')).toBeVisible()

  await page.getByRole('button', { name: '先看看演示账号' }).click()

  // 登录成功落在首页，「今日饮食」是首页独有的区块
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('今日饮食')).toBeVisible()

  // 去记录一条力量动作
  await page.goto('/workouts/new')
  await page.getByPlaceholder(/动作名称/).fill('E2E 深蹲')
  await page.getByLabel('第 1 组重量').fill('80')
  await page.getByLabel('第 1 组次数').fill('10')
  await page.getByRole('button', { name: '保存', exact: true }).click()

  // 保存后跳回首页，刚记的那条出现在「今日运动」里
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('E2E 深蹲')).toBeVisible()
})
