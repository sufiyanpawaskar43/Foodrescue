import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use React's automatic JSX runtime so components do not need a global React variable.
export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })],
});
