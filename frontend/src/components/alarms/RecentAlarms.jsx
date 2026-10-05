import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../common/DataTable'
import EmptyState from '../common/EmptyState'
import ErrorState from '../common/ErrorState'
import { AlarmStatusBadge, SeverityBadge } from '../common/StatusBadge'
import { REALTIME_EVENTS, deviceRoom, sensorRoom } from '../../constants/realtime'
import { useSocket } from '../../hooks/useSocket'
import { listAlarms } from '../../services/alarm.service'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

export default function RecentAlarms({ deviceId, sensorId, title = 'Recent alarms', refreshKey = 0 }) {
  const { listen, revision, subscribe } = useSocket()
  const [alarms, setAlarms] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    listAlarms({ deviceId, sensorId, page: 1, limit: 5 })
      .then((result) => {
        if (!ignore) {
          setAlarms(result.items)
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
  }, [deviceId, sensorId, refreshKey, revision])

  useEffect(() => {
    const room = sensorId ? sensorRoom(sensorId) : deviceId ? deviceRoom(deviceId) : null
    if (!room) return undefined
    return subscribe([room])
  }, [deviceId, sensorId, subscribe])

  useEffect(() => {
    function relevant(alarm) {
      if (sensorId) return alarm.sensorId === sensorId
      if (deviceId) return alarm.deviceId === deviceId
      return false
    }

    function insert(alarm) {
      if (!relevant(alarm)) return
      setAlarms((current) => [alarm, ...current.filter((item) => item.id !== alarm.id)].slice(0, 5))
    }

    function update(alarm) {
      if (!relevant(alarm)) return
      setAlarms((current) => current.map((item) => (item.id === alarm.id ? { ...item, ...alarm } : item)))
    }

    const offCreated = listen(REALTIME_EVENTS.ALARM_CREATED, insert)
    const offAcknowledged = listen(REALTIME_EVENTS.ALARM_ACKNOWLEDGED, update)
    const offResolved = listen(REALTIME_EVENTS.ALARM_RESOLVED, update)
    return () => {
      offCreated()
      offAcknowledged()
      offResolved()
    }
  }, [deviceId, listen, sensorId])

  const emptyMessage = sensorId
    ? 'No alarms recorded for this sensor.'
    : 'No alarms recorded for this device.'

  return (
    <section>
      <h2>{title}</h2>
      {error ? <ErrorState message={error} /> : null}
      {loading && !error ? <p>Loading alarms...</p> : null}
      {!loading && !error && alarms.length === 0 ? <EmptyState message={emptyMessage} /> : null}
      {alarms.length > 0 ? (
        <DataTable
          rowKey={(alarm) => alarm.id}
          rows={alarms}
          columns={[
            { key: 'severity', header: 'Severity', render: (alarm) => <SeverityBadge severity={alarm.severity} /> },
            { key: 'type', header: 'Type', render: (alarm) => alarm.type },
            { key: 'status', header: 'Status', render: (alarm) => <AlarmStatusBadge status={alarm.status} /> },
            { key: 'message', header: 'Message', render: (alarm) => alarm.message },
            { key: 'time', header: 'Triggered at', render: (alarm) => formatDateTime(alarm.triggeredAt) },
            {
              key: 'actions',
              header: 'Actions',
              render: (alarm) => <Link className="button button-quiet" to={`/alarms/${alarm.id}`}>View alarm</Link>,
            },
          ]}
        />
      ) : null}
    </section>
  )
}
