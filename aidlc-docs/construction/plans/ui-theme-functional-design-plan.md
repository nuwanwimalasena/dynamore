# Functional Design Plan: `ui-theme`

## Objective
Update application theme tokens in Ant Design (`src/theme.ts`) and global CSS custom variables (`src/index.css`) to match the color palette of the app logo icon (`resources/logo.png`).

---

## 🎨 Color System Definition

### 1. Dark Mode (`darkTheme`)
- **Primary Color (`colorPrimary`)**: `#00b4d8` (Electric Cyan)
- **Primary Link (`colorLink`)**: `#00b4d8`
- **Info Color (`colorInfo`)**: `#00b4d8`
- **Success Color (`colorSuccess`)**: `#2dd4bf` (Teal Aqua)
- **Base Background (`colorBgBase`)**: `#0a0f1d` (Deep Slate Navy)
- **Container Background (`colorBgContainer`)**: `#111927` (Slate Navy Container)
- **Elevated Background (`colorBgElevated`)**: `#1a2332` (Elevated Card/Modal)
- **Layout Background (`colorBgLayout`)**: `#0a0f1d`
- **Border (`colorBorder`)**: `#1e293b`
- **Secondary Border (`colorBorderSecondary`)**: `#162032`
- **Text (`colorText`)**: `#f1f5f9` (Slate 100)
- **Text Secondary (`colorTextSecondary`)**: `#94a3b8` (Slate 400)
- **Text Tertiary (`colorTextTertiary`)**: `#64748b` (Slate 500)

**Ant Design Component Overrides (Dark Mode)**:
- **Layout**: `siderBg: '#111927'`, `bodyBg: '#0a0f1d'`, `headerBg: '#111927'`
- **Menu**:
  - `darkItemBg: '#111927'`
  - `darkSubMenuItemBg: '#0a0f1d'`
  - `darkItemSelectedBg: 'rgba(0, 180, 216, 0.15)'`
  - `darkItemColor: '#94a3b8'`
  - `darkItemHoverColor: '#f1f5f9'`
  - `darkItemSelectedColor: '#00b4d8'`
- **Table**: `headerBg: '#111927'`, `rowHoverBg: '#1a2332'`, `borderColor: '#1e293b'`, `headerColor: '#94a3b8'`
- **Tabs**: `itemColor: '#94a3b8'`, `itemActiveColor: '#00b4d8'`, `itemSelectedColor: '#00b4d8'`, `inkBarColor: '#00b4d8'`, `cardBg: '#111927'`
- **Button**: `defaultBg: '#162032'`, `defaultBorderColor: '#1e293b'`, `defaultColor: '#f1f5f9'`
- **Input / Select**: `activeBorderColor: '#00b4d8'`, `hoverBorderColor: '#00b4d8'`, `optionSelectedBg: 'rgba(0, 180, 216, 0.15)'`

---

### 2. Light Mode (`lightTheme`)
- **Primary Color (`colorPrimary`)**: `#0284c7` (Oceanic Blue)
- **Primary Link (`colorLink`)**: `#0284c7`
- **Info Color (`colorInfo`)**: `#0284c7`
- **Success Color (`colorSuccess`)**: `#0d9488` (Teal)
- **Base Background (`colorBgBase`)**: `#ffffff`
- **Container Background (`colorBgContainer`)**: `#ffffff`
- **Elevated Background (`colorBgElevated`)**: `#ffffff`
- **Layout Background (`colorBgLayout`)**: `#f0f7ff` (Soft Ice Tint)
- **Border (`colorBorder`)**: `#e2e8f0`
- **Text (`colorText`)**: `#0f172a`
- **Text Secondary (`colorTextSecondary`)**: `#475569`

**Ant Design Component Overrides (Light Mode)**:
- **Layout**: `siderBg: '#ffffff'`, `bodyBg: '#f0f7ff'`, `headerBg: '#ffffff'`
- **Menu**: `itemSelectedBg: 'rgba(2, 132, 199, 0.1)'`, `itemSelectedColor: '#0284c7'`
- **Table**: `headerBg: '#f0f7ff'`, `rowHoverBg: '#e0f2fe'`, `borderColor: '#e2e8f0'`
- **Tabs**: `itemActiveColor: '#0284c7'`, `itemSelectedColor: '#0284c7'`, `inkBarColor: '#0284c7'`

---

### 3. Global CSS Custom Properties (`src/index.css`)
Sync CSS variables:
```css
:root {
  --color-primary: #00b4d8;
  --color-primary-hover: #38bdf8;
  --color-secondary: #2dd4bf;
  --color-bg-base: #0a0f1d;
  --color-bg-container: #111927;
  --color-bg-elevated: #1a2332;
  --color-border: #1e293b;
  --color-text: #f1f5f9;
  --color-text-secondary: #94a3b8;
}
```

Add scrollbar accenting, selection background, logo icon glow, and subtle cyan top-border accents.
