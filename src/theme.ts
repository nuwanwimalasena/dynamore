import { theme as antdTheme } from 'antd'
import type { ThemeConfig } from 'antd'

export const darkTheme: ThemeConfig = {
    algorithm: antdTheme.darkAlgorithm,
    token: {
        colorPrimary: '#00b4d8',
        colorBgBase: '#0a0f1d',
        colorBgContainer: '#111927',
        colorBgElevated: '#1a2332',
        colorBgLayout: '#0a0f1d',
        colorBorder: '#1e293b',
        colorBorderSecondary: '#162032',
        colorText: '#f1f5f9',
        colorTextSecondary: '#94a3b8',
        colorTextTertiary: '#64748b',
        colorTextPlaceholder: '#64748b',
        colorLink: '#00b4d8',
        colorSuccess: '#2dd4bf',
        colorError: '#f85149',
        colorWarning: '#fbbf24',
        colorInfo: '#00b4d8',
        borderRadius: 6,
        borderRadiusLG: 8,
        borderRadiusSM: 4,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 14,
        fontSizeSM: 12,
        lineHeight: 1.5714,
        controlHeight: 34,
        controlHeightSM: 26,
        controlHeightLG: 40,
        motionDurationSlow: '0.25s',
        motionDurationMid: '0.15s',
        motionDurationFast: '0.08s'
    },
    components: {
        Layout: {
            siderBg: '#111927',
            bodyBg: '#0a0f1d',
            headerBg: '#111927'
        },
        Menu: {
            darkItemBg: '#111927',
            darkSubMenuItemBg: '#0a0f1d',
            darkItemSelectedBg: 'rgba(0, 180, 216, 0.15)',
            darkItemColor: '#94a3b8',
            darkItemHoverColor: '#f1f5f9',
            darkItemSelectedColor: '#00b4d8'
        },
        Table: {
            headerBg: '#111927',
            rowHoverBg: '#1a2332',
            borderColor: '#1e293b',
            headerColor: '#94a3b8',
            cellFontSizeMD: 13
        },
        Input: {
            activeBorderColor: '#00b4d8',
            hoverBorderColor: '#94a3b8'
        },
        Select: {
            optionSelectedBg: 'rgba(0, 180, 216, 0.15)'
        },
        Button: {
            primaryColor: '#ffffff',
            defaultBg: '#162032',
            defaultBorderColor: '#1e293b',
            defaultColor: '#f1f5f9'
        },
        Tabs: {
            itemColor: '#94a3b8',
            itemActiveColor: '#00b4d8',
            itemSelectedColor: '#00b4d8',
            inkBarColor: '#00b4d8',
            cardBg: '#111927'
        },
        Modal: {
            contentBg: '#1a2332',
            headerBg: '#1a2332',
            footerBg: '#1a2332'
        },
        Drawer: {
            colorBgElevated: '#1a2332'
        },
        Tag: {
            defaultBg: '#162032',
            defaultColor: '#94a3b8'
        },
        Badge: {
            colorBgContainer: '#162032'
        },
        Tooltip: {
            colorBgSpotlight: '#162032',
            colorTextLightSolid: '#f1f5f9'
        },
        Form: {
            labelColor: '#94a3b8'
        }
    }
}

export const lightTheme: ThemeConfig = {
    algorithm: antdTheme.defaultAlgorithm,
    token: {
        colorPrimary: '#0284c7',
        colorBgBase: '#ffffff',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBgLayout: '#f0f7ff',
        colorBorder: '#e2e8f0',
        colorBorderSecondary: '#f1f5f9',
        colorText: '#0f172a',
        colorTextSecondary: '#475569',
        colorTextTertiary: '#94a3b8',
        colorTextPlaceholder: '#94a3b8',
        colorLink: '#0284c7',
        colorSuccess: '#0d9488',
        colorError: '#e11d48',
        colorWarning: '#d97706',
        colorInfo: '#0284c7',
        borderRadius: 6,
        borderRadiusLG: 8,
        borderRadiusSM: 4,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 14,
        fontSizeSM: 12,
        lineHeight: 1.5714,
        controlHeight: 34,
        controlHeightSM: 26,
        controlHeightLG: 40,
        motionDurationSlow: '0.25s',
        motionDurationMid: '0.15s',
        motionDurationFast: '0.08s'
    },
    components: {
        Layout: {
            siderBg: '#ffffff',
            bodyBg: '#f0f7ff',
            headerBg: '#ffffff'
        },
        Menu: {
            itemBg: '#ffffff',
            subMenuItemBg: '#f0f7ff',
            itemSelectedBg: 'rgba(2, 132, 199, 0.1)',
            itemColor: '#475569',
            itemHoverColor: '#0f172a',
            itemSelectedColor: '#0284c7'
        },
        Table: {
            headerBg: '#f0f7ff',
            rowHoverBg: '#e0f2fe',
            borderColor: '#e2e8f0',
            headerColor: '#475569',
            cellFontSizeMD: 13
        },
        Input: {
            activeBorderColor: '#0284c7',
            hoverBorderColor: '#94a3b8'
        },
        Select: {
            optionSelectedBg: 'rgba(2, 132, 199, 0.1)'
        },
        Button: {
            primaryColor: '#ffffff',
            defaultBg: '#f0f7ff',
            defaultBorderColor: '#e2e8f0',
            defaultColor: '#0f172a'
        },
        Tabs: {
            itemColor: '#475569',
            itemActiveColor: '#0284c7',
            itemSelectedColor: '#0284c7',
            inkBarColor: '#0284c7',
            cardBg: '#ffffff'
        },
        Modal: {
            contentBg: '#ffffff',
            headerBg: '#ffffff',
            footerBg: '#ffffff'
        },
        Drawer: {
            colorBgElevated: '#ffffff'
        },
        Tag: {
            defaultBg: '#e0f2fe',
            defaultColor: '#0369a1'
        },
        Badge: {
            colorBgContainer: '#ffffff'
        },
        Tooltip: {
            colorBgSpotlight: '#0f172a',
            colorTextLightSolid: '#ffffff'
        },
        Form: {
            labelColor: '#475569'
        }
    }
}
