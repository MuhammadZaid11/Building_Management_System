import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EnergyTrendChart from './EnergyTrendChart'
import DataTable from '../common/DataTable'
import ErrorState from '../common/ErrorState'
import { REALTIME_EVENTS } from '../../constants/realtime'
import { useSocket } from '../../hooks/useSocket'
import { getDeviceEnergy } from '../../services/energy.service'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime, formatKwh, formatKw, formatMoney } from '../../utils/format'

export default function EnergyDevicePanel({ deviceId, sensorId }) {
  const { listen, revision } = useSocket()
  const [energy, setEnergy] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    getDeviceEnergy(deviceId, { sensorId })
      .then((data) => {
        if (!ignore) {
          setEnergy(data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setEnergy(null)
          const code = requestError.response?.data?.error?.code
          setError(code === 'ENERGY_DATA_NOT_AVAILABLE' ? '' : getErrorMessage(requestError))
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [deviceId, sensorId, revision])

  useEffect(() => listen(REALTIME_EVENTS.READING_CREATED, (reading) => {
    if (reading.deviceId !== deviceId) return
    if (sensorId && reading.sensorId !== sensorId) return
    setEnergy((current) => {
      if (!current) return current
      const sensor = current.sensors.find((item) => item.id === reading.sensorId)
      if (!sensor) return current
      const nextSensors = current.sensors.map((item) => (
        item.id === reading.sensorId
          ? { ...item, latestValue: reading.value, recordedAt: reading.recordedAt }
          : item
      ))
      if ((reading.unit === 'kWh' || reading.unit === 'Wh') && current.source === 'MEASURED') {
        const nextKwh = Number(reading.unit === 'Wh' ? reading.value / 1000 : reading.value)
        const previousKwh = Number(sensor.unit === 'Wh' ? sensor.latestValue / 1000 : sensor.latestValue)
        if (Number.isFinite(nextKwh) && Number.isFinite(previousKwh) && nextKwh + 0.0001 < previousKwh) {
          return { ...current, sensors: nextSensors, meterResetDetected: true }
        }
        if (Number.isFinite(nextKwh) && Number.isFinite(previousKwh) && nextKwh >= previousKwh) {
          const delta = nextKwh - previousKwh
          const consumptionKwh = Math.round(((Number(current.consumptionKwh) || 0) + delta) * 10000) / 10000
          return {
            ...current,
            sensors: nextSensors,
            consumptionKwh,
            estimatedCost: Math.round(consumptionKwh * Number(current.ratePerKwh || 0) * 100) / 100,
          }
        }
      }
      if (reading.unit === 'kW' || reading.unit === 'W') {
        const powerSensors = nextSensors.filter((item) => item.sensorType === 'POWER')
        if (powerSensors.length === 1) {
          return {
            ...current,
            sensors: nextSensors,
            currentPowerKw: Number(reading.unit === 'W' ? reading.value / 1000 : reading.value),
          }
        }
      }
      return { ...current, sensors: nextSensors }
    })
  }), [deviceId, listen, sensorId])

  if (loading) return <p>Loading energy overview...</p>
  if (error) return <ErrorState message={error} />
  if (!energy) return null

  const title = sensorId ? 'Energy statistics' : 'Energy overview'
  const measured = energy.source === 'MEASURED'
  const estimated = energy.source === 'ESTIMATED'

  return (
    <section>
      <h2>{title}</h2>
      {energy.meterResetDetected ? <p className="notice">A meter reset was detected. The drop was excluded from consumption.</p> : null}
      <dl className="facts facts-grid">
        <div><dt>{measured ? 'Consumption' : 'Estimated consumption'}</dt><dd>{formatKwh(energy.consumptionKwh)}</dd></div>
        <div><dt>Estimated cost</dt><dd>{formatMoney(energy.estimatedCost, energy.currency)}</dd></div>
        <div><dt>Rate</dt><dd>{formatMoney(energy.ratePerKwh, energy.currency)}/kWh</dd></div>
        <div><dt>Current power</dt><dd>{formatKw(energy.currentPowerKw)}</dd></div>
      </dl>
      <p className="lede">
        {measured
          ? 'Consumption is the increase in the cumulative meter during this period. Estimated cost is not a utility bill.'
          : 'This figure is estimated from power samples using trapezoidal intervals. It is not measured energy.'}
      </p>
      {estimated ? <p>The reading chart shows instantaneous power, not energy consumption.</p> : null}
      <EnergyTrendChart points={energy.trend} source={energy.source} />
      <DataTable
        rowKey={(sensor) => sensor.id}
        rows={energy.sensors}
        columns={[
          { key: 'name', header: 'Sensor', render: (sensor) => <Link to={`/sensors/${sensor.id}`}>{sensor.name}</Link> },
          { key: 'type', header: 'Type', render: (sensor) => sensor.sensorType },
          { key: 'latest', header: 'Latest reading', render: (sensor) => (sensor.latestValue === null ? '—' : `${sensor.latestValue} ${sensor.unit}`) },
          { key: 'time', header: 'Recorded', render: (sensor) => formatDateTime(sensor.recordedAt) },
        ]}
      />
    </section>
  )
}
