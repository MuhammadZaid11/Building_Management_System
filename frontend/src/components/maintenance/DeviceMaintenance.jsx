import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../common/DataTable'
import EmptyState from '../common/EmptyState'
import { DueStateBadge, WorkOrderStatusBadge } from '../common/StatusBadge'
import { MAINTENANCE_REALTIME_EVENTS, deviceRoom } from '../../constants/realtime'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { listSchedules, listWorkOrders } from '../../services/maintenance.service'
import { canManageMaintenance } from '../../utils/access'
import { formatCost, formatDateTime } from '../../utils/format'

export default function DeviceMaintenance({ deviceId }) {
  const { user } = useAuth()
  const { listen, revision, subscribe } = useSocket()
  const [orders, setOrders] = useState([])
  const [schedules, setSchedules] = useState([])
  const [error, setError] = useState('')

  useEffect(() => subscribe([deviceRoom(deviceId)]), [deviceId, subscribe])

  useEffect(() => {
    let ignore = false
    Promise.all([
      listWorkOrders({ deviceId, page: 1, limit: 20 }),
      listSchedules({ deviceId, page: 1, limit: 20 }),
    ])
      .then(([orderResult, scheduleResult]) => {
        if (ignore) return
        setOrders(orderResult.items)
        setSchedules(scheduleResult.items)
        setError('')
      })
      .catch(() => {
        if (!ignore) setError('Maintenance information could not be loaded.')
      })
    return () => {
      ignore = true
    }
  }, [deviceId, revision])

  useEffect(() => {
    const stops = MAINTENANCE_REALTIME_EVENTS.map((eventName) => listen(eventName, (event) => {
      if (event.deviceId !== deviceId) return
      setOrders((current) => current.map((order) => (
        order.id === event.workOrderId ? { ...order, status: event.status, priority: event.priority } : order
      )))
    }))
    return () => stops.forEach((stop) => stop())
  }, [deviceId, listen])

  const active = orders.filter((order) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED')
  const history = orders.filter((order) => order.status === 'COMPLETED' || order.status === 'CANCELLED')

  return (
    <section>
      <div className="page-heading">
        <h2>Maintenance</h2>
        {canManageMaintenance(user) ? (
          <Link className="button button-primary" to={`/maintenance?create=1&deviceId=${deviceId}`}>Create work order</Link>
        ) : null}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <h3>Active work orders</h3>
      {active.length === 0 ? <EmptyState message="No active work orders for this device." /> : (
        <DataTable
          rowKey={(order) => order.id}
          rows={active}
          columns={[
            { key: 'number', header: 'Work order', render: (order) => <Link to={`/maintenance/work-orders/${order.id}`}>{order.workOrderNumber}</Link> },
            { key: 'title', header: 'Title', render: (order) => order.title },
            { key: 'status', header: 'Status', render: (order) => <WorkOrderStatusBadge status={order.status} /> },
            { key: 'technician', header: 'Technician', render: (order) => order.assignedTo?.name || '—' },
          ]}
        />
      )}
      <h3>Upcoming maintenance</h3>
      {schedules.length === 0 ? <EmptyState message="No preventive schedules for this device." /> : (
        <DataTable
          rowKey={(schedule) => schedule.id}
          rows={schedules}
          columns={[
            { key: 'title', header: 'Schedule', render: (schedule) => schedule.title },
            { key: 'frequency', header: 'Frequency', render: (schedule) => schedule.frequency },
            { key: 'due', header: 'Next due', render: (schedule) => formatDateTime(schedule.nextDueAt) },
            { key: 'state', header: 'Status', render: (schedule) => <DueStateBadge status={schedule.dueState} /> },
          ]}
        />
      )}
      <h3>Maintenance history</h3>
      {history.length === 0 ? <EmptyState message="No completed or cancelled work orders yet." /> : (
        <DataTable
          rowKey={(order) => order.id}
          rows={history}
          columns={[
            { key: 'number', header: 'Work order', render: (order) => <Link to={`/maintenance/work-orders/${order.id}`}>{order.workOrderNumber}</Link> },
            { key: 'date', header: 'Date', render: (order) => formatDateTime(order.completedAt || order.cancelledAt || order.createdAt) },
            { key: 'technician', header: 'Technician', render: (order) => order.assignedTo?.name || '—' },
            { key: 'title', header: 'Description', render: (order) => order.title },
            { key: 'cost', header: 'Cost', render: (order) => formatCost(order.actualCost) },
            { key: 'status', header: 'Status', render: (order) => <WorkOrderStatusBadge status={order.status} /> },
          ]}
        />
      )}
    </section>
  )
}
