import { useMobileScope } from '../../state/scope'
import { RequesterHome } from './RequesterHome'
import { TechnicianHome } from './TechnicianHome'

export function HomePage() {
  const { isTechnician } = useMobileScope()
  return isTechnician ? <TechnicianHome /> : <RequesterHome />
}
