import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * GitHub Pages віддає проєкт із підпапки з назвою репозиторію,
 * тому всі шляхи мають бути з префіксом. Для власного домену
 * достатньо зібрати з BASE_PATH=/ і нічого тут не міняти.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/school-schedule/',
  plugins: [react()],
  build: {
    target: 'es2022',
  },
})
