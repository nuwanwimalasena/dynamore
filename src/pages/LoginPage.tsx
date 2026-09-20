import { useState, useEffect, useRef } from 'react'
import { Form, Input, Button, Typography, Steps, Alert, List, Select, Tooltip, Segmented, Collapse } from 'antd'
import { AmazonOutlined, LoadingOutlined, CheckCircleOutlined, ArrowRightOutlined, RightOutlined, SunOutlined, MoonOutlined, KeyOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/appStore'
import { AWS_REGIONS, DEFAULT_AWS_REGION } from '../constants/regions'
import type { AWSAccount, AWSRole } from '../types/global'

const { Title, Text, Paragraph } = Typography

type LoginStep = 'config' | 'authenticating' | 'account' | 'role' | 'completing' | 'success' | 'error'

interface LoginFormValues {
    startUrl: string
    region?: string
}

export default function LoginPage() {
    const [form] = Form.useForm<LoginFormValues>()
    const { setSession, theme, setTheme } = useAppStore()
    const [step, setStep] = useState<LoginStep>('config')
    const [authType, setAuthType] = useState<'sso' | 'keys'>('sso')
    const [statusMsg, setStatusMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [loading, setLoading] = useState(false)

    const [accessToken, setAccessToken] = useState('')
    const [startUrlRef, setStartUrlRef] = useState('')
    const [regionRef, setRegionRef] = useState('')
    const [ssoRegionRef, setSsoRegionRef] = useState('')
    const [accounts, setAccounts] = useState<AWSAccount[]>([])
    const [roles, setRoles] = useState<AWSRole[]>([])
    const [selectedAccount, setSelectedAccount] = useState<AWSAccount | null>(null)
    const unsubscribeRef = useRef<(() => void) | null>(null)

    useEffect(() => {
        window.api.auth.getLastSSOConfig().then(config => {
            if (config?.startUrl) {
                form.setFieldsValue({
                    startUrl: config.startUrl,
                    region: config.region || DEFAULT_AWS_REGION
                })
            }
        }).catch(() => {})

        const unsub = window.api.auth.onSSOProgress((_progressStep, message) => {
            setStatusMsg(message)
        })
        unsubscribeRef.current = unsub
        return () => unsub()
    }, [form])

    const handleError = (err: unknown, fallback = 'An error occurred') => {
        let msg = fallback
        if (typeof err === 'string' && err.trim().length > 0) {
            msg = err
        } else if (err instanceof Error && err.message) {
            msg = err.message
        } else if (err && typeof err === 'object') {
            msg = (err as any).message || (err as any).error || (err as any).toString() || JSON.stringify(err)
        }
        setErrorMsg(msg)
        setStep('error')
        setLoading(false)
    }

    const handleInitSSO = async (values: LoginFormValues) => {
        setLoading(true)
        setErrorMsg('')
        setStatusMsg('Connecting to AWS SSO…')
        setStep('authenticating')

        try {
            const initRes = await window.api.auth.initSSO({
                startUrl: values.startUrl,
                region: values.region || DEFAULT_AWS_REGION
            })
            const effectiveSsoRegion = initRes.region || values.region || DEFAULT_AWS_REGION
            setSsoRegionRef(effectiveSsoRegion)
            setStartUrlRef(initRes.startUrl ?? values.startUrl)
            setRegionRef(values.region || DEFAULT_AWS_REGION)
            setStatusMsg('Waiting for you to sign in via the browser…')

            const { accessToken } = await window.api.auth.pollSSOToken({
                region: effectiveSsoRegion,
                clientId: initRes.clientId,
                clientSecret: initRes.clientSecret,
                deviceCode: initRes.deviceCode,
                interval: initRes.interval,
                expiresAt: initRes.expiresAt
            })

            setAccessToken(accessToken)
            setStatusMsg('Fetching your AWS accounts…')

            const { accounts } = await window.api.auth.listSSOAccounts({ accessToken, region: effectiveSsoRegion })
            if (!accounts.length) throw new Error('No AWS accounts found for this user.')
            setAccounts(accounts)
            setStep('account')
        } catch (err) {
            handleError(err, 'Authentication failed. Please check your SSO URL.')
        } finally {
            setLoading(false)
        }
    }

    const handleSelectAccount = async (account: AWSAccount) => {
        setSelectedAccount(account)
        setLoading(true)
        try {
            const { roles } = await window.api.auth.listSSOAccountRoles({
                accessToken, region: ssoRegionRef || regionRef || DEFAULT_AWS_REGION, accountId: account.accountId
            })
            if (!roles.length) throw new Error('No roles found for this account.')
            setRoles(roles)
            setStep('role')
        } catch (err) {
            handleError(err, 'Failed to load roles for that account.')
        } finally {
            setLoading(false)
        }
    }

    const handleSelectRole = async (role: AWSRole) => {
        setLoading(true)
        setStep('completing')
        setStatusMsg(`Signing in as ${role.roleName}…`)
        try {
            const res = await window.api.auth.completeSSOLogin({
                accessToken,
                region: regionRef || DEFAULT_AWS_REGION,
                ssoRegion: ssoRegionRef || DEFAULT_AWS_REGION,
                accountId: selectedAccount!.accountId,
                roleName: role.roleName,
                startUrl: startUrlRef
            })
            if (!res.success) throw new Error(res.error ?? 'Login failed')
            setStep('success')
            setTimeout(async () => {
                const session = await window.api.auth.getSession()
                setSession(session)
            }, 600)
        } catch (err) {
            handleError(err, 'Failed to complete login.')
        } finally {
            setLoading(false)
        }
    }

    const handleReset = async () => {
        await window.api.auth.clearSSOConfig()
        form.resetFields()
        form.setFieldsValue({ region: DEFAULT_AWS_REGION })
        setStep('config')
        setErrorMsg('')
        setStatusMsg('')
        setAccessToken('')
        setAccounts([])
        setRoles([])
        setSelectedAccount(null)
    }

    const handleLoginWithKeys = async (values: any) => {
        setLoading(true)
        setErrorMsg('')
        try {
            const payload = {
                ...values,
                region: values.region || DEFAULT_AWS_REGION,
                sessionToken: values.sessionToken?.trim() || undefined
            }
            const res = await window.api.auth.loginWithKeys(payload)
            if (!res.success) throw new Error(res.error ?? 'Login failed')
            setStep('success')
            setTimeout(async () => {
                const session = await window.api.auth.getSession().catch(() => null)
                setSession(session)
            }, 600)
        } catch (err) {
            handleError(err, 'Authentication failed. Please check your credentials.')
        } finally {
            setLoading(false)
        }
    }

    const stepIndex = {
        config: 0, authenticating: 1, account: 2, role: 3, completing: 4, success: 4, error: 0
    }[step] ?? 0

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div className="auth-bg" />

            <div className="titlebar" style={{ background: 'transparent', borderBottom: 'none', paddingLeft: 80, paddingRight: 16 }}>
                <div style={{ flex: 1 }} />
                <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12, opacity: 0.6 }}>Dynamore</Text>
                <div style={{ flex: 1 }} />
                <div className="titlebar-nodrag" style={{ display: 'flex', alignItems: 'center' }}>
                    <Tooltip title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
                        <Button
                            type="text"
                            size="small"
                            icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
                            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                            style={{ color: 'var(--color-text-secondary)' }}
                        />
                    </Tooltip>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1 }}>
                <div className="fade-in glass-card" style={{ width: '100%', maxWidth: 500, borderRadius: 24, padding: '48px 40px 40px', position: 'relative' }}>
                    {/* Top accent bar */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, var(--color-accent-blue), transparent)', borderRadius: '24px 24px 0 0' }} />

                    {/* Logo + Title */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 18, background: 'rgba(88, 166, 255, 0.1)', border: '1px solid rgba(88, 166, 255, 0.2)', marginBottom: 16, boxShadow: '0 0 24px rgba(88, 166, 255, 0.15)' }}>
                            <AmazonOutlined style={{ fontSize: 30, color: 'var(--color-accent-blue)' }} />
                        </div>
                        <Title level={3} style={{ margin: 0, color: 'var(--color-text-primary)', fontWeight: 700 }}>
                            {step === 'account' ? 'Select Account' : step === 'role' ? 'Select Role' : (authType === 'sso' ? 'AWS SSO Sign In' : 'Access Keys')}
                        </Title>
                    </div>

                    {/* Auth Toggle */}
                    {(step === 'config' || step === 'error') && (
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <Segmented
                                options={[
                                    { label: 'AWS SSO', value: 'sso', icon: <AmazonOutlined /> },
                                    { label: 'Access Keys', value: 'keys', icon: <KeyOutlined /> }
                                ]}
                                value={authType}
                                onChange={(val) => { setAuthType(val as 'sso' | 'keys'); setErrorMsg(''); setStep('config'); }}
                                size="large"
                                block
                            />
                        </div>
                    )}

                    {/* Progress Steps */}
                    {authType === 'sso' && (
                        <Steps
                            size="small"
                            current={stepIndex}
                            status={step === 'error' ? 'error' : step === 'success' ? 'finish' : 'process'}
                            style={{ marginBottom: 32 }}
                            items={[
                                { title: 'Connect' },
                                { title: 'Authorize', icon: step === 'authenticating' ? <LoadingOutlined /> : undefined },
                                { title: 'Account' },
                                { title: 'Role' },
                                { title: 'Done', icon: step === 'success' ? <CheckCircleOutlined /> : undefined }
                            ]}
                        />
                    )}

                    {/* Error Alert */}
                    {step === 'error' && (
                        <Alert
                            type="error"
                            message="Login Failed"
                            description={errorMsg}
                            showIcon
                            style={{ marginBottom: 24, borderRadius: 12 }}
                            action={<Button size="small" onClick={handleReset}>Try Again</Button>}
                        />
                    )}

                    {/* ─── STEP: Config Form ─── */}
                    {(step === 'config' || step === 'error') && authType === 'sso' && (
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleInitSSO}
                            initialValues={{ region: DEFAULT_AWS_REGION }}
                            requiredMark={false}
                            size="large"
                        >
                            <Form.Item
                                label="SSO Start URL"
                                name="startUrl"
                                rules={[
                                    { required: true, message: 'Please enter your SSO Start URL' },
                                    { type: 'url', message: 'Please enter a valid URL' }
                                ]}
                            >
                                <Input
                                    placeholder="https://d-xxxxxxxxxx.awsapps.com/start"
                                    spellCheck={false}
                                    autoComplete="off"
                                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                                />
                            </Form.Item>

                            <Collapse
                                ghost
                                size="small"
                                style={{ marginBottom: 16 }}
                                items={[{
                                    key: 'advanced-sso',
                                    label: <Text style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Advanced: SSO Portal Region</Text>,
                                    children: (
                                        <Form.Item
                                            label="IAM Identity Center Region"
                                            name="region"
                                            extra="Only required if your SSO portal is in a custom region (defaults to us-east-1)"
                                            style={{ marginBottom: 0 }}
                                        >
                                            <Select
                                                showSearch
                                                placeholder="us-east-1 (Default)"
                                                optionFilterProp="label"
                                                options={AWS_REGIONS}
                                                allowClear
                                                filterOption={(input, option) =>
                                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                                                    (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                                                }
                                            />
                                        </Form.Item>
                                    )
                                }]}
                            />

                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                style={{ height: 52, borderRadius: 14, fontWeight: 600, marginTop: 8, fontSize: 15 }}
                                icon={<ArrowRightOutlined />}
                                iconPosition="end"
                            >
                                Continue with SSO
                            </Button>
                            <Button type="text" block onClick={handleReset} style={{ color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                                Reset
                            </Button>
                        </Form>
                    )}

                    {(step === 'config' || step === 'error') && authType === 'keys' && (
                        <Form
                            layout="vertical"
                            onFinish={handleLoginWithKeys}
                            initialValues={{ region: DEFAULT_AWS_REGION }}
                            requiredMark={false}
                            size="large"
                        >
                            <Form.Item label="Access Key ID" name="accessKeyId" rules={[{ required: true, message: 'Required' }]}>
                                <Input spellCheck={false} placeholder="AKIAIOSFODNN7EXAMPLE" style={{ fontFamily: 'monospace', fontSize: 13 }} />
                            </Form.Item>
                            <Form.Item label="Secret Access Key" name="secretAccessKey" rules={[{ required: true, message: 'Required' }]}>
                                <Input.Password spellCheck={false} placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" style={{ fontFamily: 'monospace', fontSize: 13 }} />
                            </Form.Item>
                            <Form.Item label="Session Token (Optional)" name="sessionToken">
                                <Input.Password spellCheck={false} placeholder="Optional temporary credentials token" style={{ fontFamily: 'monospace', fontSize: 13 }} />
                            </Form.Item>
                            <Collapse
                                ghost
                                size="small"
                                style={{ marginBottom: 16 }}
                                items={[{
                                    key: 'advanced-keys',
                                    label: <Text style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Advanced: Initial Region</Text>,
                                    children: (
                                        <Form.Item
                                            label="Initial Region"
                                            name="region"
                                            extra="Default is us-east-1. You can switch regions anytime in the header."
                                            style={{ marginBottom: 0 }}
                                        >
                                            <Select
                                                showSearch
                                                placeholder="us-east-1 (Default)"
                                                optionFilterProp="label"
                                                options={AWS_REGIONS}
                                                allowClear
                                                filterOption={(input, option) =>
                                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                                                    (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                                                }
                                            />
                                        </Form.Item>
                                    )
                                }]}
                            />
                            <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 52, borderRadius: 14, fontWeight: 600, marginTop: 8, fontSize: 15 }} icon={<ArrowRightOutlined />} iconPosition="end">
                                Sign In
                            </Button>
                        </Form>
                    )}

                    {/* ─── STEP: Authenticating (browser + polling unified) ─── */}
                    {step === 'authenticating' && (
                        <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
                            {/* Animated ring */}
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 28 }}>
                                <LoadingOutlined style={{ fontSize: 56, color: 'var(--color-accent-blue)' }} />
                                <div style={{
                                    position: 'absolute', inset: -8,
                                    borderRadius: '50%',
                                    border: '2px solid rgba(88,166,255,0.15)',
                                    animation: 'spin 3s linear infinite'
                                }} />
                            </div>

                            <Paragraph style={{ fontSize: 15, color: 'var(--color-text-primary)', margin: '0 0 8px', fontWeight: 500 }}>
                                {statusMsg || 'Opening your browser…'}
                            </Paragraph>
                            <Text style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                                Complete the sign-in in your browser and come back here.
                            </Text>

                            {/* Subtle instruction card */}
                            <div style={{
                                marginTop: 28,
                                padding: '12px 16px',
                                background: 'rgba(88,166,255,0.06)',
                                borderRadius: 12,
                                border: '1px solid rgba(88,166,255,0.15)',
                                textAlign: 'left'
                            }}>
                                <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
                                    1. A browser window should have opened automatically.<br />
                                    2. Sign in with your corporate credentials.<br />
                                    3. This screen will update once you've approved access.
                                </Text>
                            </div>
                        </div>
                    )}

                    {/* ─── STEP: Select Account ─── */}
                    {step === 'account' && (
                        <div>
                            <Paragraph style={{ color: 'var(--color-text-secondary)', marginBottom: 20, fontSize: 13 }}>
                                Choose the AWS account you want to manage DynamoDB tables in:
                            </Paragraph>
                            <div style={{ maxHeight: 320, overflowY: 'auto', borderRadius: 12, border: '1px solid var(--color-border-subtle)' }}>
                                <List
                                    dataSource={accounts}
                                    renderItem={acc => (
                                        <List.Item
                                            key={acc.accountId}
                                            onClick={() => handleSelectAccount(acc)}
                                            style={{
                                                padding: '14px 18px',
                                                cursor: 'pointer',
                                                transition: 'background 0.15s ease',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                borderBottom: '1px solid var(--color-border-subtle)'
                                            }}
                                            className="account-item-hover"
                                        >
                                            <div>
                                                <Text style={{ fontWeight: 600, color: 'var(--color-text-primary)', display: 'block', fontSize: 14 }}>
                                                    {acc.accountName}
                                                </Text>
                                                <Text style={{ color: 'var(--color-text-tertiary)', fontSize: 12, fontFamily: 'monospace' }}>
                                                    {acc.accountId}
                                                </Text>
                                            </div>
                                            <RightOutlined style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }} />
                                        </List.Item>
                                    )}
                                />
                            </div>
                            <Button type="text" block onClick={handleReset} style={{ color: 'var(--color-text-tertiary)', marginTop: 16 }}>
                                Start Over
                            </Button>
                        </div>
                    )}

                    {/* ─── STEP: Select Role ─── */}
                    {step === 'role' && (
                        <div>
                            <Paragraph style={{ color: 'var(--color-text-secondary)', marginBottom: 20, fontSize: 13 }}>
                                Choose the IAM role to assume in <strong>{selectedAccount?.accountName}</strong>:
                            </Paragraph>
                            <div style={{ maxHeight: 320, overflowY: 'auto', borderRadius: 12, border: '1px solid var(--color-border-subtle)' }}>
                                <List
                                    dataSource={roles}
                                    renderItem={role => (
                                        <List.Item
                                            key={role.roleName}
                                            onClick={() => handleSelectRole(role)}
                                            style={{
                                                padding: '14px 18px',
                                                cursor: 'pointer',
                                                transition: 'background 0.15s ease',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                borderBottom: '1px solid var(--color-border-subtle)'
                                            }}
                                            className="account-item-hover"
                                        >
                                            <Text style={{ fontWeight: 500, color: 'var(--color-text-primary)', fontSize: 14 }}>
                                                {role.roleName}
                                            </Text>
                                            <RightOutlined style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }} />
                                        </List.Item>
                                    )}
                                />
                            </div>
                            <Button type="text" block onClick={() => setStep('account')} style={{ color: 'var(--color-text-tertiary)', marginTop: 16 }}>
                                Back to Accounts
                            </Button>
                        </div>
                    )}

                    {/* ─── STEP: Completing ─── */}
                    {step === 'completing' && (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <LoadingOutlined style={{ fontSize: 44, color: 'var(--color-accent-blue)', marginBottom: 20 }} />
                            <Paragraph style={{ fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                {statusMsg || 'Finalizing your session…'}
                            </Paragraph>
                        </div>
                    )}

                    {/* ─── STEP: Success ─── */}
                    {step === 'success' && (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <CheckCircleOutlined style={{ fontSize: 48, color: 'var(--color-accent-green)', marginBottom: 16 }} />
                            <Title level={4} style={{ margin: 0, color: 'var(--color-text-primary)' }}>
                                Signed In!
                            </Title>
                            <Text style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 4, display: 'block' }}>
                                Loading your DynamoDB tables…
                            </Text>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
