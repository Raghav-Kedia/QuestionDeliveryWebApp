import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Neo Aurora palette (hex values)
        neo: {
          primary: {
            base: '#6A5ACD',
            hover: '#7B68EE',
            active: '#483D8B'
          },
          secondary: {
            base: '#00CED1',
            hover: '#20B2AA',
            active: '#008B8B'
          },
          accent: {
            pink: '#FF6EC7',
            green: '#00FA9A',
            yellow: '#FFD700'
          },
          background: {
            light: '#F9FAFB',
            dark: '#1C1E26'
          },
          text: {
            primary: '#111827',
            secondary: '#4B5563',
            inverted: '#FFFFFF',
            muted: '#9CA3AF'
          },
          border: {
            light: '#E5E7EB',
            dark: '#374151'
          },
          status: {
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            info: '#3B82F6'
          }
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Neo Aurora specific radii
        'na-btn': '1rem',
        'na-card': '1.25rem',
        'na-input': '0.75rem'
      },
      boxShadow: {
        'na': '0 4px 14px rgba(0, 0, 0, 0.15)'
      },
      backgroundImage: {
        'na-gradient': 'linear-gradient(135deg, #6A5ACD 0%, #00CED1 50%, #FF6EC7 100%)'
      },
      fontFamily: {
        sans: ['"Emilys Candy"', 'Plus Jakarta Sans', 'Inter', 'Roboto', 'sans-serif'],
        code: ['Fira Code', 'monospace']
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [animate]
}

export default config
