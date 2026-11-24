import sp500 from './sp500.json'
import nikkei225 from './nikkei225.json'
import topix from './topix.json'
import acwi from './acwi.json'
import usdjpy from './usdjpy.json'
import { yearRange, type IndexDataset } from '../lib/types'

export const datasets: IndexDataset[] = [sp500, nikkei225, topix, acwi]
export const fxDataset: IndexDataset = usdjpy
export const datasetYearRange: [number, number] = [Math.min(...datasets.map(item => yearRange(item)[0])), Math.max(...datasets.map(item => yearRange(item)[1]))]
export const indexColors: Record<string, string> = { sp500: '#217953', nikkei225: '#2563eb', topix: '#d97706', acwi: '#9333ea' }
