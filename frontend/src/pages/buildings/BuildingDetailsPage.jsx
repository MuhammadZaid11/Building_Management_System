import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumbs from '../../components/common/Breadcrumbs'
import ErrorState from '../../components/common/ErrorState'
import LoadingState from '../../components/common/LoadingState'
import StatusBadge from '../../components/common/StatusBadge'
import { getBuilding } from '../../services/building.service'
import { getErrorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/format'

function summarize(building) {
  const floors = building.floors || []
  const zones = floors.reduce((sum, floor) => sum + (floor.zones?.length || 0), 0)
  const rooms = floors.reduce(
    (sum, floor) => sum + (floor.zones || []).reduce((zoneSum, zone) => zoneSum + (zone.rooms?.length || 0), 0),
    0,
  )

  return { floors: floors.length, zones, rooms }
}

export default function BuildingDetailsPage() {
  const { id } = useParams()
  const [building, setBuilding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    getBuilding(id)
      .then((data) => {
        if (!ignore) {
          setBuilding(data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setBuilding(null)
          setError(getErrorMessage(requestError))
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [id])

  if (loading) return <LoadingState message="Loading building..." />
  if (error || !building) return <ErrorState message={error || 'The requested information could not be found.'} />

  const counts = summarize(building)

  return (
    <section>
      <Breadcrumbs items={[{ label: 'Buildings', to: '/buildings' }, { label: building.name }]} />
      <div className="page-heading">
        <div>
          <h1>{building.name}</h1>
          <p className="lede">{building.address}</p>
        </div>
        <Link className="button button-primary" to={`/buildings/${building.id}/floors`}>Manage floors</Link>
      </div>
      <dl className="facts facts-grid">
        <div><dt>Code</dt><dd>{building.code}</dd></div>
        <div><dt>Status</dt><dd><StatusBadge status={building.status} /></dd></div>
        <div><dt>Floors</dt><dd>{counts.floors}</dd></div>
        <div><dt>Zones</dt><dd>{counts.zones}</dd></div>
        <div><dt>Rooms</dt><dd>{counts.rooms}</dd></div>
        <div><dt>Created</dt><dd>{formatDate(building.createdAt)}</dd></div>
      </dl>
      {building.description ? <p>{building.description}</p> : null}
      <section className="panel">
        <h2>Floors</h2>
        {building.floors.length === 0 ? <p>No floors found.</p> : (
          <ul className="link-list">
            {building.floors.map((floor) => (
              <li key={floor.id}>
                <Link to={`/floors/${floor.id}`}>{floor.name}</Link>
                <span>Floor {floor.floorNumber}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
