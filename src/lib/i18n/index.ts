import { derived } from 'svelte/store';
import { settings } from '$lib/stores/settings';
import { en } from './en';
import { th } from './th';

export const t = derived(settings, ($s) => $s.lang === 'th' ? th : en);
