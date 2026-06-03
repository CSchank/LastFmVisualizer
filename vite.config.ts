import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// react-grid-layout depends on react-draggable, whose debug helper references
// process.env (DRAGGABLE_DEBUG, NODE_ENV). `process` does not exist in the
// browser, so without these defines react-draggable throws "process is not
// defined" the moment a drag starts. Replace the literals at build/serve time.
export default defineConfig(({ mode }) => ({
  base: '/LastFmVisualizer/',
  plugins: [react()],
  define: {
    'process.env.DRAGGABLE_DEBUG': 'false',
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
}))
