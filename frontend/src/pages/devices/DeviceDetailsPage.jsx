import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RecentAlarms from '../../components/alarms/RecentAlarms'
import DeviceMaintenance from '../../components/maintenance/DeviceMaintenance'
import EnergyDevicePanel from '../../components/energy/EnergyDevicePanel'
import Breadcrumbs from '../../components/common/Breadcrumbs'
import DataTable from '../../components/common/DataTable'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import LoadingState from '../../components/common/LoadingState'
import StatusBadge from '../../components/common/StatusBadge'
import { REALTIME_EVENTS, deviceRoom } from '../../constants/realtime'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { getDevice } from '../../services/device.service'
import { canManageSensors } from '../../utils/access'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime, formatLastSeen } from '../../utils/format'

export default function DeviceDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { listen, revision, subscribe } = useSocket()
  const canAddSensor = canManageSensors(user)
  const [device, setDevice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    getDevice(id)
      .then((data) => {
        if (!ignore) {
          setDevice(data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (!ignore) setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id, revision])

  useEffect(() => subscribe([deviceRoom(id)]), [id, subscribe])

  useEffect(() => {
    const offStatus = listen(REALTIME_EVENTS.DEVICE_STATUS_CHANGED, (event) => {
      if (event.deviceId !== id) return
      setDevice((current) => (current ? { ...current, status: event.status, updatedAt: event.updatedAt } : current))
    })
    const offReading = listen(REALTIME_EVENTS.READING_CREATED, (reading) => {
      if (reading.deviceId !== id) return
      setDevice((current) => {
        if (!current) return current
        return {
          ...current,
          sensors: (current.sensors || []).map((sensor) => {
            if (sensor.id !== reading.sensorId) return sensor
            const latest = sensor.latestReading
            if (latest && new Date(latest.recordedAt) > new Date(reading.recordedAt)) return sensor
            if (latest?.id === reading.id) return sensor
            return {
              ...sensor,
              latestReading: {
                id: reading.id,
                value: reading.value,
                recordedAt: reading.recordedAt,
                outOfRange: reading.outOfRange,
              },
            }
          }),
        }
      })
    })
    return () => {
      offStatus()
      offReading()
    }
  }, [id, listen])

  if (loading) return <LoadingState message="Loading device..." />
  if (error || !device) return <ErrorState message={error || 'The requested information could not be found.'} />

  const room = device.room
  const zone = room?.zone
  const floor = zone?.floor
  const building = floor?.building
  const sensors = device.sensors || []

  return (
    <section>
      <Breadcrumbs items={[{ label: 'Devices', to: '/devices' }, { label: device.name }]} />
      <div className="page-heading">
        <div>
          <h1>{device.name}</h1>
          <p className="lede">{device.deviceCode}</p>
        </div>
        <StatusBadge status={device.status} />
      </div>
      <h2>Device information</h2>
      <dl className="facts facts-grid">
        <div><dt>Name</dt><dd>{device.name}</dd></div>
        <div><dt>Device code</dt><dd>{device.deviceCode}</dd></div>
        <div><dt>Type</dt><dd>{device.deviceType}</dd></div>
        <div><dt>Manufacturer</dt><dd>{device.manufacturer || '—'}</dd></div>
        <div><dt>Model</dt><dd>{device.model || '—'}</dd></div>
        <div><dt>Status</dt><dd><StatusBadge status={device.status} /></dd></div>
        <div><dt>Installed at</dt><dd>{formatDateTime(device.installedAt)}</dd></div>
        <div><dt>Last seen</dt><dd>{formatLastSeen(device.lastSeenAt)}</dd></div>
      </dl>
      <h2>Location</h2>
      <dl className="facts facts-grid">
        <div><dt>Building</dt><dd>{building ? <Link to={`/buildings/${building.id}`}>{building.name}</Link> : '—'}</dd></div>
        <div><dt>Floor</dt><dd>{floor ? <Link to={`/floors/${floor.id}`}>{floor.name}</Link> : '—'}</dd></div>
        <div><dt>Zone</dt><dd>{zone ? <Link to={`/zones/${zone.id}`}>{zone.name}</Link> : '—'}</dd></div>
        <div><dt>Room</dt><dd>{room ? <Link to={`/rooms/${room.id}`}>{room.name}</Link> : '—'}</dd></div>
      </dl>
      {device.deviceType === 'ENERGY_METER' ? <EnergyDevicePanel deviceId={device.id} /> : null}
      <div className="page-heading">
        <h2>Sensors</h2>
        {canAddSensor ? <Link className="button button-primary" to={`/sensors?deviceId=${device.id}`}>Add sensor</Link> : null}
      </div>
      {sensors.length === 0 ? <EmptyState message="No sensors configured for this device." /> : (
        <DataTable
          rowKey={(sensor) => sensor.id}
          rows={sensors}
          columns={[
            { key: 'name', header: 'Name', render: (sensor) => sensor.name },
            { key: 'type', header: 'Type', render: (sensor) => sensor.sensorType },
            {
              key: 'latest',
              header: 'Latest reading',
              render: (sensor) => (sensor.latestReading ? `${sensor.latestReading.value} ${sensor.unit}` : 'No readings'),
            },
            {
              key: 'seen',
              header: 'Last reading',
              render: (sensor) => (sensor.latestReading ? formatDateTime(sensor.latestReading.recordedAt) : '—'),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (sensor) => <Link className="button button-quiet" to={`/sensors/${sensor.id}`}>View sensor</Link>,
            },
          ]}
        />
      )}
      <DeviceMaintenance deviceId={device.id} />
      <RecentAlarms deviceId={device.id} />
    </section>
  )
}