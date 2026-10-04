import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Breadcrumbs from '../../components/common/Breadcrumbs'
import ErrorState from '../../components/common/ErrorState'
import LoadingState from '../../components/common/LoadingState'
import { getFloor } from '../../services/floor.service'
import { getRoom } from '../../services/room.service'
import { getErrorMessage } from '../../utils/errors'

export default function RoomDetailsPage() {
  const { id } = useParams()
  const [room, setRoom] = useState(null)
  const [floor, setFloor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    getRoom(id)
      .then(async (roomData) => {
        const floorData = await getFloor(roomData.zone.floorId)
        if (!ignore) {
          setRoom(roomData)
          setFloor(floorData)
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
  }, [id])

  if (loading) return <LoadingState message="Loading room..." />
  if (error || !room || !floor) return <ErrorState message={error || 'The requested information could not be found.'} />

  return (
    <section>
      <Breadcrumbs
        items={[
          { label: 'Buildings', to: '/buildings' },
          { label: floor.building.name, to: `/buildings/${floor.building.id}` },
          { label: floor.name, to: `/floors/${floor.id}` },
          { label: room.zone.name, to: `/zones/${room.zone.id}` },
          { label: room.name },
        ]}
      />
      <h1>{room.name}</h1>
      <dl className="facts facts-grid">
        <div><dt>Room number</dt><dd>{room.roomNumber}</dd></div>
        <div><dt>Zone</dt><dd>{room.zone.name}</dd></div>
        <div><dt>Floor</dt><dd>{floor.name}</dd></div>
        <div><dt>Building</dt><dd>{floor.building.name}</dd></div>
      </dl>
      {room.description ? <p>{room.description}</p> : <p>No description.</p>}
    </section>
  )
}
