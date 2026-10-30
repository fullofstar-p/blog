/** @type {import('tailwindcss').Config} */
// Sketch Style 主题扩展：纸张色 / 铅笔灰 / 手绘阴影 / 倾斜 / 手写衬线字体
//
// 颜色全部通过 CSS 变量取值（见 src/styles/main.css 的 :root / html.dark）：
// 亮色是米色纸张 + 铅笔灰，暗色是暖黑纸张 + 粉笔白，组件里只写语义 token，
// 不需要到处堆 dark: 变体，切换主题时整站一次性换色。
const token = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: token('--paper'),
          soft: token('--paper-soft'),
          deep: token('--paper-deep'),
          edge: token('--paper-edge')
        },
        pencil: {
          DEFAULT: token('--pencil'),
          soft: token('--pencil-soft'),
          faint: token('--pencil-faint'),
          line: token('--pencil-line')
        },
        ink: {
          900: token('--ink-900'),
          700: token('--ink-700'),
          500: token('--ink-500'),
          300: token('--ink-300'),
          100: token('--ink-100')
        },
        sketchred: token('--sketch-red'),
        sketchblue: token('--sketch-blue'),
        sketchgreen: token('--sketch-green'),
        sketchyellow: {
          DEFAULT: token('--sketch-yellow'),
          deep: token('--sketch-yellow-deep')
        },
        // 弹窗遮罩：亮色是半透明铅笔灰，暗色是纯黑
        overlay: token('--overlay')
      },
      boxShadow: {
        sketch: '3px 3px 0 var(--sketch-shadow)',
        'sketch-lg': '5px 5px 0 var(--sketch-shadow)',
        sketchsm: '2px 2px 0 var(--sketch-shadow-sm)',
        press: '1px 1px 0 var(--sketch-shadow)'
      },
      ringOffsetColor: {
        DEFAULT: 'rgb(var(--paper))'
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
