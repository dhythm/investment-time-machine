export interface MonthlyPoint {
  month: string
  buy: number | null
  close: number
}

export interface IndexDataset {
  id: string
  name: string
  nameEn: string
  currency: string
  source: string
  sourceUrl: string
  retrievedAt: string
  notes: string[]
  points: MonthlyPoint[]
}

export function yearRange(dataset: IndexDataset): [number, number] {
  return [Number(dataset.points[0]?.month.slice(0, 4)), Number(dataset.points.at(-1)?.month.slice(0, 4))]
}
