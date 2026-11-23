import sp500 from './sp500.json'
import nikkei225 from './nikkei225.json'
import topix from './topix.json'
import acwi from './acwi.json'
import usdjpy from './usdjpy.json'
import type { IndexDataset } from '../lib/types'

export const datasets: IndexDataset[] = [sp500, nikkei225, topix, acwi]
export const fxDataset: IndexDataset = usdjpy
export const getDataset = (id: string) => datasets.find(dataset => dataset.id === id)
