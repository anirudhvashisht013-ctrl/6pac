const C = {
  bg: '#0A0A0F',
  surface: '#141419',
  surface2: '#1E1E28',
  surface3: '#272733',
  border: '#2A2A3A',
  borderLight: '#3A3A4A',

  primary: '#00E5FF',
  primaryDim: '#00B8CC',
  primaryBg: 'rgba(0,229,255,0.08)',

  secondary: '#FF6B35',
  secondaryBg: 'rgba(255,107,53,0.1)',

  accent: '#7B61FF',
  accentBg: 'rgba(123,97,255,0.1)',

  success: '#00D68F',
  successBg: 'rgba(0,214,143,0.1)',

  warning: '#FFAA00',
  warningBg: 'rgba(255,170,0,0.1)',

  error: '#FF4757',
  errorBg: 'rgba(255,71,87,0.1)',

  text: '#FFFFFF',
  textSecondary: '#A0A0B8',
  textMuted: '#606075',

  tabActive: '#00E5FF',
  tabInactive: '#505065',
} as const;

export default {
  light: {
    tint: C.primary,
    tabIconDefault: C.tabInactive,
    tabIconSelected: C.primary,
  },
  C,
};

export { C };
