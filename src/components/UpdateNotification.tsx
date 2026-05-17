import { useEffect, useState, useCallback } from 'react'
import { Button, Progress, Typography, Space } from 'antd'
import {
    CloudDownloadOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    CloseOutlined,
    ReloadOutlined
} from '@ant-design/icons'

const { Text } = Typography

type UpdateStatus = 'idle' | 'available' | 'downloading' | 'ready' | 'error'

interface UpdateState {
    status: UpdateStatus
    version?: string
    percent?: number
    errorMessage?: string
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UpdateNotification() {
    const [state, setState] = useState<UpdateState>({ status: 'idle' })
    const [dismissed, setDismissed] = useState(false)
    const [speed, setSpeed] = useState(0)

    const dismiss = useCallback(() => setDismissed(true), [])

    useEffect(() => {
        const cleanups: (() => void)[] = []

        cleanups.push(
            window.api.updater.onUpdateAvailable((info) => {
                setState({ status: 'available', version: info.version })
                setDismissed(false)
            })
        )

        cleanups.push(
            window.api.updater.onDownloadProgress((progress) => {
                setState((prev) => ({ ...prev, status: 'downloading', percent: progress.percent }))
                setSpeed(progress.bytesPerSecond)
            })
        )

        cleanups.push(
            window.api.updater.onUpdateDownloaded((info) => {
                setState({ status: 'ready', version: info.version })
            })
        )

        cleanups.push(
            window.api.updater.onError((err) => {
                setState({ status: 'error', errorMessage: err.message })
            })
        )

        return () => cleanups.forEach((fn) => fn())
    }, [])

    const handleDownload = async () => {
        setState((prev) => ({ ...prev, status: 'downloading', percent: 0 }))
        await window.api.updater.downloadUpdate()
    }

    const handleInstall = () => {
        window.api.updater.quitAndInstall()
    }

    if (state.status === 'idle' || dismissed) return null

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 9999,
                width: 320,
                background: 'var(--color-bg-secondary, #1a1d23)',
                border: '1px solid var(--color-border, #2a2d35)',
                borderRadius: 10,
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                overflow: 'hidden',
                animation: 'slideUp 0.25s ease-out'
            }}
        >
            {/* Accent bar */}
            <div style={{
                height: 3,
                background: state.status === 'error'
                    ? 'linear-gradient(90deg, #ff4d4f, #ff7875)'
                    : state.status === 'ready'
                        ? 'linear-gradient(90deg, #52c41a, #95de64)'
                        : 'linear-gradient(90deg, #1677ff, #69b1ff)',
            }} />

            <div style={{ padding: '14px 16px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {state.status === 'available' && (
                            <CloudDownloadOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                        )}
                        {state.status === 'downloading' && (
                            <CloudDownloadOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                        )}
                        {state.status === 'ready' && (
                            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                        )}
                        {state.status === 'error' && (
                            <WarningOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                        )}

                        <Text style={{ color: 'var(--color-text-primary, #e8eaf0)', fontWeight: 600, fontSize: 13 }}>
                            {state.status === 'available' && `Update available — v${state.version}`}
                            {state.status === 'downloading' && 'Downloading update…'}
                            {state.status === 'ready' && `v${state.version} ready to install`}
                            {state.status === 'error' && 'Update failed'}
                        </Text>
                    </div>

                    {state.status !== 'downloading' && (
                        <Button
                            type="text"
                            size="small"
                            icon={<CloseOutlined />}
                            onClick={dismiss}
                            style={{ color: 'var(--color-text-muted, #5a5f73)', marginTop: -2, marginRight: -4 }}
                        />
                    )}
                </div>

                {/* Body */}
                {state.status === 'available' && (
                    <Text style={{ color: 'var(--color-text-secondary, #8b91a7)', fontSize: 12, display: 'block', marginBottom: 12 }}>
                        A new version of Dynamore is available. Download it now to get the latest features and fixes.
                    </Text>
                )}

                {state.status === 'error' && (
                    <Text style={{ color: '#ff7875', fontSize: 12, display: 'block', marginBottom: 12 }}>
                        {state.errorMessage ?? 'An unknown error occurred while checking for updates.'}
                    </Text>
                )}

                {state.status === 'downloading' && (
                    <div style={{ marginBottom: 4 }}>
                        <Progress
                            percent={state.percent ?? 0}
                            size="small"
                            strokeColor={{ from: '#1677ff', to: '#69b1ff' }}
                            trailColor="var(--color-border, #2a2d35)"
                            showInfo={false}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <Text style={{ color: 'var(--color-text-muted, #5a5f73)', fontSize: 11 }}>
                                {state.percent ?? 0}% complete
                            </Text>
                            <Text style={{ color: 'var(--color-text-muted, #5a5f73)', fontSize: 11 }}>
                                {formatBytes(speed)}/s
                            </Text>
                        </div>
                    </div>
                )}

                {state.status === 'ready' && (
                    <Text style={{ color: 'var(--color-text-secondary, #8b91a7)', fontSize: 12, display: 'block', marginBottom: 12 }}>
                        The update has been downloaded. Restart Dynamore to apply it.
                    </Text>
                )}

                {/* Actions */}
                <Space style={{ width: '100%', justifyContent: 'flex-end' }} size={8}>
                    {state.status === 'available' && (
                        <Button
                            type="primary"
                            size="small"
                            icon={<CloudDownloadOutlined />}
                            onClick={handleDownload}
                            style={{ fontSize: 12 }}
                        >
                            Download
                        </Button>
                    )}

                    {state.status === 'ready' && (
                        <>
                            <Button
                                size="small"
                                onClick={dismiss}
                                style={{
                                    fontSize: 12,
                                    background: 'transparent',
                                    borderColor: 'var(--color-border, #2a2d35)',
                                    color: 'var(--color-text-secondary, #8b91a7)'
                                }}
                            >
                                Later
                            </Button>
                            <Button
                                type="primary"
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={handleInstall}
                                style={{ fontSize: 12, background: '#52c41a', borderColor: '#52c41a' }}
                            >
                                Restart Now
                            </Button>
                        </>
                    )}

                    {state.status === 'error' && (
                        <Button
                            size="small"
                            onClick={() => setState({ status: 'idle' })}
                            style={{ fontSize: 12 }}
                        >
                            Dismiss
                        </Button>
                    )}
                </Space>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
