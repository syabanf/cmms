import { ROLE_LABEL, SHIFT_LABEL, SKILL_LEVEL_LABEL } from '@cmms/types'
import { Avatar, Badge, Button, KeyValue, Sheet, SheetContent, SheetDescription, SheetTitle } from '@cmms/ui'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/auth'
import { useMobileScope } from '../state/scope'

export function ProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, site, maps } = useMobileScope()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const tech = user.technician
  const skills = tech
    ? Object.entries(tech.skills)
        .filter(([, level]) => level > 0)
        .sort((a, b) => b[1] - a[1])
    : []

  const leave = () => {
    onOpenChange(false)
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <div className="flex flex-col items-center px-5 pt-4 text-center">
          <Avatar name={user.name} color={user.color} size="xl" ring />
          <SheetTitle className="mt-3 text-xl font-bold">{user.name}</SheetTitle>
          <SheetDescription>{user.title}</SheetDescription>
        </div>
        <KeyValue
          bare
          className="mx-5 mt-4"
          items={[
            { label: 'Role', value: ROLE_LABEL[user.role] },
            { label: 'Team', value: tech ? (maps.team.get(tech.teamId)?.name ?? 'No team') : '', hidden: !tech },
            { label: 'Shift', value: tech ? SHIFT_LABEL[tech.shift] : '', hidden: !tech },
            {
              label: 'Skills',
              hidden: !skills.length,
              value: (
                <span className="flex flex-wrap gap-1.5">
                  {skills.map(([skillId, level]) => (
                    <Badge key={skillId} title={SKILL_LEVEL_LABEL[level]}>
                      {maps.skill.get(skillId)?.name ?? skillId}
                      <span className="text-muted">L{level}</span>
                    </Badge>
                  ))}
                </span>
              ),
            },
            { label: 'Site', value: `${site.name} · ${site.city}` },
          ]}
        />
        <div className="px-5 pt-4">
          <Button variant="outline" size="lg" className="w-full" onClick={leave}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
