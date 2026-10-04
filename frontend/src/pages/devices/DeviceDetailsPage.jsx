import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumbs from '../../components/common/Breadcrumbs'
import DataTable from '../../components/common/DataTable'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import LoadingState from '../../components/common/LoadingState'
import StatusBadge from '../../components/common/StatusBadge'
import { getDevice } from '../../services/device.service'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime, formatLastSeen } from '../../utils/format'

export default function DeviceDetailsPage() {
  const { id } = useParams()
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
  }, [id])

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
      <h2>Sensors</h2>
      {sensors.length === 0 ? <EmptyState message="No sensors configured for this device." /> : (
        <DataTable
          rowKey={(sensor) => sensor.id}
          rows={sensors}
          columns={[
            { key: 'name', header: 'Name', render: (sensor) => sensor.name },
            { key: 'type', header: 'Type', render: (sensor) => sensor.sensorType },
            { key: 'unit', header: 'Unit', render: (sensor) => sensor.unit },
          ]}
        />
      )}
    </section>
  )
}