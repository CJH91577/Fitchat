/**
 * 单用户演示阶段的身份约定：库里只有这一个用户。
 *
 * 单独放一个文件而不是从 scripts 或 seed 里导出，是为了避免运行时的页面
 * 代码反向依赖种子脚本。阶段 3 接入认证后，这里会被会话取代——
 * 那时 user id 来自登录态，而不是这个常量。
 */
export const DEMO_USER_ID = 'demo-user'
export const DEMO_USER_EMAIL = 'demo@fitchat.local'
