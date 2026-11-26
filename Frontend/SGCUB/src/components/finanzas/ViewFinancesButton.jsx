import { useNavigate } from 'react-router-dom'
import { SecondaryButton } from '../personas/tabs/parts'
import { useFinancesVisible } from './visibleFinances'

const financesPath = (socio) => (socio.jugador_id
  ? `/padron/jugadores/${socio.jugador_id}?tab=financiero`
  : `/padron/socios/${socio.socio_id}?tab=financiero`)

function ViewFinancesButton({ socio, onNavigate = null }) {
  const navigate = useNavigate()
  const alreadyVisible = useFinancesVisible(socio?.socio_id)
  if (!socio?.socio_id || alreadyVisible) return null

  const viewFinances = () => {
    onNavigate?.()
    navigate(financesPath(socio))
  }

  return (
    <SecondaryButton icon="account_balance_wallet" onClick={viewFinances}>
      Ver estado financiero
    </SecondaryButton>
  )
}

export default ViewFinancesButton
