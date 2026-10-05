import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DataTable from '../../components/common/DataTable'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import LoadingState from '../../components/common/LoadingState'
import Modal from '../../components/common/Modal'
import Pagination from '../../components/common/Pagination'
import { SeverityBadge, WorkOrderStatusBadge } from '../../components/common/StatusBadge'
import WorkOrderForm from '../../components/maintenance/WorkOrderForm'
import { WORK_ORDER_PRIORITIES, WORK_ORDER_STATUSES } from '../../constants/maintenance'
import { MAINTENANCE_REALTIME_EVENTS, buildingRoom } from '../../constants/realtime'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { listBuildings } from '../../services/building.service'
import { listDevices } from '../../services/device.service'
import { getMaintenanceSummary, listTechnicians, listWorkOrders } from '../../services/maintenance.service'
import { canManageMaintenance } from '../../utils/access'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

function toIso(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export default function MaintenancePage() {
  const { user } = useAuth()
  const { listen, revision, subscribe } = useSocket()
  const canManage = canManageMaintenance(user)
  const [params, setParams] = useSearchParams()
  const page = Math.max(Number(params.get('page')) || 1, 1)
  const search = params.get('search') || ''
  const status = params.get('status') || ''
  const priority = params.get('priority') || ''
  const buildingId = params.get('buildingId') || ''
  const deviceId = params.get('deviceId') || ''
  const assignedToId = params.get('assignedToId') || ''
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const alarmId = params.get('alarmId') || ''
  const [searchInput, setSearchInput] = useState(search)
  const [buildings, setBuildings] = useState([])
  const [devices, setDevices] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [summary, setSummary] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [creating, setCreating] = useState(Boolean(alarmId || (deviceId && params.get('create') === '1')))

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
  }, [search, searchInput, setParams])

  useEffect(() => {
    let ignore = false
    listBuildings({ page: 1, limit: 100 })
      .then((data) => {
        if (!ignore) setBuildings(data.items)
      })
      .catch(() => {
        if (!ignore) setBuildings([])
      })
    listTechnicians()
      .then((data) => {
        if (!ignore) setTechnicians(data)
      })
      .catch(() => {
        if (!ignore) setTechnicians([])
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
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
    getMaintenanceSummary()
      .then((data) => {
        if (!ignore) setSummary(data)
      })
      .catch(() => {
        if (!ignore) setSummary(null)
      })
    return () => {
      ignore = true
    }
  }, [reloadKey, revision])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    listWorkOrders({
      page,
      limit: 20,
      search,
      status,
      priority,
      buildingId,
      deviceId: alarmId ? '' : deviceId,
      assignedToId,
      from: toIso(from),
      to: toIso(to),
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
  }, [alarmId, assignedToId, buildingId, deviceId, from, page, priority, reloadKey, revision, search, status, to])

  useEffect(() => {
    const ids = buildingId ? [buildingId] : buildings.map((building) => building.id)
    if (ids.length === 0) return undefined
    return subscribe(ids.map((id) => buildingRoom(id)))
  }, [buildingId, buildings, subscribe])

  useEffect(() => {
    const stops = MAINTENANCE_REALTIME_EVENTS.map((eventName) => listen(eventName, () => {
      setReloadKey((value) => value + 1)
    }))
    return () => stops.forEach((stop) => stop())
  }, [listen])

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

  if (loading && !result) return <LoadingState message="Loading maintenance..." />
  if (error && !result) return <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />

  const items = result?.items || []

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Maintenance</h1>
          <p className="lede">Work orders, preventive schedules, and service history. Costs are recorded maintenance amounts, not a utility bill.</p>
        </div>
        <div className="row-actions">
          <Link className="button" to="/maintenance/schedules">Preventive maintenance</Link>
          {canManage ? <button type="button" className="button button-primary" onClick={() => setCreating(true)}>Add work order</button> : null}
        </div>
      </div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {summary ? (
        <div className="summary-grid">
          <article className="summary-card"><span>Open</span><strong>{summary.open}</strong></article>
          <article className="summary-card"><span>Assigned</span><strong>{summary.assigned}</strong></article>
          <article className="summary-card"><span>In progress</span><strong>{summary.inProgress}</strong></article>
          <article className="summary-card"><span>Overdue schedules</span><strong>{summary.overdue}</strong></article>
          <article className="summary-card"><span>Critical open work</span><strong>{summary.critical}</strong></article>
        </div>
      ) : null}
      <div className="toolbar">
        <label>
          Search
          <input type="search" value={searchInput} placeholder="Number or title" onChange={(event) => setSearchInput(event.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => updateParam('status', event.target.value)}>
            <option value="">All</option>
            {WORK_ORDER_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(event) => updateParam('priority', event.target.value)}>
            <option value="">All</option>
            {WORK_ORDER_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
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
          <select value={alarmId ? '' : deviceId} onChange={(event) => updateParam('deviceId', event.target.value)}>
            <option value="">All</option>
            {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
          </select>
        </label>
        <label>
          Technician
          <select value={assignedToId} onChange={(event) => updateParam('assignedToId', event.target.value)}>
            <option value="">All</option>
            {technicians.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label>
          From
          <input type="datetime-local" value={from} onChange={(event) => updateParam('from', event.target.value)} />
        </label>
        <label>
          To
          <input type="datetime-local" value={to} onChange={(event) => updateParam('to', event.target.value)} />
        </label>
      </div>
      {items.length === 0 ? <EmptyState message="No work orders match this selection." /> : (
        <DataTable
          rowKey={(order) => order.id}
          rows={items}
          columns={[
            { key: 'number', header: 'Number', render: (order) => <Link to={`/maintenance/work-orders/${order.id}`}>{order.workOrderNumber}</Link> },
            { key: 'title', header: 'Title', render: (order) => order.title },
            { key: 'device', header: 'Device', render: (order) => order.device ? <Link to={`/devices/${order.device.id}`}>{order.device.name}</Link> : '—' },
            { key: 'building', header: 'Building', render: (order) => order.building?.name || '—' },
            { key: 'priority', header: 'Priority', render: (order) => <SeverityBadge severity={order.priority} /> },
            { key: 'status', header: 'Status', render: (order) => <WorkOrderStatusBadge status={order.status} /> },
            { key: 'technician', header: 'Assigned technician', render: (order) => order.assignedTo?.name || '—' },
            { key: 'scheduled', header: 'Scheduled', render: (order) => formatDateTime(order.scheduledAt) },
            { key: 'actions', header: 'Actions', render: (order) => <Link className="button button-quiet" to={`/maintenance/work-orders/${order.id}`}>View</Link> },
          ]}
        />
      )}
      <Pagination
        page={result?.pagination?.page || page}
        total={result?.pagination?.total || 0}
        totalPages={result?.pagination?.totalPages || 0}
        onPage={(nextPage) => updateParam('page', String(nextPage))}
      />
      {creating ? (
        <Modal title="Add work order" onClose={() => setCreating(false)}>
          <WorkOrderForm
            deviceId={deviceId}
            alarmId={alarmId}
            onCancel={() => setCreating(false)}
            onCreated={(order) => {
              setCreating(false)
              setNotice(`${order.workOrderNumber} created.`)
              setReloadKey((value) => value + 1)
            }}
          />
        </Modal>
      ) : null}
    </section>
  )
}
