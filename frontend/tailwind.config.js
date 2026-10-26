/** @type {import('tailwindcss').Config} */
// Sketch Style 主题扩展：纸张色 / 铅笔灰 / 手绘阴影 / 倾斜 / 手写衬线字体
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#f5f0e8',
          soft: '#faf6ee',
          deep: '#efe7d8',
          edge: '#e4dac8'
        },
        pencil: {
          DEFAULT: '#2c2c2c',
          soft: '#4a463f',
          faint: '#6f685c',
          line: '#d8d0c0'
        },
        ink: {
          900: '#2c2c2c',
          700: '#3f3a33',
          500: '#5c564c',
          300: '#6f685c',
          100: '#e4dac8'
        },
        sketchred: '#b23b2e',
        sketchblue: '#2b6e96',
        sketchgreen: '#1f7a4d',
        sketchyellow: '#9a6a00'
      },
      boxShadow: {
        sketch: '3px 3px 0 rgba(44,44,44,0.15)',
        'sketch-lg': '5px 5px 0 rgba(44,44,44,0.15)',
        sketchsm: '2px 2px 0 rgba(44,44,44,0.12)',
        press: '1px 1px 0 rgba(44,44,44,0.15)'
      },
      ringOffsetColor: {
        DEFAULT: '#f5f0e8'
      },
      rotate: {
        '-sketch': '-0.5deg',
        sketch: '0.5deg',
        '-sketch-lg': '-1.2deg',
        'sketch-lg': '1.2deg'
      },
      borderRadius: {
        sketch: '2px',
        'sketch-sm': '1px'
      },
      fontFamily: {
        serif: [
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"Songti SC"',
          'Georgia',
          '"Times New Roman"',
          'serif'
        ],
        hand: ['"Segoe Print"', '"Bradley Hand"', '"Comic Sans MS"', 'cursive']
      },
      keyframes: {
        jitter: {
          '0%, 100%': { transform: 'rotate(-0.4deg) translateY(0)' },
          '25%': { transform: 'rotate(0.5deg) translateY(-1px)' },
          '50%': { transform: 'rotate(-0.2deg) translateY(0)' },
          '75%': { transform: 'rotate(0.6deg) translateY(0.5px)' }
        },
        'scribble-in': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' }
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px) rotate(-0.3deg)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotate(0deg)' }
        }
      },
      animation: {
        jitter: 'jitter 3s ease-in-out infinite',
        'scribble-in': 'scribble-in 0.5s ease-out both',
        'fade-up': 'fade-up 0.35s ease-out both'
      }
    }
  },
  plugins: []
}
