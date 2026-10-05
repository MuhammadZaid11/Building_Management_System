import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RecentAlarms from '../../components/alarms/RecentAlarms'
import EnergyDevicePanel from '../../components/energy/EnergyDevicePanel'
import Breadcrumbs from '../../components/common/Breadcrumbs'
import DataTable from '../../components/common/DataTable'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import FormField from '../../components/common/FormField'
import LoadingState from '../../components/common/LoadingState'
import Pagination from '../../components/common/Pagination'
import StatusBadge from '../../components/common/StatusBadge'
import ReadingChart from '../../components/sensors/ReadingChart'
import { REALTIME_EVENTS, sensorRoom } from '../../constants/realtime'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { createReading, listReadings } from '../../services/reading.service'
import { getSensor } from '../../services/sensor.service'
import { canCreateReadings } from '../../utils/access'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

const RANGES = [
  { id: '1h', label: 'Last 1 hour' },
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
]

function rangeBounds(rangeId) {
  const to = new Date()
  const from = new Date(to.getTime())
  if (rangeId === '1h') from.setHours(from.getHours() - 1)
  else if (rangeId === '24h') from.setHours(from.getHours() - 24)
  else from.setDate(from.getDate() - 7)
  return { from: from.toISOString(), to: to.toISOString() }
}

