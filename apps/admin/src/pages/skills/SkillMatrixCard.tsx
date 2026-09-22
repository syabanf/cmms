import type { SkillLevel } from '@cmms/types'
import { SKILL_LEVEL_LABEL } from '@cmms/types'
import { ActionMenu, Avatar, Badge, Card, CardDescription, CardHeader, CardTitle, cn, toast } from '@cmms/ui'
import { Link } from 'react-router'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { SKILL_LEVELS } from '../technicians/lib'
import { type Coverage, LEVEL_CELL, MIN_COVERAGE, type MatrixRow } from './lib'

function LevelChip({ level, className }: { level: SkillLevel; className?: string }) {
  return (
    <span
      className={cn(
        'h-8 w-11 rounded-xl text-xs font-bold inline-flex items-center justify-center tabular-nums',
        LEVEL_CELL[level],
        className,
      )}
    >
      L{level}
    </span>
  )
}

function LevelCell({
  row,
  skillId,
  skillName,
  canEdit,
}: {
  row: MatrixRow
  skillId: string
  skillName: string
  canEdit: boolean
}) {
  const { dispatch } = useScoped()
  const level = row.profile.skills[skillId] ?? 0
  const label = `${row.person.name}, ${skillName}: ${SKILL_LEVEL_LABEL[level]}`
  if (!canEdit) {
    return (
      <span role="img" aria-label={label} title={label}>
        <LevelChip level={level} />
      </span>
    )
  }
  return (
    <ActionMenu
      title={`${row.person.name} · ${skillName}`}
      align="center"
      trigger={
        <button
          type="button"
          aria-label={`${label}. Change level`}
          className="rounded-xl transition-shadow hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
        >
          <LevelChip level={level} />
        </button>
      }
      items={SKILL_LEVELS.map((l) => ({
        key: String(l),
        label: SKILL_LEVEL_LABEL[l],
        icon: <span className={cn('size-4 rounded-md', LEVEL_CELL[l])} />,
        description: l === level ? 'Current level' : undefined,
        disabled: l === level,
        onSelect: () => {
          dispatch({ type: 'people/setSkill', id: row.person.id, skillId, level: l })
          toast(`${row.person.name}: ${skillName} ${l ? `L${l}` : 'cleared'}`, { tone: 'success' })
        },
      }))}
    />
  )
}

function CoverageCell({ coverage }: { coverage: Coverage }) {
  const count = coverage.qualified.length
  return (
    <div className="gap-1 flex flex-col items-center">
      <span className="text-base font-extrabold tabular-nums">{count}</span>
      {count < MIN_COVERAGE ? (
        <Badge variant="warning">{count === 0 ? 'Nobody' : 'Only one'}</Badge>
      ) : (
        coverage.onLeave.length > 0 && (
          <span className="text-[11px] whitespace-nowrap text-muted">{coverage.onLeave.length} on leave</span>
        )
      )}
    </div>
  )
}

const stickyCell = 'sticky left-0 z-10 bg-card'
const cellBorder = 'border-b border-border'

export function SkillMatrixCard({
  rows,
  coverage,
  canEdit,
}: {
  rows: MatrixRow[]
  coverage: Coverage[]
  canEdit: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Levels by technician</CardTitle>
        <CardDescription>
          {canEdit ? 'Select a level to change it.' : 'Supervisors and managers set levels on each profile.'}{' '}
          The footer counts people at L2 or higher.
        </CardDescription>
        <ul
          aria-label="Legend"
          className="mt-2 gap-x-3 gap-y-1.5 text-xs flex flex-wrap items-center text-muted"
        >
          {[...SKILL_LEVELS].reverse().map((l) => (
            <li key={l} className="gap-1.5 inline-flex items-center">
              <span aria-hidden="true" className={cn('size-3.5 rounded-[5px]', LEVEL_CELL[l])} />
              {SKILL_LEVEL_LABEL[l]}
            </li>
          ))}
        </ul>
      </CardHeader>

      {/* Wide by nature: the matrix scrolls inside the card on narrow screens and the name column stays put. */}
      <div className="relative overflow-x-auto">
        <table className="border-spacing-0 text-sm w-full border-separate">
          <thead>
            <tr>
              <th
                scope="col"
                className={cn(
                  stickyCell,
                  cellBorder,
                  'min-w-44 px-5 py-3 text-xs font-semibold text-left text-muted',
                )}
              >
                Technician
              </th>
              {coverage.map(({ skill }) => (
                <th
                  key={skill.id}
                  scope="col"
                  className={cn(
                    cellBorder,
                    'px-2 py-3 text-xs font-semibold text-center whitespace-nowrap text-muted',
                  )}
                >
                  {skill.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.person.id}>
                <th
                  scope="row"
                  className={cn(stickyCell, cellBorder, 'max-w-56 px-5 py-2.5 font-normal text-left')}
                >
                  <Link
                    to={paths.technician(row.person.id)}
                    className="min-w-0 gap-2.5 flex items-center hover:text-accent"
                  >
                    <Avatar name={row.person.name} color={row.person.color} size="sm" />
                    <span className="min-w-0">
                      <span className="font-semibold block truncate">{row.person.name}</span>
                      <span className="text-xs block truncate text-muted">
                        {row.teamName}
                        {row.profile.availability === 'leave' && ' · on leave'}
                      </span>
                    </span>
                  </Link>
                </th>
                {coverage.map(({ skill }) => (
                  <td key={skill.id} className={cn(cellBorder, 'px-2 py-2.5 text-center')}>
                    <LevelCell row={row} skillId={skill.id} skillName={skill.name} canEdit={canEdit} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                className={cn(stickyCell, 'px-5 py-3 text-xs font-semibold text-left text-muted')}
              >
                At L2 or higher
              </th>
              {coverage.map((c) => (
                <td key={c.skill.id} className="px-2 py-3 text-center align-top">
                  <CoverageCell coverage={c} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
