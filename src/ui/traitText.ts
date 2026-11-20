import { traitDef } from '../core/traits';
import { getLang } from '../i18n/i18n';

/** A trait's name and its effect in life, in the current language. */
export const traitName = (id: string): string => traitDef(id).name[getLang()];
export const traitLife = (id: string): string => traitDef(id).life[getLang()];