export default function SensorDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { listen, revision, subscribe } = useSocket()
  const [sensor, setSensor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState('24h')
  const [chartReadings, setChartReadings] = useState([])
  const [table, setTable] = useState(null)
  const [page, setPage] = useState(1)
  const [readingsError, setReadingsError] = useState('')
  const [readingsLoading, setReadingsLoading] = useState(true)
  const [readingValue, setReadingValue] = useState('')
  const [readingError, setReadingError] = useState('')
  const [savingReading, setSavingReading] = useState(false)
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const canRecord = canCreateReadings(user)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    getSensor(id)
      .then((data) => {
        if (!ignore) {
          setSensor(data)
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
  }, [id, reloadKey, revision])

  useEffect(() => {
    let ignore = false
    const bounds = rangeBounds(range)
    setReadingsLoading(true)
    Promise.all([
      listReadings({ sensorId: id, ...bounds, page: 1, limit: 100 }),
      listReadings({ sensorId: id, ...bounds, page, limit: 20 }),
    ])
      .then(([chart, rows]) => {
        if (!ignore) {
          setChartReadings([...chart.items].reverse())
          setTable(rows)
          setReadingsError('')
        }
      })
      .catch((requestError) => {
        if (!ignore) setReadingsError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (!ignore) setReadingsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id, range, page, reloadKey, revision])

  useEffect(() => subscribe([sensorRoom(id)]), [id, subscribe])

  useEffect(() => {
    return listen(REALTIME_EVENTS.READING_CREATED, (reading) => {
      if (reading.sensorId !== id) return
      const recordedAt = new Date(reading.recordedAt)
      const point = {
        id: reading.id,
        sensorId: reading.sensorId,
        value: reading.value,
        recordedAt: reading.recordedAt,
        outOfRange: reading.outOfRange,
      }

      setSensor((current) => {
        if (!current) return current
        const latest = current.latestReading
        if (latest && new Date(latest.recordedAt) > recordedAt) return current
        return { ...current, latestReading: point }
      })

      const bounds = rangeBounds(range)
      if (recordedAt < new Date(bounds.from)) return

      setChartReadings((current) => {
        if (current.some((item) => item.id === point.id)) return current
        return [...current, point].sort((left, right) => new Date(left.recordedAt) - new Date(right.recordedAt)).slice(-100)
      })

      if (page !== 1) return
      setTable((current) => {
        if (!current || current.items.some((item) => item.id === point.id)) return current
        return {
          ...current,
          items: [point, ...current.items].slice(0, 20),
          pagination: { ...current.pagination, total: current.pagination.total + 1 },
        }
      })
    })
  }, [id, listen, page, range])

  async function submitReading(event) {
    event.preventDefault()
    const value = Number(readingValue)
    if (!Number.isFinite(value)) {
      setReadingError('Value must be a number.')
      return
    }
    setSavingReading(true)
    setReadingError('')
    try {
      const saved = await createReading({ sensorId: id, value: readingValue })
      setReadingValue('')
      if (saved.alarm?.status === 'RESOLVED') setNotice('Reading recorded. The open alarm was resolved.')
      else if (saved.alarm) setNotice('Reading recorded. An alarm is open for this sensor.')
      else setNotice('Reading recorded.')
      setPage(1)
      setReloadKey((current) => current + 1)
    } catch (requestError) {
      setReadingError(getErrorMessage(requestError))
    } finally {
      setSavingReading(false)
    }
  }

  if (loading) return <LoadingState message="Loading sensor..." />
  if (error || !sensor) return <ErrorState message={error || 'The requested information could not be found.'} />

  const device = sensor.device
  const room = device?.room
  const zone = room?.zone
  const floor = zone?.floor
  const building = floor?.building
  const latest = sensor.latestReading
  const rows = table?.items || []

  return (
    <section>
      <Breadcrumbs items={[{ label: 'Sensors', to: '/sensors' }, { label: sensor.name }]} />
      <div className="page-heading">
        <div>
          <h1>{sensor.name}</h1>
          <p className="lede">{sensor.sensorType}</p>
        </div>
      </div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <h2>Sensor information</h2>
      <dl className="facts facts-grid">
        <div><dt>Name</dt><dd>{sensor.name}</dd></div>
        <div><dt>Type</dt><dd>{sensor.sensorType}</dd></div>
        <div><dt>Unit</dt><dd>{sensor.unit}</dd></div>
        <div><dt>Min value</dt><dd>{sensor.minValue ?? '—'}</dd></div>
        <div><dt>Max value</dt><dd>{sensor.maxValue ?? '—'}</dd></div>
      </dl>
      <h2>Device information</h2>
      <dl className="facts facts-grid">
        <div><dt>Device name</dt><dd>{device ? <Link to={`/devices/${device.id}`}>{device.name}</Link> : '—'}</dd></div>
        <div><dt>Device code</dt><dd>{device?.deviceCode || '—'}</dd></div>
        <div><dt>Device type</dt><dd>{device?.deviceType || '—'}</dd></div>
        <div><dt>Status</dt><dd>{device ? <StatusBadge status={device.status} /> : '—'}</dd></div>
      </dl>
      <h2>Location</h2>
      <dl className="facts facts-grid">
        <div><dt>Building</dt><dd>{building ? <Link to={`/buildings/${building.id}`}>{building.name}</Link> : '—'}</dd></div>
        <div><dt>Floor</dt><dd>{floor ? <Link to={`/floors/${floor.id}`}>{floor.name}</Link> : '—'}</dd></div>
        <div><dt>Zone</dt><dd>{zone ? <Link to={`/zones/${zone.id}`}>{zone.name}</Link> : '—'}</dd></div>
        <div><dt>Room</dt><dd>{room ? <Link to={`/rooms/${room.id}`}>{room.name}</Link> : '—'}</dd></div>
      </dl>
      <h2>Latest reading</h2>
      {latest ? (
        <dl className="facts facts-grid">
          <div><dt>Current value</dt><dd>{latest.value} {sensor.unit}</dd></div>
          <div><dt>Recorded time</dt><dd>{formatDateTime(latest.recordedAt)}</dd></div>
          <div><dt>Status</dt><dd>{latest.outOfRange ? 'Out of range' : 'Normal'}</dd></div>
        </dl>
      ) : <EmptyState message="No readings recorded for this sensor." />}
      {canRecord ? (
        <form className="inline-form" onSubmit={submitReading}>
          <FormField id="reading-value" label="Record a reading" error={readingError}>
            <input id="reading-value" inputMode="decimal" value={readingValue} onChange={(event) => setReadingValue(event.target.value)} />
          </FormField>
          <button type="submit" className="button button-primary" disabled={savingReading}>{savingReading ? 'Saving...' : 'Save reading'}</button>
        </form>
      ) : null}
      {device?.deviceType === 'ENERGY_METER' && (sensor.sensorType === 'ENERGY' || sensor.sensorType === 'POWER') ? (
        <EnergyDevicePanel deviceId={device.id} sensorId={sensor.id} />
      ) : null}
      <h2>Readings</h2>
      {sensor.sensorType === 'POWER' ? <p className="lede">This chart shows instantaneous power, not energy consumption.</p> : null}
      {sensor.sensorType === 'ENERGY' ? <p className="lede">This chart shows the cumulative meter register. Consumption is the increase over the selected period.</p> : null}
      <div className="range-switch" role="group" aria-label="Reading time range">
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={range === item.id ? 'button button-primary' : 'button'}
            aria-pressed={range === item.id}
            onClick={() => { setRange(item.id); setPage(1) }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {readingsError ? <ErrorState message={readingsError} /> : null}
      {readingsLoading && !table ? <LoadingState message="Loading readings..." /> : null}
      {!readingsLoading && chartReadings.length === 0 ? <EmptyState message="No readings recorded for this time range." /> : null}
      {chartReadings.length > 0 ? <ReadingChart readings={chartReadings} unit={sensor.unit} minValue={sensor.minValue} maxValue={sensor.maxValue} /> : null}
      {rows.length > 0 ? (
        <>
          <DataTable
            rowKey={(reading) => reading.id}
            rows={rows}
            columns={[
              { key: 'value', header: 'Value', render: (reading) => reading.value },
              { key: 'unit', header: 'Unit', render: () => sensor.unit },
              { key: 'time', header: 'Recorded at', render: (reading) => formatDateTime(reading.recordedAt) },
              { key: 'status', header: 'Status', render: (reading) => (reading.outOfRange ? 'Out of range' : 'Normal') },
            ]}
          />
          <Pagination
            page={table.pagination.page}
            total={table.pagination.total}
            totalPages={table.pagination.totalPages}
            onPage={setPage}
          />
        </>
      ) : null}
      <RecentAlarms sensorId={sensor.id} refreshKey={reloadKey} />
    </section>
  )
}
