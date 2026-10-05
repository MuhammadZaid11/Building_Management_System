import { useEffect, useState } from 'react'
import FormField from '../common/FormField'
import { listBuildings } from '../../services/building.service'
import { listDevices } from '../../services/device.service'
import { listFloors } from '../../services/floor.service'
import { listRooms } from '../../services/room.service'
import { listZones } from '../../services/zone.service'
import { getErrorMessage } from '../../utils/errors'

function optionsFrom(items, label) {
  return (items || []).map((item) => ({ id: item.id, label: label(item) }))
}

export default function LocationSelector({ value, onChange, errors, withDevice = false }) {
  const [buildings, setBuildings] = useState([])
  const [floors, setFloors] = useState([])
  const [zones, setZones] = useState([])
  const [rooms, setRooms] = useState([])
  const [devices, setDevices] = useState([])
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let ignore = false
    listBuildings({ page: 1, limit: 100 })
      .then((result) => {
        if (!ignore) setBuildings(result.items)
      })
      .catch((error) => {
        if (!ignore) setLoadError(getErrorMessage(error))
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    if (!value.buildingId) {
      return undefined
    }
    listFloors({ buildingId: value.buildingId, page: 1, limit: 100 })
      .then((result) => {
        if (!ignore) setFloors(result.items)
      })
      .catch((error) => {
        if (!ignore) setLoadError(getErrorMessage(error))
      })
    return () => {
      ignore = true
    }
  }, [value.buildingId])

  useEffect(() => {
    let ignore = false
    if (!value.floorId) {
      return undefined
    }
    listZones({ floorId: value.floorId, page: 1, limit: 100 })
      .then((result) => {
        if (!ignore) setZones(result.items)
      })
      .catch((error) => {
        if (!ignore) setLoadError(getErrorMessage(error))
      })
    return () => {
      ignore = true
    }
  }, [value.floorId])

  useEffect(() => {
    let ignore = false
    if (!value.zoneId) {
      return undefined
    }
    listRooms({ zoneId: value.zoneId, page: 1, limit: 100 })
      .then((result) => {
        if (!ignore) setRooms(result.items)
      })
      .catch((error) => {
        if (!ignore) setLoadError(getErrorMessage(error))
      })
    return () => {
      ignore = true
    }
  }, [value.zoneId])

  useEffect(() => {
    if (!withDevice) {
      return undefined
    }

    let ignore = false

    if (!value.roomId) {
      return undefined
    }

    listDevices({ roomId: value.roomId, page: 1, limit: 100 })
      .then((result) => {
        if (!ignore) setDevices(result.items)
      })
      .catch((error) => {
        if (!ignore) setLoadError(getErrorMessage(error))
      })

    return () => {
      ignore = true
    }
  }, [withDevice, value.roomId])

  function clearedDevice() {
    return withDevice ? { deviceId: '' } : {}
  }

  function chooseBuilding(buildingId) {
    setFloors([])
    setZones([])
    setRooms([])
    setDevices([])
    onChange({ buildingId, floorId: '', zoneId: '', roomId: '', ...clearedDevice() })
  }

  function chooseFloor(floorId) {
    setZones([])
    setRooms([])
    setDevices([])
    onChange({ ...value, floorId, zoneId: '', roomId: '', ...clearedDevice() })
  }

  function chooseZone(zoneId) {
    setRooms([])
    setDevices([])
    onChange({ ...value, zoneId, roomId: '', ...clearedDevice() })
  }

  function chooseRoom(roomId) {
    setDevices([])
    onChange({ ...value, roomId, ...clearedDevice() })
  }

  return (
    <>
      {loadError ? <p className="form-error" role="alert">{loadError}</p> : null}
      <FormField id="device-building" label="Building">
        <select id="device-building" value={value.buildingId} onChange={(event) => chooseBuilding(event.target.value)}>
          <option value="">Select a building</option>
          {optionsFrom(buildings, (building) => building.name).map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </FormField>
      <FormField id="device-floor" label="Floor">
        <select id="device-floor" value={value.floorId} onChange={(event) => chooseFloor(event.target.value)} disabled={!value.buildingId}>
          <option value="">Select a floor</option>
          {optionsFrom(floors, (floor) => floor.name).map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </FormField>
      <FormField id="device-zone" label="Zone">
        <select id="device-zone" value={value.zoneId} onChange={(event) => chooseZone(event.target.value)} disabled={!value.floorId}>
          <option value="">Select a zone</option>
          {optionsFrom(zones, (zone) => zone.name).map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </FormField>
      <FormField id="device-room" label="Room" error={errors.roomId}>
        <select id="device-room" value={value.roomId} onChange={(event) => chooseRoom(event.target.value)} disabled={!value.zoneId}>
          <option value="">Select a room</option>
          {optionsFrom(rooms, (room) => `${room.name} (${room.roomNumber})`).map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </FormField>
      {withDevice ? (
        <FormField id="location-device" label="Device" error={errors.deviceId}>
          <select
            id="location-device"
            value={value.deviceId || ''}
            onChange={(event) => onChange({ ...value, deviceId: event.target.value })}
            disabled={!value.roomId}
          >
            <option value="">Select a device</option>
            {optionsFrom(devices, (device) => `${device.name} (${device.deviceCode})`).map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </FormField>
      ) : null}
    </>
  )
}
