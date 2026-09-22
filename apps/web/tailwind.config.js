/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        ink: {
          DEFAULT: '#0f172a',
          soft: '#334155',
        },
      },
      fontFamily: {
        // Skill ui-ux-pro-max · pairing "Tech Startup" (#1): carácter + legibilidad
        heading: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 16px -4px rgb(15 23 42 / 0.08), 0 8px 32px -8px rgb(15 23 42 / 0.10)',
        lift: '0 8px 24px -6px rgb(79 70 229 / 0.18), 0 16px 48px -12px rgb(15 23 42 / 0.16)',
        glow: '0 0 0 1px rgb(99 102 241 / 0.25), 0 8px 40px -8px rgb(99 102 241 / 0.45)',
        glass: '0 8px 32px 0 rgb(15 23 42 / 0.18)',
        'inner-soft': 'inset 0 2px 4px 0 rgb(15 23 42 / 0.04)',
      },
      backgroundImage: {
        'mesh-hero':
          'radial-gradient(at 20% 20%, rgb(79 70 229 / 0.35) 0px, transparent 50%), radial-gradient(at 80% 0%, rgb(124 58 237 / 0.30) 0px, transparent 50%), radial-gradient(at 65% 75%, rgb(14 165 233 / 0.22) 0px, transparent 55%), radial-gradient(at 10% 90%, rgb(217 70 239 / 0.18) 0px, transparent 50%)',
        'grid-fade':
          'linear-gradient(to right, rgb(148 163 184 / 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.12) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '44px 44px',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(28px,-36px) scale(1.08)' },
          '66%': { transform: 'translate(-20px,22px) scale(0.94)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-18px) rotate(2deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
      animation: {
        blob: 'blob 14s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 9s ease-in-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        marquee: 'marquee 28s linear infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        'fade-up': 'fade-up 0.5s ease-out both',
        'pop-in': 'pop-in 0.25s ease-out both',
        'slide-in-right': 'slide-in-right 0.3s ease-out both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 14s linear infinite',
        wiggle: 'wiggle 1.6s ease-in-out infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
