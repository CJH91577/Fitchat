import type { FoodTemplate } from './generator'

/**
 * 常用单品的食物库（数值按 100 克计）。
 *
 * 为什么要单独一份：演示数据里那 12 样都是**套餐**（「鸡胸肉盖饭」「清蒸鱼套餐」），
 * 而用户说出来的通常是单品——「两个鸡蛋一碗米饭」。只拿套餐去匹配，「鸡蛋」会
 * 命中「豆浆鸡蛋」这个套餐名，算出来的热量差了十倍。
 *
 * 数值取常见近似值，不追求权威：确认页会把克数与热量摆出来让用户改，
 * 而按 100 克记也让「两个鸡蛋 = 100 克」这种换算一眼可查。
 */
export const PANTRY: FoodTemplate[] = [
  { name: '鸡蛋', calories: 144, protein: 13, carbs: 1, fat: 10 },
  { name: '米饭', calories: 116, protein: 2.6, carbs: 26, fat: 0.3 },
  { name: '鸡胸肉', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: '牛奶', calories: 65, protein: 3.3, carbs: 4.9, fat: 3.6 },
  { name: '全麦面包', calories: 247, protein: 13, carbs: 41, fat: 3.4 },
  { name: '燕麦', calories: 380, protein: 13, carbs: 66, fat: 7 },
  { name: '香蕉', calories: 93, protein: 1.1, carbs: 22, fat: 0.3 },
  { name: '苹果', calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { name: '酸奶', calories: 72, protein: 3.5, carbs: 9, fat: 2.5 },
  { name: '豆浆', calories: 31, protein: 3, carbs: 1.2, fat: 1.6 },
  { name: '牛肉', calories: 250, protein: 26, carbs: 0, fat: 15 },
  { name: '猪里脊', calories: 155, protein: 21, carbs: 0, fat: 7 },
  { name: '三文鱼', calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: '虾', calories: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  { name: '豆腐', calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  { name: '西红柿', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name: '黄瓜', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { name: '西兰花', calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name: '土豆', calories: 77, protein: 2, carbs: 17, fat: 0.1 },
  { name: '红薯', calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { name: '玉米', calories: 96, protein: 3.4, carbs: 21, fat: 1.5 },
  { name: '橄榄油', calories: 884, protein: 0, carbs: 0, fat: 100 },
  { name: '可乐', calories: 43, protein: 0, carbs: 11, fat: 0 },
  { name: '啤酒', calories: 43, protein: 0.5, carbs: 3.6, fat: 0 },
  { name: '薯片', calories: 536, protein: 7, carbs: 53, fat: 34 },
  { name: '巧克力', calories: 546, protein: 4.9, carbs: 61, fat: 31 },
]

/**
 * 「一个 / 一杯」大约多少克。
 *
 * 这份表是**解析用**的，不进数据库：它回答的是「用户说『两个鸡蛋』时该记多少克」，
 * 属于把口语换成份量的换算，与食物本身的营养值不是一回事。
 *
 * 没列到的食物按「一份 = 100 克」处理，并在确认页把克数显出来——用户可以改，
 * 也看得见我们猜了什么。
 */
export const PORTION_GRAMS: Record<string, Record<string, number>> = {
  鸡蛋: { 个: 50, 只: 50 },
  米饭: { 碗: 200, 小碗: 150 },
  鸡胸肉: { 块: 120, 份: 150 },
  牛奶: { 杯: 250, 盒: 250 },
  全麦面包: { 片: 35 },
  燕麦: { 份: 40, 勺: 15 },
  香蕉: { 根: 120, 个: 120 },
  苹果: { 个: 180 },
  酸奶: { 杯: 150, 盒: 100 },
  豆浆: { 杯: 250 },
  牛肉: { 份: 150 },
  猪里脊: { 份: 150 },
  三文鱼: { 份: 150 },
  虾: { 只: 10, 份: 100 },
  豆腐: { 块: 200 },
  西红柿: { 个: 150 },
  黄瓜: { 根: 200 },
  西兰花: { 份: 150 },
  土豆: { 个: 150 },
  红薯: { 个: 200 },
  玉米: { 根: 200 },
  橄榄油: { 勺: 10 },
  可乐: { 罐: 330, 瓶: 500 },
  啤酒: { 瓶: 500, 罐: 330 },
  薯片: { 袋: 70 },
  巧克力: { 块: 30 },
}

/** 没写进份量表时的兜底：一份算 100 克 */
export const DEFAULT_PORTION_GRAMS = 100
