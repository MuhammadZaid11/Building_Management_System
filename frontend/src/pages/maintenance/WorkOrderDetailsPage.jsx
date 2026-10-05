import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumbs from '../../components/common/Breadcrumbs'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import DataTable from '../../components/common/DataTable'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import FormField from '../../components/common/FormField'
import LoadingState from '../../components/common/LoadingState'
import { SeverityBadge, WorkOrderStatusBadge } from '../../components/common/StatusBadge'
import { MAINTENANCE_REALTIME_EVENTS, buildingRoom, deviceRoom } from '../../constants/realtime'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import {
  addWorkOrderActivity,
  assignWorkOrder,
  cancelWorkOrder,
  completeWorkOrder,
  getWorkOrder,
  holdWorkOrder,
  listTechnicians,
  resumeWorkOrder,
  startWorkOrder,
} from '../../services/maintenance.service'
import { canManageMaintenance, canWorkOnOrder } from '../../utils/access'
import { getErrorMessage } from '../../utils/errors'
import { formatCost, formatDateTime } from '../../utils/format'

function timeline(order) {
  const events = [
    order.createdAt ? { at: order.createdAt, label: 'Created', detail: order.createdBy?.name } : null,
    order.assignedAt ? { at: order.assignedAt, label: 'Assigned', detail: order.assignedTo?.name } : null,
    order.startedAt ? { at: order.startedAt, label: 'Started' } : null,
    order.heldAt ? { at: order.heldAt, label: 'Placed on hold' } : null,
    ...(order.activities || []).map((activity) => ({
      at: activity.performedAt,
      label: 'Activity added',
      detail: activity.description,
    })),
    order.completedAt ? { at: order.completedAt, label: 'Completed', detail: order.completionNotes } : null,
    order.cancelledAt ? { at: order.cancelledAt, label: 'Cancelled' } : null,
  ].filter(Boolean)

  return events.sort((left, right) => new Date(left.at) - new Date(right.at))
}

