// Tailwind preset mapping Crossroads Blue tokens (tokens.css) to utility classes.
// Usage in tailwind.config.ts: presets: [require('./tokens/tailwind.preset').default]
import type { Config } from 'tailwindcss';

const v = (name: string) => `var(--rd-${name})`;

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        electric: v('electric'),
        'bleu-ciel': v('bleu-ciel'),
        sky: { DEFAULT: v('sky'), soft: v('sky-soft') },
        ice: { DEFAULT: v('ice'), page: v('ice-page') },
        charcoal: v('charcoal'),
        orange: { DEFAULT: v('orange'), deep: v('orange-deep') },
        bg: v('bg'),
        surface: { DEFAULT: v('surface'), muted: v('surface-muted') },
        line: { DEFAULT: v('line'), strong: v('line-strong') },
        ink: { DEFAULT: v('ink'), muted: v('ink-muted'), soft: v('ink-soft'), disabled: v('ink-disabled') },
        dark: {
          bg: v('dark-bg'), deep: v('dark-bg-deep'), surface: v('dark-surface'), surface2: v('dark-surface-2'),
          panel: v('dark-panel'), line: v('dark-line'), ink: v('dark-ink'), muted: v('dark-ink-muted'), soft: v('dark-ink-soft'),
        },
        primary: { DEFAULT: v('primary'), foreground: v('on-primary') },
        action: { DEFAULT: v('action'), foreground: v('on-action') },
      },
      fontFamily: {
        display: ['var(--rd-font-display)'],
        sans: ['var(--rd-font-body)'],
        mono: ['var(--rd-font-mono)'],
        accent: ['var(--rd-font-accent)'],
      },
      borderRadius: {
        sm: v('radius-sm'), md: v('radius-md'), lg: v('radius-lg'), xl: v('radius-xl'), '2xl': v('radius-2xl'), pill: v('radius-pill'),
      },
      backgroundImage: {
        'grad-logo': v('grad-logo'),
        'grad-wordmark': v('grad-wordmark'),
        'grad-clear-sky': v('grad-clear-sky'),
        'grad-blue': v('grad-blue'),
        'grad-sky-spark': v('grad-sky-spark'),
        'grad-ice': v('grad-ice'),
        'glow-hero': v('glow-hero'),
      },
      boxShadow: { card: v('shadow-card'), float: v('shadow-float'), prompt: v('shadow-prompt') },
      maxWidth: { container: v('container') },
      letterSpacing: { display: v('tracking-display'), label: v('tracking-label') },
      transitionTimingFunction: { brand: v('ease') },
    },
  },
};

export default preset;
