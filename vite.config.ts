import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// GitHub Pages では /investment-time-machine/ 配下で配信されるため、
// Pages 用ビルド（--mode pages）でのみ base を付ける。ローカル開発・通常ビルドは従来どおり。
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/investment-time-machine/' : '/',
  plugins: [react()],
}))
