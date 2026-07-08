/** @type {import('tailwindcss').Config} */
module.exports = {
  // MVP: 다크모드 미지원 - class 전략 + 클래스 미부착으로 완전 비활성화
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        success: '#10B981',
        danger: '#EF4444',
        shade: '#10B98133',
      },
    },
  },
  plugins: [],
}
