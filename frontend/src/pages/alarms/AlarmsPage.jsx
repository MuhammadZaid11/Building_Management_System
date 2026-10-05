import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import DataTable from '../../components/common/DataTable'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import LoadingState from '../../components/common/LoadingState'
import Pagination from '../../components/common/Pagination'
import { AlarmStatusBadge, SeverityBadge } from '../../components/common/StatusBadge'
import { ALARM_SEVERITIES, ALARM_STATUSES, ALARM_TYPES } from '../../constants/alarms'
import { REALTIME_EVENTS, buildingRoom } from '../../constants/realtime'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { acknowledgeAlarm, listAlarms, resolveAlarm } from '../../services/alarm.service'
import { listBuildings } from '../../services/building.service'
import { listDevices } from '../../services/device.service'
import { canOperateAlarms } from '../../utils/access'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

function toLocalInput(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export default function AlarmsPage() {
  const { user } = useAuth()
  const { listen, revision, subscribe } = useSocket()
  const canOperate = canOperateAlarms(user)
  const [params, setParams] = useSearchParams()
  const page = Math.max(Number(params.get('page')) || 1, 1)
  const search = params.get('search') || ''
  const status = params.get('status') || 'ACTIVE'
  const severity = params.get('severity') || ''
  const type = params.get('type') || ''
  const buildingId = params.get('buildingId') || ''
  const deviceId = params.get('deviceId') || ''
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const [searchInput, setSearchInput] = useState(search)
  const [buildings, setBuildings] = useState([])
  const [devices, setDevices] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [pending, setPending] = useState(null)
  const [actionError, setActionError] = useState('')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim()
      if (nextSearch === search) return
      setParams((current) => {
        const next = new URLSearchParams(current)
        if (nextSearch) next.set('search', nextSearch)
        else next.delete('search')
        next.delete('page')
        return next
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, search, setParams])

  useEffect(() => {
    let ignore = false
    listBuildings({ page: 1, limit: 100 })
      .then((data) => {
        if (!ignore) setBuildings(data.items)
      })
      .catch(() => {
        if (!ignore) setBuildings([])
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    if (!buildingId) {
      setDevices([])
      return undefined
    }
    listDevices({ buildingId, page: 1, limit: 100 })
      .then((data) => {
        if (!ignore) setDevices(data.items)
      })
      .catch(() => {
        if (!ignore) setDevices([])
      })
    return () => {
      ignore = true
    }
  }, [buildingId])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    listAlarms({
      page,
      limit: 20,
      search,
      status: status === 'ALL' ? '' : status,
      severity,
      type,
      buildingId,
      deviceId,
      from,
      to,
    })
      .then((data) => {
        if (!ignore) {
          setResult(data)
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
  }, [page, search, status, severity, type, buildingId, deviceId, from, to, reloadKey, revision])

  useEffect(() => {
    const ids = buildingId ? [buildingId] : buildings.map((building) => building.id)
    if (ids.length === 0) return undefined
    return subscribe(ids.map((id) => buildingRoom(id)))
  }, [buildingId, buildings, subscribe])

  useEffect(() => {
    function matches(alarm) {
      if (status !== 'ALL' && alarm.status !== status) return false
      if (severity && alarm.severity !== severity) return false
      if (type && alarm.type !== type) return false
      if (buildingId && alarm.buildingId !== buildingId) return false
      if (deviceId && alarm.deviceId !== deviceId) return false
      if (search && !String(alarm.message || '').toLowerCase().includes(search.toLowerCase())) return false
      if (from && new Date(alarm.triggeredAt) < new Date(from)) return false
      if (to && new Date(alarm.triggeredAt) > new Date(to)) return false
      return true
    }

    function apply(alarm) {
      setResult((current) => {
        if (!current) return current
        const exists = current.items.some((item) => item.id === alarm.id)
        const visible = matches(alarm)
        if (!visible) {
          if (!exists) return current
          return {
            ...current,
            items: current.items.filter((item) => item.id !== alarm.id),
            pagination: { ...current.pagination, total: Math.max(0, current.pagination.total - 1) },
          }
        }
        if (exists) {
          return { ...current, items: current.items.map((item) => (item.id === alarm.id ? { ...item, ...alarm } : item)) }
        }
        if (page !== 1) {
          return { ...current, pagination: { ...current.pagination, total: current.pagination.total + 1 } }
        }
        return {
          ...current,
          items: [alarm, ...current.items].slice(0, 20),
          pagination: { ...current.pagination, total: current.pagination.total + 1 },
        }
      })
    }

    const offCreated = listen(REALTIME_EVENTS.ALARM_CREATED, apply)
    const offAcknowledged = listen(REALTIME_EVENTS.ALARM_ACKNOWLEDGED, apply)
    const offResolved = listen(REALTIME_EVENTS.ALARM_RESOLVED, apply)
    return () => {
      offCreated()
      offAcknowledged()
      offResolved()
    }
  }, [buildingId, deviceId, from, listen, page, search, severity, status, to, type])

  function updateParam(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key === 'buildingId') next.delete('deviceId')
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  async function confirmAction() {
    if (!pending) return
    setActing(true)
    setActionError('')
    try {
      if (pending.action === 'acknowledge') await acknowledgeAlarm(pending.alarm.id)
      else await resolveAlarm(pending.alarm.id)
      setNotice(pending.action === 'acknowledge' ? 'Alarm acknowledged.' : 'Alarm resolved.')
      setPending(null)
      setReloadKey((value) => value + 1)
    } catch (requestError) {
      setActionError(getErrorMessage(requestError))
    } finally {
      setActing(false)
    }
  }

  if (loading && !result) return <LoadingState message="Loading alarms..." />
  if (error && !result) return <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />

  const items = result?.items || []
  const filtered = search || severity || type || buildingId || deviceId || from || to || status !== 'ACTIVE'
  const emptyMessage = filtered ? 'No alarms found.' : 'No active alarms.'

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Alarms</h1>
          <p className="lede">Threshold episodes raised from sensor readings. History stays available after an alarm is resolved.</p>
        </div>
      </div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <div className="toolbar">
        <label>
          Search
          <input type="search" value={searchInput} placeholder="Alarm message" onChange={(event) => setSearchInput(event.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => updateParam('status', event.target.value === 'ACTIVE' ? '' : event.target.value)}>
            <option value="ALL">All</option>
            {ALARM_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Severity
          <select value={severity} onChange={(event) => updateParam('severity', event.target.value)}>
            <option value="">All</option>
            {ALARM_SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Type
          <select value={type} onChange={(event) => updateParam('type', event.target.value)}>
            <option value="">All</option>
            {ALARM_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Building
          <select value={buildingId} onChange={(event) => updateParam('buildingId', event.target.value)}>
            <option value="">All</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
        </label>
        <label>
          Device
          <select value={deviceId} onChange={(event) => updateParam('deviceId', event.target.value)} disabled={!buildingId}>
            <option value="">All</option>
            {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
          </select>
        </label>
        <label>
          From
          <input type="datetime-local" value={toLocalInput(from)} onChange={(event) => updateParam('from', fromLocalInput(event.target.value))} />
        </label>
        <label>
          To
          <input type="datetime-local" value={toLocalInput(to)} onChange={(event) => updateParam('to', fromLocalInput(event.target.value))} />
        </label>
      </div>
      {error ? <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {items.length === 0 && !error ? <EmptyState message={emptyMessage} /> : null}
      {items.length > 0 ? (
        <>
          <DataTable
            rowKey={(alarm) => alarm.id}
            rows={items}
            columns={[
              { key: 'severity', header: 'Severity', render: (alarm) => <SeverityBadge severity={alarm.severity} /> },
              { key: 'type', header: 'Type', render: (alarm) => alarm.type },
              { key: 'message', header: 'Message', render: (alarm) => alarm.message },
              { key: 'device', header: 'Device', render: (alarm) => alarm.device?.name || '—' },
              { key: 'building', header: 'Building', render: (alarm) => alarm.building?.name || '—' },
              { key: 'status', header: 'Status', render: (alarm) => <AlarmStatusBadge status={alarm.status} /> },
              { key: 'triggered', header: 'Triggered at', render: (alarm) => formatDateTime(alarm.triggeredAt) },
              { key: 'acknowledged', header: 'Acknowledged at', render: (alarm) => formatDateTime(alarm.acknowledgedAt) },
              { key: 'resolved', header: 'Resolved at', render: (alarm) => formatDateTime(alarm.resolvedAt) },
              {
                key: 'actions',
                header: 'Actions',
                render: (alarm) => (
                  <div className="row-actions">
                    <Link className="button button-quiet" to={`/alarms/${alarm.id}`}>View</Link>
                    {canOperate && alarm.status === 'ACTIVE' ? (
                      <button type="button" className="button button-quiet" onClick={() => { setActionError(''); setPending({ action: 'acknowledge', alarm }) }}>Acknowledge</button>
                    ) : null}
                    {canOperate && alarm.status !== 'RESOLVED' ? (
                      <button type="button" className="button button-quiet" onClick={() => { setActionError(''); setPending({ action: 'resolve', alarm }) }}>Resolve</button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            page={result.pagination.page}
            total={result.pagination.total}
            totalPages={result.pagination.totalPages}
            onPage={(nextPage) => updateParam('page', nextPage <= 1 ? '' : String(nextPage))}
          />
        </>
      ) : null}
      {pending ? (
        <ConfirmDialog
          title={pending.action === 'acknowledge' ? 'Acknowledge alarm' : 'Resolve alarm'}
          message={pending.action === 'acknowledge' ? 'Acknowledge this alarm?' : 'Resolve this alarm?'}
          confirmLabel={pending.action === 'acknowledge' ? 'Acknowledge' : 'Resolve'}
          busyLabel="Saving..."
          danger={pending.action === 'resolve'}
          busy={acting}
          error={actionError}
          onCancel={() => { if (!acting) setPending(null) }}
          onConfirm={confirmAction}
        />
      ) : null}
    </section>
  )
}
