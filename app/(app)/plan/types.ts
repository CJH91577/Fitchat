/**
 * 训练计划页的表单状态。
 *
 * savedAt 是给客户端判断「这次提交真的写进去了」用的——只用 error 的话，
 * 分不清「还没提交过」与「提交成功」，于是要么不刷新，要么每次渲染都刷新。
 * 放在普通模块里是因为 'use server' 文件只能导出 async 函数（见 actions.ts）。
 */
export type PlanFormState = { error: string | null; savedAt: number }

export const EMPTY_PLAN_FORM_STATE: PlanFormState = { error: null, savedAt: 0 }
