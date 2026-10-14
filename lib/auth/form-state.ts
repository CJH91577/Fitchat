/**
 * 表单动作的返回值。
 *
 * 单独一个模块，因为 'use server' 文件里只能导出 async 函数——常量与类型
 * 放在那里会让构建报错，而客户端组件又需要它们来初始化 useActionState。
 */
export type FormState = { error: string | null }

export const EMPTY_FORM_STATE: FormState = { error: null }