export default function WorkOrderDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { listen, revision, subscribe } = useSocket()
  const canManage = canManageMaintenance(user)
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [acting, setActing] = useState(false)
  const [technicians, setTechnicians] = useState([])
  const [assignedToId, setAssignedToId] = useState('')
  const [activity, setActivity] = useState({ description: '', notes: '', cost: '' })
  const [completion, setCompletion] = useState({ completionNotes: '', actualCost: '' })
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    getWorkOrder(id)
      .then((data) => {
        if (!ignore) {
          setOrder(data)
          setAssignedToId(data.assignedTo?.id || '')
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
    if (!order?.buildingId) return undefined
    return subscribe([buildingRoom(order.buildingId), deviceRoom(order.deviceId)].filter(Boolean))
  }, [order?.buildingId, order?.deviceId, subscribe])

  useEffect(() => {
    const stops = MAINTENANCE_REALTIME_EVENTS.map((eventName) => listen(eventName, (event) => {
      if (event.workOrderId !== id) return
      getWorkOrder(id)
        .then((data) => setOrder(data))
        .catch(() => {})
    }))
    return () => stops.forEach((stop) => stop())
  }, [id, listen])

  useEffect(() => {
    if (!canManage) return undefined
    let ignore = false
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
  }, [canManage])

  async function run(action) {
    setActing(true)
    setActionError('')
    try {
      const updated = await action()
      setOrder(updated)
      setNotice('Work order updated.')
      setConfirmCancel(false)
    } catch (requestError) {
      setActionError(getErrorMessage(requestError))
    } finally {
      setActing(false)
    }
  }

  if (loading) return <LoadingState message="Loading work order..." />
  if (error || !order) return <ErrorState message={error || 'The requested information could not be found.'} />

  const canWork = canWorkOnOrder(user, order)
  const room = order.device?.room
  const zone = room?.zone
  const floor = zone?.floor
  const building = floor?.building || order.building
  const events = timeline(order)
  const costs = order.costs || {}

  return (
    <section>
      <Breadcrumbs items={[{ label: 'Maintenance', to: '/maintenance' }, { label: order.workOrderNumber }]} />
      <div className="page-heading">
        <div>
          <h1>{order.workOrderNumber}</h1>
          <p className="lede">{order.title}</p>
        </div>
        <WorkOrderStatusBadge status={order.status} />
      </div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {actionError ? <p className="form-error">{actionError}</p> : null}
      <div className="row-actions">
        {canManage && (order.status === 'OPEN' || order.status === 'ASSIGNED') ? (
          <>
            <label>
              Technician
              <select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
                <option value="">Select</option>
                {technicians.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <button type="button" className="button button-primary" disabled={acting || !assignedToId} onClick={() => run(() => assignWorkOrder(id, assignedToId))}>Assign</button>
            <button type="button" className="button" disabled={acting} onClick={() => { setActionError(''); setConfirmCancel(true) }}>Cancel</button>
          </>
        ) : null}
        {canWork && order.status === 'ASSIGNED' ? (
          <button type="button" className="button button-primary" disabled={acting} onClick={() => run(() => startWorkOrder(id))}>Start</button>
        ) : null}
        {canWork && order.status === 'IN_PROGRESS' ? (
          <>
            <button type="button" className="button" disabled={acting} onClick={() => run(() => holdWorkOrder(id))}>Put on hold</button>
          </>
        ) : null}
        {canWork && order.status === 'ON_HOLD' ? (
          <button type="button" className="button button-primary" disabled={acting} onClick={() => run(() => resumeWorkOrder(id))}>Resume</button>
        ) : null}
        {canManage && order.status === 'ON_HOLD' ? (
          <button type="button" className="button" disabled={acting} onClick={() => { setActionError(''); setConfirmCancel(true) }}>Cancel</button>
        ) : null}
      </div>
      <h2>Work order information</h2>
      <dl className="facts facts-grid">
        <div><dt>Number</dt><dd>{order.workOrderNumber}</dd></div>
        <div><dt>Title</dt><dd>{order.title}</dd></div>
        <div><dt>Description</dt><dd>{order.description || '—'}</dd></div>
        <div><dt>Priority</dt><dd><SeverityBadge severity={order.priority} /></dd></div>
        <div><dt>Status</dt><dd><WorkOrderStatusBadge status={order.status} /></dd></div>
        <div><dt>Scheduled</dt><dd>{formatDateTime(order.scheduledAt)}</dd></div>
        <div><dt>Started</dt><dd>{formatDateTime(order.startedAt)}</dd></div>
        <div><dt>Completed</dt><dd>{formatDateTime(order.completedAt)}</dd></div>
        <div><dt>Completion notes</dt><dd>{order.completionNotes || '—'}</dd></div>
      </dl>
      <h2>Device</h2>
      <p>{order.device ? <Link to={`/devices/${order.device.id}`}>{order.device.name}</Link> : '—'} {order.device?.deviceCode ? `(${order.device.deviceCode})` : ''}</p>
      <h2>Location</h2>
      <dl className="facts facts-grid">
        <div><dt>Building</dt><dd>{building ? <Link to={`/buildings/${building.id}`}>{building.name}</Link> : '—'}</dd></div>
        <div><dt>Floor</dt><dd>{floor ? <Link to={`/floors/${floor.id}`}>{floor.name}</Link> : '—'}</dd></div>
        <div><dt>Zone</dt><dd>{zone ? <Link to={`/zones/${zone.id}`}>{zone.name}</Link> : '—'}</dd></div>
        <div><dt>Room</dt><dd>{room ? <Link to={`/rooms/${room.id}`}>{room.name}</Link> : '—'}</dd></div>
      </dl>
      <h2>Alarm</h2>
      {order.alarm ? (
        <p><Link to={`/alarms/${order.alarm.id}`}>{order.alarm.type}</Link> — {order.alarm.message}</p>
      ) : <p>This work order is not linked to an alarm.</p>}
      <h2>Technician</h2>
      <dl className="facts facts-grid">
        <div><dt>Assigned to</dt><dd>{order.assignedTo?.name || '—'}</dd></div>
        <div><dt>Created by</dt><dd>{order.createdBy?.name || '—'}</dd></div>
      </dl>
      <h2>Timeline</h2>
      {events.length === 0 ? <EmptyState message="No timeline events yet." /> : (
        <ol className="timeline">
          {events.map((event) => (
            <li key={`${event.label}-${event.at}-${event.detail || ''}`}>
              <strong>{event.label}</strong>
              <span>{formatDateTime(event.at)}</span>
              {event.detail ? <p>{event.detail}</p> : null}
            </li>
          ))}
        </ol>
      )}
      <h2>Maintenance activities</h2>
      {(order.activities || []).length === 0 ? <EmptyState message="No activities recorded." /> : (
        <DataTable
          rowKey={(item) => item.id}
          rows={order.activities}
          columns={[
            { key: 'when', header: 'Performed', render: (item) => formatDateTime(item.performedAt) },
            { key: 'who', header: 'Technician', render: (item) => item.performedBy?.name || '—' },
            { key: 'description', header: 'Description', render: (item) => item.description },
            { key: 'notes', header: 'Notes', render: (item) => item.notes || '—' },
            { key: 'cost', header: 'Cost', render: (item) => formatCost(item.cost) },
          ]}
        />
      )}
      {canWork && order.status === 'IN_PROGRESS' ? (
        <form className="stack-form" onSubmit={(event) => {
          event.preventDefault()
          run(async () => {
            const updated = await addWorkOrderActivity(id, {
              description: activity.description,
              notes: activity.notes || undefined,
              cost: activity.cost === '' ? undefined : activity.cost,
            })
            setActivity({ description: '', notes: '', cost: '' })
            return updated
          })
        }}
        >
          <h3>Add activity</h3>
          <FormField id="activity-description" label="Description">
            <input id="activity-description" value={activity.description} onChange={(event) => setActivity((current) => ({ ...current, description: event.target.value }))} required minLength={3} />
          </FormField>
          <FormField id="activity-notes" label="Notes">
            <textarea id="activity-notes" value={activity.notes} onChange={(event) => setActivity((current) => ({ ...current, notes: event.target.value }))} rows={2} />
          </FormField>
          <FormField id="activity-cost" label="Activity cost">
            <input id="activity-cost" inputMode="decimal" value={activity.cost} onChange={(event) => setActivity((current) => ({ ...current, cost: event.target.value }))} />
          </FormField>
          <button type="submit" className="button button-primary" disabled={acting}>Add activity</button>
        </form>
      ) : null}
      <h2>Costs</h2>
      <p className="lede">Activity costs are itemized work. Additional completion cost is recorded once at completion and is not a copy of those lines. Estimated cost is planning only.</p>
      <dl className="facts facts-grid">
        <div><dt>Estimated cost</dt><dd>{formatCost(costs.estimatedCost)}</dd></div>
        <div><dt>Activity costs</dt><dd>{formatCost(costs.activityCost)}</dd></div>
        <div><dt>Additional completion cost</dt><dd>{formatCost(costs.additionalCost)}</dd></div>
        <div><dt>Total cost</dt><dd>{formatCost(costs.totalCost)}</dd></div>
      </dl>
      {canWork && order.status === 'IN_PROGRESS' ? (
        <form className="stack-form" onSubmit={(event) => {
          event.preventDefault()
          run(() => completeWorkOrder(id, {
            completionNotes: completion.completionNotes,
            actualCost: completion.actualCost === '' ? undefined : completion.actualCost,
          }))
        }}
        >
          <h3>Complete work order</h3>
          <FormField id="completion-notes" label="Completion notes">
            <textarea id="completion-notes" value={completion.completionNotes} onChange={(event) => setCompletion((current) => ({ ...current, completionNotes: event.target.value }))} required minLength={3} rows={3} />
          </FormField>
          <FormField id="completion-cost" label="Additional completion cost">
            <input id="completion-cost" inputMode="decimal" value={completion.actualCost} onChange={(event) => setCompletion((current) => ({ ...current, actualCost: event.target.value }))} />
          </FormField>
          <button type="submit" className="button button-primary" disabled={acting}>Complete</button>
        </form>
      ) : null}
      {confirmCancel ? (
        <ConfirmDialog
          title="Cancel work order"
          message="Cancel this work order? The record stays in the history."
          confirmLabel="Cancel work order"
          busyLabel="Cancelling..."
          danger
          busy={acting}
          error={actionError}
          onCancel={() => { if (!acting) setConfirmCancel(false) }}
          onConfirm={() => run(() => cancelWorkOrder(id))}
        />
      ) : null}
    </section>
  )
}
