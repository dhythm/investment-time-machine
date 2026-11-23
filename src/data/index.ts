import sp500 from './sp500.json'
import nikkei225 from './nikkei225.json'
import type { IndexDataset } from '../lib/types'

export const datasets: IndexDataset[] = [sp500, nikkei225]
export const getDataset = (id: string) => datasets.find(dataset => dataset.id === id)
