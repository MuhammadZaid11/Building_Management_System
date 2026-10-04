import { Navigate, Route, Routes } from 'react-router-dom'
import PlaceholderPage from './components/common/PlaceholderPage'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import Login from './pages/auth/Login'
import BuildingsPage from './pages/buildings/BuildingsPage'
import BuildingDetailsPage from './pages/buildings/BuildingDetailsPage'
import BuildingFloorsPage from './pages/buildings/BuildingFloorsPage'
import Dashboard from './pages/dashboard/Dashboard'
import DeviceDetailsPage from './pages/devices/DeviceDetailsPage'
import DevicesPage from './pages/devices/DevicesPage'
import FloorDetailsPage from './pages/floors/FloorDetailsPage'
import RoomDetailsPage from './pages/rooms/RoomDetailsPage'
import ZoneDetailsPage from './pages/zones/ZoneDetailsPage'
import GuestRoute from './routes/GuestRoute'
import ProtectedRoute from './routes/ProtectedRoute'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/buildings" element={<BuildingsPage />} />
            <Route path="/buildings/:id" element={<BuildingDetailsPage />} />
            <Route path="/buildings/:id/floors" element={<BuildingFloorsPage />} />
            <Route path="/floors/:id" element={<FloorDetailsPage />} />
            <Route path="/zones/:id" element={<ZoneDetailsPage />} />
            <Route path="/rooms/:id" element={<RoomDetailsPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/devices/:id" element={<DeviceDetailsPage />} />
            <Route path="/sensors" element={<PlaceholderPage title="Sensors" />} />
            <Route path="/alarms" element={<PlaceholderPage title="Alarms" />} />
            <Route path="/energy" element={<PlaceholderPage title="Energy" />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
