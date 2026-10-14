/**
 * 演示账号。
 *
 * 阶段 2 时「库里只有一个人」，页面直接按下面的常量取用户。现在它是真账号
 * 之一：由种子脚本建出来，**口令是公开的**（README、登录页、DEPLOY.md 都写着）。
 *
 * 公开不是疏忽，是取舍：演示账号存在的唯一目的，是让人点开就能看到一个装满
 * 数据的界面，而它里面的数据全部是按日期确定性生成的假数据——写坏了也不心疼。
 * 把它的口令包装成安全边界，只会让来的人卡在门口。要真正控制入口，用邀请码
 * 注册自己的账号（见 DEMO_INVITE_CODES 与 DEPLOY.md）。
 */
export const DEMO_USER_ID = 'demo-user'
export const DEMO_USER_EMAIL = 'demo@fitchat.local'

/** 演示口令。部署时可以用 DEMO_PASSWORD 覆盖（改完要重建库才会生效） */
export const DEMO_PASSWORD = 'fitchat-demo'

/**
 * 随部署附送的一次性邀请码。
 *
 * 邀请码是注册的唯一门槛，而这三个是公开的，所以它们拦不住谁——它们的作用是
 * 把「陌生人能注册几个账号」这件事限住：**每个码只能用一次**，用完就没了，
 * 名额从无穷变成三个。要真正控制入口，就把它们换成自己的码（DEPLOY.md 里有
 * 一条插入 SQL）。
 */
export const DEMO_INVITE_CODES = ['FITCHAT-DEMO-1', 'FITCHAT-DEMO-2', 'FITCHAT-DEMO-3']
