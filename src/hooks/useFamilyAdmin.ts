import { t } from '../i18n'
import type { Store } from '../store/store'
import type { Household } from '../types'
import type { Flash } from './useToast'

/** The admin's household tools (Family and invites): each change reloads so everyone's view matches. */
export function useFamilyAdmin(store: Store, reload: () => Promise<void>, flash: Flash) {
  return {
    onAddHousehold: async (name) => {
      try {
        const { code } = await store.addHousehold(name)
        await reload()
        flash(t('{name} created. Send them the invite.', { name }))
        return code
      } catch (e) {
        flash((e as Error).message || t("Couldn't create it. Check your connection."))
        return null
      }
    },
    onUpdateHousehold: async (h) => {
      try {
        await store.updateHousehold(h)
        await reload()
      } catch (e) {
        flash((e as Error).message || t("Couldn't save that. Check your connection."))
      }
    },
    onMovePerson: async (personId, householdId) => {
      try {
        await store.movePerson(personId, householdId)
        await reload()
        flash(t('Moved'))
      } catch (e) {
        flash((e as Error).message || t("Couldn't move them. Check your connection."))
      }
    },
    onAddPerson: async (name, householdId) => {
      try {
        await store.addPerson(name, householdId)
        await reload()
        flash(t('{name} added', { name }))
      } catch (e) {
        flash((e as Error).message || t("Couldn't add them. Check your connection."))
      }
    },
    householdCode: (id) => store.householdCode(id),
  } satisfies {
    onAddHousehold: (name: string) => Promise<string | null>
    onUpdateHousehold: (h: Household) => Promise<void>
    onMovePerson: (personId: string, householdId: string | null) => Promise<void>
    onAddPerson: (name: string, householdId: string | null) => Promise<void>
    householdCode: (id: string) => Promise<string | null>
  }
}
