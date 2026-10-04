import { useEffect, useState } from 'react'
import FormField from '../common/FormField'
import { listBuildings } from '../../services/building.service'
import { listFloors } from '../../services/floor.service'
import { listRooms } from '../../services/room.service'
import { listZones } from '../../services/zone.service'
import { getErrorMessage } from '../../utils/errors'

function optionsFrom(items, label) {
  return (items || []).map((item) => ({ id: item.id, label: label(item) }))
}

export default function LocationSelector({ value, onChange, errors }) {
  const [buildings, setBuildings] = useState([])
  const [floors, setFloors] = useState([])
  const [zones, setZones] = useState([])
  const [rooms, setRooms] = useState([])
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

  function chooseBuilding(buildingId) {
    setFloors([])
    setZones([])
    setRooms([])
    onChange({ buildingId, floorId: '', zoneId: '', roomId: '' })
  }

  function chooseFloor(floorId) {
    setZones([])
    setRooms([])
    onChange({ ...value, floorId, zoneId: '', roomId: '' })
  }

  function chooseZone(zoneId) {
    setRooms([])
    onChange({ ...value, zoneId, roomId: '' })
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
        <select id="device-room" value={value.roomId} onChange={(event) => onChange({ ...value, roomId: event.target.value })} disabled={!value.zoneId}>
          <option value="">Select a room</option>
          {optionsFrom(rooms, (room) => `${room.name} (${room.roomNumber})`).map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </FormField>
    </>
  )
}
