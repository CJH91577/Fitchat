import OnboardingForm from './OnboardingForm'

/**
 * 首次引导页。
 *
 * 页面本身是个壳：表单是客户端组件（要在两步之间切换、要实时算出目标），
 * 真正写库那一步是 Server Action（见 actions.ts）。
 */
export const dynamic = 'force-dynamic'

export default function Onboarding() {
  return <OnboardingForm />
}
