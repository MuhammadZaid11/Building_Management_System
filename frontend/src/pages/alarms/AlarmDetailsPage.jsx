import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumbs from '../../components/common/Breadcrumbs'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ErrorState from '../../components/common/ErrorState'
import LoadingState from '../../components/common/LoadingState'
import StatusBadge, { AlarmStatusBadge, SeverityBadge, WorkOrderStatusBadge } from '../../components/common/StatusBadge'
import { REALTIME_EVENTS, buildingRoom } from '../../constants/realtime'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { acknowledgeAlarm, getAlarm, resolveAlarm } from '../../services/alarm.service'
import { listWorkOrders } from '../../services/maintenance.service'
import { canManageMaintenance, canOperateAlarms } from '../../utils/access'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

export default function AlarmDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { listen, revision, subscribe } = useSocket()
  const canOperate = canOperateAlarms(user)
  const [alarm, setAlarm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(null)
  const [actionError, setActionError] = useState('')
  const [acting, setActing] = useState(false)
  const [workOrders, setWorkOrders] = useState([])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    getAlarm(id)
      .then((data) => {
        if (!ignore) {
          setAlarm(data)
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

  useEffect(() => {
    if (!alarm?.buildingId) return undefined
    return subscribe([buildingRoom(alarm.buildingId)])
  }, [alarm?.buildingId, subscribe])

  useEffect(() => {
    let ignore = false
    listWorkOrders({ alarmId: id, page: 1, limit: 20 })
      .then((data) => {
        if (!ignore) setWorkOrders(data.items)
      })
      .catch(() => {
        if (!ignore) setWorkOrders([])
      })
    return () => {
      ignore = true
    }
  }, [id, revision])

  useEffect(() => {
    function merge(event) {
      if (event.id !== id) return
      setAlarm((current) => (current ? {
        ...current,
        ...event,
        device: current.device,
        building: current.building,
        sensor: current.sensor,
      } : current))
    }

    const offAcknowledged = listen(REALTIME_EVENTS.ALARM_ACKNOWLEDGED, merge)
    const offResolved = listen(REALTIME_EVENTS.ALARM_RESOLVED, merge)
    return () => {
      offAcknowledged()
      offResolved()
    }
  }, [id, listen])

  async function confirmAction() {
    setActing(true)
    setActionError('')
    try {
      const updated = pending === 'acknowledge' ? await acknowledgeAlarm(id) : await resolveAlarm(id)
      setAlarm(updated)
      setNotice(pending === 'acknowledge' ? 'Alarm acknowledged.' : 'Alarm resolved.')
      setPending(null)
    } catch (requestError) {
      setActionError(getErrorMessage(requestError))
    } finally {
      setActing(false)
    }
  }

  if (loading) return <LoadingState message="Loading alarm..." />
  if (error || !alarm) return <ErrorState message={error || 'The requested information could not be found.'} />

  const device = alarm.device
  const room = device?.room
  const zone = room?.zone
  const floor = zone?.floor
  const building = floor?.building || alarm.building
  const sensor = alarm.sensor

  return (
    <section>
      <Breadcrumbs items={[{ label: 'Alarms', to: '/alarms' }, { label: alarm.type }]} />
      <div className="page-heading">
        <div>
          <h1>{alarm.type}</h1>
          <p className="lede">{alarm.message}</p>
        </div>
        <AlarmStatusBadge status={alarm.status} />
      </div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {canOperate && alarm.status !== 'RESOLVED' ? (
        <div className="row-actions">
          {alarm.status === 'ACTIVE' ? (
            <button type="button" className="button button-primary" onClick={() => { setActionError(''); setPending('acknowledge') }}>Acknowledge</button>
          ) : null}
          <button type="button" className="button" onClick={() => { setActionError(''); setPending('resolve') }}>Resolve</button>
        </div>
      ) : null}
      <h2>Alarm information</h2>
      <dl className="facts facts-grid">
        <div><dt>Severity</dt><dd><SeverityBadge severity={alarm.severity} /></dd></div>
        <div><dt>Type</dt><dd>{alarm.type}</dd></div>
        <div><dt>Status</dt><dd><AlarmStatusBadge status={alarm.status} /></dd></div>
        <div><dt>Message</dt><dd>{alarm.message}</dd></div>
        <div><dt>Triggered time</dt><dd>{formatDateTime(alarm.triggeredAt)}</dd></div>
        <div><dt>Acknowledged time</dt><dd>{formatDateTime(alarm.acknowledgedAt)}</dd></div>
        <div><dt>Resolved time</dt><dd>{formatDateTime(alarm.resolvedAt)}</dd></div>
      </dl>
      <h2>Device information</h2>
      <dl className="facts facts-grid">
        <div><dt>Device name</dt><dd>{device ? <Link to={`/devices/${device.id}`}>{device.name}</Link> : '—'}</dd></div>
        <div><dt>Device code</dt><dd>{device?.deviceCode || '—'}</dd></div>
        <div><dt>Device type</dt><dd>{device?.deviceType || '—'}</dd></div>
        <div><dt>Status</dt><dd>{device ? <StatusBadge status={device.status} /> : '—'}</dd></div>
      </dl>
      <h2>Sensor information</h2>
      {sensor ? (
        <dl className="facts facts-grid">
          <div><dt>Name</dt><dd><Link to={`/sensors/${sensor.id}`}>{sensor.name}</Link></dd></div>
          <div><dt>Type</dt><dd>{sensor.sensorType}</dd></div>
          <div><dt>Unit</dt><dd>{sensor.unit}</dd></div>
          <div><dt>Min value</dt><dd>{sensor.minValue ?? '—'}</dd></div>
          <div><dt>Max value</dt><dd>{sensor.maxValue ?? '—'}</dd></div>
        </dl>
      ) : <p>This alarm is not linked to a sensor.</p>}
      <div className="page-heading">
        <h2>Maintenance</h2>
        {canManageMaintenance(user) ? (
          <Link className="button button-primary" to={`/maintenance?alarmId=${alarm.id}&deviceId=${device?.id || ''}`}>Create work order</Link>
        ) : null}
      </div>
      {workOrders.length === 0 ? <p>No work orders are linked to this alarm.</p> : (
        <ul>
          {workOrders.map((order) => (
            <li key={order.id}>
              <Link to={`/maintenance/work-orders/${order.id}`}>{order.workOrderNumber}</Link>
              {' '}{order.title} <WorkOrderStatusBadge status={order.status} />
            </li>
          ))}
        </ul>
      )}
      <h2>Location</h2>
      <dl className="facts facts-grid">
        <div><dt>Building</dt><dd>{building ? <Link to={`/buildings/${building.id}`}>{building.name}</Link> : '—'}</dd></div>
        <div><dt>Floor</dt><dd>{floor ? <Link to={`/floors/${floor.id}`}>{floor.name}</Link> : '—'}</dd></div>
        <div><dt>Zone</dt><dd>{zone ? <Link to={`/zones/${zone.id}`}>{zone.name}</Link> : alarm.zone?.name || '—'}</dd></div>
        <div><dt>Room</dt><dd>{room ? <Link to={`/rooms/${room.id}`}>{room.name}</Link> : '—'}</dd></div>
      </dl>
      {pending ? (
        <ConfirmDialog
          title={pending === 'acknowledge' ? 'Acknowledge alarm' : 'Resolve alarm'}
          message={pending === 'acknowledge' ? 'Acknowledge this alarm?' : 'Resolve this alarm?'}
          confirmLabel={pending === 'acknowledge' ? 'Acknowledge' : 'Resolve'}
          busyLabel="Saving..."
          danger={pending === 'resolve'}
          busy={acting}
          error={actionError}
          onCancel={() => { if (!acting) setPending(null) }}
          onConfirm={confirmAction}
        />
      ) : null}
    </section>
  )
}
