'use client'

import type { ResidentProfile, SignupPromptKey } from '@/lib/types'
import { movedInYearOptions, TEXT_PROMPTS } from '@/lib/residentProfile'

const inputClass =
  'w-full border border-border rounded-xl px-4 py-2.5 text-base bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent'

/** The optional sign-up prompts — shared by registration (ResidentIntakeForm) and My info.
 * `hidden` lists prompts the steward turned off (see Block.hiddenSignupPrompts). */
export default function ResidentProfileFields({
  profile,
  onChange,
  hidden = [],
}: {
  profile: ResidentProfile
  onChange: (profile: ResidentProfile) => void
  hidden?: SignupPromptKey[]
}) {
  return (
    <>
      {!hidden.includes('movedInYear') && (
        <div>
          <label className="block text-base font-medium text-ink mb-1.5">Year you moved in</label>
          <select
            value={profile.movedInYear ?? ''}
            onChange={(e) => onChange({ ...profile, movedInYear: e.target.value ? Number(e.target.value) : null })}
            className="border border-border rounded-xl px-3 py-2.5 text-base bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">—</option>
            {movedInYearOptions().map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      )}
      {TEXT_PROMPTS.filter(({ key }) => !hidden.includes(key)).map(({ key, label, placeholder, max }) => (
        <div key={key}>
          <label className="block text-base font-medium text-ink mb-1.5">{label}</label>
          <input
            type="text"
            value={profile[key] ?? ''}
            onChange={(e) => onChange({ ...profile, [key]: e.target.value })}
            maxLength={max}
            placeholder={placeholder}
            className={inputClass}
          />
        </div>
      ))}
    </>
  )
}
