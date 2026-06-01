import { theme as antdTheme } from 'antd'
import type { ThemeConfig } from 'antd'

export const darkTheme: ThemeConfig = {
    algorithm: antdTheme.darkAlgorithm,
    token: {
        colorPrimary: '#58a6ff',
        colorBgBase: '#0d1117',
        colorBgContainer: '#161b22',
        colorBgElevated: '#1e2631',
        colorBgLayout: '#0d1117',
        colorBorder: '#30363d',
        colorBorderSecondary: '#21262d',
        colorText: '#e6edf3',
        colorTextSecondary: '#8b949e',
        colorTextTertiary: '#484f58',
        colorTextPlaceholder: '#484f58',
        colorLink: '#58a6ff',
        colorSuccess: '#3fb950',
        colorError: '#f85149',
        colorWarning: '#d29922',
        colorInfo: '#58a6ff',
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
            siderBg: '#161b22',
            bodyBg: '#0d1117',
            headerBg: '#161b22'
        },
        Menu: {
            darkItemBg: '#161b22',
            darkSubMenuItemBg: '#0d1117',
            darkItemSelectedBg: 'rgba(88, 166, 255, 0.1)',
            darkItemColor: '#8b949e',
            darkItemHoverColor: '#e6edf3',
            darkItemSelectedColor: '#58a6ff'
        },
        Table: {
            headerBg: '#161b22',
            rowHoverBg: '#1e2631',
            borderColor: '#30363d',
            headerColor: '#8b949e',
            cellFontSizeMD: 13
        },
        Input: {
            activeBorderColor: '#58a6ff',
            hoverBorderColor: '#8b949e'
        },
        Select: {
            optionSelectedBg: 'rgba(88, 166, 255, 0.12)'
        },
        Button: {
            primaryColor: '#ffffff',
            defaultBg: '#21262d',
            defaultBorderColor: '#30363d',
            defaultColor: '#e6edf3'
        },
        Tabs: {
            itemColor: '#8b949e',
            itemActiveColor: '#58a6ff',
            itemSelectedColor: '#58a6ff',
            inkBarColor: '#58a6ff',
            cardBg: '#161b22'
        },
        Modal: {
            contentBg: '#1e2631',
            headerBg: '#1e2631',
            footerBg: '#1e2631'
        },
        Drawer: {
            colorBgElevated: '#1e2631'
        },
        Tag: {
            defaultBg: '#21262d',
            defaultColor: '#8b949e'
        },
        Badge: {
            colorBgContainer: '#21262d'
        },
        Tooltip: {
            colorBgSpotlight: '#21262d',
            colorTextLightSolid: '#e6edf3'
        },
        Form: {
            labelColor: '#8b949e'
        }
    }
}

export const lightTheme: ThemeConfig = {
    algorithm: antdTheme.defaultAlgorithm,
    token: {
        colorPrimary: '#0969da',
        colorBgBase: '#ffffff',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBgLayout: '#f6f8fa',
        colorBorder: '#d0d7de',
        colorBorderSecondary: '#eaeef2',
        colorText: '#24292f',
        colorTextSecondary: '#57606a',
        colorTextTertiary: '#8c959f',
        colorTextPlaceholder: '#8c959f',
        colorLink: '#0969da',
        colorSuccess: '#1a7f37',
        colorError: '#cf222e',
        colorWarning: '#9a6700',
        colorInfo: '#0969da',
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
            bodyBg: '#f6f8fa',
            headerBg: '#ffffff'
        },
        Menu: {
            itemBg: '#ffffff',
            subMenuItemBg: '#f6f8fa',
            itemSelectedBg: 'rgba(9, 105, 218, 0.08)',
            itemColor: '#57606a',
            itemHoverColor: '#24292f',
            itemSelectedColor: '#0969da'
        },
        Table: {
            headerBg: '#f6f8fa',
            rowHoverBg: '#eaeef2',
            borderColor: '#d0d7de',
            headerColor: '#57606a',
            cellFontSizeMD: 13
        },
        Input: {
            activeBorderColor: '#0969da',
            hoverBorderColor: '#8c959f'
        },
        Select: {
            optionSelectedBg: 'rgba(9, 105, 218, 0.08)'
        },
        Button: {
            primaryColor: '#ffffff',
            defaultBg: '#f6f8fa',
            defaultBorderColor: '#d0d7de',
            defaultColor: '#24292f'
        },
        Tabs: {
            itemColor: '#57606a',
            itemActiveColor: '#0969da',
            itemSelectedColor: '#0969da',
            inkBarColor: '#0969da',
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
            defaultBg: '#eaeef2',
            defaultColor: '#57606a'
        },
        Badge: {
            colorBgContainer: '#ffffff'
        },
        Tooltip: {
            colorBgSpotlight: '#24292f',
            colorTextLightSolid: '#ffffff'
        },
        Form: {
            labelColor: '#57606a'
        }
    }
}
