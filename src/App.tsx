import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store/appStore'
import LoginPage from './pages/LoginPage'
import MainLayout from './pages/MainLayout'

export default function App() {
    const { session, setSession } = useAppStore()

    useEffect(() => {
        // Check for an existing valid session on startup
        window.api.auth.getSession().then((s) => setSession(s))
    }, [setSession])

    return (
        <HashRouter>
            <Routes>
                <Route
                    path="/login"
                    element={session ? <Navigate to="/tables" replace /> : <LoginPage />}
                />
                <Route
                    path="/*"
                    element={session ? <MainLayout /> : <Navigate to="/login" replace />}
                />
            </Routes>
        </HashRouter>
    )
}
