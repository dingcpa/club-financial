// 扶輪年度工具（7/1 起至次年 6/30）
// fy 以「起始西元年」代表：fy=2026 → 2026-07-01 ~ 2027-06-30（民國 115-116 年度）

export function fyOf(dateStr) {
  if (!dateStr) return null
  const [y, m] = dateStr.split('-').map(Number)
  if (!y || !m) return null
  return m >= 7 ? y : y - 1
}

export function fyRange(fy) {
  return [`${fy}-07-01`, `${fy + 1}-06-30`]
}

export function fyLabel(fy) {
  return `${fy - 1911}-${fy - 1910}年度`
}

// 該扶輪年度包含的 12 個 'YYYY-MM'
export function fyMonths(fy) {
  const months = []
  for (let i = 0; i < 12; i++) {
    const m = ((6 + i) % 12) + 1 // 7,8,...,12,1,...,6
    const y = m >= 7 ? fy : fy + 1
    months.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return months
}

// 'YYYY-MM' 月末日期字串
export function monthEnd(ym) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}

// 兩個 'YYYY-MM' 之間的月份清單（含頭尾）
export function monthsBetween(startYm, endYm) {
  if (!startYm || !endYm || startYm > endYm) return []
  const months = []
  let [y, m] = startYm.split('-').map(Number)
  const [ey, em] = endYm.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

export function toMinguoYear(westernYear) {
  return westernYear - 1911
}

// 民國日期顯示：'2026-07-01' → '115-07-01'
export function toMinguoDate(dateStr) {
  if (!dateStr) return ''
  const [y, ...rest] = dateStr.split('-')
  return [Number(y) - 1911, ...rest].join('-')
}

// 季度社費工具：季序 1..4 → 該扶輪年度的期間
// Q1=7-9月、Q2=10-12月、Q3=1-3月、Q4=4-6月
export const DUES_QUARTERS = [
  { q: 1, label: '7-9月', startMonth: 7 },
  { q: 2, label: '10-12月', startMonth: 10 },
  { q: 3, label: '1-3月', startMonth: 1 },
  { q: 4, label: '4-6月', startMonth: 4 },
]

export function duesQuarterPeriod(fy, q) {
  const info = DUES_QUARTERS.find(d => d.q === q)
  if (!info) return null
  const y = info.startMonth >= 7 ? fy : fy + 1
  const startYm = `${y}-${String(info.startMonth).padStart(2, '0')}`
  const endYm = `${y}-${String(info.startMonth + 2).padStart(2, '0')}`
  return {
    label: info.label,
    periodStart: startYm,
    periodEnd: endYm,
    dueDate: `${startYm}-01`,
    categoryName: `${toMinguoYear(y)}年${info.label}社費`,
  }
}
